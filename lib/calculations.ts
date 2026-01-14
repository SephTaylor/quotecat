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
 *
 * Calculation order:
 * 1. Materials = line items total (from catalog)
 * 2. Markup applied to line items ONLY (not material estimate or labor)
 * 3. Subtotal = materials with markup + material estimate + labor
 * 4. Tax applied to subtotal
 */
export function calculateQuoteTotals(quote: Quote): {
  materialsFromItems: number;
  materialEstimate: number;
  labor: number;
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
  const markupPercent = quote.markupPercent ?? 0;
  const taxPercent = quote.taxPercent ?? 0;

  // Apply markup to line items ONLY (not material estimate or labor)
  // Material estimate is a contractor's guess with margin already baked in
  const markupAmount = (materialsFromItems * markupPercent) / 100;
  const materialsWithMarkup = materialsFromItems + markupAmount;
  const subtotal = materialsWithMarkup + materialEstimate + labor;
  const taxAmount = (subtotal * taxPercent) / 100;
  const total = subtotal + taxAmount;

  return {
    materialsFromItems,
    materialEstimate,
    labor,
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
 *
 * Calculation order:
 * 1. Materials = line items total (from catalog)
 * 2. Markup applied to line items ONLY (not material estimate or labor)
 * 3. Subtotal = materials with markup + material estimate + labor
 * 4. Tax applied to subtotal
 * 5. Percentage applied at end (for partial invoices)
 */
export function calculateInvoiceTotals(invoice: Invoice): {
  materialsFromItems: number;
  materialEstimate: number;
  labor: number;
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
  const markupPercent = invoice.markupPercent ?? 0;
  const taxPercent = invoice.taxPercent ?? 0;
  const percentage = invoice.percentage ?? 100;

  // Apply markup to line items ONLY (not material estimate or labor)
  // Material estimate is a contractor's guess with margin already baked in
  const markupAmount = (materialsFromItems * markupPercent) / 100;
  const materialsWithMarkup = materialsFromItems + markupAmount;
  const subtotal = materialsWithMarkup + materialEstimate + labor;
  const taxAmount = (subtotal * taxPercent) / 100;
  let total = subtotal + taxAmount;

  // Apply percentage if this is a partial invoice
  if (percentage < 100) {
    total = total * (percentage / 100);
  }

  return {
    materialsFromItems,
    materialEstimate,
    labor,
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
