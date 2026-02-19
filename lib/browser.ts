// lib/browser.ts
// In-app browser utility for opening product URLs

import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

/**
 * Open a URL in the in-app browser (Safari View Controller / Chrome Custom Tab).
 * Falls back to external browser if in-app browser fails.
 */
export async function openProductUrl(url: string): Promise<void> {
  if (!url) return;

  try {
    await WebBrowser.openBrowserAsync(url, {
      dismissButtonStyle: 'close',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: '#FF9500', // Match app accent color
    });
  } catch (error) {
    // Fallback to external browser if WebBrowser fails
    console.warn('In-app browser failed, falling back to external:', error);
    Linking.openURL(url);
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
