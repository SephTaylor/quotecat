// lib/features.ts
// Feature gating and eligibility checks

import type { UserState } from "./user";
import { FREE_LIMITS } from "./user";

/**
 * Check if user can create a new quote
 */
export function canCreateQuote(user: UserState): {
  allowed: boolean;
  reason?: string;
} {
  if (user.tier === "pro" || user.tier === "premium") {
    return { allowed: true };
  }

  if (user.quotesUsed >= FREE_LIMITS.quotes) {
    return {
      allowed: false,
      reason: `You've reached the free limit of ${FREE_LIMITS.quotes} quotes. Upgrade to Pro for unlimited quotes.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can export a PDF
 */
export function canExportPDF(user: UserState): {
  allowed: boolean;
  reason?: string;
  remaining?: number;
} {
  if (user.tier === "pro" || user.tier === "premium") {
    return { allowed: true };
  }

  const remaining = FREE_LIMITS.pdfsPerMonth - user.pdfsThisMonth;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `You've used all ${FREE_LIMITS.pdfsPerMonth} free PDF exports this month. Upgrade to Pro for unlimited exports.`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining };
}

/**
 * Check if user can export a spreadsheet
 */
export function canExportSpreadsheet(user: UserState): {
  allowed: boolean;
  reason?: string;
  remaining?: number;
} {
  if (user.tier === "pro" || user.tier === "premium") {
    return { allowed: true };
  }

  const remaining = FREE_LIMITS.spreadsheetsPerMonth - user.spreadsheetsThisMonth;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `You've used your ${FREE_LIMITS.spreadsheetsPerMonth} free spreadsheet export this month. Upgrade to Pro for unlimited exports.`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining };
}

/**
 * Check if user can access assemblies library
 */
export function canAccessAssemblies(user: UserState): boolean {
  return user.tier === "pro" || user.tier === "premium";
}

/**
 * Check if user can access cloud sync
 */
export function canAccessCloudSync(user: UserState): boolean {
  return user.tier === "pro" || user.tier === "premium";
}

/**
 * Check if user can access change orders (Premium only)
 */
export function canAccessChangeOrders(user: UserState): boolean {
  return user.tier === "premium";
}

/**
 * Check if user can access dashboard value tracking
 */
export function canAccessValueTracking(user: UserState): boolean {
  return user.tier === "pro" || user.tier === "premium";
}

/**
 * Get remaining quota for a resource
 */
export function getQuotaRemaining(
  user: UserState,
  resource: "quotes" | "pdfs" | "spreadsheets",
): number {
  if (user.tier === "pro" || user.tier === "premium") {
    return Infinity;
  }

  if (resource === "quotes") {
    return Math.max(0, FREE_LIMITS.quotes - user.quotesUsed);
  }

  if (resource === "pdfs") {
    return Math.max(0, FREE_LIMITS.pdfsPerMonth - user.pdfsThisMonth);
  }

  if (resource === "spreadsheets") {
    return Math.max(0, FREE_LIMITS.spreadsheetsPerMonth - user.spreadsheetsThisMonth);
  }

  return 0;
}

/**
 * Get user-friendly message about upgrade benefits for a specific feature
 */
export function getUpgradeMessage(
  feature: "quotes" | "pdf" | "assemblies" | "cloud" | "value",
): string {
  const messages = {
    quotes: "Upgrade to Pro for unlimited quotes",
    pdf: "Upgrade to Pro for unlimited PDF exports with custom branding",
    assemblies:
      "Assemblies are a Pro feature. Access pre-built calculators for all trades.",
    cloud: "Cloud backup and sync is a Pro feature. Never lose your data.",
    value:
      "Value tracking is a Pro feature. See your total quote pipeline value.",
  };
  return messages[feature];
}

/**
 * Check if user should see upgrade prompts
 */
export function shouldShowUpgradePrompt(user: UserState): boolean {
  if (user.tier === "pro" || user.tier === "premium") return false;

  // Show when approaching limits
  const quotesRemaining = getQuotaRemaining(user, "quotes");
  const pdfsRemaining = getQuotaRemaining(user, "pdfs");

  // Show prompt when 70% of quota is used
  return quotesRemaining <= 3 || pdfsRemaining <= 1;
}
