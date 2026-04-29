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
import { Stack, useRouter, useNavigation } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";
import { supabase } from "@/lib/supabase";
import { needsSync, syncAllProducts, hasProductCache } from "@/modules/catalog/productService";
import { setUserEmail } from "@/lib/user";
import { ensureProfileExists } from "@/lib/authUtils";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const LAST_EMAIL_KEY = "@quotecat/last-email";

export default function SignUpScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ loaded: 0, total: 0 });
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const isMountedRef = useRef(true);
  const spinValue = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Google Sign-In setup
  // iOS uses the iOS OAuth client (validates by bundle ID).
  // Android uses the Android OAuth client (validates by package name + SHA-1).
  // Web client ID is included for Supabase ID-token verification.
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  // Check Apple Sign-In availability (iOS only)
  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
    }
  }, []);

  // Handle Google Sign-In response
  useEffect(() => {
    if (googleResponse?.type === "success") {
      const { id_token } = googleResponse.params;
      handleGoogleToken(id_token);
    } else if (googleResponse?.type === "error") {
      console.error("Google OAuth error:", googleResponse.error);
      Alert.alert(
        "Google Sign-In Failed",
        googleResponse.error?.message || "An error occurred during Google sign-in"
      );
    } else if (googleResponse?.type === "dismiss") {
      console.log("Google OAuth dismissed by user");
    }
  }, [googleResponse]);

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

  // Shared post-sign-in flow (sync products, navigate to dashboard)
  const handlePostSignIn = async (userEmail: string) => {
    await setUserEmail(userEmail);

    // Sync product catalog for new user
    const hasCache = await hasProductCache();
    const shouldSyncProducts = await needsSync();

    if (shouldSyncProducts && !hasCache) {
      const userConsents = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Download Product Catalog",
          "QuoteCat needs to download the product catalog (~100 MB) to enable material pricing. This is a one-time download.\n\nDownload now?",
          [
            { text: "Later", style: "cancel", onPress: () => resolve(false) },
            { text: "Download", onPress: () => resolve(true) },
          ]
        );
      });

      if (userConsents) {
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
    }

    router.replace("/(main)/(tabs)/dashboard");
  };

  // Apple Sign-In handler
  const handleAppleSignIn = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("No identity token received from Apple");
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) throw error;

      if (data.user) {
        await ensureProfileExists(data.user);
        await handlePostSignIn(data.user.email || "");
      }
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        // User cancelled, don't show error
      } else {
        console.error("Apple Sign-In error:", error);
        Alert.alert("Sign In Failed", error.message || "Please try again");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Google Sign-In token handler
  const handleGoogleToken = async (idToken: string) => {
    setLoading(true);
    console.log("🔵 handleGoogleToken called with token length:", idToken?.length);

    try {
      console.log("🔵 Calling supabase.auth.signInWithIdToken...");
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      console.log("🔵 Supabase response - data:", !!data, "error:", error?.message);

      if (error) throw error;

      if (data.user) {
        console.log("🔵 User authenticated:", data.user.id, data.user.email);
        await ensureProfileExists(data.user);
        console.log("🔵 Profile ensured, calling handlePostSignIn...");
        await handlePostSignIn(data.user.email || "");
      } else {
        console.log("🔵 No user in response data");
      }
    } catch (error) {
      console.error("🔴 Google Sign-In error:", error);
      Alert.alert("Sign In Failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

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
        // Create profile for new user so entitlements sync correctly
        try {
          await supabase.from("profiles").insert({
            id: data.user.id,
            email: data.user.email,
            tier: "free",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } catch (profileError) {
          // Profile might already exist (e.g., created by Stripe webhook), ignore error
          console.log("Profile creation skipped (may already exist):", profileError);
        }

        // Save email for next time
        await AsyncStorage.setItem(LAST_EMAIL_KEY, email.trim());

        // Check if email confirmation is required
        if (data.session) {
          // User is signed in immediately (email confirmation disabled)
          // Save email to user state so Delete Account works
          await setUserEmail(email.trim());
          Alert.alert("Success", "Account created successfully!");

          // Sync product catalog for new user
          const hasCache = await hasProductCache();
          const shouldSyncProducts = await needsSync();

          if (shouldSyncProducts && !hasCache) {
            // Prompt for consent before downloading (Apple requirement)
            const userConsents = await new Promise<boolean>((resolve) => {
              Alert.alert(
                "Download Product Catalog",
                "QuoteCat needs to download the product catalog (~100 MB) to enable material pricing. This is a one-time download.\n\nDownload now?",
                [
                  { text: "Later", style: "cancel", onPress: () => resolve(false) },
                  { text: "Download", onPress: () => resolve(true) },
                ]
              );
            });

            if (userConsents) {
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
            } else {
              console.log("⏭️ User skipped product catalog download");
            }
          }

          // Navigate to main app
          router.replace("/(main)/(tabs)/dashboard");
        } else {
          // Email confirmation required
          Alert.alert(
            "Check Your Email",
            "We sent you a confirmation link. Please check your email (and junk/spam folder) to verify your account, then sign in.",
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
              {/* Social Login Buttons */}
              {Platform.OS === "ios" && appleAuthAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={styles.socialButton}
                  onPress={handleAppleSignIn}
                />
              )}

              <Pressable
                style={[styles.googleButton, loading && styles.buttonDisabled]}
                onPress={() => {
                  console.log("🔵 Google button pressed, googleRequest ready:", !!googleRequest);
                  googlePromptAsync().then(result => {
                    console.log("🔵 googlePromptAsync result:", JSON.stringify(result, null, 2));
                  }).catch(err => {
                    console.error("🔴 googlePromptAsync error:", err);
                  });
                }}
                disabled={loading || !googleRequest}
              >
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

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
                onPress={() => {
                  if (canGoBack) {
                    router.back();
                  } else {
                    router.replace("/(main)/(tabs)/dashboard");
                  }
                }}
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
      gap: theme.spacing(2),
    },
    socialButton: {
      height: 50,
      width: "100%",
    },
    googleButton: {
      height: 50,
      backgroundColor: "#fff",
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    googleButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#1f1f1f",
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: theme.spacing(1),
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      marginHorizontal: theme.spacing(2),
      fontSize: 14,
      color: theme.colors.muted,
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
