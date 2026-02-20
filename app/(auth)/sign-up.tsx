// app/(auth)/sign-up.tsx
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
import { needsSync, syncAllProducts, hasProductCache } from "@/modules/catalog/productService";

const LAST_EMAIL_KEY = "@quotecat/last-email";

export default function SignUpScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleSignUp = async () => {
    // Validation
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }
    if (!password) {
      Alert.alert("Error", "Please enter a password");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: "https://quotecat.ai/confirmed.html",
        },
      });

      if (error) throw error;

      if (data.user) {
        // Save email for next time
        await AsyncStorage.setItem(LAST_EMAIL_KEY, email.trim());

        // Check if email confirmation is required
        if (data.session) {
          // User is signed in immediately (email confirmation disabled)
          Alert.alert("Success", "Account created successfully!");

          // Sync product catalog for new user
          const hasCache = await hasProductCache();
          const shouldSyncProducts = await needsSync();

          if (shouldSyncProducts && !hasCache) {
            console.log("📦 First-time sync: downloading product catalog...");
            setSyncing(true);
            setSyncProgress({ loaded: 0, total: 100 });
            progressAnim.setValue(0);

            const success = await syncAllProducts((loaded, total) => {
              if (isMountedRef.current) {
                setSyncProgress({ loaded, total });
              }
            });

            await new Promise((r) => setTimeout(r, 300));
            setSyncing(false);

            if (!success) {
              Alert.alert("Warning", "Could not download product catalog. Some features may be limited.");
            }
          }

          // Navigate to main app
          router.replace("/(main)/(tabs)/dashboard");
        } else {
          // Email confirmation required
          Alert.alert(
            "Check Your Email",
            "We sent you a confirmation link. Please check your email to verify your account, then sign in.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/(auth)/sign-in"),
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error("Sign up error:", error);
      Alert.alert(
        "Sign Up Failed",
        error instanceof Error ? error.message : "Please try again"
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up for a free QuoteCat account</Text>

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
                  placeholder="At least 6 characters"
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter your password"
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry
                  editable={!loading}
                />
              </View>

              <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Pressable
                  onPress={() => router.replace("/(auth)/sign-in")}
                  disabled={loading}
                >
                  <Text style={styles.footerLink}>Sign In</Text>
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
