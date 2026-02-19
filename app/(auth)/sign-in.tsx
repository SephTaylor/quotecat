// app/(auth)/sign-in.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";
import { supabase } from "@/lib/supabase";
import { activateProTier, activatePremiumTier } from "@/lib/user";
import { needsSync, syncAllProducts, hasProductCache } from "@/modules/catalog/productService";

const LAST_EMAIL_KEY = "@quotecat/last-email";

export default function SignInScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ loaded: 0, total: 0 });
  const isMountedRef = useRef(true);
  const spinValue = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Spin animation while syncing
  useEffect(() => {
    if (syncing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [syncing, spinValue]);

  // Animate progress bar
  useEffect(() => {
    if (syncProgress.total > 0) {
      const percent = syncProgress.loaded / syncProgress.total;
      Animated.timing(progressAnim, {
        toValue: percent,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [syncProgress.loaded, syncProgress.total, progressAnim]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Track mounted state to avoid state updates on unmounted component
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load last used email on mount
  useEffect(() => {
    AsyncStorage.getItem(LAST_EMAIL_KEY).then((savedEmail) => {
      if (savedEmail && isMountedRef.current) setEmail(savedEmail);
    });
  }, []);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please enter your email and password");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Fetch user's tier from Supabase profiles table
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("tier, email")
          .eq("id", data.user.id)
          .single();

        // Save email for next time
        await AsyncStorage.setItem(LAST_EMAIL_KEY, email.trim());

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          // Default to free if profile doesn't exist yet
          Alert.alert("Success", "Signed in successfully");
        } else if (profile) {
          // Update local user state based on Supabase tier
          const isPaidTier = profile.tier === "premium" || profile.tier === "pro";

          if (profile.tier === "premium") {
            await activatePremiumTier(profile.email);
          } else if (profile.tier === "pro") {
            await activateProTier(profile.email);
          }

          Alert.alert("Success", "Signed in successfully");
        }

        // Ensure product catalog is available (sync if needed)
        const hasCache = await hasProductCache();
        const shouldSyncProducts = await needsSync();

        if (shouldSyncProducts) {
          if (!hasCache) {
            // First-time user - wait for sync with progress bar
            console.log("📦 First-time sync: downloading product catalog...");
            setSyncing(true);
            setSyncProgress({ loaded: 0, total: 100 });
            progressAnim.setValue(0);

            const success = await syncAllProducts((loaded, total) => {
              if (isMountedRef.current) {
                setSyncProgress({ loaded, total });
              }
            });

            // Brief pause to show completion
            await new Promise((r) => setTimeout(r, 300));
            setSyncing(false);

            if (success) {
              console.log("✅ Product catalog synced successfully");
            } else {
              console.log("⚠️ Product catalog sync failed");
              Alert.alert("Warning", "Could not download product catalog. Some features may be limited.");
            }
          } else {
            // Existing user with stale cache - sync in background
            console.log("📦 Background sync: refreshing product catalog...");
            syncAllProducts().then((success) => {
              if (success) {
                console.log("✅ Product catalog refreshed");
              }
            });
          }
        }

        // Navigate to main app
        router.replace("/(main)/(tabs)/dashboard");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      Alert.alert(
        "Sign In Failed",
        error instanceof Error ? error.message : "Please check your credentials and try again"
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    const emailToReset = email.trim();

    if (!emailToReset) {
      Alert.alert(
        "Enter Your Email",
        "Please enter your email address first, then tap Forgot Password."
      );
      return;
    }

    Alert.alert(
      "Reset Password",
      `Send a password reset link to ${emailToReset}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            setResetLoading(true);
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(emailToReset, {
                redirectTo: "https://quotecat.ai/auth/callback",
              });

              if (error) throw error;

              Alert.alert(
                "Check Your Email",
                "If an account exists with that email, you'll receive a password reset link shortly."
              );
            } catch (error) {
              console.error("Password reset error:", error);
              Alert.alert(
                "Error",
                "Unable to send reset email. Please try again later."
              );
            } finally {
              if (isMountedRef.current) {
                setResetLoading(false);
              }
            }
          },
        },
      ]
    );
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <GradientBackground>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in with your QuoteCat account</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry
                  editable={!loading}
                />
                <Pressable
                  onPress={handleForgotPassword}
                  disabled={loading || resetLoading}
                  style={styles.forgotPassword}
                >
                  <Text style={styles.forgotPasswordText}>
                    {resetLoading ? "Sending..." : "Forgot Password?"}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Don&apos;t have an account? </Text>
                <Pressable
                  onPress={() => Linking.openURL("https://quotecat.ai")}
                  disabled={loading}
                >
                  <Text style={styles.footerLink}>Visit quotecat.ai</Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.backButton}
                onPress={() => router.back()}
                disabled={loading}
              >
                <Text style={styles.backButtonText}>Back to App</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </GradientBackground>

      {/* Product sync progress modal */}
      <Modal
        visible={syncing}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.syncOverlay}>
          <View style={styles.syncContainer}>
            <View style={styles.syncHeader}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons
                  name="sync-outline"
                  size={18}
                  color={theme.colors.accent}
                />
              </Animated.View>
              <Text style={styles.syncText}>Downloading product catalog...</Text>
              <Text style={styles.syncCount}>
                {syncProgress.loaded.toLocaleString()} / {syncProgress.total.toLocaleString()}
              </Text>
            </View>
            <View style={styles.syncBarBg}>
              <Animated.View
                style={[
                  styles.syncBarFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.syncSubtext}>This only happens once</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      padding: theme.spacing(4),
    },
    title: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.muted,
      marginBottom: theme.spacing(4),
      textAlign: "center",
    },
    form: {
      gap: theme.spacing(3),
    },
    inputGroup: {
      gap: theme.spacing(1),
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    forgotPassword: {
      alignSelf: "flex-end",
      marginTop: theme.spacing(0.5),
    },
    forgotPasswordText: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: "500",
    },
    button: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.5),
      alignItems: "center",
      marginTop: theme.spacing(1),
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    footer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    footerText: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    footerLink: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: "600",
    },
    backButton: {
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
    },
    backButtonText: {
      fontSize: 14,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    // Sync progress modal styles
    syncOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "transparent",
    },
    syncContainer: {
      backgroundColor: theme.colors.card,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      padding: 16,
      paddingBottom: 32,
    },
    syncHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 8,
    },
    syncText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      flex: 1,
    },
    syncCount: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    syncBarBg: {
      height: 6,
      backgroundColor: theme.colors.border,
      borderRadius: 3,
      overflow: "hidden",
    },
    syncBarFill: {
      height: "100%",
      backgroundColor: theme.colors.accent,
      borderRadius: 3,
    },
    syncSubtext: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 8,
      textAlign: "center",
    },
  });
}
