// lib/revenuecat.ts
// RevenueCat configuration with LAZY loading
// Only initializes when user enters purchase flow (not at app startup)

import { Platform } from 'react-native';
import { getCurrentUserId } from './authUtils';
import { supabase } from './supabase';
import { setUserTier, getUserState, UserTier } from './user';
import { trackEvent, AnalyticsEvents } from './app-analytics';
import { getTechContext } from './team';

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
 * Resolve the user's tier from a RevenueCat customerInfo object.
 *
 * Uses RC's LOCAL entitlement state — updated synchronously by the SDK
 * when an IAP completes on this device. Authoritative for "did I just buy
 * something here." No webhook race; no Supabase round-trip.
 *
 * Cross-device sync still happens via Supabase (the revenuecat-webhook edge
 * function mirrors entitlements to profiles.tier server-side), but that's
 * eventually consistent. For immediate post-PURCHASED UI updates, this
 * local read is the source of truth.
 *
 * Premium > Pro > Free in the precedence check (Premium implies Pro).
 */
function resolveTierFromCustomerInfo(customerInfo: { entitlements?: { active?: Record<string, unknown> } } | null | undefined): UserTier {
  const active = customerInfo?.entitlements?.active ?? {};
  if (active[ENTITLEMENTS.PREMIUM]) return 'premium';
  if (active[ENTITLEMENTS.PRO]) return 'pro';
  return 'free';
}

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
      const supabaseTier = profile.tier as UserTier;

      // Never downgrade based on a stale Supabase read. The RC webhook chain
      // (RevenueCat → revenuecat-webhook edge function → upsert_subscription_event
      // RPC → profiles.tier mirror) commonly takes 3-10s in production. If the
      // post-IAP background sync runs before the webhook lands, this read
      // returns 'free' while local state already correctly shows 'pro' or
      // 'premium' from the RC local-entitlement read in presentPaywallAndSync.
      // Letting that overwrite would cause a visible tier flicker:
      // free → pro (RC) → free (this) → pro (next webhook-driven refresh).
      // Background sync only ratchets up; downgrades come from auth changes
      // (sign-out, deactivateProTier) on the explicit code paths.
      const localState = await getUserState();
      const localIsHigher =
        (localState.tier === 'premium' && supabaseTier !== 'premium') ||
        (localState.tier === 'pro' && supabaseTier === 'free');

      if (localIsHigher) {
        console.log(
          `[paywall] background Supabase sync skipped: local=${localState.tier} > supabase=${supabaseTier} (likely webhook still in flight)`,
        );
        return;
      }

      console.log(`✅ Refreshed tier from Supabase: ${supabaseTier}`);
      await setUserTier(supabaseTier);
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

  // Architectural rule (locked 2026-06-25): techs should never see paywalls.
  // They get app access through their owner's subscription and never
  // complete an IAP themselves. If a tap handler upstream missed the isTech
  // check, catch it here — a tech paying for an IAP gets nothing because
  // their effectiveTier comes from their owner's tier, not their own.
  // Single source of truth for tech-paywall-prevention.
  try {
    const userIdForTechCheck = await getCurrentUserId();
    if (userIdForTechCheck) {
      const techCtx = await getTechContext(userIdForTechCheck);
      if (techCtx.isTech) {
        console.log('[paywall] tech detected — no-op (techs cannot subscribe)');
        return false;
      }
    }
  } catch (e) {
    // If the tech check itself fails, fall through and let the paywall show.
    // Better to allow a possible-tech to see a paywall (they can cancel)
    // than to block all paywalls due to a transient error.
    console.warn('[paywall] tech check failed, continuing:', e);
  }

  trackEvent(AnalyticsEvents.PAYWALL_SHOWN, { source: source ?? 'unknown' });

  try {
    const RevenueCatUI = require('react-native-purchases-ui').default;
    const result = await RevenueCatUI.presentPaywall();

    // PURCHASED or RESTORED means successful
    if (result === 'PURCHASED' || result === 'RESTORED') {
      // IMMEDIATE truth: read RC's local entitlement state. The SDK has
      // already updated this synchronously when the IAP completed on
      // device — no webhook race, no Supabase round-trip. setUserTier
      // also emits markTierChanged() which causes TechContext to refresh
      // its React state, so all useTechContext() consumers re-render
      // with the new tier within one render cycle.
      try {
        const customerInfo = await PurchasesModule.getCustomerInfo();
        const tier = resolveTierFromCustomerInfo(customerInfo);
        if (tier !== 'free') {
          await setUserTier(tier);
        } else {
          console.warn('[paywall] PURCHASED but RC entitlements empty — falling back to Supabase');
        }
      } catch (e) {
        // Don't block — fall through to the Supabase background sync.
        // If RC local read fails, the user still gets the tier flip
        // eventually via the webhook → Supabase path.
        console.warn('[paywall] RC customerInfo read failed:', e);
      }

      // EVENTUALLY-CONSISTENT cross-device sync: keep the Supabase mirror
      // call as belt-and-suspenders. Fire-and-forget — don't block UI on it.
      refreshTierFromSupabase().catch((e) => {
        console.warn('[paywall] background Supabase sync failed:', e);
      });

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

    // IMMEDIATE truth: restored entitlements appear in customerInfo just
    // like a fresh PURCHASED outcome. Same code path as presentPaywallAndSync.
    try {
      const customerInfo = await PurchasesModule.getCustomerInfo();
      const tier = resolveTierFromCustomerInfo(customerInfo);
      if (tier !== 'free') {
        await setUserTier(tier);
      }
    } catch (e) {
      console.warn('[restore] RC customerInfo read failed:', e);
    }

    // Background Supabase sync as fallback / cross-device consistency.
    refreshTierFromSupabase().catch((e) => {
      console.warn('[restore] background Supabase sync failed:', e);
    });

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
