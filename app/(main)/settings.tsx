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
  updatePricingSettings,
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
  Image,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { uploadCompanyLogo, getCompanyLogo, deleteLogo, type CompanyLogo } from "@/lib/logo";
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
    quoteDefaults: false,
    invoiceSettings: false,
    pricingSettings: false,
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

    // Load logo (local storage)
    try {
      const companyLogo = await getCompanyLogo();
      setLogo(companyLogo);
    } catch (error) {
      console.error("Failed to load logo:", error);
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

  const handleUploadLogo = async () => {
    if (!isPro) {
      // Pro feature - button should be disabled for free users
      return;
    }

    try {
      setUploadingLogo(true);
      const uploadedLogo = await uploadCompanyLogo();
      setLogo(uploadedLogo);
    } catch (error) {
      console.error("Failed to upload logo:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
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
              await deleteLogo();
              setLogo(null);
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
                      💡 Cloud sync keeps your quotes backed up and synced across devices
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
                  <View
                    style={[styles.defaultItemButton, styles.defaultItemButtonLocked]}
                  >
                    <Ionicons name="lock-closed" size={16} color="#666" style={{ marginRight: 6 }} />
                    <Text style={[styles.defaultItemButtonText, { color: "#666" }]}>
                      Locked
                    </Text>
                  </View>
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
                  Add your company logo to appear on all PDF quotes.
                </Text>
                <Text style={styles.logoHelpTip}>
                  Tip: For best results, use a PNG with transparent background
                </Text>

                {/* Logo Preview */}
                {logo && logo.base64 && (
                  <View style={styles.logoPreviewContainer}>
                    <Image
                      source={{ uri: logo.base64 }}
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

          {/* Pricing Settings Section */}
          <CollapsibleSection
            title="Pricing Settings"
            isExpanded={expandedSections.pricingSettings}
            onToggle={() => toggleSection('pricingSettings')}
            theme={theme}
          >
            <View style={styles.defaultsContainer}>
              {/* Default Tax */}
              <View style={styles.defaultItem}>
                <View style={styles.defaultItemHeader}>
                  <Ionicons name="calculator-outline" size={20} color={theme.colors.accent} />
                  <Text style={styles.defaultItemTitle}>Default Tax %</Text>
                </View>
                <Text style={styles.defaultItemDescription}>
                  Set a default tax percentage that will be applied to new quotes.
                </Text>
                {(preferences.pricing?.defaultTaxPercent ?? 0) > 0 && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewText}>{preferences.pricing.defaultTaxPercent}%</Text>
                  </View>
                )}
                <Pressable
                  style={styles.defaultItemButton}
                  onPress={() => {
                    Alert.prompt(
                      'Default Tax %',
                      'Enter the default tax percentage for new quotes:',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Save',
                          onPress: async (value) => {
                            const num = parseFloat(value || '0');
                            if (!isNaN(num) && num >= 0 && num <= 100) {
                              const updated = await updatePricingSettings({ defaultTaxPercent: num });
                              setPreferences(updated);
                            } else {
                              Alert.alert('Invalid Value', 'Please enter a number between 0 and 100.');
                            }
                          },
                        },
                      ],
                      'plain-text',
                      String(preferences.pricing?.defaultTaxPercent || ''),
                      'decimal-pad'
                    );
                  }}
                >
                  <Text style={styles.defaultItemButtonText}>
                    {(preferences.pricing?.defaultTaxPercent ?? 0) > 0 ? 'Change Tax %' : 'Set Tax %'}
                  </Text>
                </Pressable>
              </View>

              {/* Default Markup */}
              <View style={styles.defaultItem}>
                <View style={styles.defaultItemHeader}>
                  <Ionicons name="trending-up-outline" size={20} color={theme.colors.accent} />
                  <Text style={styles.defaultItemTitle}>Default Markup %</Text>
                </View>
                <Text style={styles.defaultItemDescription}>
                  Set a default markup percentage that will be applied to new quotes.
                </Text>
                {(preferences.pricing?.defaultMarkupPercent ?? 0) > 0 && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewText}>{preferences.pricing.defaultMarkupPercent}%</Text>
                  </View>
                )}
                <Pressable
                  style={styles.defaultItemButton}
                  onPress={() => {
                    Alert.prompt(
                      'Default Markup %',
                      'Enter the default markup percentage for new quotes:',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Save',
                          onPress: async (value) => {
                            const num = parseFloat(value || '0');
                            if (!isNaN(num) && num >= 0) {
                              const updated = await updatePricingSettings({ defaultMarkupPercent: num });
                              setPreferences(updated);
                            } else {
                              Alert.alert('Invalid Value', 'Please enter a valid number.');
                            }
                          },
                        },
                      ],
                      'plain-text',
                      String(preferences.pricing?.defaultMarkupPercent || ''),
                      'decimal-pad'
                    );
                  }}
                >
                  <Text style={styles.defaultItemButtonText}>
                    {(preferences.pricing?.defaultMarkupPercent ?? 0) > 0 ? 'Change Markup %' : 'Set Markup %'}
                  </Text>
                </Pressable>
              </View>

              {/* Zip Code */}
              <View style={[styles.defaultItem, styles.defaultItemLast]}>
                <View style={styles.defaultItemHeader}>
                  <Ionicons name="location-outline" size={20} color={theme.colors.accent} />
                  <Text style={styles.defaultItemTitle}>Zip Code</Text>
                </View>
                <Text style={styles.defaultItemDescription}>
                  Enter your zip code to get regional pricing from suppliers like Lowes, Home Depot, and Menards.
                </Text>
                {preferences.pricing?.zipCode && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewText}>📍 {preferences.pricing.zipCode}</Text>
                  </View>
                )}
                <Pressable
                  style={styles.defaultItemButton}
                  onPress={() => {
                    Alert.prompt(
                      'Zip Code',
                      'Enter your 5-digit zip code for regional pricing:',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Save',
                          onPress: async (value) => {
                            if (value && /^\d{5}$/.test(value.trim())) {
                              const updated = await updatePricingSettings({ zipCode: value.trim() });
                              setPreferences(updated);
                            } else if (value && value.trim()) {
                              Alert.alert('Invalid Zip Code', 'Please enter a valid 5-digit zip code.');
                            }
                          },
                        },
                      ],
                      'plain-text',
                      preferences.pricing?.zipCode || '',
                      'number-pad'
                    );
                  }}
                >
                  <Text style={styles.defaultItemButtonText}>
                    {preferences.pricing?.zipCode ? 'Change Zip Code' : 'Set Zip Code'}
                  </Text>
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
    logoHelpTip: {
      fontSize: 12,
      color: theme.colors.muted,
      fontStyle: "italic",
      marginBottom: theme.spacing(1.5),
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
