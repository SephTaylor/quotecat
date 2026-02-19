// lib/browser.ts
// Browser utility for opening product URLs

import { Linking } from 'react-native';

/**
 * Open a URL in external Safari/Chrome.
 *
 * Note: We use external browser instead of in-app browser (Safari View Controller)
 * because retailer sites (Lowe's, Home Depot, Menards) block embedded browsers
 * with "Access Denied" or error pages due to bot protection.
 */
export async function openProductUrl(url: string): Promise<void> {
  if (!url) return;

  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn('Failed to open URL:', error);
  }
}

/**
 * Get human-readable store name from supplier ID.
 */
export function getStoreName(supplierId?: string): string {
  const STORE_NAMES: Record<string, string> = {
    homedepot: 'Home Depot',
    lowes: "Lowe's",
    menards: 'Menards',
  };
  return STORE_NAMES[supplierId || ''] || 'Store';
}
