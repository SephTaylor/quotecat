// app/(forms)/invoice/quick.tsx
// Simple Quick Invoice form - create invoice without a quote
import { useTheme } from "@/contexts/ThemeContext";
import { createQuickInvoice } from "@/lib/invoices";
import { FormInput, FormScreen } from "@/modules/core/ui";
import { parseMoney } from "@/modules/settings/money";
import { Stack, useRouter } from "expo-router";
import React, { useState, useMemo } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function QuickInvoice() {
  const { theme } = useTheme();
  const router = useRouter();

  const [clientName, setClientName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const parsedAmount = parseMoney(amount);

  const handleGoBack = () => {
    if (clientName || jobDescription || amount) {
      Alert.alert(
        "Discard Invoice?",
        "You have unsaved changes.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleCreateInvoice = async () => {
    if (!clientName.trim()) {
      Alert.alert("Required", "Please enter a client name");
      return;
    }
    if (!jobDescription.trim()) {
      Alert.alert("Required", "Please enter a job description");
      return;
    }
    if (parsedAmount <= 0) {
      Alert.alert("Required", "Please enter an amount");
      return;
    }

    setIsSubmitting(true);

    try {
      const invoice = await createQuickInvoice({
        clientName: clientName.trim(),
        jobDescription: jobDescription.trim(),
        amount: parsedAmount,
        notes: notes.trim() || undefined,
        dueDate,
      });

      Alert.alert("Success!", `Invoice ${invoice.invoiceNumber} created`, [
        {
          text: "View Invoice",
          onPress: () => router.replace(`/invoice/${invoice.id}` as any),
        },
        {
          text: "Done",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create invoice"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatMoneyInput = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    if (parts.length === 2 && parts[1].length > 2) {
      return parts[0] + "." + parts[1].slice(0, 2);
    }
    return cleaned;
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: "center",
          headerTintColor: theme.colors.accent,
          headerLeft: () => <HeaderBackButton onPress={handleGoBack} />,
          title: "Quick Invoice",
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTitleStyle: {
            color: theme.colors.text,
          },
        }}
      />
      <FormScreen
        scroll
        bottomBar={
          <Pressable
            style={[styles.createBtn, isSubmitting && styles.createBtnDisabled]}
            onPress={handleCreateInvoice}
            disabled={isSubmitting}
          >
            <Text style={styles.createBtnText}>
              {isSubmitting ? "Creating..." : "Create Invoice"}
            </Text>
          </Pressable>
        }
      >
        <Text style={styles.label}>Client Name *</Text>
        <FormInput
          placeholder="Who's the invoice for?"
          value={clientName}
          onChangeText={setClientName}
          autoCapitalize="words"
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Job Description *</Text>
        <FormInput
          placeholder="What work was done?"
          value={jobDescription}
          onChangeText={setJobDescription}
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Amount *</Text>
        <FormInput
          placeholder="0.00"
          value={amount}
          onChangeText={(t) => setAmount(formatMoneyInput(t))}
          keyboardType="decimal-pad"
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Due Date</Text>
        <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
          <Ionicons name="calendar-outline" size={20} color={theme.colors.muted} />
          <Text style={styles.dateButtonText}>
            {dueDate.toLocaleDateString()}
          </Text>
        </Pressable>

        {showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, date) => {
              setShowDatePicker(Platform.OS === "ios");
              if (date) setDueDate(date);
            }}
            minimumDate={new Date()}
          />
        )}

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Notes (Optional)</Text>
        <FormInput
          placeholder="Additional details..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
        />

        <View style={{ height: theme.spacing(3) }} />

        {/* Preview */}
        {parsedAmount > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Invoice Total</Text>
            <Text style={styles.previewAmount}>${parsedAmount.toFixed(2)}</Text>
          </View>
        )}
      </FormScreen>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    label: {
      fontSize: 12,
      color: theme.colors.text,
      marginBottom: 6,
      fontWeight: "600",
    },
    dateButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
    },
    dateButtonText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    previewCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      alignItems: "center",
    },
    previewLabel: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1),
    },
    previewAmount: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    createBtn: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      height: 48,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    createBtnDisabled: {
      opacity: 0.6,
    },
    createBtnText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#000",
    },
  });
}
