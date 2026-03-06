// lib/revenuecat.ts
// RevenueCat configuration with LAZY loading
// Only initializes when user enters purchase flow (not at app startup)

import { Platform } from 'react-native';
import { getCurrentUserId } from './authUtils';

// Track initialization state
let isInitialized = false;
let PurchasesModule: any = null;
let LOG_LEVEL: any = null;

// API Keys - Get these from RevenueCat dashboard
const REVENUECAT_IOS_KEY = 'appl_ExkgnPkiEZCaTifCLtvAjbgBoPf';
const REVENUECAT_ANDROID_KEY = 'test_JMfMXQVdDJPruXJknXvgZTQutmz';

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
    await PurchasesModule.configure({ apiKey });

    // Link to current user if logged in
    const userId = await getCurrentUserId();
    if (userId) {
      await PurchasesModule.logIn(userId);
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
 * Present paywall and handle purchase
 * Initializes RevenueCat lazily if needed
 * Returns false if RC unavailable (simulator) or user cancelled
 *
 * Note: After purchase, tier syncs via RevenueCat webhook → Supabase profiles.tier
 * The app reads tier from Supabase, not RevenueCat
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
    // Tier will update via webhook → Supabase → app sync
    return result === 'PURCHASED' || result === 'RESTORED';
  } catch (e) {
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
