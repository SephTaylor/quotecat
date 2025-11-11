// app/(main)/settings.tsx
// Settings and profile management
import { useTheme } from "@/contexts/ThemeContext";
import { canAccessAssemblies } from "@/lib/features";
import { getUserState, FREE_LIMITS, type UserState } from "@/lib/user";
import {
  loadPreferences,
  savePreferences,
  updateDashboardPreferences,
  updateInvoiceSettings,
  updateNotificationPreferences,
  resetPreferences,
  type DashboardPreferences,
  type UserPreferences,
  type NotificationPreferences,
} from "@/lib/preferences";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { uploadCompanyLogo, getCompanyLogo, deleteLogo, type CompanyLogo } from "@/lib/logo";
import { signOut } from "@/lib/auth";
import {
  syncQuotes,
  getLastSyncTime,
  isSyncAvailable,
  downloadQuotes,
  hasMigrated,
  resetSyncMetadata
} from "@/lib/quotesSync";
import { listQuotes } from "@/lib/quotes";
import { getDeviceCount, shouldSuggestTeamTier } from "@/lib/usageTracking";

/**
 * Format sync time as relative time (e.g., "just now", "2 minutes ago")
 */
function formatSyncTime(date: Date): string {
  const now = Date.now();
  const syncTime = date.getTime();
  const diffMs = now - syncTime;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export default function Settings() {
  const { mode, theme, setThemeMode } = useTheme();
  const router = useRouter();
  const [isPro, setIsPro] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userState, setUserState] = useState<UserState | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>({
    dashboard: {
      showStats: true,
      showValueTracking: true,
      showPinnedQuotes: true,
      showRecentQuotes: true,
      showQuickActions: true,
      recentQuotesCount: 5,
    },
    privacy: {
      shareAnonymousUsage: false,
    },
  });

  // Logo state
  const [logo, setLogo] = useState<CompanyLogo | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncAvailable, setSyncAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [localQuoteCount, setLocalQuoteCount] = useState(0);
  const [cloudQuoteCount, setCloudQuoteCount] = useState(0);
  const [deviceCount, setDeviceCount] = useState(0);
  const [suggestTeam, setSuggestTeam] = useState(false);

  // Track expanded sections
  const [expandedSections, setExpandedSections] = useState({
    usage: false,
    cloudSync: false,
    appearance: false,
    dashboard: false,
    quoteDefaults: false,
    invoiceSettings: false,
    notifications: false,
    privacy: false,
    comingSoon: false,
    about: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const load = useCallback(async () => {
    const [user, fullPrefs] = await Promise.all([
      getUserState(),
      loadPreferences(),
    ]);
    setIsPro(canAccessAssemblies(user));
    setUserEmail(user.email);
    setUserState(user);
    setPreferences(fullPrefs);

    // Load logo if user is signed in
    if (user.userId) {
      try {
        const companyLogo = await getCompanyLogo(user.userId);
        setLogo(companyLogo);
      } catch (error) {
        console.error("Failed to load logo:", error);
      }
    }

    // Load sync state
    const isPaidTier = user.tier === 'pro' || user.tier === 'premium';
    const [syncTime, available, localQuotes] = await Promise.all([
      getLastSyncTime(),
      isSyncAvailable(),
      listQuotes(),
    ]);

    setLastSyncTime(syncTime);
    setSyncAvailable(available && isPaidTier);
    setLocalQuoteCount(localQuotes.length);

    // Load cloud quote count and device info if available
    if (available && isPaidTier) {
      try {
        const [cloudQuotes, devCount, teamSuggestion] = await Promise.all([
          downloadQuotes(),
          getDeviceCount(),
          shouldSuggestTeamTier(),
        ]);
        setCloudQuoteCount(cloudQuotes.length);
        setDeviceCount(devCount);
        setSuggestTeam(teamSuggestion);
      } catch (error) {
        console.error("Failed to load cloud data:", error);
      }
    }
  }, []);

  const handleUploadLogo = async () => {
    if (!isPro) {
      Alert.alert(
        "Pro Feature",
        "Logo upload is available for Pro and Premium users. Upgrade to add your company logo to PDFs.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Learn More",
            onPress: () => {
              Linking.openURL("https://quotecat.ai/pricing");
            },
          },
        ]
      );
      return;
    }

    if (!userState?.userId) {
      Alert.alert("Error", "Please sign in to upload a logo.");
      return;
    }

    try {
      setUploadingLogo(true);
      const uploadedLogo = await uploadCompanyLogo(userState.userId);
      setLogo(uploadedLogo);
      Alert.alert("Success", "Logo uploaded successfully!");
    } catch (error) {
      console.error("Failed to upload logo:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!userState?.userId) return;

    Alert.alert(
      "Delete Logo",
      "Are you sure you want to delete your company logo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setUploadingLogo(true);
              await deleteLogo(userState.userId!);
              setLogo(null);
              Alert.alert("Success", "Logo deleted successfully");
            } catch (error) {
              console.error("Failed to delete logo:", error);
              Alert.alert("Error", "Failed to delete logo");
            } finally {
              setUploadingLogo(false);
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleManageAccount = () => {
    Alert.alert(
      "Manage Account",
      "You'll be redirected to quotecat.ai to manage your account and subscription.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            Linking.openURL("https://quotecat.ai/account");
          },
        },
      ],
    );
  };

  const handleSignIn = () => {
    router.push("/(auth)/sign-in" as any);
  };

  const handleUpgrade = () => {
    Linking.openURL("https://quotecat.ai");
  };

  const handleUpdatePreference = async (
    updates: Partial<DashboardPreferences>,
  ) => {
    const updated = {
      ...preferences,
      dashboard: {
        ...preferences.dashboard,
        ...updates
      }
    };
    setPreferences(updated);
    await updateDashboardPreferences(updates);
  };

  const handleResetDashboard = async () => {
    Alert.alert(
      "Reset Dashboard",
      "This will reset your dashboard to default settings. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            const defaults = await resetPreferences();
            setPreferences(defaults);
          },
        },
      ],
    );
  };

  const handleSyncNow = async () => {
    if (!syncAvailable) {
      Alert.alert("Sync Unavailable", "Please sign in to sync your quotes to the cloud.");
      return;
    }

    setSyncing(true);
    try {
      const result = await syncQuotes();

      if (result.success) {
        setLastSyncTime(new Date());

        // Reload counts
        const [localQuotes, cloudQuotes] = await Promise.all([
          listQuotes(),
          downloadQuotes(),
        ]);
        setLocalQuoteCount(localQuotes.length);
        setCloudQuoteCount(cloudQuotes.length);

        const message = result.downloaded === 0 && result.uploaded === 0
          ? "Everything is up to date!"
          : `Synced! Downloaded ${result.downloaded}, uploaded ${result.uploaded} quote${result.uploaded === 1 ? '' : 's'}.`;

        Alert.alert("Sync Complete", message);
      } else {
        Alert.alert("Sync Failed", "Unable to sync with the cloud. Please try again later.");
      }
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert("Sync Error", "An error occurred while syncing. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const handleForceSync = async () => {
    if (!syncAvailable) return;

    Alert.alert(
      "Force Full Sync",
      "This will re-upload all local quotes to the cloud. This may take a moment. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Force Sync",
          onPress: async () => {
            setSyncing(true);
            try {
              // Reset sync metadata to force re-upload
              await resetSyncMetadata();

              // Run sync
              const result = await syncQuotes();

              if (result.success) {
                setLastSyncTime(new Date());

                // Reload counts
                const [localQuotes, cloudQuotes] = await Promise.all([
                  listQuotes(),
                  downloadQuotes(),
                ]);
                setLocalQuoteCount(localQuotes.length);
                setCloudQuoteCount(cloudQuotes.length);

                Alert.alert("Success", `Force sync complete! Uploaded ${result.uploaded} quote${result.uploaded === 1 ? '' : 's'}.`);
              } else {
                Alert.alert("Sync Failed", "Unable to complete force sync.");
              }
            } catch (error) {
              console.error("Force sync error:", error);
              Alert.alert("Error", "Force sync failed. Please try again.");
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Settings",
          headerShown: true,
          headerTitleAlign: 'center', // Center title on all platforms (Android defaults to left)
          headerBackTitle: "Back",
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
        }}
      />
      <GradientBackground>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Profile</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.accountHeader}>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountEmail}>
                    {userEmail || "Not signed in"}
                  </Text>
                  <View
                    style={[styles.tierBadge, isPro && styles.tierBadgePro]}
                  >
                    <Text
                      style={[
                        styles.tierBadgeText,
                        isPro && styles.tierBadgeTextPro,
                      ]}
                    >
                      {isPro ? "PRO" : "FREE"}
                    </Text>
                  </View>
                </View>
              </View>

              {userEmail ? (
                <Pressable
                  style={[styles.settingButton, styles.settingButtonLast]}
                  onPress={handleManageAccount}
                >
                  <Text style={styles.settingButtonText}>Manage Account</Text>
                  <Text style={styles.settingButtonIcon}>→</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.settingButton, styles.settingButtonLast]}
                  onPress={handleSignIn}
                >
                  <Text style={styles.settingButtonText}>Sign In</Text>
                  <Text style={styles.settingButtonIcon}>→</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Cloud Sync Section (Pro/Premium only) */}
          {isPro && (
            <CollapsibleSection
              title="Cloud Sync"
              isExpanded={expandedSections.cloudSync}
              onToggle={() => toggleSection('cloudSync')}
              theme={theme}
            >
              <View style={styles.card}>
                {/* Sync Status */}
                <View style={styles.syncStatusRow}>
                  <View style={styles.syncStatusHeader}>
                    <Text style={styles.syncStatusLabel}>Status</Text>
                    <View style={styles.syncStatusIndicator}>
                      <View style={[
                        styles.syncStatusDot,
                        syncAvailable ? styles.syncStatusDotOnline : styles.syncStatusDotOffline
                      ]} />
                      <Text style={styles.syncStatusText}>
                        {syncAvailable ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                  </View>
                  {lastSyncTime && (
                    <Text style={styles.syncStatusSubtext}>
                      Last synced: {formatSyncTime(lastSyncTime)}
                    </Text>
                  )}
                </View>

                {/* Quote Counts */}
                <View style={styles.syncCountsRow}>
                  <View style={styles.syncCountItem}>
                    <Text style={styles.syncCountLabel}>Local</Text>
                    <Text style={styles.syncCountValue}>{localQuoteCount}</Text>
                  </View>
                  <View style={styles.syncCountDivider} />
                  <View style={styles.syncCountItem}>
                    <Text style={styles.syncCountLabel}>Cloud</Text>
                    <Text style={styles.syncCountValue}>{cloudQuoteCount}</Text>
                  </View>
                  <View style={styles.syncCountDivider} />
                  <View style={styles.syncCountItem}>
                    <Text style={styles.syncCountLabel}>Devices</Text>
                    <Text style={styles.syncCountValue}>{deviceCount}</Text>
                  </View>
                </View>

                {/* Team Tier Suggestion */}
                {suggestTeam && (
                  <View style={styles.teamSuggestion}>
                    <View style={styles.teamSuggestionHeader}>
                      <Ionicons name="people-outline" size={20} color={theme.colors.accent} />
                      <Text style={styles.teamSuggestionTitle}>Using multiple devices?</Text>
                    </View>
                    <Text style={styles.teamSuggestionText}>
                      Team tier includes multi-user accounts, quote assignments, and activity tracking.
                    </Text>
                    <Pressable
                      style={styles.teamSuggestionButton}
                      onPress={() => Linking.openURL("https://quotecat.ai/team")}
                    >
                      <Text style={styles.teamSuggestionButtonText}>Learn More</Text>
                    </Pressable>
                  </View>
                )}

                {/* Sync Actions */}
                <Pressable
                  style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
                  onPress={handleSyncNow}
                  disabled={syncing || !syncAvailable}
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color="#000" />
                      <Text style={styles.syncButtonText}>Sync Now</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.syncButton, styles.syncButtonSecondary, syncing && styles.syncButtonDisabled]}
                  onPress={handleForceSync}
                  disabled={syncing || !syncAvailable}
                >
                  <Ionicons name="refresh-outline" size={20} color={theme.colors.accent} />
                  <Text style={[styles.syncButtonText, styles.syncButtonTextSecondary]}>Force Full Sync</Text>
                </Pressable>

                {!syncAvailable && (
                  <View style={styles.syncHelpText}>
                    <Text style={styles.syncHelpTextContent}>
                      Cloud sync keeps your quotes backed up and synced across devices
                    </Text>
                  </View>
                )}
              </View>
            </CollapsibleSection>
          )}

          {/* Free User Prompt */}
          {!isPro && (
            <CollapsibleSection
              title="Cloud Sync"
              isExpanded={expandedSections.cloudSync}
              onToggle={() => toggleSection('cloudSync')}
              theme={theme}
            >
              <View style={styles.card}>
                <View style={styles.proFeaturePrompt}>
                  <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.muted} />
                  <Text style={styles.proFeatureTitle}>Cloud Sync is a Pro Feature</Text>
                  <Text style={styles.proFeatureDescription}>
                    Automatically back up your quotes to the cloud and sync across all your devices with a Pro subscription.
                  </Text>
                  <Pressable
                    style={styles.proFeatureButton}
                    onPress={userEmail ? handleManageAccount : handleSignIn}
                  >
                    <Text style={styles.proFeatureButtonText}>
                      {userEmail ? 'Manage Subscription' : 'Sign In'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </CollapsibleSection>
          )}

          {/* Usage & Limits Section */}
          {userState && (
            <CollapsibleSection
              title="Usage & Limits"
              isExpanded={expandedSections.usage}
              onToggle={() => toggleSection('usage')}
              theme={theme}
            >
              <View style={styles.card}>
                {/* Draft Quotes */}
                <View style={styles.usageRow}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageLabel}>Draft Quotes</Text>
                    <Text style={styles.usageValue}>Unlimited ✨</Text>
                  </View>
                </View>

                {/* PDF Exports */}
                <View style={[styles.usageRow, styles.usageRowLast]}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageLabel}>Client Exports</Text>
                    <Text style={styles.usageValue}>
                      {isPro
                        ? `${userState.pdfsExported} (Unlimited)`
                        : `${userState.pdfsExported} / ${FREE_LIMITS.pdfsTotal}`}
                    </Text>
                  </View>
                  {!isPro && (
                    <View style={styles.progressBarContainer}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${Math.min(
                              100,
                              (userState.pdfsExported / FREE_LIMITS.pdfsTotal) * 100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>
              </View>
            </CollapsibleSection>
          )}

          {/* Appearance Section */}
          <CollapsibleSection
            title="Appearance"
            isExpanded={expandedSections.appearance}
            onToggle={() => toggleSection('appearance')}
            theme={theme}
          >
            <View style={styles.card}>
              <View style={styles.settingButton}>
                <Text style={styles.settingButtonText}>Dark Mode</Text>
                <Switch
                  value={mode === "dark"}
                  onValueChange={(value) =>
                    setThemeMode(value ? "dark" : "light")
                  }
                  trackColor={{ false: "#D1D1D6", true: theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </CollapsibleSection>

          {/* Dashboard Section */}
          <CollapsibleSection
            title="Dashboard"
            isExpanded={expandedSections.dashboard}
            onToggle={() => toggleSection('dashboard')}
            theme={theme}
          >
            <View style={styles.card}>
              <SettingRow
                label="Quick Stats"
                value={preferences.dashboard.showStats}
                onToggle={(value) =>
                  handleUpdatePreference({ showStats: value })
                }
                theme={theme}
              />
              <SettingRow
                label="Value Tracking"
                value={preferences.dashboard.showValueTracking}
                onToggle={(value) =>
                  handleUpdatePreference({ showValueTracking: value })
                }
                theme={theme}
              />
              <SettingRow
                label="Pinned Quotes"
                value={preferences.dashboard.showPinnedQuotes}
                onToggle={(value) =>
                  handleUpdatePreference({ showPinnedQuotes: value })
                }
                theme={theme}
              />
              <SettingRow
                label="Recent Quotes"
                value={preferences.dashboard.showRecentQuotes}
                onToggle={(value) =>
                  handleUpdatePreference({ showRecentQuotes: value })
                }
                theme={theme}
              />
              <SettingRow
                label="Quick Actions"
                value={preferences.dashboard.showQuickActions}
                onToggle={(value) =>
                  handleUpdatePreference({ showQuickActions: value })
                }
                theme={theme}
                isLast
              />

              {/* Recent Quotes Count */}
              {preferences.dashboard.showRecentQuotes && (
                <View
                  style={[
                    styles.settingButton,
                    styles.settingButtonLast,
                    styles.chipContainer,
                  ]}
                >
                  <Text style={styles.chipLabel}>Recent Count</Text>
                  <View style={styles.chipsRow}>
                    {([3, 5, 10, "all"] as const).map((count) => (
                      <Pressable
                        key={count}
                        style={[
                          styles.chip,
                          preferences.dashboard.recentQuotesCount === count &&
                            styles.chipActive,
                        ]}
                        onPress={() =>
                          handleUpdatePreference({ recentQuotesCount: count })
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            preferences.dashboard.recentQuotesCount === count &&
                              styles.chipTextActive,
                          ]}
                        >
                          {count === "all" ? "All" : count}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Reset Button */}
            <Pressable
              style={styles.resetButton}
              onPress={handleResetDashboard}
            >
              <Text style={styles.resetButtonText}>Reset to Default</Text>
            </Pressable>
          </CollapsibleSection>

          {/* Quote Defaults Section */}
          <CollapsibleSection
            title="Quote Defaults"
            isExpanded={expandedSections.quoteDefaults}
            onToggle={() => toggleSection('quoteDefaults')}
            theme={theme}
          >
            <View style={styles.defaultsContainer}>
              {/* Company Details - All-in-One Editor */}
              <View style={styles.defaultItem}>
                <View style={styles.defaultItemHeader}>
                  <Ionicons name="business-outline" size={20} color={theme.colors.accent} />
                  <Text style={styles.defaultItemTitle}>Company Details</Text>
                  {!isPro && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.defaultItemDescription}>
                  Add your company name, contact info, and address to all quotes and PDFs.
                </Text>
                {isPro && preferences.company && (preferences.company.companyName || preferences.company.email || preferences.company.phone) && (
                  <View style={styles.previewBox}>
                    {preferences.company.companyName && (
                      <Text style={styles.previewText}>📍 {preferences.company.companyName}</Text>
                    )}
                    {preferences.company.email && (
                      <Text style={styles.previewText}>✉️ {preferences.company.email}</Text>
                    )}
                    {preferences.company.phone && (
                      <Text style={styles.previewText}>📞 {preferences.company.phone}</Text>
                    )}
                  </View>
                )}
                {isPro ? (
                  <Pressable
                    style={styles.defaultItemButton}
                    onPress={() => router.push("/(main)/company-details")}
                  >
                    <Text style={styles.defaultItemButtonText}>
                      {preferences.company?.companyName ? "Edit Details" : "Set Up Company Details"}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.defaultItemButton, styles.defaultItemButtonLocked]}
                    onPress={handleUpgrade}
                  >
                    <Ionicons name="lock-closed" size={16} color="#666" style={{ marginRight: 6 }} />
                    <Text style={[styles.defaultItemButtonText, { color: "#666" }]}>
                      Pro Feature
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Company Logo Upload */}
              <View style={[styles.defaultItem, styles.defaultItemLast]}>
                <View style={styles.defaultItemHeader}>
                  <Ionicons name="image-outline" size={20} color={theme.colors.accent} />
                  <Text style={styles.defaultItemTitle}>Company Logo</Text>
                  {!isPro && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.defaultItemDescription}>
                  Add your company logo to appear on all PDF quotes. Logo will be resized and optimized automatically.
                </Text>

                {/* Logo Preview */}
                {logo && logo.localUri && (
                  <View style={styles.logoPreviewContainer}>
                    <Image
                      source={{ uri: logo.localUri }}
                      style={styles.logoPreview}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {/* Upload/Delete Buttons */}
                <View style={styles.logoButtonsContainer}>
                  <Pressable
                    style={[
                      styles.defaultItemButton,
                      !isPro && styles.defaultItemButtonDisabled,
                      { flex: 1 }
                    ]}
                    onPress={handleUploadLogo}
                    disabled={uploadingLogo || !isPro}
                  >
                    {uploadingLogo ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={[
                        styles.defaultItemButtonText,
                        !isPro && styles.defaultItemButtonTextDisabled
                      ]}>
                        {logo ? "Change Logo" : "Upload Logo"}
                      </Text>
                    )}
                  </Pressable>

                  {logo && isPro && (
                    <Pressable
                      style={[styles.defaultItemButton, styles.deleteLogoButton]}
                      onPress={handleDeleteLogo}
                      disabled={uploadingLogo}
                    >
                      <Text style={styles.deleteLogoButtonText}>Delete</Text>
                    </Pressable>
                  )}
                </View>

                {!isPro && (
                  <Text style={styles.proFeatureNote}>
                    🔒 Upgrade to Pro or Premium to add your logo to PDFs
                  </Text>
                )}
              </View>
            </View>
          </CollapsibleSection>

          {/* Invoice Settings Section */}
          <CollapsibleSection
            title="Invoice Settings"
            isExpanded={expandedSections.invoiceSettings}
            onToggle={() => toggleSection('invoiceSettings')}
            theme={theme}
          >
            <View style={styles.defaultsContainer}>
              {/* Invoice Number Prefix */}
              <View style={styles.defaultItem}>
                <View style={styles.defaultItemHeader}>
                  <Ionicons name="receipt-outline" size={20} color={theme.colors.accent} />
                  <Text style={styles.defaultItemTitle}>Invoice Number Format</Text>
                </View>
                <Text style={styles.defaultItemDescription}>
                  Customize your invoice numbering system. Next invoice will be: {preferences.invoice?.prefix || 'INV'}-{String(preferences.invoice?.nextNumber || 1).padStart(3, '0')}
                </Text>
                <Pressable
                  style={styles.defaultItemButton}
                  onPress={() => {
                    Alert.prompt(
                      'Invoice Prefix',
                      'Enter prefix for invoice numbers (e.g., INV, 2025, ABC):',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Save',
                          onPress: async (value) => {
                            if (value && value.trim()) {
                              const updated = await updateInvoiceSettings({ prefix: value.trim().toUpperCase() });
                              setPreferences(updated);
                            }
                          },
                        },
                      ],
                      'plain-text',
                      preferences.invoice?.prefix || 'INV'
                    );
                  }}
                >
                  <Text style={styles.defaultItemButtonText}>Change Prefix</Text>
                </Pressable>
              </View>

              {/* Next Invoice Number */}
              <View style={[styles.defaultItem, styles.defaultItemLast]}>
                <View style={styles.defaultItemHeader}>
                  <Ionicons name="keypad-outline" size={20} color={theme.colors.accent} />
                  <Text style={styles.defaultItemTitle}>Next Invoice Number</Text>
                </View>
                <Text style={styles.defaultItemDescription}>
                  Set the starting number for your next invoice. This auto-increments after each invoice.
                </Text>
                <Pressable
                  style={styles.defaultItemButton}
                  onPress={() => {
                    Alert.prompt(
                      'Next Invoice Number',
                      'Enter the next invoice number:',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Save',
                          onPress: async (value) => {
                            const num = parseInt(value || '1', 10);
                            if (num > 0) {
                              const updated = await updateInvoiceSettings({ nextNumber: num });
                              setPreferences(updated);
                            } else {
                              Alert.alert('Invalid Number', 'Please enter a number greater than 0');
                            }
                          },
                        },
                      ],
                      'plain-text',
                      String(preferences.invoice?.nextNumber || 1),
                      'number-pad'
                    );
                  }}
                >
                  <Text style={styles.defaultItemButtonText}>Change Number</Text>
                </Pressable>
              </View>
            </View>
          </CollapsibleSection>

          {/* Notifications Section */}
          <CollapsibleSection
            title="Notifications"
            isExpanded={expandedSections.notifications}
            onToggle={() => toggleSection('notifications')}
            theme={theme}
          >
            <View style={styles.card}>
              {/* Invoice Notifications */}
              <View style={styles.notificationGroup}>
                <View style={styles.notificationGroupHeader}>
                  <Ionicons name="receipt-outline" size={18} color={theme.colors.accent} />
                  <Text style={styles.notificationGroupTitle}>Invoice Notifications</Text>
                </View>
                <Text style={styles.notificationGroupDescription}>
                  Get notified about invoice due dates and status changes
                </Text>
              </View>

              <SettingRow
                label="Overdue Invoices"
                value={preferences.notifications?.invoiceOverdue || false}
                onToggle={async (value) => {
                  const updated = await updateNotificationPreferences({ invoiceOverdue: value });
                  setPreferences(updated);
                }}
                theme={theme}
                compact
              />

              <SettingRow
                label="Due Soon (3 days)"
                value={preferences.notifications?.invoiceDueSoon || false}
                onToggle={async (value) => {
                  const updated = await updateNotificationPreferences({ invoiceDueSoon: value });
                  setPreferences(updated);
                }}
                theme={theme}
                compact
              />

              <SettingRow
                label="Due Today"
                value={preferences.notifications?.invoiceDueToday || false}
                onToggle={async (value) => {
                  const updated = await updateNotificationPreferences({ invoiceDueToday: value });
                  setPreferences(updated);
                }}
                theme={theme}
                compact
                isLast
              />

              {/* Info note */}
              <View style={styles.notificationNote}>
                <Text style={styles.notificationNoteText}>
                  Feature coming soon
                </Text>
              </View>
            </View>
          </CollapsibleSection>

          {/* Privacy & Data Section */}
          <CollapsibleSection
            title="Privacy & Data"
            isExpanded={expandedSections.privacy}
            onToggle={() => toggleSection('privacy')}
            theme={theme}
          >
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>
                    Share Anonymous Usage Data
                  </Text>
                  <Text style={styles.settingDescription}>
                    Help improve QuoteCat by sharing which products you use most often. No personal information is collected.
                  </Text>
                </View>
                <Switch
                  value={preferences.privacy?.shareAnonymousUsage || false}
                  onValueChange={async (value) => {
                    const updated = {
                      ...preferences,
                      privacy: {
                        ...preferences.privacy,
                        shareAnonymousUsage: value,
                      },
                    };
                    setPreferences(updated);
                    await savePreferences(updated);
                  }}
                  trackColor={{ false: theme.colors.muted, true: theme.colors.accent }}
                  thumbColor={theme.colors.card}
                />
              </View>
            </View>
          </CollapsibleSection>

          {/* Coming Soon Section */}
          <CollapsibleSection
            title="🔜 Coming in v1.0 Launch"
            isExpanded={expandedSections.comingSoon}
            onToggle={() => toggleSection('comingSoon')}
            theme={theme}
            titleColor={theme.colors.accent}
          >
            <View style={styles.card}>
              <View style={styles.comingSoonHeader}>
                <Text style={styles.comingSoonTitle}>Good/Better/Best Pricing</Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonBadgeText}>PLANNED FOR V1</Text>
                </View>
              </View>
              <Text style={styles.comingSoonDescription}>
                Create tiered pricing quotes with one click. Offer your clients Good, Better, and Best options - or create add-on quotes for optional upgrades like surge protectors or generator hookups.
              </Text>
              <View style={styles.comingSoonFeatures}>
                <Text style={styles.comingSoonFeature}>✓ Auto-generate 3 pricing tiers</Text>
                <Text style={styles.comingSoonFeature}>✓ Basic → Premium material swaps</Text>
                <Text style={styles.comingSoonFeature}>✓ Add-on quote creation</Text>
                <Text style={styles.comingSoonFeature}>✓ Present all options in one PDF</Text>
              </View>
              <Text style={styles.comingSoonNote}>
                💡 Tip: You can manually create tiers now using the &quot;Tier / Variant&quot; field when editing quotes!
              </Text>
            </View>
          </CollapsibleSection>

          {/* About Section */}
          <CollapsibleSection
            title="About"
            isExpanded={expandedSections.about}
            onToggle={() => toggleSection('about')}
            theme={theme}
          >
            <View style={styles.card}>
              <View style={styles.settingButton}>
                <Text style={styles.settingButtonText}>Version</Text>
                <Text style={styles.settingValue}>1.0.0</Text>
              </View>

              <Pressable
                style={styles.settingButton}
                onPress={() => {
                  Linking.openURL("https://quotecat.ai/terms");
                }}
              >
                <Text style={styles.settingButtonText}>Terms of Service</Text>
                <Text style={styles.settingButtonIcon}>→</Text>
              </Pressable>

              <Pressable
                style={styles.settingButton}
                onPress={() => {
                  Linking.openURL("https://quotecat.ai/privacy");
                }}
              >
                <Text style={styles.settingButtonText}>Privacy Policy</Text>
                <Text style={styles.settingButtonIcon}>→</Text>
              </Pressable>

              <Pressable
                style={[styles.settingButton, styles.settingButtonLast]}
                onPress={() => {
                  Linking.openURL("https://quotecat.ai/support");
                }}
              >
                <Text style={styles.settingButtonText}>Support</Text>
                <Text style={styles.settingButtonIcon}>→</Text>
              </Pressable>
            </View>
          </CollapsibleSection>
        </ScrollView>
      </GradientBackground>
    </>
  );
}

