// modules/changeOrders/ui/ChangeOrderModal.tsx
// Modal for creating a change order when material changes are detected

import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Quote, ChangeOrder } from "@/lib/types";
import type { QuoteSnapshot } from "../types";
import { ChangeOrderDiffView } from "./ChangeOrderDiffView";
import { formatNetChange } from "../diff";

type Theme = {
  colors: {
    card: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    bg: string;
  };
  spacing: (n: number) => number;
  radius: { md: number; lg: number };
};

type DiffData = {
  items: ChangeOrder["items"];
  laborBefore: number;
  laborAfter: number;
  laborDelta: number;
  netChange: number;
  quoteTotalBefore: number;
  quoteTotalAfter: number;
};

type Props = {
  visible: boolean;
  quote: Quote;
  diff: DiffData;
  theme: Theme;
  /** Called when user confirms creating a CO */
  onConfirm: (reason: string) => Promise<void>;
  /** Called when user cancels (discard changes or go back) */
  onCancel: () => void;
  /** Called when user wants to save without CO (only for quotes not yet accepted) */
  onSaveWithoutCO?: () => void;
};

export function ChangeOrderModal({
  visible,
  quote,
  diff,
  theme,
  onConfirm,
  onCancel,
  onSaveWithoutCO,
}: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const styles = createStyles(theme);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(reason);
    } finally {
      setLoading(false);
      setReason("");
    }
  };

  const handleCancel = () => {
    setReason("");
    onCancel();
  };

  const handleSaveWithoutCO = () => {
    setReason("");
    onSaveWithoutCO?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>Create Change Order</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary Banner */}
          <View style={styles.summaryBanner}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Quote</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {quote.name || "Untitled Quote"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Net Change</Text>
              <Text
                style={[
                  styles.netChange,
                  diff.netChange > 0 && styles.netChangePositive,
                  diff.netChange < 0 && styles.netChangeNegative,
                ]}
              >
                {formatNetChange(diff.netChange)}
              </Text>
            </View>
          </View>

          {/* Changes Preview */}
          <Text style={styles.sectionLabel}>What Changed</Text>
          <View style={styles.diffContainer}>
            <ChangeOrderDiffView diff={diff} theme={theme} compact />
          </View>

          {/* Reason Input */}
          <Text style={styles.sectionLabel}>Reason for Change (Optional)</Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g., Client requested additional outlets in kitchen"
            placeholderTextColor={theme.colors.muted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.confirmButton, loading && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="document-text" size={18} color="#000" />
                <Text style={styles.confirmButtonText}>Create Change Order</Text>
              </>
            )}
          </Pressable>

          {onSaveWithoutCO && (
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={handleSaveWithoutCO}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Save Without CO</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Discard Changes</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing(2),
    },
    summaryBanner: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      gap: theme.spacing(1),
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.text,
      flex: 1,
      textAlign: "right",
      marginLeft: theme.spacing(2),
    },
    netChange: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    netChangePositive: {
      color: "#22C55E",
    },
    netChangeNegative: {
      color: "#EF4444",
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
      marginTop: theme.spacing(1),
    },
    diffContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    reasonInput: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      fontSize: 15,
      color: theme.colors.text,
      minHeight: 80,
    },
    actions: {
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(4),
      gap: theme.spacing(1.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing(1),
      paddingVertical: theme.spacing(1.75),
      borderRadius: theme.radius.md,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    confirmButton: {
      backgroundColor: theme.colors.accent,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    secondaryButton: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    cancelButton: {
      alignItems: "center",
      paddingVertical: theme.spacing(1),
    },
    cancelButtonText: {
      fontSize: 14,
      color: theme.colors.muted,
    },
  });
}
