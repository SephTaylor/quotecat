// lib/revenuecat.ts
// RevenueCat configuration with LAZY loading
// Only initializes when user enters purchase flow (not at app startup)

import { Platform } from 'react-native';
import { getCurrentUserId } from './authUtils';
import { supabase } from './supabase';
import { setUserTier, UserTier } from './user';
import { trackEvent, AnalyticsEvents } from './app-analytics';

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
 * Ensure RevenueCat's internal user identity matches the current
 * Supabase-authenticated user.
 *
 * Why this exists: configure({ appUserID }) only sets the user once per
 * app install. If a user signs out and a different user signs in on the
 * same install, RC's stored identity does NOT update on its own. Without
 * this sync, the next IAP/restore on the device fires a webhook under
 * the previous user's app_user_id — crediting the wrong account.
 *
 * Idempotent and cheap: we read the current RC app user id and only call
 * logIn() when it actually differs from the current Supabase user.
 *
 * Called before every paywall, restore, and tier-sensitive operation so
 * RC's identity is current at the moment a transaction begins. Discovered
 * 2026-06-22 during the v1.2.10 IAP verification when a TestFlight test
 * routed nonyabiznix's purchase to jobhato's RC customer record because
 * RC had been configured with jobhato's id earlier in the session and
 * never re-aliased after the sign-out / sign-in switch.
 */
async function syncCurrentUserToRevenueCat(): Promise<void> {
  if (!isInitialized || !PurchasesModule) return;

  try {
    const supabaseUserId = await getCurrentUserId();
    if (!supabaseUserId) {
      // No signed-in Supabase user; leave RC in whatever state it's in.
      // (logOutRevenueCat is the explicit path for clearing identity.)
      return;
    }

    const rcUserId = await PurchasesModule.getAppUserID();
    if (rcUserId === supabaseUserId) {
      // Already in sync — nothing to do.
      return;
    }

    console.log(
      `🔄 RevenueCat user mismatch — rc=${rcUserId} supabase=${supabaseUserId} — re-aliasing via logIn`,
    );
    await PurchasesModule.logIn(supabaseUserId);
    console.log(`✅ RevenueCat user re-aliased to ${supabaseUserId}`);
  } catch (e) {
    // Don't throw — if we can't sync, the worst case is reverting to the
    // previous identity bug for that one operation. Better to attempt the
    // purchase than block it.
    console.warn('RevenueCat user sync failed:', e);
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
 *
 * @param source label for analytics so we can see which surface drives
 *   the most paywall traffic (e.g. "card_payments_tile",
 *   "export_lock", "business_settings_smsmessaging"). Optional.
 */
export async function presentPaywallAndSync(source?: string): Promise<boolean> {
  const ready = await ensureInitialized();
  if (!ready) {
    // On simulator or if RC fails, can't show paywall
    // Caller should show "upgrade via website" message
    return false;
  }

  // Make sure RC's identity matches the currently-signed-in Supabase user
  // before any IAP / restore can fire. See syncCurrentUserToRevenueCat
  // for the bug this protects against.
  await syncCurrentUserToRevenueCat();

  trackEvent(AnalyticsEvents.PAYWALL_SHOWN, { source: source ?? 'unknown' });

  try {
    const RevenueCatUI = require('react-native-purchases-ui').default;
    const result = await RevenueCatUI.presentPaywall();

    // PURCHASED or RESTORED means successful
    if (result === 'PURCHASED' || result === 'RESTORED') {
      // Sync tier from Supabase (webhook should have updated it)
      await refreshTierFromSupabase();
      trackEvent(AnalyticsEvents.PAYWALL_PURCHASED, {
        source: source ?? 'unknown',
        outcome: result.toLowerCase(),
      });
      return true;
    }
    trackEvent(AnalyticsEvents.PAYWALL_DISMISSED, {
      source: source ?? 'unknown',
      reason: 'closed_without_purchase',
    });
    return false;
  } catch (e: any) {
    // User cancellation is not an error - handle it quietly
    if (e?.userCancelled || e?.code === 'PURCHASE_CANCELLED' || e?.message?.includes('cancel')) {
      console.log('User cancelled purchase');
      trackEvent(AnalyticsEvents.PAYWALL_DISMISSED, {
        source: source ?? 'unknown',
        reason: 'user_cancelled',
      });
      return false;
    }
    console.error('Paywall error:', e);
    trackEvent(AnalyticsEvents.PAYWALL_DISMISSED, {
      source: source ?? 'unknown',
      reason: 'error',
    });
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

  // Same identity check as the paywall path — a restore should always
  // credit the currently-signed-in Supabase user, not whoever RC's stored
  // identity happens to be from a previous session.
  await syncCurrentUserToRevenueCat();

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
