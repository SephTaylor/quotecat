// app/(main)/settings.tsx
// Settings and profile management
import { useTheme } from "@/contexts/ThemeContext";
import { canAccessAssemblies, getQuotaRemaining } from "@/lib/features";
import { getUserState, activateProTier, deactivateProTier, FREE_LIMITS, type UserState } from "@/lib/user";
import {
  loadPreferences,
  updateDashboardPreferences,
  resetPreferences,
  type DashboardPreferences,
} from "@/lib/preferences";
import { Stack, useFocusEffect } from "expo-router";
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
} from "react-native";

export default function Settings() {
  const { mode, theme, setThemeMode } = useTheme();
  const [isPro, setIsPro] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userState, setUserState] = useState<UserState | null>(null);
  const [preferences, setPreferences] = useState<DashboardPreferences>({
    showStats: true,
    showValueTracking: true,
    showPinnedQuotes: true,
    showRecentQuotes: true,
    showQuickActions: true,
    recentQuotesCount: 5,
  });

  const load = useCallback(async () => {
    const [user, prefs] = await Promise.all([
      getUserState(),
      loadPreferences(),
    ]);
    setIsPro(canAccessAssemblies(user));
    setUserEmail(user.email);
    setUserState(user);
    setPreferences(prefs.dashboard);
  }, []);

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
    Alert.alert(
      "Sign In",
      "You'll be redirected to quotecat.ai to sign in to your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            Linking.openURL("https://quotecat.ai/login");
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          // TODO: Implement sign out logic
          Alert.alert("Signed Out", "You have been signed out successfully.");
        },
      },
    ]);
  };

  const handleUpdatePreference = async (
    updates: Partial<DashboardPreferences>,
  ) => {
    const updated = { ...preferences, ...updates };
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
            setPreferences(defaults.dashboard);
          },
        },
      ],
    );
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Settings",
          headerShown: true,
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
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>

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
                <>
                  <Pressable
                    style={styles.settingButton}
                    onPress={handleManageAccount}
                  >
                    <Text style={styles.settingButtonText}>Manage Account</Text>
                    <Text style={styles.settingButtonIcon}>→</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.settingButton, styles.settingButtonLast]}
                    onPress={handleSignOut}
                  >
                    <Text style={styles.settingButtonText}>Sign Out</Text>
                  </Pressable>
                </>
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

          {/* Usage & Limits Section */}
          {userState && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Usage & Limits</Text>

              <View style={styles.card}>
                {/* Quotes */}
                <View style={styles.usageRow}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageLabel}>Quotes Created</Text>
                    <Text style={styles.usageValue}>
                      {isPro
                        ? `${userState.quotesUsed} (Unlimited)`
                        : `${userState.quotesUsed} / ${FREE_LIMITS.quotes}`}
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
                              (userState.quotesUsed / FREE_LIMITS.quotes) * 100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* PDF Exports */}
                <View style={styles.usageRow}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageLabel}>PDF Exports (This Month)</Text>
                    <Text style={styles.usageValue}>
                      {isPro
                        ? `${userState.pdfsThisMonth} (Unlimited)`
                        : `${userState.pdfsThisMonth} / ${FREE_LIMITS.pdfsPerMonth}`}
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
                              (userState.pdfsThisMonth / FREE_LIMITS.pdfsPerMonth) * 100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* Spreadsheet Exports */}
                <View style={[styles.usageRow, styles.usageRowLast]}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageLabel}>
                      Spreadsheet Exports (This Month)
                    </Text>
                    <Text style={styles.usageValue}>
                      {isPro
                        ? `${userState.spreadsheetsThisMonth} (Unlimited)`
                        : `${userState.spreadsheetsThisMonth} / ${FREE_LIMITS.spreadsheetsPerMonth}`}
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
                              (userState.spreadsheetsThisMonth /
                                FREE_LIMITS.spreadsheetsPerMonth) *
                                100
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Appearance Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appearance</Text>

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
          </View>

          {/* Dashboard Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dashboard</Text>

            <View style={styles.card}>
              <SettingRow
                label="Quick Stats"
                value={preferences.showStats}
                onToggle={(value) =>
                  handleUpdatePreference({ showStats: value })
                }
                theme={theme}
              />
              <SettingRow
                label="Value Tracking"
                value={preferences.showValueTracking}
                onToggle={(value) =>
                  handleUpdatePreference({ showValueTracking: value })
                }
                theme={theme}
              />
              <SettingRow
                label="Pinned Quotes"
                value={preferences.showPinnedQuotes}
                onToggle={(value) =>
                  handleUpdatePreference({ showPinnedQuotes: value })
                }
                theme={theme}
              />
              <SettingRow
                label="Recent Quotes"
                value={preferences.showRecentQuotes}
                onToggle={(value) =>
                  handleUpdatePreference({ showRecentQuotes: value })
                }
                theme={theme}
              />
              <SettingRow
                label="Quick Actions"
                value={preferences.showQuickActions}
                onToggle={(value) =>
                  handleUpdatePreference({ showQuickActions: value })
                }
                theme={theme}
                isLast
              />

              {/* Recent Quotes Count */}
              {preferences.showRecentQuotes && (
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
                          preferences.recentQuotesCount === count &&
                            styles.chipActive,
                        ]}
                        onPress={() =>
                          handleUpdatePreference({ recentQuotesCount: count })
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            preferences.recentQuotesCount === count &&
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
          </View>

          {/* Quote Defaults Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quote Defaults</Text>

            <View style={styles.card}>
              <Pressable
                style={styles.settingButton}
                onPress={() => {
                  // TODO: Navigate to company name editor
                  Alert.alert("Coming Soon", "Company name editing");
                }}
              >
                <Text style={styles.settingButtonText}>Company Name</Text>
                <Text style={styles.settingButtonIcon}>→</Text>
              </Pressable>

              <Pressable
                style={styles.settingButton}
                onPress={() => {
                  // TODO: Navigate to currency picker
                  Alert.alert("Coming Soon", "Currency picker");
                }}
              >
                <Text style={styles.settingButtonText}>Currency</Text>
                <Text style={styles.settingButtonIcon}>→</Text>
              </Pressable>

              <Pressable
                style={styles.settingButton}
                onPress={() => {
                  // TODO: Navigate to contact info editor
                  Alert.alert("Coming Soon", "Contact info editing");
                }}
              >
                <Text style={styles.settingButtonText}>Contact Info</Text>
                <Text style={styles.settingButtonIcon}>→</Text>
              </Pressable>

              <Pressable
                style={[styles.settingButton, styles.settingButtonLast]}
                onPress={() => {
                  if (!isPro) {
                    Alert.alert(
                      "Pro Feature",
                      "Company logo upload is available for Pro subscribers. Upgrade at quotecat.ai to unlock this feature.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Upgrade",
                          onPress: () => {
                            Linking.openURL("https://quotecat.ai/pricing");
                          },
                        },
                      ],
                    );
                  } else {
                    // TODO: Navigate to logo upload
                    Alert.alert("Coming Soon", "Logo upload");
                  }
                }}
              >
                <View style={styles.settingButtonContent}>
                  <Text style={styles.settingButtonText}>Company Logo</Text>
                  {!isPro && <Text style={styles.proLock}>🔒</Text>}
                </View>
                <Text style={styles.settingButtonIcon}>→</Text>
              </Pressable>
            </View>
          </View>

          {/* ⚠️ DEBUG SECTION - REMOVE BEFORE PRODUCTION ⚠️ */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#FF3B30' }]}>
              ⚠️ DEBUG (REMOVE BEFORE PRODUCTION)
            </Text>

            <View style={[styles.card, { borderColor: '#FF3B30', borderWidth: 2 }]}>
              <Pressable
                style={[styles.settingButton, styles.settingButtonLast]}
                onPress={async () => {
                  const user = await getUserState();
                  if (user.tier === "free") {
                    await activateProTier("debug@test.com");
                    Alert.alert("Debug", "Switched to PRO tier");
                  } else {
                    await deactivateProTier();
                    Alert.alert("Debug", "Switched to FREE tier");
                  }
                  await load(); // Reload to update UI
                }}
              >
                <Text style={[styles.settingButtonText, { fontWeight: '700' }]}>
                  Toggle Free/Pro Tier
                </Text>
                <Text style={styles.settingValue}>
                  {isPro ? "PRO → FREE" : "FREE → PRO"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>

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
          </View>
        </ScrollView>
      </View>
    </>
  );
}

function SettingRow({
  label,
  value,
  onToggle,
  isLast = false,
  theme,
}: {
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  isLast?: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.settingButton, isLast && styles.settingButtonLast]}>
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
      padding: theme.spacing(2),
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: theme.spacing(1),
      marginLeft: theme.spacing(0.5),
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
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    usageRowLast: {
      borderBottomWidth: 0,
    },
    usageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    usageLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    usageValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
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
  });
}
