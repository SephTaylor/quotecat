// lib/user.ts
// User state and tier management

import AsyncStorage from "@react-native-async-storage/async-storage";
import { resetAnalyticsUser } from "@/lib/app-analytics";
import { markTierChanged } from "@/lib/tierState";

export type UserTier = "free" | "pro" | "premium";

/**
 * One-time nudges keyed by an identifier. Value is the ISO timestamp when
 * the nudge was shown, so we can also do "not-more-than-once-per-month"
 * variants later without changing the field type.
 */
export type NudgeMap = {
  firstQuote?: string;
  pdfLimit?: string; // Timestamp of the last time we showed the pdf-limit nudge
  [key: string]: string | undefined;
};

export type UserState = {
  tier: UserTier;
  email?: string;
  displayName?: string; // User's display name for contracts
  quotesUsed: number;
  pdfsUsed: number; // Monthly total (resets on 1st)
  spreadsheetsUsed: number; // Monthly total (resets on 1st)
  invoicesUsed: number; // Monthly total (resets on 1st)
  lastUsageReset?: string; // ISO date string of last reset (YYYY-MM)
  // Pro user fields
  proActivatedAt?: string;
  proExpiresAt?: string; // For trial/subscription tracking
  // Free→Paid nudges seen (celebratory + limit-reached)
  nudgesShown?: NudgeMap;
};

export const FREE_LIMITS = {
  quotes: 10,
  pdfs: 10,           // Per month
  spreadsheets: 10,   // Per month
  invoices: 10,       // Per month (with QuoteCat branding)
  pricebookItems: 50, // Total items in pricebook
} as const;

const USER_STATE_KEY = "@quotecat/user_state";

/**
 * Get current user state from storage
 */
export async function getUserState(): Promise<UserState> {
  try {
    const json = await AsyncStorage.getItem(USER_STATE_KEY);
    if (!json) {
      return getDefaultUserState();
    }
    const state = JSON.parse(json) as UserState;
    // Migrate from old monthly fields to lifetime fields
    return migrateUserState(state);
  } catch (error) {
    console.error("Failed to load user state:", error);
    return getDefaultUserState();
  }
}

/**
 * Save user state to storage
 */
export async function saveUserState(state: UserState): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save user state:", error);
  }
}

/**
 * Get current month as YYYY-MM string
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Human-readable reset date for the next monthly quota rollover.
 * Used in Free-tier nudges: "resets on August 1".
 *
 * Note: quotas do NOT accumulate. New month = 10 fresh, not
 * "10 + whatever was left." migrateUserState() sets pdfsUsed = 0 on
 * the rollover regardless of prior usage.
 */
export function getNextResetDateLabel(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

/**
 * Default state for new users
 */
function getDefaultUserState(): UserState {
  return {
    tier: "free", // New users start on free tier until they subscribe
    quotesUsed: 0,
    pdfsUsed: 0,
    spreadsheetsUsed: 0,
    invoicesUsed: 0,
    lastUsageReset: getCurrentMonth(),
  };
}

/**
 * Migrate and reset monthly usage if needed
 */
function migrateUserState(state: UserState): UserState {
  const migrated = { ...state };
  const currentMonth = getCurrentMonth();

  // Handle migration from old fields
  if ('pdfsThisMonth' in state) {
    migrated.pdfsUsed = (state as any).pdfsThisMonth || 0;
    delete (migrated as any).pdfsThisMonth;
  }
  if ('spreadsheetsThisMonth' in state) {
    migrated.spreadsheetsUsed = (state as any).spreadsheetsThisMonth || 0;
    delete (migrated as any).spreadsheetsThisMonth;
  }
  if ('lastPdfResetDate' in state) {
    delete (migrated as any).lastPdfResetDate;
  }

  // Ensure fields exist
  if (migrated.pdfsUsed === undefined) migrated.pdfsUsed = 0;
  if (migrated.spreadsheetsUsed === undefined) migrated.spreadsheetsUsed = 0;
  if (migrated.invoicesUsed === undefined) migrated.invoicesUsed = 0;

  // Monthly reset: if we're in a new month, reset usage counters
  if (migrated.lastUsageReset !== currentMonth) {
    console.log(`[user] Monthly reset: ${migrated.lastUsageReset} → ${currentMonth}`);
    migrated.pdfsUsed = 0;
    migrated.spreadsheetsUsed = 0;
    migrated.invoicesUsed = 0;
    migrated.lastUsageReset = currentMonth;
  }

  return migrated;
}

/**
 * Increment quote usage counter
 */
export async function incrementQuoteCount(): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    quotesUsed: state.quotesUsed + 1,
  });
}

