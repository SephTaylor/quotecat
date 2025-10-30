// lib/app-analytics.ts
// Analytics tracking using PostHog

import PostHog from 'posthog-react-native';

// Global PostHog instance
let posthogInstance: PostHog | null = null;

/**
 * Initialize PostHog analytics
 */
export async function initAnalytics(): Promise<void> {
  try {
    const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
    const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

    if (!apiKey) {
      console.warn('PostHog API key not configured - analytics disabled');
      return;
    }

    // Initialize PostHog with constructor (v3.0.0+ API)
    posthogInstance = new PostHog(apiKey, {
      host,
    });

    console.log('Analytics initialized');
  } catch (error) {
    console.error('Failed to initialize analytics:', error);
  }
}

/**
 * Analytics event names
 */
export const AnalyticsEvents = {
  // App lifecycle
  APP_OPENED: 'app_opened',

  // Quote operations
  QUOTE_CREATED: 'quote_created',
  QUOTE_UPDATED: 'quote_updated',
  QUOTE_DELETED: 'quote_deleted',
  QUOTE_DUPLICATED: 'quote_duplicated',
  REVIEW_OPENED: 'review_opened',

  // Export operations
  PDF_GENERATED: 'pdf_generated',
  PDF_SHARED: 'pdf_shared',
  CSV_GENERATED: 'csv_generated',
  CSV_SHARED: 'csv_shared',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
} as const;

/**
 * Track an analytics event
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  try {
    if (posthogInstance) {
      posthogInstance.capture(eventName, properties);
    }
  } catch (error) {
    console.error('Failed to track event:', eventName, error);
  }
}
