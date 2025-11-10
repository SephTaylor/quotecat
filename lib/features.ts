// lib/features.ts
// Feature gating and eligibility checks

import type { UserState } from "./user";
import { FREE_LIMITS } from "./user";

/**
 * Check if user has Pro or Premium tier (Premium includes all Pro features)
 */
function hasPaidTier(user: UserState): boolean {
  return user.tier === "pro" || user.tier === "premium";
}

/**
 * Check if user has Premium tier specifically
 */
function hasPremiumTier(user: UserState): boolean {
  return user.tier === "premium";
}

/**
 * Check if user can create a new quote (always allowed - unlimited drafts)
 */
export function canCreateQuote(user: UserState): {
  allowed: boolean;
  reason?: string;
} {
  // Free users have unlimited draft quotes
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
  if (hasPaidTier(user)) {
    return { allowed: true };
  }

  const remaining = FREE_LIMITS.pdfsTotal - user.pdfsExported;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `You've used all ${FREE_LIMITS.pdfsTotal} free exports. Upgrade to Pro for unlimited exports.`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining };
}

/**
 * Check if user can export a spreadsheet (CSV) - Pro feature only
 */
export function canExportSpreadsheet(user: UserState): {
  allowed: boolean;
  reason?: string;
  remaining?: number;
} {
  if (hasPaidTier(user)) {
    return { allowed: true };
  }

  // CSV export is Pro-only (no free tier access)
  return {
    allowed: false,
    reason: "CSV export is available for Pro and Premium accounts.",
    remaining: 0,
  };
}

/**
 * Check if user can access assemblies library (Pro/Premium feature)
 */
export function canAccessAssemblies(user: UserState): boolean {
  return hasPaidTier(user);
}

/**
 * Check if user can access cloud sync (Pro/Premium feature)
 */
export function canAccessCloudSync(user: UserState): boolean {
  return hasPaidTier(user);
}

/**
 * Check if user can access dashboard value tracking (Pro/Premium feature)
 */
export function canAccessValueTracking(user: UserState): boolean {
  return hasPaidTier(user);
}

/**
 * Check if user can access Quote Wizard (Premium-only feature)
 */
export function canAccessQuoteWizard(user: UserState): boolean {
  return hasPremiumTier(user);
}

/**
 * Check if user can use branded PDFs (Premium-only feature)
 */
export function canUseBrandedPDFs(user: UserState): boolean {
  return hasPremiumTier(user);
}

/**
 * Check if user can access advanced analytics (Premium-only feature)
 */
export function canAccessAdvancedAnalytics(user: UserState): boolean {
  return hasPremiumTier(user);
}

/**
 * Get remaining quota for a resource
 */
export function getQuotaRemaining(
  user: UserState,
  resource: "pdfs",
): number {
  if (hasPaidTier(user)) {
    return Infinity;
  }

  if (resource === "pdfs") {
    return Math.max(0, FREE_LIMITS.pdfsTotal - user.pdfsExported);
  }

  return 0;
}

/**
 * Get user-friendly message about upgrade benefits for a specific feature
 */
export function getUpgradeMessage(
  feature: "pdf" | "assemblies" | "cloud" | "value",
): string {
  const messages = {
    pdf: "Upgrade to Pro for unlimited client exports with custom branding",
    assemblies:
      "Assemblies are a Pro feature. Access pre-built calculators for all trades.",
    cloud: "Cloud backup and sync is a Pro feature. Never lose your quotes.",
    value:
      "Value tracking is a Pro feature. See your total quote pipeline value.",
  };
  return messages[feature];
}

/**
 * Check if user should see upgrade prompts
 */
export function shouldShowUpgradePrompt(user: UserState): boolean {
  if (hasPaidTier(user)) return false;

  // Show when approaching PDF export limit
  const pdfsRemaining = getQuotaRemaining(user, "pdfs");

  // Show prompt when only 1 PDF export remaining
  return pdfsRemaining <= 1;
}
