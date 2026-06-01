// lib/pricingHealth.ts
// Analysis layer for Pricing Health Check (Pro feature).
//
// Pure function that takes already-loaded quotes + preferences + team and returns
// a structured report of underpriced quotes from the configured window. No I/O,
// no side effects — the caller is responsible for loading the inputs.

import type { Quote, TeamMember } from "@/lib/types";
import type { OverheadSettings, PricingSettings } from "@/lib/preferences";
import {
  calculateQuoteProfitability,
  type ProfitabilityResult,
} from "@/lib/calculations";

export const DEFAULT_TARGET_MARGIN_PERCENT = 20;
export const DEFAULT_WINDOW_DAYS = 90;
export const UNDERPRICED_THRESHOLD_DELTA = 5; // flag when actualMargin < target - 5
export const MAX_FLAGGED_RESULTS = 10;

export type FlaggedQuote = {
  quote: Quote;
  profitability: ProfitabilityResult;
  targetMargin: number;
  estimatedLostProfit: number;
};

export type HealthCheckResult = {
  windowDays: number;
  totalAnalyzed: number;
  totalSkipped: number;
  flagged: FlaggedQuote[];
  totalEstimatedLostProfit: number;
  targetMargin: number;
  usingDefaultTarget: boolean;
  hasLaborRatesConfigured: boolean;
};

const ANALYZABLE_STATUSES = new Set(["sent", "approved", "completed"]);

export function analyzeQuoteHealth(
  quotes: Quote[],
  pricing: PricingSettings | undefined,
  overhead: OverheadSettings | undefined,
  teamMembers: TeamMember[] | undefined,
  windowDays: number = DEFAULT_WINDOW_DAYS,
  now: Date = new Date()
): HealthCheckResult {
  const target = overhead?.targetProfitMarginPercent;
  const targetMargin = target && target > 0 ? target : DEFAULT_TARGET_MARGIN_PERCENT;
  const usingDefaultTarget = !target || target <= 0;

  const hasLaborRatesConfigured = !!(
    pricing?.defaultLaborRate &&
    pricing?.defaultLaborCostRate &&
    pricing.defaultLaborRate > 0 &&
    pricing.defaultLaborCostRate > 0
  );

  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const inWindow = quotes.filter((q) => {
    if (!ANALYZABLE_STATUSES.has(q.status ?? "")) return false;
    const created = q.createdAt ? new Date(q.createdAt) : null;
    if (!created || isNaN(created.getTime())) return false;
    return created >= cutoff;
  });

  const flagged: FlaggedQuote[] = [];
  let totalAnalyzed = 0;
  let totalSkipped = 0;

  // Cast pricing to ProfitPricingSettings — same shape, narrower type. The
  // function only reads defaultLaborRate / defaultLaborCostRate, both present
  // on PricingSettings.
  const pricingForCalc = pricing as Parameters<typeof calculateQuoteProfitability>[2];

  for (const quote of inWindow) {
    const profitability = calculateQuoteProfitability(
      quote,
      overhead,
      pricingForCalc,
      teamMembers
    );

    // null means labor rates aren't configured — skip silently and count
    if (!profitability) {
      totalSkipped++;
      continue;
    }

    totalAnalyzed++;

    const isUnderpriced =
      profitability.marginPercent < targetMargin - UNDERPRICED_THRESHOLD_DELTA;
    if (!isUnderpriced) continue;

    // Lost profit = margin shortfall held at the price actually sold.
    // ((targetMargin - actualMargin) / 100) * revenue
    const shortfallPercent = targetMargin - profitability.marginPercent;
    const estimatedLostProfit = (shortfallPercent / 100) * profitability.revenue;

    flagged.push({
      quote,
      profitability,
      targetMargin,
      estimatedLostProfit,
    });
  }

  flagged.sort((a, b) => b.estimatedLostProfit - a.estimatedLostProfit);
  const topFlagged = flagged.slice(0, MAX_FLAGGED_RESULTS);

  const totalEstimatedLostProfit = topFlagged.reduce(
    (sum, f) => sum + f.estimatedLostProfit,
    0
  );

  return {
    windowDays,
    totalAnalyzed,
    totalSkipped,
    flagged: topFlagged,
    totalEstimatedLostProfit,
    targetMargin,
    usingDefaultTarget,
    hasLaborRatesConfigured,
  };
}
