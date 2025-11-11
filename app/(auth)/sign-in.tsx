// app/(auth)/sign-in.tsx
import React, { useState } from "react";
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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";
import { supabase } from "@/lib/supabase";
import { activateProTier, activatePremiumTier } from "@/lib/user";
import { migrateLocalQuotesToCloud, hasMigrated } from "@/lib/quotesSync";
import { logUsageEvent, UsageEventTypes } from "@/lib/usageTracking";
import {
  isBiometricSupported,
  getAvailableBiometricTypes,
  getBiometricName,
  authenticateWithBiometrics,
  saveCredentials,
  getCredentials,
  hasCredentials,
  type BiometricType,
} from "@/lib/biometrics";

export default function SignInScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricTypes, setBiometricTypes] = useState<BiometricType[]>(['none']);
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  // Check biometric availability on mount
  React.useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    const supported = await isBiometricSupported();
    const types = await getAvailableBiometricTypes();
    const saved = await hasCredentials();

    setBiometricAvailable(supported);
    setBiometricTypes(types);
    setCredentialsSaved(saved);
  };

  const handleBiometricSignIn = async () => {
    setLoading(true);
    try {
      // Authenticate with biometrics
      const authenticated = await authenticateWithBiometrics();
      if (!authenticated) {
        setLoading(false);
        return;
      }

      // Get saved credentials
      const credentials = await getCredentials();
      if (!credentials) {
        Alert.alert("Error", "Saved credentials not found. Please sign in with email and password.");
        setLoading(false);
        return;
      }

      // Sign in with saved credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;

      if (data.user) {
        await handleSuccessfulSignIn(data.user, credentials.email);
      }
    } catch (error) {
      console.error("Biometric sign-in error:", error);
      Alert.alert(
        "Sign In Failed",
        error instanceof Error ? error.message : "Please try signing in with your password."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessfulSignIn = async (user: any, userEmail: string) => {
    // Log sign-in event
    logUsageEvent(UsageEventTypes.SIGN_IN, {
      email: userEmail,
    });

    // Fetch user's tier
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tier, email")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
      Alert.alert("Success", "Signed in successfully");
    } else if (profile) {
      const isPaidTier = profile.tier === "premium" || profile.tier === "pro";

      if (profile.tier === "premium") {
        await activatePremiumTier(profile.email);
      } else if (profile.tier === "pro") {
        await activateProTier(profile.email);
      }

      // Auto-migrate for Pro/Premium users
      if (isPaidTier) {
        const migrated = await hasMigrated();
        if (!migrated) {
          Alert.alert(
            "Backing up your quotes",
            "We're uploading your quotes to the cloud. This may take a moment...",
            [{ text: "OK" }]
          );

          const result = await migrateLocalQuotesToCloud();

          if (result.success && result.uploaded > 0) {
            Alert.alert(
              "Backup Complete",
              `Successfully backed up ${result.uploaded} quote${result.uploaded === 1 ? "" : "s"} to the cloud!`,
              [{ text: "Great!" }]
            );
          } else if (result.success) {
            Alert.alert("Success", "Signed in successfully");
          } else {
            Alert.alert(
              "Backup Warning",
              "Some quotes couldn't be backed up. Your local quotes are safe. You can try syncing again from Settings.",
              [{ text: "OK" }]
            );
          }
        } else {
          Alert.alert("Success", "Signed in successfully");
        }
      } else {
        Alert.alert("Success", "Signed in successfully");
      }
    }

    // Navigate to main app
    router.replace("/(main)/(tabs)/dashboard");
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Email Required", "Please enter your email address to reset your password");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'quotecat://auth/callback',
      });

      if (error) throw error;

      Alert.alert(
        "Check Your Email",
        `We've sent a password reset link to ${email.trim()}. Click the link in the email to set a new password.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Password reset error:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to send reset email. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

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
        // Offer to enable biometrics if supported and not already saved
        if (biometricAvailable && !credentialsSaved) {
          const biometricName = getBiometricName(biometricTypes);
          Alert.alert(
            `Enable ${biometricName}?`,
            `Sign in faster next time using ${biometricName}`,
            [
              { text: "Not Now", style: "cancel" },
              {
                text: "Enable",
                onPress: async () => {
                  await saveCredentials(email.trim(), password);
                  setCredentialsSaved(true);
                },
              },
            ]
          );
        }

        await handleSuccessfulSignIn(data.user, email.trim());
      }
    } catch (error) {
      console.error("Sign in error:", error);
      Alert.alert(
        "Sign In Failed",
        error instanceof Error ? error.message : "Please check your credentials and try again"
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ paddingLeft: 16, paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 17, color: theme.colors.accent }}>
                ‹ Back
              </Text>
            </Pressable>
          ),
          headerTitle: () => (
            <Text style={{ fontSize: 17, fontWeight: "700", color: theme.colors.text }}>
              Sign In
            </Text>
          ),
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
        }}
      />
      <GradientBackground>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in with your QuoteCat account</Text>

            {/* Biometric Sign In Button (if enabled) */}
            {biometricAvailable && credentialsSaved && (
              <Pressable
                style={[styles.biometricButton, loading && styles.buttonDisabled]}
                onPress={handleBiometricSignIn}
                disabled={loading}
              >
                <Ionicons
                  name={biometricTypes.includes('facial') ? 'scan' : 'finger-print'}
                  size={24}
                  color={theme.colors.accent}
                />
                <Text style={styles.biometricButtonText}>
                  Sign in with {getBiometricName(biometricTypes)}
                </Text>
              </Pressable>
            )}

            {biometricAvailable && credentialsSaved && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

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

              <Pressable
                onPress={handleForgotPassword}
                disabled={loading}
                style={{ alignItems: 'center', marginTop: 12 }}
              >
                <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <Pressable
                  onPress={() => Linking.openURL("https://quotecat.ai")}
                  disabled={loading}
                >
                  <Text style={styles.footerLink}>Visit quotecat.ai</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </GradientBackground>
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
    forgotPasswordLink: {
      fontSize: 14,
      color: theme.colors.accent,
      fontWeight: "600",
    },
    biometricButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing(1),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 2,
      borderColor: theme.colors.accent,
      paddingVertical: theme.spacing(1.5),
      marginTop: theme.spacing(3),
    },
    biometricButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    divider: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: theme.spacing(3),
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
      fontWeight: "600",
    },
  });
}
