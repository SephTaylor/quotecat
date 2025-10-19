// lib/user.ts
// User state and tier management

import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserTier = "free" | "pro";

export type UserState = {
  tier: UserTier;
  email?: string;
  quotesUsed: number;
  pdfsThisMonth: number;
  lastPdfResetDate: string; // ISO date for monthly reset
  // Pro user fields
  proActivatedAt?: string;
  proExpiresAt?: string; // For trial/subscription tracking
};

export const FREE_LIMITS = {
  quotes: 10,
  pdfsPerMonth: 3,
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
    // Reset PDF count if month has changed
    return resetPdfCountIfNeeded(state);
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
    tier: "free",
    quotesUsed: 0,
    pdfsThisMonth: 0,
    lastPdfResetDate: new Date().toISOString(),
  };
}

/**
 * Reset PDF count if we're in a new month
 */
function resetPdfCountIfNeeded(state: UserState): UserState {
  const lastReset = new Date(state.lastPdfResetDate);
  const now = new Date();

  // Check if month or year has changed
  if (
    lastReset.getMonth() !== now.getMonth() ||
    lastReset.getFullYear() !== now.getFullYear()
  ) {
    return {
      ...state,
      pdfsThisMonth: 0,
      lastPdfResetDate: now.toISOString(),
    };
  }

  return state;
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
    pdfsThisMonth: state.pdfsThisMonth + 1,
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
