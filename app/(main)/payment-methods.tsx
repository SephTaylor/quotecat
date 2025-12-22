// app/(main)/payment-methods.tsx
// Configure payment methods to display on invoices

import { useTheme } from "@/contexts/ThemeContext";
import {
  loadPreferences,
  updatePaymentMethods,
  type PaymentMethods,
} from "@/lib/preferences";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { HeaderBackButton } from "@/components/HeaderBackButton";

type PaymentMethodKey = keyof PaymentMethods;

const PAYMENT_METHOD_CONFIG: Record<PaymentMethodKey, {
  label: string;
  icon: string;
  placeholder: string;
  hint: string;
  multiline?: boolean;
}> = {
  zelle: {
    label: "Zelle",
    icon: "💵",
    placeholder: "Phone number or email",
    hint: "e.g., (555) 123-4567 or you@email.com",
  },
  venmo: {
    label: "Venmo",
    icon: "📱",
    placeholder: "@username",
    hint: "Your Venmo username starting with @",
  },
  cashApp: {
    label: "Cash App",
    icon: "💲",
    placeholder: "$cashtag",
    hint: "Your Cash App $cashtag",
  },
  paypal: {
    label: "PayPal",
    icon: "🅿️",
    placeholder: "PayPal email",
    hint: "Email linked to your PayPal account",
  },
  check: {
    label: "Check",
    icon: "📝",
    placeholder: "Make payable to...\nMail to: 123 Main St, City, ST 12345",
    hint: "Include payee name and mailing address",
    multiline: true,
  },
  wire: {
    label: "Wire/ACH Transfer",
    icon: "🏦",
    placeholder: "Bank: First National\nRouting: 123456789\nAccount: 987654321",
    hint: "Bank details for larger jobs",
    multiline: true,
  },
  other: {
    label: "Other",
    icon: "📋",
    placeholder: "Custom payment instructions",
    hint: "Any other payment instructions",
    multiline: true,
  },
};

export default function PaymentMethodsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMethod, setExpandedMethod] = useState<PaymentMethodKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const prefs = await loadPreferences();
    setPaymentMethods(prefs.paymentMethods);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleToggle = async (key: PaymentMethodKey, enabled: boolean) => {
    if (!paymentMethods) return;
    const updated = await updatePaymentMethods({
      [key]: { ...paymentMethods[key], enabled },
    });
    setPaymentMethods(updated.paymentMethods);
    if (enabled && !paymentMethods[key].value) {
      setExpandedMethod(key);
    }
  };

  const handleValueChange = async (key: PaymentMethodKey, value: string) => {
    if (!paymentMethods) return;
    const updated = await updatePaymentMethods({
      [key]: { ...paymentMethods[key], value },
    });
    setPaymentMethods(updated.paymentMethods);
  };

  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  const enabledCount = paymentMethods
    ? Object.values(paymentMethods).filter((m) => m.enabled && m.value).length
    : 0;

  if (loading || !paymentMethods) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Payment Methods",
            headerShown: true,
            headerTitleAlign: "center",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Payment Methods",
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
        keyboardDismissMode="on-drag"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Accept Payments Your Way</Text>
          <Text style={styles.headerSubtitle}>
            Enable the payment methods you accept. They&apos;ll appear on your invoices so clients know how to pay you.
          </Text>
        </View>

        {/* Status */}
        {enabledCount > 0 && (
          <View style={styles.statusBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            <Text style={styles.statusText}>
              {enabledCount} payment method{enabledCount !== 1 ? "s" : ""} will appear on invoices
            </Text>
          </View>
        )}

        {/* Payment Methods List */}
        <View style={styles.section}>
          {(Object.keys(PAYMENT_METHOD_CONFIG) as PaymentMethodKey[]).map((key) => {
            const config = PAYMENT_METHOD_CONFIG[key];
            const method = paymentMethods[key];
            const isExpanded = expandedMethod === key;

            return (
              <View key={key} style={styles.methodCard}>
                <Pressable
                  style={styles.methodHeader}
                  onPress={() => setExpandedMethod(isExpanded ? null : key)}
                >
                  <View style={styles.methodLeft}>
                    <Text style={styles.methodIcon}>{config.icon}</Text>
                    <View>
                      <Text style={styles.methodLabel}>{config.label}</Text>
                      {method.enabled && method.value && !isExpanded && (
                        <Text style={styles.methodPreview} numberOfLines={1}>
                          {method.value.split("\n")[0]}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.methodRight}>
                    <Switch
                      value={method.enabled}
                      onValueChange={(v) => handleToggle(key, v)}
                      trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                      thumbColor="#FFF"
                    />
                  </View>
                </Pressable>

                {(isExpanded || (method.enabled && !method.value)) && (
                  <View style={styles.methodBody}>
                    <TextInput
                      style={[
                        styles.methodInput,
                        config.multiline && styles.methodInputMultiline,
                      ]}
                      value={method.value}
                      onChangeText={(v) => handleValueChange(key, v)}
                      placeholder={config.placeholder}
                      placeholderTextColor={theme.colors.muted}
                      multiline={config.multiline}
                      numberOfLines={config.multiline ? 3 : 1}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={styles.methodHint}>{config.hint}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.muted} />
          <Text style={styles.infoText}>
            Payment methods with info filled in will automatically appear in the Payment Options section of your invoice PDFs.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], insets: { bottom: number }) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: 16, paddingBottom: Math.max(32, insets.bottom) },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg },

    header: { marginBottom: 20 },
    headerTitle: { fontSize: 20, fontWeight: "700", color: theme.colors.text, marginBottom: 8 },
    headerSubtitle: { fontSize: 14, color: theme.colors.muted, lineHeight: 20 },

    statusBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#22C55E15",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      marginBottom: 16,
    },
    statusText: { fontSize: 14, color: "#22C55E", fontWeight: "500" },

    section: { gap: 12 },

    methodCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    methodHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
    },
    methodLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    methodIcon: { fontSize: 24 },
    methodLabel: { fontSize: 16, fontWeight: "600", color: theme.colors.text },
    methodPreview: { fontSize: 13, color: theme.colors.muted, marginTop: 2, maxWidth: 200 },
    methodRight: { flexDirection: "row", alignItems: "center" },

    methodBody: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 0,
    },
    methodInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.colors.text,
    },
    methodInputMultiline: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    methodHint: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 6,
      marginLeft: 2,
    },

    infoBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: theme.colors.card,
      padding: 14,
      borderRadius: 10,
      marginTop: 24,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
    },
  });
}
