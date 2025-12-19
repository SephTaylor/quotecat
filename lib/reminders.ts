// lib/reminders.ts
// Reminder/notification calculation and storage

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Quote, Invoice } from "./types";
import type { NotificationPreferences } from "./preferences";
import { supabase } from "./supabase";
import { getCurrentUserId } from "./auth";
import { calculateInvoiceTotal } from "./calculations";

export type ReminderType =
  | "quote_followup"      // Sent quote needs follow-up (auto or manual date)
  | "invoice_overdue"     // Invoice past due date
  | "invoice_due_soon"    // Invoice due in 3 days
  | "invoice_due_today"   // Invoice due today
  | "pro_welcome"         // Welcome notification for new Pro users
  | "contract_signed"     // Client signed a contract
  | "contract_viewed"     // Client viewed a contract
  | "contract_declined";  // Client declined a contract

export type Reminder = {
  id: string;
  type: ReminderType;
  entityId: string;       // Quote, Invoice, or Contract ID (or "system" for system notifications)
  entityType: "quote" | "invoice" | "contract" | "system";
  title: string;
  subtitle: string;
  dueDate: string;        // ISO 8601 date when reminder became active
  createdAt: string;      // ISO 8601
};

export type DismissedReminder = {
  reminderId: string;
  dismissedAt: string;    // ISO 8601
  snoozedUntil?: string;  // ISO 8601 - if set, reminder reappears after this date
};

const DISMISSED_KEY = "@quotecat/dismissed_reminders";

/**
 * Load dismissed/snoozed reminders from storage
 */
export async function loadDismissedReminders(): Promise<DismissedReminder[]> {
  try {
    const json = await AsyncStorage.getItem(DISMISSED_KEY);
    if (!json) return [];
    return JSON.parse(json);
  } catch (error) {
    console.error("Failed to load dismissed reminders:", error);
    return [];
  }
}

/**
 * Save dismissed reminders to storage
 */
async function saveDismissedReminders(dismissed: DismissedReminder[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  } catch (error) {
    console.error("Failed to save dismissed reminders:", error);
  }
}

/**
 * Dismiss a reminder (permanently or until snooze date)
 */
export async function dismissReminder(
  reminderId: string,
  snoozeDays?: number
): Promise<void> {
  const dismissed = await loadDismissedReminders();

  // Remove any existing dismissal for this reminder
  const filtered = dismissed.filter(d => d.reminderId !== reminderId);

  const newDismissal: DismissedReminder = {
    reminderId,
    dismissedAt: new Date().toISOString(),
  };

  if (snoozeDays) {
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + snoozeDays);
    newDismissal.snoozedUntil = snoozeDate.toISOString();
  }

  filtered.push(newDismissal);
  await saveDismissedReminders(filtered);
}

/**
 * Check if a reminder is currently dismissed
 */
function isReminderDismissed(
  reminderId: string,
  dismissed: DismissedReminder[]
): boolean {
  const dismissal = dismissed.find(d => d.reminderId === reminderId);
  if (!dismissal) return false;

  // If snoozed, check if snooze period has passed
  if (dismissal.snoozedUntil) {
    return new Date() < new Date(dismissal.snoozedUntil);
  }

  // Permanently dismissed
  return true;
}

/**
 * Generate reminder ID for a quote follow-up
 */
function getQuoteFollowUpReminderId(quoteId: string): string {
  return `quote_followup_${quoteId}`;
}

/**
 * Generate reminder ID for an invoice
 */
function getInvoiceReminderId(invoiceId: string, type: ReminderType): string {
  return `${type}_${invoiceId}`;
}

/**
 * Calculate days since a date
 */
function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days until a date (negative if past)
 */
function daysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  // Reset time to compare just dates
  date.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - now.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get active reminders based on quotes and preferences
 */