function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  children,
  theme,
  titleColor,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>["theme"];
  titleColor?: string;
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.sectionHeader}
        onPress={onToggle}
      >
        <Text style={[styles.sectionTitle, titleColor && { color: titleColor }]}>
          {title}
        </Text>
        <Ionicons
          name={isExpanded ? "chevron-down" : "chevron-forward"}
          size={20}
          color={titleColor || theme.colors.text}
        />
      </Pressable>
      {isExpanded && children}
    </View>
  );
}

function SettingRow({
  label,
  value,
  onToggle,
  isLast = false,
  theme,
  compact = false,
}: {
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  isLast?: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
  compact?: boolean;
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[
      compact ? styles.settingButtonCompact : styles.settingButton,
      isLast && styles.settingButtonLast
    ]}>
      <Text style={styles.settingButtonText}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#D1D1D6", true: theme.colors.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    scrollContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(2),
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
      paddingHorizontal: theme.spacing(0.5),
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    accountHeader: {
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    accountInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    accountEmail: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    tierBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.border,
    },
    tierBadgePro: {
      backgroundColor: theme.colors.accent,
    },
    tierBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    tierBadgeTextPro: {
      color: "#000",
    },
    settingButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingButtonCompact: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing(1.25),
      paddingHorizontal: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingButtonLast: {
      borderBottomWidth: 0,
    },
    settingButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    settingButtonText: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text,
    },
    settingButtonIcon: {
      fontSize: 18,
      color: theme.colors.muted,
    },
    settingValue: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    proLock: {
      fontSize: 14,
    },
    // Quote Defaults redesign
    defaultsContainer: {
      gap: theme.spacing(2),
    },
    defaultItem: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    defaultItemLast: {
      marginBottom: 0,
    },
    defaultItemHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    defaultItemTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      flex: 1,
    },
    defaultItemDescription: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1.5),
      lineHeight: 18,
    },
    defaultItemButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.sm,
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(2),
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
    },
    defaultItemButtonDisabled: {
      backgroundColor: theme.colors.border,
    },
    defaultItemButtonLocked: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    defaultItemButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#000",
    },
    defaultItemButtonTextDisabled: {
      color: theme.colors.muted,
    },
    proBadge: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    proBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#000",
      letterSpacing: 0.5,
    },
    previewBox: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.sm,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1.5),
      gap: theme.spacing(0.5),
    },
    previewText: {
      fontSize: 13,
      color: theme.colors.text,
      lineHeight: 18,
    },
    chipContainer: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: theme.spacing(1.5),
    },
    chipLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    chipsRow: {
      flexDirection: "row",
      gap: theme.spacing(1),
    },
    chip: {
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.75),
      borderRadius: 999,
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    chipTextActive: {
      color: "#000",
    },
    resetButton: {
      marginTop: theme.spacing(1.5),
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      alignItems: "center",
    },
    resetButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    usageRow: {
      paddingVertical: theme.spacing(2),
      paddingHorizontal: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing(2),
      gap: theme.spacing(2),
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
    },
    usageRowLast: {
      borderBottomWidth: 0,
    },
    usageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
      gap: theme.spacing(2),
    },
    usageLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    usageValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      flexShrink: 0,
    },
    progressBarContainer: {
      height: 6,
      backgroundColor: theme.colors.bg,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressBar: {
      height: "100%",
      backgroundColor: theme.colors.accent,
      borderRadius: 3,
    },
    comingSoonHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
      padding: theme.spacing(2),
      paddingBottom: 0,
    },
    comingSoonTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      flex: 1,
    },
    comingSoonBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.accent,
    },
    comingSoonBadgeText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#000",
      letterSpacing: 0.5,
    },
    comingSoonDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      lineHeight: 20,
      paddingHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    comingSoonFeatures: {
      paddingHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
      gap: theme.spacing(0.75),
    },
    comingSoonFeature: {
      fontSize: 14,
      color: theme.colors.text,
      lineHeight: 20,
    },
    comingSoonNote: {
      fontSize: 13,
      color: theme.colors.accent,
      fontStyle: "italic",
      backgroundColor: theme.colors.bg,
      padding: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      marginHorizontal: theme.spacing(2),
      marginBottom: theme.spacing(2),
      lineHeight: 18,
    },
    // Logo upload styles
    logoPreviewContainer: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.sm,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
      alignItems: "center",
      justifyContent: "center",
      height: 120,
    },
    logoPreview: {
      width: "100%",
      height: "100%",
    },
    logoButtonsContainer: {
      flexDirection: "row",
      gap: theme.spacing(1),
    },
    deleteLogoButton: {
      backgroundColor: "#FF3B30",
      flex: 0,
      paddingHorizontal: theme.spacing(2),
    },
    deleteLogoButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#FFF",
    },
    proFeatureNote: {
      fontSize: 12,
      color: theme.colors.muted,
      fontStyle: "italic",
      marginTop: theme.spacing(1),
      textAlign: "center",
    },
    // Notification section styles
    notificationGroup: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(0.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    notificationGroupHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(0.5),
      marginBottom: 2,
    },
    notificationGroupTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.text,
    },
    notificationGroupDescription: {
      fontSize: 11,
      color: theme.colors.muted,
      lineHeight: 14,
    },
    notificationNote: {
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(0.75),
      paddingBottom: theme.spacing(1.5),
    },
    notificationNoteText: {
      fontSize: 11,
      color: theme.colors.muted,
      textAlign: "center",
    },
    // Cloud Sync section styles
    syncStatusRow: {
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    syncStatusHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(0.5),
    },
    syncStatusLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    syncStatusIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(0.75),
    },
    syncStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    syncStatusDotOnline: {
      backgroundColor: "#34C759",
    },
    syncStatusDotOffline: {
      backgroundColor: theme.colors.muted,
    },
    syncStatusText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.text,
    },
    syncStatusSubtext: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: theme.spacing(0.25),
    },
    syncCountsRow: {
      flexDirection: "row",
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: theme.spacing(2),
    },
    syncCountItem: {
      flex: 1,
      alignItems: "center",
    },
    syncCountDivider: {
      width: 1,
      backgroundColor: theme.colors.border,
    },
    syncCountLabel: {
      fontSize: 12,
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.5),
    },
    syncCountValue: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    syncButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing(1),
      padding: theme.spacing(1.5),
      marginHorizontal: theme.spacing(2),
      marginTop: theme.spacing(1.5),
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
    },
    syncButtonSecondary: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1.5),
    },
    syncButtonDisabled: {
      opacity: 0.5,
    },
    syncButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#000",
    },
    syncButtonTextSecondary: {
      color: theme.colors.accent,
    },
    syncHelpText: {
      padding: theme.spacing(2),
      paddingTop: 0,
    },
    syncHelpTextContent: {
      fontSize: 12,
      color: theme.colors.muted,
      lineHeight: 16,
      textAlign: "center",
    },
    proFeaturePrompt: {
      alignItems: "center",
      padding: theme.spacing(3),
    },
    proFeatureTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    proFeatureDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: theme.spacing(2),
    },
    proFeatureButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(3),
      borderRadius: theme.radius.md,
      marginTop: theme.spacing(1),
    },
    proFeatureButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#000",
    },
    teamSuggestion: {
      margin: theme.spacing(2),
      marginTop: 0,
      padding: theme.spacing(2),
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    teamSuggestionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      marginBottom: theme.spacing(0.75),
    },
    teamSuggestionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
    },
    teamSuggestionText: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
      marginBottom: theme.spacing(1.5),
    },
    teamSuggestionButton: {
      alignSelf: "flex-start",
      paddingVertical: theme.spacing(0.75),
      paddingHorizontal: theme.spacing(2),
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    teamSuggestionButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.accent,
    },
  });
}
