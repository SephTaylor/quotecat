// app/(main)/settings.tsx
// Settings and profile management
import { useTheme } from "@/contexts/ThemeContext";
import { getUserState, FREE_LIMITS, type UserState } from "@/lib/user";
import {
  loadPreferences,
  savePreferences,
  updateDashboardPreferences,
  updateNotificationPreferences,
  resetPreferences,
  type DashboardPreferences,
  type UserPreferences,
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
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import {
  syncQuotes,
  getLastSyncTime,
  isSyncAvailable,
  downloadQuotes,
  resetSyncMetadata
} from "@/lib/quotesSync";
import { listQuotes } from "@/lib/quotes";
import { supabase } from "@/lib/supabase";

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
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncAvailable, setSyncAvailable] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [localQuoteCount, setLocalQuoteCount] = useState(0);
  const [cloudQuoteCount, setCloudQuoteCount] = useState(0);

  // Email capture state
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  // Track expanded sections
  const [expandedSections, setExpandedSections] = useState({
    usage: false,
    cloudSync: false,
    appearance: false,
    dashboard: false,
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
    const isPaidTier = user.tier === 'pro' || user.tier === 'premium';
    setIsPro(isPaidTier);
    setUserEmail(user.email);
    setUserState(user);
    setPreferences(fullPrefs);

    // Load sync state
    const [syncTime, available, localQuotes] = await Promise.all([
      getLastSyncTime(),
      isSyncAvailable(),
      listQuotes(),
    ]);

    setLastSyncTime(syncTime);
    setSyncAvailable(available && isPaidTier);
    setLocalQuoteCount(localQuotes.length);

    // Load cloud quote count if available
    if (available && isPaidTier) {
      try {
        const cloudQuotes = await downloadQuotes();
        setCloudQuoteCount(cloudQuotes.length);
      } catch (error) {
        console.error("Failed to load cloud quote count:", error);
      }
    }

    // Check if user has already subscribed to updates
    try {
      const subscribedEmail = await AsyncStorage.getItem('@quotecat/subscribed-email');
      if (subscribedEmail) {
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error("Failed to load subscription status:", error);
    }
  }, []);

  const handleSubscribe = async () => {
    if (!subscribeEmail.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(subscribeEmail.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setSubscribing(true);
    try {
      const email = subscribeEmail.trim().toLowerCase();

      // Save to Supabase
      const { error } = await supabase
        .from('email_subscribers')
        .upsert({ email }, { onConflict: 'email' });

      if (error) {
        console.error("Supabase error:", error);
        // Still save locally as fallback
      }

      // Store locally to remember subscription state
      await AsyncStorage.setItem('@quotecat/subscribed-email', email);

      setIsSubscribed(true);
      setSubscribeEmail("");
      Alert.alert("Subscribed!", "You'll receive updates about new features and tips.");
    } catch (error) {
      console.error("Failed to subscribe:", error);
      Alert.alert("Error", "Failed to subscribe. Please try again.");
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      await AsyncStorage.removeItem('@quotecat/subscribed-email');
      setIsSubscribed(false);
    } catch (error) {
      console.error("Failed to unsubscribe:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleManageAccount = async () => {
    if (!userEmail) {
      Alert.alert("Error", "Please sign in to manage your account.");
      return;
    }

    try {
      const response = await fetch(
        "https://eouikzjzsartaabvlbee.supabase.co/functions/v1/create-portal-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWlremp6c2FydGFhYnZsYmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTA0NzEsImV4cCI6MjA3NTY4NjQ3MX0.xa7mZtOfLocL_QX2wrhpywsKbhu2hZ699O3U7KiVJzo",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdWlremp6c2FydGFhYnZsYmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxMTA0NzEsImV4cCI6MjA3NTY4NjQ3MX0.xa7mZtOfLocL_QX2wrhpywsKbhu2hZ699O3U7KiVJzo",
          },
          body: JSON.stringify({ email: userEmail }),
        }
      );

      const data = await response.json();

      if (data.error) {
        if (data.error === "No subscription found for this account") {
          Alert.alert(
            "No Subscription",
            "No active subscription found for this account."
          );
        } else {
          Alert.alert("Error", data.error);
        }
        return;
      }

      if (data.url) {
        Linking.openURL(data.url);
      }
    } catch (error) {
      console.error("Portal session error:", error);
      Alert.alert("Error", "Could not open account management. Please try again.");
    }
  };

  const handleSignIn = () => {
    router.push("/(auth)/sign-in" as any);
  };

  const handleUpdatePreference = async (
    updates: Partial<DashboardPreferences>,
  ) => {
    if (!preferences) return;
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

  // Show loading state while preferences are being loaded
  if (!preferences) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Settings",
            headerShown: true,
            headerTitleAlign: 'center',
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
          }}
        />
        <GradientBackground>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
          </View>
        </GradientBackground>
      </>
    );
  }

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
                    style={[
                      styles.tierBadge,
                      userState?.tier === 'pro' && styles.tierBadgePro,
                      userState?.tier === 'premium' && styles.tierBadgePremium,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tierBadgeText,
                        userState?.tier === 'pro' && styles.tierBadgeTextPro,
                        userState?.tier === 'premium' && styles.tierBadgeTextPremium,
                      ]}
                    >
                      {userState?.tier === 'premium' ? "PREMIUM" : userState?.tier === 'pro' ? "PRO" : "FREE"}
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
                <>
                  {/* Email capture for non-signed-in users */}
                  {!isSubscribed ? (
                    <View style={styles.emailCaptureContainer}>
                      <TextInput
                        style={styles.emailCaptureInput}
                        placeholder="Enter email for updates"
                        placeholderTextColor={theme.colors.muted}
                        value={subscribeEmail}
                        onChangeText={setSubscribeEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <Pressable
                        style={[
                          styles.emailCaptureButton,
                          (!subscribeEmail.trim() || subscribing) && styles.emailCaptureButtonDisabled
                        ]}
                        onPress={handleSubscribe}
                        disabled={!subscribeEmail.trim() || subscribing}
                      >
                        {subscribing ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <Ionicons name="arrow-forward" size={20} color="#000" />
                        )}
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.subscribedContainer}>
                      <View style={styles.subscribedRow}>
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
                        <Text style={styles.subscribedText}>Subscribed to updates</Text>
                      </View>
                      <Pressable onPress={handleUnsubscribe}>
                        <Text style={styles.unsubscribeText}>Unsubscribe</Text>
                      </Pressable>
                    </View>
                  )}

                  <Pressable
                    style={[styles.settingButton, styles.settingButtonLast]}
                    onPress={handleSignIn}
                  >
                    <Text style={styles.settingButtonText}>Sign In</Text>
                    <Text style={styles.settingButtonIcon}>→</Text>
                  </Pressable>
                </>
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
                </View>

                {/* Sync Actions */}
                <View style={styles.syncActionGroup}>
                  <Pressable
                    style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
                    onPress={handleSyncNow}
                    disabled={syncing || !syncAvailable}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Ionicons name="sync-outline" size={20} color="#000" />
                        <Text style={styles.syncButtonText}>Sync</Text>
                      </>
                    )}
                  </Pressable>
                  <Text style={styles.syncHelpTextSmall}>
                    Merges changes from device and cloud
                  </Text>
                </View>

                <View style={styles.syncActionGroup}>
                  <Pressable
                    style={[styles.syncButton, styles.syncButtonSecondary, syncing && styles.syncButtonDisabled]}
                    onPress={handleForceSync}
                    disabled={syncing || !syncAvailable}
                  >
                    <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.accent} />
                    <Text style={[styles.syncButtonText, styles.syncButtonTextSecondary]}>Re-upload All</Text>
                  </Pressable>
                  <Text style={styles.syncHelpTextSmall}>
                    Overwrites cloud with local data
                  </Text>
                </View>

                {!syncAvailable && (
                  <View style={styles.syncHelpText}>
                    <Text style={styles.syncHelpTextContent}>
                      Sign in to enable cloud sync
                    </Text>
                  </View>
                )}
              </View>
            </CollapsibleSection>
          )}

          {/* Free User Prompt */}
          {/* Cloud Sync section only shown for Pro users */}

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

          {/* Business Settings */}
          <View style={styles.section}>
            <Pressable
              style={styles.sectionHeader}
              onPress={() => router.push("/(main)/business-settings")}
            >
              <Text style={styles.sectionTitle}>Business Settings</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

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
              />
              <SettingRow
                label="Recent Invoices"
                value={preferences.dashboard.showRecentInvoices}
                onToggle={(value) =>
                  handleUpdatePreference({ showRecentInvoices: value })
                }
                theme={theme}
              />
              <SettingRow
                label="Recent Contracts"
                value={preferences.dashboard.showRecentContracts}
                onToggle={(value) =>
                  handleUpdatePreference({ showRecentContracts: value })
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

              {/* Quote Follow-up Reminders */}
              <View style={[styles.notificationGroup, { marginTop: theme.spacing(2), borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing(2) }]}>
                <View style={styles.notificationGroupHeader}>
                  <Ionicons name="document-text-outline" size={18} color={theme.colors.accent} />
                  <Text style={styles.notificationGroupTitle}>Quote Follow-ups</Text>
                </View>
                <Text style={styles.notificationGroupDescription}>
                  Get reminded to follow up on sent quotes
                </Text>
              </View>

              <SettingRow
                label="Auto follow-up reminders"
                value={preferences.notifications?.autoFollowUpEnabled ?? true}
                onToggle={async (value) => {
                  const updated = await updateNotificationPreferences({ autoFollowUpEnabled: value });
                  setPreferences(updated);
                }}
                theme={theme}
                compact
              />

              {preferences.notifications?.autoFollowUpEnabled && (
                <View style={styles.followUpDaysRow}>
                  <Text style={styles.followUpDaysLabel}>Remind after</Text>
                  <View style={styles.followUpDaysOptions}>
                    {([3, 5, 7, 14] as const).map((days) => (
                      <Pressable
                        key={days}
                        style={[
                          styles.followUpDayOption,
                          preferences.notifications?.autoFollowUpDays === days && styles.followUpDayOptionActive,
                        ]}
                        onPress={async () => {
                          const updated = await updateNotificationPreferences({ autoFollowUpDays: days });
                          setPreferences(updated);
                        }}
                      >
                        <Text
                          style={[
                            styles.followUpDayOptionText,
                            preferences.notifications?.autoFollowUpDays === days && styles.followUpDayOptionTextActive,
                          ]}
                        >
                          {days}d
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
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
    tierBadgePremium: {
      backgroundColor: "#5856D6",
    },
    tierBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.muted,
    },
    tierBadgeTextPro: {
      color: "#000",
    },
    tierBadgeTextPremium: {
      color: "#FFF",
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
    followUpDaysRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
    },
    followUpDaysLabel: {
      fontSize: 14,
      color: theme.colors.text,
    },
    followUpDaysOptions: {
      flexDirection: "row",
      gap: theme.spacing(1),
    },
    followUpDayOption: {
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.75),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
    followUpDayOptionActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accent,
    },
    followUpDayOptionText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    followUpDayOptionTextActive: {
      color: "#000",
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
    syncHelpTextSmall: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: theme.spacing(0.5),
      textAlign: "center",
    },
    syncActionGroup: {
      marginBottom: theme.spacing(1.5),
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
    // Email capture styles
    emailCaptureContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    emailCaptureInput: {
      flex: 1,
      height: 40,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(1.5),
      fontSize: 14,
      color: theme.colors.text,
    },
    emailCaptureButton: {
      width: 40,
      height: 40,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    emailCaptureButtonDisabled: {
      opacity: 0.5,
    },
    subscribedContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    subscribedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    subscribedText: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    unsubscribeText: {
      fontSize: 13,
      color: theme.colors.muted,
      textDecorationLine: "underline",
    },
  });
}
