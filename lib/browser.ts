// lib/browser.ts
// Browser utility for opening product URLs

import { Linking } from 'react-native';

/**
 * Site-specific Google search patterns.
 * We route through Google because retailers block direct links from apps,
 * but they can't block traffic that comes from Google search results.
 */
const GOOGLE_SITE_SEARCH: Record<string, string> = {
  homedepot: 'site:homedepot.com',
  lowes: 'site:lowes.com',
  menards: 'site:menards.com',
};

/**
 * Open a Google search scoped to the retailer's site.
 *
 * We route through Google because retailers (Lowe's, Home Depot, Menards)
 * aggressively block any direct links from apps - even to search pages.
 * By using Google as an intermediary, the retailer sees traffic from Google,
 * not from our app.
 */
export async function openProductSearch(
  productName: string,
  supplierId?: string
): Promise<void> {
  if (!productName) return;

  try {
    const siteFilter = GOOGLE_SITE_SEARCH[supplierId || ''] || '';
    const query = siteFilter
      ? `${siteFilter} ${productName}`
      : productName;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    await Linking.openURL(googleUrl);
  } catch (error) {
    console.warn('Failed to open search URL:', error);
  }
}

/**
 * @deprecated Use openProductSearch instead - direct URLs are blocked by retailers
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