export async function getActiveReminders(
  quotes: Quote[],
  invoices: Invoice[],
  preferences: NotificationPreferences
): Promise<Reminder[]> {
  const reminders: Reminder[] = [];
  const dismissed = await loadDismissedReminders();
  const now = new Date().toISOString();

  // Quote follow-up reminders
  for (const quote of quotes) {
    // Skip non-sent quotes and archived quotes
    if (quote.status !== "sent") continue;

    let shouldRemind = false;
    let dueDate = "";
    let subtitle = "";

    // Check manual follow-up date first
    if (quote.followUpDate) {
      const daysLeft = daysUntil(quote.followUpDate);
      if (daysLeft <= 0) {
        shouldRemind = true;
        dueDate = quote.followUpDate;
        if (daysLeft === 0) {
          subtitle = "Follow-up due today";
        } else {
          subtitle = `Follow-up was due ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago`;
        }
      }
    }
    // Otherwise check auto follow-up based on when quote was sent/updated
    else if (preferences.autoFollowUpEnabled) {
      const daysSinceSent = daysSince(quote.updatedAt || quote.createdAt);
      if (daysSinceSent >= preferences.autoFollowUpDays) {
        shouldRemind = true;
        // Due date is when the threshold was crossed
        const thresholdDate = new Date(quote.updatedAt || quote.createdAt);
        thresholdDate.setDate(thresholdDate.getDate() + preferences.autoFollowUpDays);
        dueDate = thresholdDate.toISOString();
        subtitle = `Sent ${daysSinceSent} day${daysSinceSent === 1 ? "" : "s"} ago`;
      }
    }

    if (shouldRemind) {
      const reminderId = getQuoteFollowUpReminderId(quote.id);

      // Skip if dismissed
      if (isReminderDismissed(reminderId, dismissed)) continue;

      reminders.push({
        id: reminderId,
        type: "quote_followup",
        entityId: quote.id,
        entityType: "quote",
        title: quote.name || "Untitled Quote",
        subtitle: `${quote.clientName || "No client"} • ${subtitle}`,
        dueDate,
        createdAt: now,
      });
    }
  }

  // Invoice reminders
  for (const invoice of invoices) {
    // Skip paid or cancelled invoices
    if (invoice.status === "paid" || invoice.status === "cancelled") continue;

    const daysLeft = daysUntil(invoice.dueDate);
    let shouldRemind = false;
    let reminderType: ReminderType = "invoice_due_today";
    let subtitle = "";

    if (daysLeft < 0 && preferences.invoiceOverdue) {
      // Overdue
      shouldRemind = true;
      reminderType = "invoice_overdue";
      subtitle = `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"}`;
    } else if (daysLeft === 0 && preferences.invoiceDueToday) {
      // Due today
      shouldRemind = true;
      reminderType = "invoice_due_today";
      subtitle = "Due today";
    } else if (daysLeft > 0 && daysLeft <= 3 && preferences.invoiceDueSoon) {
      // Due soon (within 3 days)
      shouldRemind = true;
      reminderType = "invoice_due_soon";
      subtitle = `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
    }

    if (shouldRemind) {
      const reminderId = getInvoiceReminderId(invoice.id, reminderType);

      // Skip if dismissed
      if (isReminderDismissed(reminderId, dismissed)) continue;

      reminders.push({
        id: reminderId,
        type: reminderType,
        entityId: invoice.id,
        entityType: "invoice",
        title: `Invoice ${invoice.invoiceNumber}`,
        subtitle: `${invoice.clientName || "No client"} • ${subtitle} • $${(invoice.paidAmount !== undefined ? (calculateInvoiceTotal(invoice) - invoice.paidAmount) : calculateInvoiceTotal(invoice)).toFixed(2)}`,
        dueDate: invoice.dueDate,
        createdAt: now,
      });
    }
  }

  // Sort by due date (oldest/most urgent first)
  reminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return reminders;
}

/**
 * Clean up old dismissed reminders (older than 90 days with no snooze)
 */
export async function cleanupDismissedReminders(): Promise<void> {
  const dismissed = await loadDismissedReminders();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const filtered = dismissed.filter(d => {
    // Keep if snoozed
    if (d.snoozedUntil) return true;
    // Keep if dismissed within last 90 days
    return new Date(d.dismissedAt) > cutoff;
  });

  if (filtered.length !== dismissed.length) {
    await saveDismissedReminders(filtered);
  }
}

// ============================================
// Pro Welcome Notification
// ============================================

const PRO_WELCOME_KEY = "@quotecat/pro_welcome_shown";
const PRO_WELCOME_REMINDER_ID = "pro_welcome";

/**
 * Check if the Pro welcome notification has been shown
 */
export async function hasSeenProWelcome(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(PRO_WELCOME_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

/**
 * Mark the Pro welcome notification as shown
 */
export async function markProWelcomeAsSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(PRO_WELCOME_KEY, "true");
    // Also dismiss the reminder so it doesn't show in the panel
    await dismissReminder(PRO_WELCOME_REMINDER_ID);
  } catch (error) {
    console.error("Failed to mark Pro welcome as seen:", error);
  }
}

/**
 * Create the Pro welcome reminder (called when user activates Pro tier)
 */
export function createProWelcomeReminder(): Reminder {
  const now = new Date().toISOString();
  return {
    id: PRO_WELCOME_REMINDER_ID,
    type: "pro_welcome",
    entityId: "system",
    entityType: "system",
    title: "Welcome to Pro!",
    subtitle: "Tap to explore your new features",
    dueDate: now,
    createdAt: now,
  };
}

/**
 * Get the Pro welcome reminder if it should be shown
 */
export async function getProWelcomeReminder(): Promise<Reminder | null> {
  const hasSeen = await hasSeenProWelcome();
  if (hasSeen) return null;

  const dismissed = await loadDismissedReminders();
  if (isReminderDismissed(PRO_WELCOME_REMINDER_ID, dismissed)) return null;

  return createProWelcomeReminder();
}

// ============================================
// Contract Notifications (from Supabase)
// ============================================

/**
 * Notification record from Supabase
 */
type SupabaseNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  contract_id: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
};

/**
 * Fetch unread contract notifications from Supabase
 */
export async function getContractNotifications(): Promise<Reminder[]> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Failed to fetch notifications:", error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Convert to Reminder format
    return (data as SupabaseNotification[]).map((n) => ({
      id: `notification_${n.id}`,
      type: n.type as ReminderType,
      entityId: n.contract_id || "system",
      entityType: "contract" as const,
      title: n.title,
      subtitle: n.message,
      dueDate: n.created_at,
      createdAt: n.created_at,
    }));
  } catch (error) {
    console.error("Error fetching contract notifications:", error);
    return [];
  }
}

/**
 * Mark a notification as read in Supabase
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    // Extract the actual ID from "notification_uuid" format
    const actualId = notificationId.replace("notification_", "");

    const { error } = await supabase
      .from("notifications")
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", actualId);

    if (error) {
      console.error("Failed to mark notification as read:", error);
    }
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}