/**
 * Decrement quote usage counter (when quote is deleted)
 */
export async function decrementQuoteCount(): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    quotesUsed: Math.max(0, state.quotesUsed - 1),
  });
}

/**
 * Increment PDF export counter
 */
export async function incrementPdfCount(): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    pdfsUsed: state.pdfsUsed + 1,
  });
}

/**
 * Has the reviewer/user seen a given one-time nudge?
 * Returns true if the nudge has fired at any point in the past — the caller
 * decides whether to re-arm it (e.g. pdfLimit refires each month).
 */
export async function hasSeenNudge(key: keyof NudgeMap): Promise<boolean> {
  const state = await getUserState();
  return !!state.nudgesShown?.[key];
}

/**
 * Mark a nudge as shown. Timestamped so we can later detect "shown this
 * month" or similar. For truly one-time nudges (first-quote congrats),
 * hasSeenNudge is enough.
 */
export async function markNudgeShown(key: keyof NudgeMap): Promise<void> {
  const state = await getUserState();
  const nudgesShown: NudgeMap = { ...(state.nudgesShown || {}) };
  nudgesShown[key] = new Date().toISOString();
  await saveUserState({ ...state, nudgesShown });
}

/**
 * Was this nudge shown in the current calendar month?
 * Used to re-arm limit-reached nudges monthly without re-nagging inside
 * the same month.
 */
export async function wasNudgeShownThisMonth(key: keyof NudgeMap): Promise<boolean> {
  const state = await getUserState();
  const shownAt = state.nudgesShown?.[key];
  if (!shownAt) return false;
  const shownMonth = shownAt.slice(0, 7); // YYYY-MM
  return shownMonth === getCurrentMonth();
}

/**
 * Increment spreadsheet export counter
 */
export async function incrementSpreadsheetCount(): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    spreadsheetsUsed: state.spreadsheetsUsed + 1,
  });
}

/**
 * Increment invoice export counter
 */
export async function incrementInvoiceCount(): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    invoicesUsed: (state.invoicesUsed || 0) + 1,
  });
}

// ============================================================================
// Server-side usage enforcement (migration 028)
// ============================================================================
// Free-tier limits used to be enforced entirely in AsyncStorage, which let
// users reset their counters by clearing app data — direct revenue leak.
// consumeUsage() now routes signed-in users through the `consume_usage`
// Postgres RPC, which is atomic and authoritative. Anonymous (not-signed-in)
// app users still fall back to the local check, since they have no server
// identity. Pro / Premium users short-circuit to allowed without an RPC call.

export type UsageKind = "pdf" | "csv" | "invoice";

export interface UsageResult {
  allowed: boolean;
  reason: string | null; // human-friendly message when allowed=false
  used: number;
  limit: number; // -1 = unlimited
}

const KIND_LABEL: Record<UsageKind, string> = {
  pdf: "PDF exports",
  csv: "spreadsheet exports",
  invoice: "invoice exports",
};

function reasonText(kind: UsageKind, used: number, limit: number): string {
  return `You've used all ${limit} free ${KIND_LABEL[kind]} this month. Resets on the 1st.`;
}

/**
 * Check and consume a single usage slot atomically. Returns whether the
 * caller is allowed to perform the action. If allowed, the counter has
 * already been incremented (server-side for signed-in users, locally for
 * anonymous). Do NOT call increment* afterwards.
 */
