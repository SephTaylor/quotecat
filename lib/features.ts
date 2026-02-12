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
      reason: `You've reached the free limit of ${FREE_LIMITS.quotes} quotes this month.`,
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

  const remaining = FREE_LIMITS.pdfs - user.pdfsUsed;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `You've used all ${FREE_LIMITS.pdfs} free PDF exports this month. Resets on the 1st.`,
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

  const remaining = FREE_LIMITS.spreadsheets - user.spreadsheetsUsed;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `You've used all ${FREE_LIMITS.spreadsheets} free spreadsheet exports this month. Resets on the 1st.`,
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
 * Check if user can access pricebook (Pro and Premium)
 */
export function canAccessPricebook(user: UserState): boolean {
  return user.tier === "pro" || user.tier === "premium";
}

/**
 * Check if user can access cloud sync
 */
export function canAccessCloudSync(user: UserState): boolean {
  return user.tier === "pro" || user.tier === "premium";
}

/**
 * Check if user can access change orders (Pro and Premium)
 */
export function canAccessChangeOrders(user: UserState): boolean {
  return user.tier === "pro" || user.tier === "premium";
}

/**
 * Check if user can access invoices (all tiers - free has limits)
 */
export function canAccessInvoices(_user: UserState): boolean {
  return true; // All users can access invoices
}

/**
 * Check if user can export an invoice PDF
 * Free users have monthly limit and get QuoteCat branding
 */
export function canExportInvoice(user: UserState): {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  hasBranding: boolean; // True if export will have QuoteCat branding
} {
  if (user.tier === "pro" || user.tier === "premium") {
    return { allowed: true, hasBranding: false };
  }

  const invoicesUsed = user.invoicesUsed || 0;
  const remaining = FREE_LIMITS.invoices - invoicesUsed;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `You've used all ${FREE_LIMITS.invoices} free invoice exports this month. Upgrade to Pro for unlimited exports without branding.`,
      remaining: 0,
      hasBranding: true,
    };
  }

  return { allowed: true, remaining, hasBranding: true };
}

/**
 * Check if user can access Quote Wizard / Drew (Premium only)
 */
export function canAccessWizard(user: UserState): boolean {
  return user.tier === "premium";
}

/**
 * Check if user can access Drew for support questions (all tiers)
 * Everyone can ask Drew questions; only Premium can build quotes with Drew
 */
export function canAccessDrewSupport(_user: UserState): boolean {
  return true;  // All users can ask Drew questions
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
  resource: "quotes" | "pdfs" | "spreadsheets" | "invoices",
): number {
  if (user.tier === "pro" || user.tier === "premium") {
    return Infinity;
  }

  if (resource === "quotes") {
    return Math.max(0, FREE_LIMITS.quotes - user.quotesUsed);
  }

  if (resource === "pdfs") {
    return Math.max(0, FREE_LIMITS.pdfs - user.pdfsUsed);
  }

  if (resource === "spreadsheets") {
    return Math.max(0, FREE_LIMITS.spreadsheets - user.spreadsheetsUsed);
  }

  if (resource === "invoices") {
    return Math.max(0, FREE_LIMITS.invoices - (user.invoicesUsed || 0));
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
