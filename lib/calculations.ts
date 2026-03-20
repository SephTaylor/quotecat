// lib/calculations.ts
// Centralized calculation functions for quotes and invoices
// Single source of truth - do not duplicate these elsewhere

import { type Quote, type QuoteItem, type Invoice, type TeamMember, type LaborEntry, computeLaborEntryTotal } from "./types";
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
 * Pricing settings needed for profit calculation
 */
export type ProfitPricingSettings = {
  defaultLaborRate: number;     // Billable rate (what you charge clients)
  defaultLaborCostRate: number; // Cost rate (what it costs you - salary + benefits)
};

/**
 * Calculate profitability for a quote
 *
 * Formula:
 * - Revenue = quote subtotal (excluding tax - tax is pass-through, not profit)
 * - Materials Cost = line items total (BEFORE markup)
 * - Labor Cost = labor billed × (costRate / billableRate)
 * - Profit = Revenue - Materials Cost - Labor Cost
 * - Margin % = (Profit / Revenue) × 100
 *
 * The labor COST is different from labor BILLED:
 * - Labor billed = what client pays (e.g., 8 hrs × $95/hr = $760)
 * - Labor cost = what it costs you (e.g., 8 hrs × $56/hr = $448)
 * - Labor profit = $760 - $448 = $312
 *
 * The cost rate comes from the Labor Rate Calculator:
 * costRate = (salary + benefits + payrollTaxes) / billableHours
 * This excludes overhead and profit margin, which are embedded in the billable rate.
 */
export function calculateQuoteProfitability(
  quote: Quote,
  overheadSettings: OverheadSettings | undefined,
  pricingSettings?: ProfitPricingSettings,
  teamMembers?: TeamMember[]
): ProfitabilityResult | null {
  // Require cost rate to be set for accurate calculation
  // Note: overheadSettings is optional - only used for targetProfitMarginPercent coloring
  if (!pricingSettings?.defaultLaborCostRate || !pricingSettings?.defaultLaborRate) {
    return null;
  }

  const totals = calculateQuoteTotals(quote);
  // Use subtotal, not total - tax is pass-through, not profit
  const revenue = totals.subtotal;
  const materialsCost = totals.materialsFromItems; // Before markup

  // Calculate TRUE labor cost
  // Default cost ratio for entries without per-worker rates
  const defaultCostRatio = pricingSettings.defaultLaborCostRate / pricingSettings.defaultLaborRate;

  let laborCost: number;

  // If quote has labor entries and team members provided, use per-worker rates
  if (quote.laborEntries && quote.laborEntries.length > 0 && teamMembers && teamMembers.length > 0) {
    laborCost = calculateLaborCostWithWorkerRatesInternal(
      quote.laborEntries,
      teamMembers,
      defaultCostRatio
    );
  } else {
    // Fall back to global ratio for all labor
    laborCost = totals.labor * defaultCostRatio;
  }

  // Profit = Revenue - direct costs only
  const profit = revenue - materialsCost - laborCost;

  // Margin = Profit / Revenue
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Design decision: overheadCost is intentionally 0 because overhead is embedded
  // in the billable rate via the Labor Rate Calculator, not subtracted as a separate
  // line item. Subtracting it separately would cause double-counting.
  //
  // Required inputs for profitability:
  // - defaultLaborRate (what you charge clients)
  // - defaultLaborCostRate (your actual cost: salary + benefits + payroll taxes)
  //
  // overheadSettings is optional and only used for targetProfitMarginPercent
  // to color the margin indicator green/yellow/red.
  return {
    revenue,
    materialsCost,
    laborCost,
    overheadCost: 0,
    profit,
    marginPercent,
  };
}

/**
 * Calculate labor cost using per-worker cost rates when available
 *
 * For each labor entry:
 * - If entry has a workerId and that worker has costRate and billableRate set,
 *   use that worker's specific cost ratio
 * - Otherwise, fall back to the default cost ratio
 */
