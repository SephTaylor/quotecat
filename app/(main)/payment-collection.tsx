// app/(main)/payment-collection.tsx
// v1.2.9 — Stripe Connect onboarding + status screen for Pro+ contractors.
//
// Renders one of three states based on the contractor's Stripe Connect
// account from /api/stripe/connect (GET):
//
//   1. Not connected (no stripe_account_id)         → Connect with Stripe CTA
//   2. Pending verification (id exists, charges off) → Continue / re-open
//      onboarding (handles the abandonment scenario the v1.2.9 plan flags:
//      mobile in-app browser dismiss before completion)
//   3. Active (charges enabled)                      → success + manage link
//
// The screen does NOT itself enforce a tier gate at mount — the entry tile in
// business-settings already fires the paywall for Free. This screen assumes
// Pro+ context; deep-linking here as Free will still let getStripeConnectStatus
// run (server-side allows status fetch for any signed-in user) and the
// Connect button will work — server doesn't reject Free either. The product
// gate is intentionally at the entry surface, not duplicated here.

import { HeaderBackButton } from "@/components/HeaderBackButton";
import { useTechContext } from "@/contexts/TechContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getStripeConnectStatus,
  startStripeOnboarding,
  type StripeConnectStatus,
} from "@/lib/stripeConnect";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PaymentCollectionScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isTech } = useTechContext();

  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getStripeConnectStatus();
      setStatus(s);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleConnect = useCallback(async () => {
    setStarting(true);
    try {
      const result = await startStripeOnboarding();
      if (result.kind === "error") {
        Alert.alert("Could not start onboarding", result.message);
        return;
      }
      // success | refresh | cancelled — in all cases re-fetch status. Stripe
      // updates charges_enabled asynchronously via the account.updated webhook,
      // so freshly-finished accounts may briefly read as pending here.
      await load();
    } finally {
      setStarting(false);
    }
  }, [load]);

  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerBlock}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.muted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.primaryButton} onPress={load}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    if (!status) return null;

    if (isTech) {
      return (
        <View style={styles.centerBlock}>
          <Ionicons name="lock-closed-outline" size={48} color={theme.colors.muted} />
          <Text style={styles.statusTitle}>Owner-only setting</Text>
          <Text style={styles.statusBody}>
            Only your business owner can set up card payments. They&apos;ll show up here once it&apos;s connected.
          </Text>
        </View>
      );
    }

    // State 1: not connected
    if (!status.connected) {
      return (
        <View>
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <Ionicons name="card-outline" size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.cardTitle}>Accept card payments</Text>
            <Text style={styles.cardBody}>
              Let your customers pay invoices by card via Stripe. Money goes straight to your bank — QuoteCat never touches it and takes no cut. Stripe charges their standard processor fee.
            </Text>
            <Pressable
              style={[styles.primaryButton, starting && styles.primaryButtonDisabled]}
              onPress={handleConnect}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Connect with Stripe</Text>
              )}
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>
            You&apos;ll be asked to verify your identity and business with Stripe. This is required to accept card payments.
          </Text>
        </View>
      );
    }

    // State 3: active
    if (status.chargesEnabled) {
      return (
        <View>
          <View style={styles.card}>
            <View style={[styles.cardIconRow, styles.cardIconRowActive]}>
              <Ionicons name="checkmark-circle" size={28} color="#22C55E" />
            </View>
            <Text style={styles.cardTitle}>Card payments active</Text>
            <Text style={styles.cardBody}>
              You&apos;re all set. The Pay-by-Card button now appears on every invoice you share via Share as Link.
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => Linking.openURL("https://dashboard.stripe.com/")}
            >
              <Text style={styles.secondaryButtonText}>Open Stripe Dashboard</Text>
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>
            Manage payouts, view balances, and download tax documents in your Stripe Dashboard.
          </Text>
        </View>
      );
    }

    // State 2: pending verification
    return (
      <View>
        <View style={styles.card}>
          <View style={[styles.cardIconRow, styles.cardIconRowPending]}>
            <Ionicons name="time-outline" size={28} color="#F59E0B" />
          </View>
          <Text style={styles.cardTitle}>Setup in progress</Text>
          <Text style={styles.cardBody}>
            Stripe is still verifying your account. If you closed the setup screen before finishing, tap below to continue. Card payments will only appear on invoices once Stripe finishes verification.
          </Text>
          <Pressable
            style={[styles.primaryButton, starting && styles.primaryButtonDisabled]}
            onPress={handleConnect}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Continue setup</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.disclaimer}>
          Verification typically takes a few minutes. Your customers will see your existing payment methods (Venmo, Zelle, etc.) in the meantime.
        </Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Card Payments",
          headerShown: true,
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {renderBody()}
      </ScrollView>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], insets: { bottom: number }) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: 16, paddingBottom: Math.max(32, insets.bottom) },

    centerBlock: {
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 48,
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      paddingHorizontal: 24,
    },

    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 20,
      alignItems: "center",
      gap: 12,
    },
    cardIconRow: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: `${theme.colors.accent}15`,
      alignItems: "center",
      justifyContent: "center",
    },
    cardIconRowActive: { backgroundColor: "#22C55E20" },
    cardIconRowPending: { backgroundColor: "#F59E0B20" },
    cardTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      textAlign: "center",
    },
    cardBody: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },
    statusTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    statusBody: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      paddingHorizontal: 24,
    },

    primaryButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 10,
      width: "100%",
      alignItems: "center",
      marginTop: 8,
    },
    primaryButtonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

    secondaryButton: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 10,
      width: "100%",
      alignItems: "center",
      marginTop: 8,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "600",
    },

    disclaimer: {
      fontSize: 12,
      color: theme.colors.muted,
      textAlign: "center",
      marginTop: 16,
      paddingHorizontal: 16,
      lineHeight: 18,
    },
  });
}
