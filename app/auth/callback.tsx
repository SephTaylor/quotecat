// app/auth/callback.tsx
// Handles deep link callback from password setup/recovery emails
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { GradientBackground } from "@/components/GradientBackground";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleDeepLink();
  }, []);

  const handleDeepLink = async () => {
    try {
      // Extract tokens from URL params
      // URL format: quotecat://auth/callback#access_token=xxx&refresh_token=xxx&type=recovery
      const accessToken = params.access_token as string;
      const refreshToken = params.refresh_token as string;
      const type = params.type as string;

      console.log('Auth callback - Type:', type);
      console.log('Access token present:', !!accessToken);
      console.log('Refresh token present:', !!refreshToken);

      if (!accessToken || !refreshToken || type !== 'recovery') {
        setError('Invalid or expired password reset link. Please request a new one.');
        setLoading(false);
        return;
      }

      // Set the session using the tokens from the URL
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        console.error('Session error:', sessionError);
        setError('This password reset link has expired. Please request a new one.');
        setLoading(false);
        return;
      }

      console.log('Session set successfully for user:', data.user?.email);
      setLoading(false);
    } catch (err) {
      console.error('Deep link handling error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert("Error", "Please enter and confirm your password");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }

    setUpdating(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      Alert.alert(
        "Success!",
        "Your password has been set. You can now sign in to QuoteCat.",
        [
          {
            text: "Sign In",
            onPress: () => router.replace("/(auth)/sign-in"),
          },
        ]
      );
    } catch (err) {
      console.error('Password update error:', err);
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to set password. Please try again."
      );
    } finally {
      setUpdating(false);
    }
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <GradientBackground>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingText}>Verifying your link...</Text>
          </View>
        </GradientBackground>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitleAlign: 'center',
            headerTitle: () => (
              <Text style={{ fontSize: 17, fontWeight: "700", color: theme.colors.text }}>
                Password Reset
              </Text>
            ),
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
          }}
        />
        <GradientBackground>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Link Invalid or Expired</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.button}
              onPress={() => router.replace("/(auth)/sign-in")}
            >
              <Text style={styles.buttonText}>Back to Sign In</Text>
            </Pressable>
          </View>
        </GradientBackground>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          headerTitle: () => (
            <Text style={{ fontSize: 17, fontWeight: "700", color: theme.colors.text }}>
              Set Your Password
            </Text>
          ),
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
        }}
      />
      <GradientBackground>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Create Your Password</Text>
            <Text style={styles.subtitle}>
              Choose a secure password for your QuoteCat account
            </Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!updating}
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
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!updating}
                />
              </View>

              <Pressable
                style={[styles.button, updating && styles.buttonDisabled]}
                onPress={handleSetPassword}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.buttonText}>Set Password</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </GradientBackground>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing(4),
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.text,
      marginTop: theme.spacing(2),
    },
    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing(4),
    },
    errorIcon: {
      fontSize: 64,
      marginBottom: theme.spacing(2),
    },
    errorTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
      textAlign: "center",
    },
    errorText: {
      fontSize: 16,
      color: theme.colors.muted,
      marginBottom: theme.spacing(4),
      textAlign: "center",
      lineHeight: 24,
    },
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
  });
}