function calculateLaborCostWithWorkerRatesInternal(
  laborEntries: LaborEntry[],
  teamMembers: TeamMember[],
  defaultCostRatio: number
): number {
  // Build lookup map for team members
  const memberMap = new Map<string, TeamMember>();
  for (const member of teamMembers) {
    memberMap.set(member.id, member);
  }

  let totalCost = 0;

  for (const entry of laborEntries) {
    const entryBilled = computeLaborEntryTotal(entry);

    // Try to get worker-specific cost ratio
    let costRatio = defaultCostRatio;

    if (entry.workerId) {
      const worker = memberMap.get(entry.workerId);
      if (worker && worker.costRate && worker.costRate > 0 && worker.billableRate > 0) {
        // Use worker's specific cost ratio
        costRatio = worker.costRate / worker.billableRate;
      }
    }

    totalCost += entryBilled * costRatio;
  }

  return totalCost;
}

/**
 * Exported helper for calculating labor cost with per-worker rates
 *
 * Handles both cases:
 * - Premium users with laborEntries: uses per-worker cost rates
 * - Pro users with simple labor: uses fallbackLaborValue with default cost ratio
 */
export function calculateLaborCostWithWorkerRates(
  laborEntries: LaborEntry[],
  fallbackLaborValue: number,
  teamMembers: TeamMember[],
  defaultLaborRate: number,
  defaultLaborCostRate: number
): number {
  const defaultCostRatio = defaultLaborRate > 0
    ? defaultLaborCostRate / defaultLaborRate
    : 0;

  // If we have labor entries (Premium), use per-worker calculation
  if (laborEntries && laborEntries.length > 0) {
    return calculateLaborCostWithWorkerRatesInternal(laborEntries, teamMembers, defaultCostRatio);
  }

  // Otherwise (Pro with simple labor), use fallback value with default ratio
  return fallbackLaborValue * defaultCostRatio;
}

/**
 * Calculate profitability for an invoice
 *
 * Same formula as quotes - uses cost ratio to calculate true labor cost.
 * Supports per-worker cost rates when laborEntries and teamMembers are available.
 */
export function calculateInvoiceProfitability(
  invoice: Invoice,
  overheadSettings: OverheadSettings | undefined,
  pricingSettings?: ProfitPricingSettings,
  teamMembers?: TeamMember[]
): ProfitabilityResult | null {
  // Require cost rate to be set for accurate calculation
  // Note: overheadSettings is optional - only used for targetProfitMarginPercent coloring
  if (!pricingSettings?.defaultLaborCostRate || !pricingSettings?.defaultLaborRate) {
    return null;
  }

  const totals = calculateInvoiceTotals(invoice);
  // Use subtotal, not total - tax is pass-through, not profit
  const revenue = totals.subtotal;
  const materialsCost = totals.materialsFromItems; // Before markup

  // Calculate TRUE labor cost
  // Default cost ratio for entries without per-worker rates
  const defaultCostRatio = pricingSettings.defaultLaborCostRate / pricingSettings.defaultLaborRate;

  let laborCost: number;

  // Check for laborEntries on invoice (stored as extra field)
  const laborEntries = (invoice as any).laborEntries as LaborEntry[] | undefined;

  // If invoice has labor entries and team members provided, use per-worker rates
  if (laborEntries && laborEntries.length > 0 && teamMembers && teamMembers.length > 0) {
    laborCost = calculateLaborCostWithWorkerRatesInternal(
      laborEntries,
      teamMembers,
      defaultCostRatio
    );
  } else {
    // Fall back to global ratio for all labor
    laborCost = totals.labor * defaultCostRatio;
  }

  // Profit = Revenue - direct costs only
  const profit = revenue - materialsCost - laborCost;

  // Margin = Profit / Revenue
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

  // See calculateQuoteProfitability for design decision on why overheadCost is 0
  return {
    revenue,
    materialsCost,
    laborCost,
    overheadCost: 0,
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
