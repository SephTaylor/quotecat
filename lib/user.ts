// lib/user.ts
// User state and tier management

import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserTier = "free" | "pro" | "premium";

export type UserState = {
  tier: UserTier;
  email?: string;
  displayName?: string; // User's display name for contracts
  quotesUsed: number;
  pdfsUsed: number; // Lifetime total
  spreadsheetsUsed: number; // Lifetime total
  // Pro user fields
  proActivatedAt?: string;
  proExpiresAt?: string; // For trial/subscription tracking
};

export const FREE_LIMITS = {
  quotes: 10,
  pdfs: 10,
  spreadsheets: 5,
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
 * Default state for new users
 */
function getDefaultUserState(): UserState {
  return {
    tier: "free", // New users start on free tier until they subscribe
    quotesUsed: 0,
    pdfsUsed: 0,
    spreadsheetsUsed: 0,
  };
}

/**
 * Migrate old monthly fields to new lifetime fields
 */
function migrateUserState(state: UserState): UserState {
  // Handle migration from old monthly fields
  const migrated = { ...state };
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
