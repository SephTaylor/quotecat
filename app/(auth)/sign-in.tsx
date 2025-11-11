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

export default function SignInScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
        // Log sign-in event (non-blocking)
        logUsageEvent(UsageEventTypes.SIGN_IN, {
          email: email.trim(),
        });

        // Fetch user's tier from Supabase profiles table
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("tier, email")
          .eq("id", data.user.id)
          .single();

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

          // Auto-migrate local quotes to cloud for Pro/Premium users
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
            // Free tier users don't need activation (already default)
            Alert.alert("Success", "Signed in successfully");
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
      setLoading(false);
    }
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Sign In",
          headerShown: true,
          headerTitleAlign: 'center',
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
  });
}
