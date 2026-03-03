// lib/calculations.ts
// Centralized calculation functions for quotes and invoices
// Single source of truth - do not duplicate these elsewhere

import type { Quote, QuoteItem, Invoice } from "./types";
import type { OverheadSettings } from "./preferences";

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
  materialsMarginPercent: number;
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

  // Calculate materials margin from markup
  // Formula: margin% = markup% / (100 + markup%) * 100
  const materialsMarginPercent = markupPercent > 0
    ? (markupPercent / (100 + markupPercent)) * 100
    : 0;

  return {
    materialsFromItems,
    materialEstimate,
    labor,
    subtotal,
    markupPercent,
    markupAmount,
    materialsMarginPercent,
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

/**
 * Profitability result type
 */
export type ProfitabilityResult = {
  revenue: number;
  materialsCost: number;
  laborCost: number;
  overheadCost: number;
  profit: number;
  marginPercent: number;
};

/**
 * Calculate profitability for a quote
 *
 * Formula:
 * - Materials Cost = line items total (BEFORE markup)
 * - Labor Cost = labor field
 * - Overhead Cost = Labor × (Overhead % / 100)
 * - Revenue = quote total (what client pays)
 * - Profit = Revenue - Materials Cost - Labor Cost - Overhead Cost
 * - Margin % = (Profit / Revenue) × 100
 */
export function calculateQuoteProfitability(
  quote: Quote,
  overheadSettings: OverheadSettings | undefined
): ProfitabilityResult | null {
  if (!overheadSettings || !overheadSettings.overheadPercent) {
    return null;
  }

  const totals = calculateQuoteTotals(quote);
  const revenue = totals.total;
  const materialsCost = totals.materialsFromItems; // Before markup
  const laborCost = totals.labor;
  const overheadPercent = overheadSettings.overheadPercent;

  // Overhead is calculated on labor
  const overheadCost = laborCost * (overheadPercent / 100);

  // Profit = Revenue - all costs
  const profit = revenue - materialsCost - laborCost - overheadCost;

  // Margin = Profit / Revenue
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    revenue,
    materialsCost,
    laborCost,
    overheadCost,
    profit,
    marginPercent,
  };
}

/**
 * Calculate profitability for an invoice
 *
 * Same formula as quotes, but uses invoice totals
 */
export function calculateInvoiceProfitability(
  invoice: Invoice,
  overheadSettings: OverheadSettings | undefined
): ProfitabilityResult | null {
  if (!overheadSettings || !overheadSettings.overheadPercent) {
    return null;
  }

  const totals = calculateInvoiceTotals(invoice);
  const revenue = totals.total;
  const materialsCost = totals.materialsFromItems; // Before markup
  const laborCost = totals.labor;
  const overheadPercent = overheadSettings.overheadPercent;

  // Overhead is calculated on labor
  const overheadCost = laborCost * (overheadPercent / 100);

  // Profit = Revenue - all costs
  const profit = revenue - materialsCost - laborCost - overheadCost;

  // Margin = Profit / Revenue
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    revenue,
    materialsCost,
    laborCost,
    overheadCost,
    profit,
    marginPercent,
  };
}

/**
 * Get margin indicator color based on margin percentage and user's target
 * - Green: at or above target
 * - Yellow: within 5% of target
 * - Red: more than 5% below target
 * - Gray: no target set (neutral)
 */
export function getMarginColor(marginPercent: number, targetMargin?: number): string {
  // No target set - show neutral gray
  if (!targetMargin || targetMargin <= 0) {
    return "#6b7280"; // gray
  }

  const warningThreshold = targetMargin - 5;

  if (marginPercent >= targetMargin) return "#22c55e"; // green - at or above target
  if (marginPercent >= warningThreshold) return "#eab308"; // yellow - close to target
  return "#ef4444"; // red - below target
}

/**
 * Get margin indicator icon based on margin percentage and user's target
 */
export function getMarginIcon(marginPercent: number, targetMargin?: number): string {
  // No target set - show neutral icon
  if (!targetMargin || targetMargin <= 0) {
    return "analytics-outline"; // neutral chart icon
  }

  const warningThreshold = targetMargin - 5;

  if (marginPercent >= targetMargin) return "checkmark";
  if (marginPercent >= warningThreshold) return "remove";
  return "warning";
}
