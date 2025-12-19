// lib/calculations.ts
// Centralized calculation functions for quotes and invoices
// Single source of truth - do not duplicate these elsewhere

import type { Quote, QuoteItem, Invoice } from "./types";

/**
 * Calculate subtotal from line items
 */
export function calculateMaterialSubtotal(items: QuoteItem[] | undefined): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
}

/**
 * Calculate all quote totals with breakdown
 */
export function calculateQuoteTotals(quote: Quote): {
  materialsFromItems: number;
  materialEstimate: number;
  labor: number;
  overhead: number;
  subtotal: number;
  markupPercent: number;
  markupAmount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
} {
  const materialsFromItems = calculateMaterialSubtotal(quote.items);
  const materialEstimate = quote.materialEstimate ?? 0;
  const labor = quote.labor ?? 0;
  const overhead = quote.overhead ?? 0;
  const markupPercent = quote.markupPercent ?? 0;
  const taxPercent = quote.taxPercent ?? 0;

  const subtotal = materialsFromItems + materialEstimate + labor + overhead;
  const markupAmount = (subtotal * markupPercent) / 100;
  const afterMarkup = subtotal + markupAmount;
  const taxAmount = (afterMarkup * taxPercent) / 100;
  const total = afterMarkup + taxAmount;

  return {
    materialsFromItems,
    materialEstimate,
    labor,
    overhead,
    subtotal,
    markupPercent,
    markupAmount,
    taxPercent,
    taxAmount,
    total,
  };
}

/**
 * Calculate quote total (simplified)
 */
export function calculateQuoteTotal(quote: Quote): number {
  return calculateQuoteTotals(quote).total;
}

/**
 * Calculate all invoice totals with breakdown
 */
export function calculateInvoiceTotals(invoice: Invoice): {
  materialsFromItems: number;
  materialEstimate: number;
  labor: number;
  overhead: number;
  subtotal: number;
  markupPercent: number;
  markupAmount: number;
  taxPercent: number;
  taxAmount: number;
  percentage: number;
  total: number;
} {
  const materialsFromItems = invoice.items?.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  ) ?? 0;
  const materialEstimate = invoice.materialEstimate ?? 0;
  const labor = invoice.labor ?? 0;
  const overhead = invoice.overhead ?? 0;
  const markupPercent = invoice.markupPercent ?? 0;
  const taxPercent = invoice.taxPercent ?? 0;
  const percentage = invoice.percentage ?? 100;

  const subtotal = materialsFromItems + materialEstimate + labor + overhead;
  const markupAmount = (subtotal * markupPercent) / 100;
  const afterMarkup = subtotal + markupAmount;
  const taxAmount = (afterMarkup * taxPercent) / 100;
  let total = afterMarkup + taxAmount;

  // Apply percentage if this is a partial invoice
  if (percentage < 100) {
    total = total * (percentage / 100);
  }

  return {
    materialsFromItems,
    materialEstimate,
    labor,
    overhead,
    subtotal,
    markupPercent,
    markupAmount,
    taxPercent,
    taxAmount,
    percentage,
    total,
  };
}

/**
 * Calculate invoice total (simplified)
 */
export function calculateInvoiceTotal(invoice: Invoice): number {
  return calculateInvoiceTotals(invoice).total;
}

/**
 * Calculate remaining balance on an invoice
 */
export function calculateInvoiceRemaining(invoice: Invoice): number {
  const total = calculateInvoiceTotal(invoice);
  return invoice.paidAmount ? total - invoice.paidAmount : total;
}
