// lib/preferences.ts
// User preferences and dashboard customization

import AsyncStorage from "@react-native-async-storage/async-storage";

export type DashboardPreferences = {
  showStats: boolean;
  showValueTracking: boolean;
  showPinnedQuotes: boolean;
  showRecentQuotes: boolean;
  showQuickActions: boolean;
  showRecentInvoices: boolean;
  showRecentContracts: boolean;
  recentQuotesCount: 3 | 5 | 10 | "all";
};

export type PrivacyPreferences = {
  shareAnonymousUsage: boolean; // Opt-in for anonymous product usage analytics
};

export type CompanyDetails = {
  companyName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  logoUrl?: string; // Optional logo URL
};

export type InvoiceSettings = {
  prefix: string; // e.g., "INV", "2025", etc.
  nextNumber: number; // Next invoice number to use
};

export type ContractSettings = {
  prefix: string; // e.g., "CTR", "CONTRACT", etc.
  nextNumber: number; // Next contract number to use
};

export type NotificationPreferences = {
  invoiceOverdue: boolean; // Notify when invoice becomes overdue
  invoiceDueSoon: boolean; // Notify 3 days before due date
  invoiceDueToday: boolean; // Notify on due date
  // Quote follow-up reminders
  autoFollowUpEnabled: boolean; // Auto-remind for sent quotes
  autoFollowUpDays: 3 | 5 | 7 | 14; // Days after sent to remind
};

export type PricingSettings = {
  zipCode: string; // User's zip code for regional pricing
  defaultTaxPercent: number; // Default tax % for new quotes
  defaultMarkupPercent: number; // Default markup % for new quotes
};

export type UserPreferences = {
  dashboard: DashboardPreferences;
  privacy: PrivacyPreferences;
  company: CompanyDetails;
  invoice: InvoiceSettings;
  contract: ContractSettings;
  notifications: NotificationPreferences;
  pricing: PricingSettings;
  // Add more preference categories as needed
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
      showRecentInvoices: true,
      showRecentContracts: true,
      recentQuotesCount: 5,
    },
    privacy: {
      shareAnonymousUsage: false, // Opt-in, not opt-out
    },
    company: {
      companyName: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      logoUrl: undefined,
    },
    invoice: {
      prefix: "INV",
      nextNumber: 1,
    },
    contract: {
      prefix: "CTR",
      nextNumber: 1,
    },
    notifications: {
      invoiceOverdue: false,
      invoiceDueSoon: false,
      invoiceDueToday: false,
      autoFollowUpEnabled: true,
      autoFollowUpDays: 5,
    },
    pricing: {
      zipCode: "",
      defaultTaxPercent: 0,
      defaultMarkupPercent: 0,
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

    const stored = JSON.parse(json) as any;

    // Migration: If dashboard properties are at top level (from old bug), migrate them
    const dashboardData = stored.dashboard || {};
    const keys = ['showStats', 'showValueTracking', 'showPinnedQuotes', 'showRecentQuotes', 'showQuickActions', 'recentQuotesCount'];
    keys.forEach(key => {
      if (stored[key] !== undefined && dashboardData[key] === undefined) {
        dashboardData[key] = stored[key];
      }
    });

    // Merge with defaults to handle new preference fields
    const result: UserPreferences = {
      ...getDefaultPreferences(),
      dashboard: {
        ...getDefaultPreferences().dashboard,
        ...dashboardData,
      },
      privacy: {
        ...getDefaultPreferences().privacy,
        ...stored.privacy,
      },
      company: {
        ...getDefaultPreferences().company,
        ...stored.company,
      },
      invoice: {
        ...getDefaultPreferences().invoice,
        ...stored.invoice,
      },
      notifications: {
        ...getDefaultPreferences().notifications,
        ...stored.notifications,
      },
      pricing: {
        ...getDefaultPreferences().pricing,
        ...stored.pricing,
      },
    };

    // Save migrated preferences back to storage to clean up
    if (keys.some(key => stored[key] !== undefined)) {
      await savePreferences(result);
    }

    return result;
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
 * Update company details
 */
export async function updateCompanyDetails(
  updates: Partial<CompanyDetails>,
): Promise<UserPreferences> {
  const prefs = await loadPreferences();
  const updated: UserPreferences = {
    ...prefs,
    company: {
      ...prefs.company,
      ...updates,
    },
  };
  await savePreferences(updated);
  return updated;
}

/**
 * Update invoice settings
 */
export async function updateInvoiceSettings(
  updates: Partial<InvoiceSettings>,
): Promise<UserPreferences> {
  const prefs = await loadPreferences();
  const updated: UserPreferences = {
    ...prefs,
    invoice: {
      ...prefs.invoice,
      ...updates,
    },
  };
  await savePreferences(updated);
  return updated;
}

/**
 * Update contract settings (prefix, next number)
 */
export async function updateContractSettings(
  updates: Partial<ContractSettings>,
): Promise<UserPreferences> {
  const prefs = await loadPreferences();
  const updated: UserPreferences = {
    ...prefs,
    contract: {
      ...prefs.contract,
      ...updates,
    },
  };
  await savePreferences(updated);
  return updated;
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  updates: Partial<NotificationPreferences>,
): Promise<UserPreferences> {
  const prefs = await loadPreferences();
  const updated: UserPreferences = {
    ...prefs,
    notifications: {
      ...prefs.notifications,
      ...updates,
    },
  };
  await savePreferences(updated);
  return updated;
}

/**
 * Update pricing settings
 */
export async function updatePricingSettings(
  updates: Partial<PricingSettings>,
): Promise<UserPreferences> {
  const prefs = await loadPreferences();
  const updated: UserPreferences = {
    ...prefs,
    pricing: {
      ...prefs.pricing,
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
