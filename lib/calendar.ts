// lib/calendar.ts
// Calendar event export via .ics file handoff to the OS share sheet.
//
// The immediate use case is one-way: a contractor taps "Add to Calendar" on
// a quote or contract, we generate an .ics file with the work dates, and
// the OS opens Apple Calendar / Google Calendar / Outlook pre-filled with
// the event. One more tap and the job is on their personal calendar.
//
// The longer arc (v1.4+ candidate): read the contractor's calendar with
// their permission and warn them before committing to a date that already
// has their kid's soccer game on it. No other quoting tool in the trades
// respects the fact that contractors are people with lives outside work,
// so this is a real positioning bet. This module is named generically and
// its exported surface is CalendarEvent-shaped (not file-shaped) so future
// read functions like checkAvailability(range) can join here cleanly.
//
// Implementation mirrors lib/spreadsheet.ts's file-write → share → cleanup
// pattern. No new deps — expo-file-system + expo-sharing were already in
// package.json for PDF/CSV exports. NSCalendarsUsageDescription is NOT
// required for the .ics-handoff path (Apple Calendar receives the file
// through the share sheet, no direct-write permission needed).

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Quote, Contract } from './types';
import { calculateQuoteTotal } from './calculations';

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  /** ISO 8601 date or datetime. */
  startDate: string;
  /** ISO 8601 date or datetime. If omitted, single-day event on startDate. */
  endDate?: string;
  /** Default true — contractors block whole days, not hours. */
  allDay?: boolean;
}

/**
 * Convert an ISO 8601 date to the .ics VALUE=DATE format (YYYYMMDD) for
 * all-day events. Uses UTC parts so a date entered "2026-07-15" in any
 * timezone still lands as July 15.
 */
function toIcsAllDay(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** UTC datetime format for timed events: YYYYMMDDTHHMMSSZ. */
function toIcsUtcDateTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape a string for use inside SUMMARY / DESCRIPTION / LOCATION properties
 * per RFC 5545 section 3.3.11. Order matters: backslash first, otherwise
 * we'd double-escape our own escape chars.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Add one day to an ISO date. Used for DTEND on all-day events. */
function addOneDayIso(iso: string): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/**
 * Build an .ics file body from a single CalendarEvent. Content lines use
 * CRLF per spec. UID is per-invocation so re-sharing the same event
 * creates a new calendar entry rather than merging with a previous one.
 */
function buildIcs(event: CalendarEvent): string {
  const allDay = event.allDay ?? true;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@quotecat.ai`;
  const dtstamp = toIcsUtcDateTime(new Date().toISOString());

  let dtstart: string;
  let dtend: string;
  if (allDay) {
    dtstart = `DTSTART;VALUE=DATE:${toIcsAllDay(event.startDate)}`;
    // DTEND on all-day events is EXCLUSIVE per RFC 5545: a Mon–Fri job needs
    // DTEND to be the following Saturday. Without endDate, single-day event.
    const endIso = event.endDate ?? event.startDate;
    dtend = `DTEND;VALUE=DATE:${toIcsAllDay(addOneDayIso(endIso))}`;
  } else {
    dtstart = `DTSTART:${toIcsUtcDateTime(event.startDate)}`;
    dtend = `DTEND:${toIcsUtcDateTime(event.endDate ?? event.startDate)}`;
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QuoteCat//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Generate an .ics file and hand it to the OS share sheet. On success,
 * Apple Calendar / Google Calendar / Outlook / etc. appear in the sheet
 * and open the event pre-filled. The temporary file is deleted afterwards
 * regardless of whether the user completed or cancelled the share.
 */
export async function shareCalendarEvent(event: CalendarEvent): Promise<void> {
  const safeName = event.title.replace(/[^a-z0-9_\-\s]/gi, '_').trim() || 'event';
  const fileUri = `${FileSystem.cacheDirectory}${safeName}.ics`;
  const body = buildIcs(event);

  await FileSystem.writeAsStringAsync(fileUri, body);
  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on this device');
    }
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/calendar',
      dialogTitle: 'Add to Calendar',
      UTI: 'com.apple.ical.ics',
    });
  } finally {
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (cleanupError) {
      // Cache cleanup failure should never break the user's experience.
      console.warn('Failed to clean up .ics file:', cleanupError);
    }
  }
}

/**
 * Build a CalendarEvent from a Quote. Returns null if no work dates are set —
 * the caller shows a "set work dates first" alert rather than sharing an
 * event with meaningless dates.
 */
export function quoteToCalendarEvent(quote: Quote): CalendarEvent | null {
  if (!quote.startDate && !quote.completionDate) return null;

  const start = quote.startDate ?? quote.completionDate!;
  const end = quote.completionDate ?? quote.startDate!;
  const total = calculateQuoteTotal(quote);

  const descriptionParts: string[] = [];
  if (quote.clientName) descriptionParts.push(`Client: ${quote.clientName}`);
  if (quote.quoteNumber) descriptionParts.push(`Quote: ${quote.quoteNumber}`);
  descriptionParts.push(
    `Total: $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );
  if (quote.notes) descriptionParts.push(`Notes: ${quote.notes}`);

  return {
    title: quote.name || 'QuoteCat job',
    startDate: start,
    endDate: end,
    allDay: true,
    description: descriptionParts.join('\n'),
    location: quote.clientAddress,
  };
}

/**
 * Build a CalendarEvent from a Contract. Same rules as quoteToCalendarEvent —
 * null when there are no dates to schedule.
 */
export function contractToCalendarEvent(contract: Contract): CalendarEvent | null {
  if (!contract.startDate && !contract.completionDate) return null;

  const start = contract.startDate ?? contract.completionDate!;
  const end = contract.completionDate ?? contract.startDate!;

  const descriptionParts: string[] = [];
  if (contract.clientName) descriptionParts.push(`Client: ${contract.clientName}`);
  if (contract.contractNumber) descriptionParts.push(`Contract: ${contract.contractNumber}`);
  descriptionParts.push(
    `Total: $${contract.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );
  if (contract.scopeOfWork) descriptionParts.push(`Scope: ${contract.scopeOfWork}`);

  return {
    title: contract.projectName || 'QuoteCat contract',
    startDate: start,
    endDate: end,
    allDay: true,
    description: descriptionParts.join('\n'),
    location: contract.clientAddress,
  };
}
