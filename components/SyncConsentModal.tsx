// components/SyncConsentModal.tsx
// Modal to prompt user before first cloud sync (Apple requirement)
// Must disclose download size and get explicit consent

import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { runSyncWithConsent, setSyncConsent } from "@/lib/auth";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
};

export function SyncConsentModal({ visible, onClose, onSyncComplete }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await runSyncWithConsent();
      onSyncComplete?.();
      onClose();
    } catch (error) {
      console.error("Sync failed:", error);
      // Still close modal - user can retry via pull-to-refresh
      onClose();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLater = async () => {
    // Don't set consent - user can sync later from Settings
    // Just close the modal for now
    onClose();
  };

  const handleNeverSync = async () => {
    // User doesn't want cloud sync - store this preference
    await setSyncConsent(true); // Mark as "consented" so we don't ask again
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="cloud-outline" size={48} color={theme.colors.accent} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Cloud Sync</Text>

          {/* Description */}
          <Text style={styles.description}>
            Sync your quotes, invoices, and settings across devices. This will download your data from the cloud.
          </Text>

          {/* Download size disclosure (Apple requirement) */}
          <View style={styles.sizeInfo}>
            <Ionicons name="download-outline" size={20} color={theme.colors.muted} />
            <Text style={styles.sizeText}>Estimated download: up to 3 MB</Text>
          </View>

          {/* Data types */}
          <View style={styles.dataList}>
            <Text style={styles.dataItem}>Quotes & Invoices</Text>
            <Text style={styles.dataItem}>Clients & Contacts</Text>
            <Text style={styles.dataItem}>Assemblies & Pricebook</Text>
            <Text style={styles.dataItem}>Company Settings & Logo</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={handleSyncNow}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Sync Now</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={handleLater}
              disabled={isSyncing}
            >
              <Text style={styles.secondaryButtonText}>Later</Text>
            </Pressable>
          </View>

          {/* Skip option */}
          <Pressable onPress={handleNeverSync} disabled={isSyncing}>
            <Text style={styles.skipText}>Don't sync this device</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalContainer: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 24,
      width: "100%",
      maxWidth: 340,
      alignItems: "center",
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.accent + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 16,
    },
    sizeInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      marginBottom: 16,
    },
    sizeText: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    dataList: {
      width: "100%",
      marginBottom: 20,
    },
    dataItem: {
      fontSize: 14,
      color: theme.colors.text,
      paddingVertical: 6,
      paddingLeft: 8,
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.accent,
      marginBottom: 4,
    },
    buttonContainer: {
      width: "100%",
      gap: 10,
      marginBottom: 16,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
    },
    primaryButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    secondaryButton: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "500",
    },
    skipText: {
      fontSize: 14,
      color: theme.colors.muted,
      textDecorationLine: "underline",
    },
  });
}
