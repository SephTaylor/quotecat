// app/(main)/settings.tsx
// Settings and profile management
import { useTheme } from "@/contexts/ThemeContext";
import { FREE_LIMITS } from "@/lib/user";
import { Stack, useRouter } from "expo-router";
import React from "react";
import {
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
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import { useSettingsState, formatSyncTime } from "@/hooks/useSettingsState";

export default function Settings() {
  const { mode, theme, setThemeMode } = useTheme();
  const router = useRouter();

  const {
    // State
    isPro,
    userEmail,
    userState,
    preferences,
    lastSyncTime,
    syncAvailable,
    syncing,
    localCounts,
    cloudCounts,
    subscribeEmail,
    isSubscribed,
    subscribing,
    expandedSections,

    // Setters
    setSubscribeEmail,

    // Handlers
    toggleSection,
    handleSubscribe,
    handleUnsubscribe,
    handleManageAccount,
    handleSignIn,
    handleUpdatePreference,
    handleResetDashboard,
    handleSyncNow,
    handleForceSync,
    handleUpdateNotifications,
    handleUpdatePrivacy,
  } = useSettingsState();

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
          headerTitleAlign: 'center',
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

                {/* File Counts */}
                <View style={styles.syncCountsContainer}>
                  <View style={styles.syncCountsRow}>
                    <Text style={styles.syncCountHeader}>Local</Text>
                    <Text style={styles.syncCountHeader}>Cloud</Text>
                  </View>
                  <View style={styles.syncCountsRow}>
                    <Text style={styles.syncCountLabel}>Quotes</Text>
                    <Text style={styles.syncCountValue}>{localCounts.quotes}</Text>
                    <Text style={styles.syncCountValue}>{cloudCounts.quotes}</Text>
                  </View>
                  <View style={styles.syncCountsRow}>
                    <Text style={styles.syncCountLabel}>Invoices</Text>
                    <Text style={styles.syncCountValue}>{localCounts.invoices}</Text>
                    <Text style={styles.syncCountValue}>{cloudCounts.invoices}</Text>
                  </View>
                  <View style={styles.syncCountsRow}>
                    <Text style={styles.syncCountLabel}>Clients</Text>
                    <Text style={styles.syncCountValue}>{localCounts.clients}</Text>
                    <Text style={styles.syncCountValue}>{cloudCounts.clients}</Text>
                  </View>
                  <View style={styles.syncCountsRow}>
                    <Text style={styles.syncCountLabel}>Assemblies</Text>
                    <Text style={styles.syncCountValue}>{localCounts.assemblies}</Text>
                    <Text style={styles.syncCountValue}>{cloudCounts.assemblies}</Text>
                  </View>
                  <View style={styles.syncCountsRow}>
                    <Text style={styles.syncCountLabel}>Business Settings</Text>
                    <Text style={[styles.syncCountValue, { color: '#34C759' }]}>✓</Text>
                    <Text style={[styles.syncCountValue, { color: '#34C759' }]}>✓</Text>
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
                <View style={styles.usageCompact}>
                  <View style={styles.usageCompactRow}>
                    <Text style={styles.usageLabel}>Draft Quotes</Text>
                    <Text style={styles.usageValue}>Unlimited</Text>
                  </View>
                  <View style={styles.usageCompactRow}>
                    <Text style={styles.usageLabel}>PDF Exports</Text>
                    <Text style={styles.usageValue}>
                      {isPro
                        ? `${userState.pdfsUsed} (Unlimited)`
                        : `${userState.pdfsUsed} / ${FREE_LIMITS.pdfs}`}
                    </Text>
                  </View>
                  <View style={styles.usageCompactRow}>
                    <Text style={styles.usageLabel}>CSV Exports</Text>
                    <Text style={styles.usageValue}>
                      {isPro
                        ? `${userState.spreadsheetsUsed} (Unlimited)`
                        : `${userState.spreadsheetsUsed} / ${FREE_LIMITS.spreadsheets}`}
                    </Text>
                  </View>
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
            {/* Quotes */}
            <Text style={styles.notifSectionLabel}>Quotes</Text>
            <View style={styles.card}>
              <View style={styles.notifRow}>
                <Text style={styles.notifRowLabel}>Follow-up reminders</Text>
                <Switch
                  value={preferences.notifications?.autoFollowUpEnabled ?? true}
                  onValueChange={(value) => handleUpdateNotifications({ autoFollowUpEnabled: value })}
                  trackColor={{ false: "#D1D1D6", true: theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {preferences.notifications?.autoFollowUpEnabled && (
                <FollowUpDaysInput
                  value={preferences.notifications?.autoFollowUpDays ?? 7}
                  onSave={(days) => handleUpdateNotifications({ autoFollowUpDays: days })}
                  theme={theme}
                />
              )}
            </View>

            {/* Invoices */}
            <Text style={[styles.notifSectionLabel, { marginTop: theme.spacing(2) }]}>Invoices</Text>
            <View style={styles.card}>
              <View style={styles.notifRow}>
                <Text style={styles.notifRowLabel}>Due today</Text>
                <Switch
                  value={preferences.notifications?.invoiceDueToday || false}
                  onValueChange={(value) => handleUpdateNotifications({ invoiceDueToday: value })}
                  trackColor={{ false: "#D1D1D6", true: theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.notifRow}>
                <Text style={styles.notifRowLabel}>Due soon (3 days)</Text>
                <Switch
                  value={preferences.notifications?.invoiceDueSoon || false}
                  onValueChange={(value) => handleUpdateNotifications({ invoiceDueSoon: value })}
                  trackColor={{ false: "#D1D1D6", true: theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={[styles.notifRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.notifRowLabel}>Overdue</Text>
                <Switch
                  value={preferences.notifications?.invoiceOverdue || false}
                  onValueChange={(value) => handleUpdateNotifications({ invoiceOverdue: value })}
                  trackColor={{ false: "#D1D1D6", true: theme.colors.accent }}
                  thumbColor="#FFFFFF"
                />
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
                  onValueChange={(value) => handleUpdatePrivacy(value)}
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

function FollowUpDaysInput({
  value,
  onSave,
  theme,
}: {
  value: number;
  onSave: (days: number) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const [localValue, setLocalValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const handleFocus = () => {
    setIsFocused(true);
    setLocalValue(""); // Clear on focus so user can type fresh
  };

  const handleChangeText = (text: string) => {
    // Only allow digits, no leading zeros
    const filtered = text.replace(/[^1-9]/g, "").slice(0, 2);
    // Allow second digit to be 0 (for 10, 20, etc.)
    if (text.length === 2 && /^[1-9]0$/.test(text)) {
      setLocalValue(text);
    } else {
      setLocalValue(filtered);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const days = parseInt(localValue, 10);
    if (!isNaN(days) && days > 0 && days <= 90) {
      onSave(days);
    }
    setLocalValue(""); // Reset local value
  };

  return (
    <View style={[styles.notifRow, { borderBottomWidth: 0 }]}>
      <Text style={styles.notifRowLabel}>Remind after</Text>
      <View style={styles.notifDaysInput}>
        <TextInput
          style={[
            styles.notifDaysField,
            isFocused && { borderColor: theme.colors.accent },
          ]}
          value={isFocused ? localValue : String(value)}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType="number-pad"
          maxLength={2}
          returnKeyType="done"
          blurOnSubmit
        />
        <Text style={styles.notifDaysLabel}>days</Text>
      </View>
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
    usageCompact: {
      padding: theme.spacing(2),
      gap: theme.spacing(1),
    },
    usageCompactRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
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
    notifSectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: theme.spacing(1),
      marginLeft: theme.spacing(0.5),
    },
    notifRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    notifRowLabel: {
      fontSize: 15,
      color: theme.colors.text,
    },
    notifDaysInput: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(0.75),
    },
    notifDaysField: {
      width: 44,
      height: 32,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      textAlign: "center",
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    notifDaysLabel: {
      fontSize: 15,
      color: theme.colors.muted,
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
    syncCountsContainer: {
      marginHorizontal: theme.spacing(2),
      marginTop: theme.spacing(2),
      borderRadius: 8,
      backgroundColor: theme.colors.card,
      overflow: "hidden",
    },
    syncCountsRow: {
      flexDirection: "row",
      paddingVertical: theme.spacing(1),
      paddingHorizontal: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    syncCountHeader: {
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.muted,
      textAlign: "center",
    },
    syncCountLabel: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.text,
    },
    syncCountValue: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "center",
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
