// lib/user.ts
// User state and tier management

import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserTier = "free" | "pro" | "premium";

export type UserState = {
  tier: UserTier;
  email?: string;
  // Unlimited draft quotes - no counter needed
  pdfsExported: number;  // Total PDF exports (not monthly)
  // Pro user fields
  proActivatedAt?: string;
  proExpiresAt?: string; // For trial/subscription tracking
};

export const FREE_LIMITS = {
  pdfsTotal: 10,  // Total client exports
  // Unlimited draft quotes
  // CSV export is Pro-only
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
    const state = JSON.parse(json) as any;

    // Migrate old user state to new structure
    const migratedState: UserState = {
      tier: state.tier || "free",
      email: state.email,
      pdfsExported: state.pdfsExported ?? state.pdfsThisMonth ?? 0, // Migrate from old field
      proActivatedAt: state.proActivatedAt,
      proExpiresAt: state.proExpiresAt,
    };

    return migratedState;
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
 * NOTE: Default tier is "free" - users must sign in with paid account for Pro features
 */
function getDefaultUserState(): UserState {
  return {
    tier: "free", // Default to free - Pro tier activated via Supabase authentication
    pdfsExported: 0,  // Total exports (not monthly)
  };
}

/**
 * Increment PDF export counter
 */
export async function incrementPdfCount(): Promise<void> {
  const state = await getUserState();
  await saveUserState({
    ...state,
    pdfsExported: state.pdfsExported + 1,
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
