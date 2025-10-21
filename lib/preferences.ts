// lib/preferences.ts
// User preferences and dashboard customization

import AsyncStorage from "@react-native-async-storage/async-storage";

export type DashboardPreferences = {
  showStats: boolean;
  showValueTracking: boolean;
  showPinnedQuotes: boolean;
  showRecentQuotes: boolean;
  showQuickActions: boolean;
  recentQuotesCount: 3 | 5 | 10 | "all";
};

export type PrivacyPreferences = {
  shareAnonymousUsage: boolean; // Opt-in for anonymous product usage analytics
};

export type UserPreferences = {
  dashboard: DashboardPreferences;
  privacy: PrivacyPreferences;
  // Add more preference categories as needed
  // notifications: NotificationPreferences;
  // appearance: AppearancePreferences;
};

const PREFERENCES_KEY = "@quotecat/preferences";

/**
 * Default preferences for new users
 */
export function getDefaultPreferences(): UserPreferences {
  return {
    dashboard: {
      showStats: true,
      showValueTracking: true,
      showPinnedQuotes: true,
      showRecentQuotes: true,
      showQuickActions: true,
      recentQuotesCount: 5,
    },
    privacy: {
      shareAnonymousUsage: false, // Opt-in, not opt-out
    },
  };
}

/**
 * Load user preferences from storage
 */
export async function loadPreferences(): Promise<UserPreferences> {
  try {
    const json = await AsyncStorage.getItem(PREFERENCES_KEY);
    if (!json) {
      return getDefaultPreferences();
    }

    const stored = JSON.parse(json) as Partial<UserPreferences>;
    // Merge with defaults to handle new preference fields
    return {
      ...getDefaultPreferences(),
      ...stored,
      dashboard: {
        ...getDefaultPreferences().dashboard,
        ...stored.dashboard,
      },
      privacy: {
        ...getDefaultPreferences().privacy,
        ...stored.privacy,
      },
    };
  } catch (error) {
    console.error("Failed to load preferences:", error);
    return getDefaultPreferences();
  }
}

/**
 * Save user preferences to storage
 */
export async function savePreferences(
  preferences: UserPreferences,
): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error("Failed to save preferences:", error);
  }
}

/**
 * Update dashboard preferences
 */
export async function updateDashboardPreferences(
  updates: Partial<DashboardPreferences>,
): Promise<UserPreferences> {
  const prefs = await loadPreferences();
  const updated: UserPreferences = {
    ...prefs,
    dashboard: {
      ...prefs.dashboard,
      ...updates,
    },
  };
  await savePreferences(updated);
  return updated;
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(): Promise<UserPreferences> {
  const defaults = getDefaultPreferences();
  await savePreferences(defaults);
  return defaults;
}