export async function consumeUsage(kind: UsageKind): Promise<UsageResult> {
  // Pro / Premium: short-circuit. No need to hit the server; tier is mirrored
  // locally and they always pass.
  const state = await getUserState();
  if (state.tier === "pro" || state.tier === "premium") {
    return { allowed: true, reason: null, used: 0, limit: -1 };
  }

  // Lazy-import to avoid pulling supabase + authUtils into modules that
  // don't otherwise need them. Also keeps unit-test surface small.
  const { supabase } = await import("./supabase");
  const { getCurrentUserId } = await import("./authUtils");

  const userId = await getCurrentUserId();
  if (userId) {
    try {
      const { data, error } = await supabase.rpc("consume_usage", { p_kind: kind });
      if (!error && data && typeof data === "object") {
        const result = data as { allowed: boolean; used: number; limit: number; reason: string | null };
        // Mirror server count to local state so UI displays stay in sync
        // without a second round trip.
        await syncLocalCounter(kind, result.used);
        return {
          allowed: result.allowed,
          reason: result.allowed ? null : reasonText(kind, result.used, result.limit),
          used: result.used,
          limit: result.limit,
        };
      }
      console.warn("consume_usage RPC failed, falling back to local:", error);
    } catch (e) {
      console.warn("consume_usage RPC threw, falling back to local:", e);
    }
    // Fall through to local on RPC error — better to slightly over-grant a
    // free slot than to block a paying-imminent user with a network blip.
  }

  // Anonymous user or RPC failure: enforce + increment locally.
  return consumeLocally(kind, state);
}

async function consumeLocally(kind: UsageKind, state: UserState): Promise<UsageResult> {
  const limit = kind === "pdf" ? FREE_LIMITS.pdfs
              : kind === "csv" ? FREE_LIMITS.spreadsheets
              : FREE_LIMITS.invoices;
  const used = kind === "pdf" ? state.pdfsUsed
             : kind === "csv" ? state.spreadsheetsUsed
             : (state.invoicesUsed || 0);

  if (used >= limit) {
    return {
      allowed: false,
      reason: reasonText(kind, used, limit),
      used,
      limit,
    };
  }

  await syncLocalCounter(kind, used + 1);
  return { allowed: true, reason: null, used: used + 1, limit };
}

async function syncLocalCounter(kind: UsageKind, newCount: number): Promise<void> {
  const state = await getUserState();
  const update: Partial<UserState> = {};
  if (kind === "pdf") update.pdfsUsed = newCount;
  else if (kind === "csv") update.spreadsheetsUsed = newCount;
  else if (kind === "invoice") update.invoicesUsed = newCount;
  await saveUserState({ ...state, ...update });
}

/**
 * Activate Pro tier (called after successful login from website)
 */
export async function activateProTier(email: string): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    tier: "pro",
    email,
    proActivatedAt: new Date().toISOString(),
  });
  markTierChanged("pro");
}

/**
 * Activate Premium tier (called after successful login from website)
 */
export async function activatePremiumTier(email: string): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    tier: "premium",
    email,
    proActivatedAt: new Date().toISOString(),
  });
  markTierChanged("premium");
}

/**
 * Set user email (for any signed-in user, including free tier)
 */
export async function setUserEmail(email: string): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    email,
  });
}

/**
 * Deactivate Pro tier (subscription ended)
 */
export async function deactivateProTier(): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    tier: "free",
    proActivatedAt: undefined,
    proExpiresAt: undefined,
  });
  markTierChanged("free");
}

/**
 * Set user tier directly (used for RevenueCat sync)
 */
export async function setUserTier(tier: UserTier): Promise<void> {
  const state = await getUserState();
  const previousTier = state.tier;

  // Only update if tier actually changed
  if (previousTier === tier) return;

  console.log(`[user] Tier updated: ${previousTier} → ${tier}`);
  await saveUserState({
    ...state,
    tier,
    proActivatedAt: tier !== "free" ? (state.proActivatedAt || new Date().toISOString()) : undefined,
  });
  markTierChanged(tier);
}

/**
 * Sign out user
 */
export async function signOutUser(): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    tier: "free",
    email: undefined,
    proActivatedAt: undefined,
    proExpiresAt: undefined,
  });
  markTierChanged("free");
  resetAnalyticsUser();
}

/**
 * Reset usage counters (for testing)
 */
export async function resetUsageCounters(): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    pdfsUsed: 0,
    spreadsheetsUsed: 0,
    invoicesUsed: 0,
  });
  console.log('✅ Usage counters reset');
}
