// lib/revenuecat.ts
// RevenueCat configuration and helpers for in-app purchases

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import { setUserTier, type UserTier } from './user';

// API Keys - Get these from RevenueCat dashboard
// https://app.revenuecat.com → Project → API Keys
const REVENUECAT_IOS_KEY = 'appl_ExkgnPkiEZCaTifCLtvAjbgBoPf'; // Production iOS key
const REVENUECAT_ANDROID_KEY = 'test_JMfMXQVdDJPruXJknXvgZTQutmz'; // Test key - replace with goog_* for production

// Entitlement IDs - must match what you set up in RevenueCat dashboard
export const ENTITLEMENTS = {
  PRO: 'pro',
  PREMIUM: 'premium',
} as const;

/**
 * Initialize RevenueCat SDK
 * Call this once at app startup (in _layout.tsx)
 */
export async function initializeRevenueCat(): Promise<void> {
  // Enable verbose logging in development
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  }

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  await Purchases.configure({ apiKey });
  console.log('✅ RevenueCat initialized');
}

/**
 * Link RevenueCat to your Supabase user ID
 * Call this after user signs in
 */
export async function identifyUser(userId: string): Promise<void> {
  await Purchases.logIn(userId);
  console.log('✅ RevenueCat user identified:', userId);
}

/**
 * Clear RevenueCat user (on sign out)
 */
export async function logOutRevenueCat(): Promise<void> {
  await Purchases.logOut();
  console.log('✅ RevenueCat user logged out');
}

/**
 * Get current customer info (subscription status)
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return await Purchases.getCustomerInfo();
}

/**
 * Check if user has Pro access
 */
export async function hasProAccess(): Promise<boolean> {
  const customerInfo = await getCustomerInfo();
  return customerInfo.entitlements.active[ENTITLEMENTS.PRO] !== undefined ||
         customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;
}

/**
 * Check if user has Premium access
 */
export async function hasPremiumAccess(): Promise<boolean> {
  const customerInfo = await getCustomerInfo();
  return customerInfo.entitlements.active[ENTITLEMENTS.PREMIUM] !== undefined;
}

/**
 * Get available offerings (products/packages)
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

/**
 * Restore purchases (for users who reinstall or switch devices)
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  return await Purchases.restorePurchases();
}

/**
 * Sync local tier with RevenueCat entitlements
 * Call this on app startup after RevenueCat initializes
 */
export async function syncTierFromRevenueCat(): Promise<void> {
  try {
    const customerInfo = await getCustomerInfo();
    const activeEntitlements = customerInfo.entitlements.active;

    let newTier: UserTier = 'free';

    // Check for Premium first (higher tier)
    if (activeEntitlements[ENTITLEMENTS.PREMIUM]) {
      newTier = 'premium';
    } else if (activeEntitlements[ENTITLEMENTS.PRO]) {
      newTier = 'pro';
    }

    // Update local tier to match RevenueCat
    await setUserTier(newTier);
    console.log('✅ RevenueCat tier synced:', newTier);
  } catch (error) {
    console.error('Failed to sync tier from RevenueCat:', error);
    // Don't throw - we'll just use the existing local tier
  }
}
