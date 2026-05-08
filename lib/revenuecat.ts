// lib/revenuecat.ts
// RevenueCat configuration with LAZY loading
// Only initializes when user enters purchase flow (not at app startup)

import { Platform } from 'react-native';
import { getCurrentUserId } from './authUtils';
import { supabase } from './supabase';
import { setUserTier, UserTier } from './user';

// Track initialization state
let isInitialized = false;
let PurchasesModule: any = null;
let LOG_LEVEL: any = null;

// API Keys - Get these from RevenueCat dashboard
const REVENUECAT_IOS_KEY = 'appl_ExkgnPkiEZCaTifCLtvAjbgBoPf';
const REVENUECAT_ANDROID_KEY = 'goog_WMUEXXKDginLWBHcqozxEUEWOqF';

// Entitlement IDs - must match RevenueCat dashboard
export const ENTITLEMENTS = {
  PRO: 'pro',
  PREMIUM: 'premium',
} as const;

/**
 * Lazy-initialize RevenueCat
 * Only call this when user is about to see the paywall
 * Returns false if initialization fails (e.g., on simulator)
 */
async function ensureInitialized(): Promise<boolean> {
  if (isInitialized && PurchasesModule) return true;

  try {
    // Use require() instead of dynamic import to avoid Metro's importAll issue
    // which triggers PushNotificationIOS loading on simulator
    const RC = require('react-native-purchases');
    PurchasesModule = RC.default;
    LOG_LEVEL = RC.LOG_LEVEL;

    if (__DEV__) {
      PurchasesModule.setLogLevel(LOG_LEVEL.VERBOSE);
    }

    const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

    // Pass appUserID up front so RC never creates an anonymous user. Without
    // this, configure() creates an anonymous identity, then logIn() aliases it
    // to the real user — but RC's webhook can still fire purchase events under
    // the anonymous ID, which dropped tier updates on the floor before the
    // server-side alias-resolution fix landed.
    const userId = await getCurrentUserId();
    if (userId) {
      await PurchasesModule.configure({ apiKey, appUserID: userId });
    } else {
      // Anonymous fallback — only if we somehow open the paywall without a
      // signed-in user. The signed-out flow shouldn't reach this code path.
      await PurchasesModule.configure({ apiKey });
    }

    isInitialized = true;
    console.log('✅ RevenueCat initialized (lazy)');
    return true;
  } catch (e) {
    console.warn('RevenueCat not available (simulator?):', e);
    return false;
  }
}

/**
 * Refresh user tier from Supabase after purchase
 * Webhook updates profiles.tier, this syncs it to local state
 */
async function refreshTierFromSupabase(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log('No user ID, cannot refresh tier');
    return;
  }

  // Give webhook a moment to process (RevenueCat → Supabase)
  await new Promise(r => setTimeout(r, 2000));

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (profile?.tier) {
      console.log(`✅ Refreshed tier from Supabase: ${profile.tier}`);
      await setUserTier(profile.tier as UserTier);
    }
  } catch (e) {
    console.error('Failed to refresh tier:', e);
  }
}

/**
 * Present paywall and handle purchase
 * Initializes RevenueCat lazily if needed
 * Returns false if RC unavailable (simulator) or user cancelled
 *
 * After purchase, refreshes tier from Supabase (webhook updates profiles.tier)
 */
export async function presentPaywallAndSync(): Promise<boolean> {
  const ready = await ensureInitialized();
  if (!ready) {
    // On simulator or if RC fails, can't show paywall
    // Caller should show "upgrade via website" message
    return false;
  }

  try {
    const RevenueCatUI = require('react-native-purchases-ui').default;
    const result = await RevenueCatUI.presentPaywall();

    // PURCHASED or RESTORED means successful
    if (result === 'PURCHASED' || result === 'RESTORED') {
      // Sync tier from Supabase (webhook should have updated it)
      await refreshTierFromSupabase();
      return true;
    }
    return false;
  } catch (e: any) {
    // User cancellation is not an error - handle it quietly
    if (e?.userCancelled || e?.code === 'PURCHASE_CANCELLED' || e?.message?.includes('cancel')) {
      console.log('User cancelled purchase');
      return false;
    }
    console.error('Paywall error:', e);
    return false;
  }
}

/**
 * Restore purchases (for users who reinstall or switch devices)
 * Returns false if RC unavailable
 */
export async function restorePurchases(): Promise<boolean> {
  const ready = await ensureInitialized();
  if (!ready) return false;

  try {
    await PurchasesModule.restorePurchases();
    console.log('✅ Purchases restored');
    // Sync tier from Supabase after restore
    await refreshTierFromSupabase();
    return true;
  } catch (e) {
    console.error('Restore purchases failed:', e);
    return false;
  }
}

/**
 * Clear RevenueCat user on sign out
 * Safe to call even if RC was never initialized
 */
export async function logOutRevenueCat(): Promise<void> {
  if (!isInitialized || !PurchasesModule) {
    // Never initialized, nothing to do
    return;
  }

  try {
    await PurchasesModule.logOut();
    console.log('✅ RevenueCat user logged out');
  } catch (e) {
    console.warn('RevenueCat logout failed:', e);
  }
}
