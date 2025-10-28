// lib/app-analytics.ts
// General app analytics using PostHog

import PostHog from 'posthog-react-native';

// Initialize PostHog
let posthog: PostHog | null = null;

export const initAnalytics = async () => {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;

  if (!apiKey || apiKey === 'placeholder_get_from_posthog') {
    console.log('[Analytics] PostHog not configured - skipping initialization');
    return;
  }

  try {
    posthog = new PostHog(apiKey, {
      host: host || 'https://app.posthog.com',
    });

    console.log('[Analytics] PostHog initialized');
  } catch (error) {
    console.error('[Analytics] Failed to initialize PostHog:', error);
  }
};

// Track events
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (!posthog) {
    console.log(`[Analytics] Event tracked (offline): ${eventName}`, properties);
    return;
  }

  try {
    posthog.capture(eventName, properties);
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error);
  }
};

// Identify user (for when we add auth later)
export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (!posthog) return;

  try {
    posthog.identify(userId, traits);
  } catch (error) {
    console.error('[Analytics] Failed to identify user:', error);
  }
};

// Reset user (on logout)
export const resetUser = () => {
  if (!posthog) return;

  try {
    posthog.reset();
  } catch (error) {
    console.error('[Analytics] Failed to reset user:', error);
  }
};

// Key events to track
export const AnalyticsEvents = {
  // App lifecycle
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',

  // Quote events
  QUOTE_CREATED: 'quote_created',
  QUOTE_UPDATED: 'quote_updated',
  QUOTE_DELETED: 'quote_deleted',
  QUOTE_DUPLICATED: 'quote_duplicated',

  // Material selection
  MATERIAL_ADDED: 'material_added',
  MATERIAL_REMOVED: 'material_removed',
  MATERIAL_SEARCH: 'material_search',

  // Assembly events
  ASSEMBLY_CREATED: 'assembly_created',
  ASSEMBLY_USED: 'assembly_used',
  ASSEMBLY_DELETED: 'assembly_deleted',

  // Export events
  PDF_GENERATED: 'pdf_generated',
  PDF_SHARED: 'pdf_shared',
  CSV_EXPORTED: 'csv_exported',

  // Review screen
  REVIEW_OPENED: 'review_opened',
  COMPANY_DETAILS_UPDATED: 'company_details_updated',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
  SAVE_FAILED: 'save_failed',

  // Feature usage
  CALCULATOR_USED: 'calculator_used',
  LABOR_ADDED: 'labor_added',
  MARKUP_CHANGED: 'markup_changed',
} as const;

export type AnalyticsEvent = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];
