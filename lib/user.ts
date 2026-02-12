// lib/user.ts
// User state and tier management

import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserTier = "free" | "pro" | "premium";

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
};

export const FREE_LIMITS = {
  quotes: 10,
  pdfs: 5,        // Per month
  spreadsheets: 5, // Per month
  invoices: 5,     // Per month (with QuoteCat branding)
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
}
