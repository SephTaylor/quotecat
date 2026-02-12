// components/ShareAssemblyModal.tsx
// Modal for sharing an assembly to the community library

import React, { useState, useCallback } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { shareAssembly } from "@/lib/sharedAssembliesApi";
import { loadPreferences } from "@/lib/preferences";
import type { Assembly } from "@/modules/assemblies/types";
import type { AssemblyTrade, SharedAssemblyItem } from "@/lib/types";
import { ASSEMBLY_TRADES } from "@/lib/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  assembly: Assembly;
  onSuccess?: () => void;
};

export function ShareAssemblyModal({ visible, onClose, assembly, onSuccess }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Form state
  const [name, setName] = useState(assembly.name);
  const [description, setDescription] = useState(assembly.description || "");
  const [trade, setTrade] = useState<AssemblyTrade>("general");
  const [category, setCategory] = useState(assembly.category || "");
  const [showCompanyName, setShowCompanyName] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load company name on mount
  React.useEffect(() => {
    if (visible) {
      loadPreferences().then((prefs) => {
        if (prefs?.company?.companyName) {
          setCompanyName(prefs.company.companyName);
        }
      });
      // Reset form with assembly data
      setName(assembly.name);
      setDescription(assembly.description || "");
      setCategory(assembly.category || "");
    }
  }, [visible, assembly]);

  // Convert assembly items to shared format (strip prices)
  const prepareItems = useCallback((): SharedAssemblyItem[] => {
    return assembly.items
      .filter((item) => "qty" in item) // Only include fixed-qty items
      .map((item) => ({
        name: item.name || item.productId, // Use name if available, fallback to ID
        qty: "qty" in item ? item.qty : 1,
        unit: "ea", // Default unit
      }));
  }, [assembly.items]);

  const handleShare = async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter a name for your assembly.");
      return;
    }

    const items = prepareItems();
    if (items.length === 0) {
      Alert.alert(
        "No Items",
        "This assembly has no items to share. Add some products first."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await shareAssembly({
        name: name.trim(),
        description: description.trim() || undefined,
        trade,
        category: category.trim() || undefined,
        items,
        showCompanyName,
        companyName: companyName.trim() || undefined,
      });

      Alert.alert(
        "Shared Successfully",
        "Your assembly is now available in the community library.",
        [{ text: "OK", onPress: () => {
          onSuccess?.();
          onClose();
        }}]
      );
    } catch (error) {
      console.error("Failed to share assembly:", error);
      Alert.alert(
        "Share Failed",
        "Could not share your assembly. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Share to Community</Text>
              <Text style={styles.subtitle}>
                Help other contractors with your template
              </Text>
            </View>

            {/* Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Assembly name"
                placeholderTextColor={theme.colors.muted}
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="What is this assembly for?"
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Trade */}
            <View style={styles.field}>
              <Text style={styles.label}>Trade</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipContainer}
              >
                {ASSEMBLY_TRADES.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[
                      styles.chip,
                      trade === t.id && styles.chipSelected,
                    ]}
                    onPress={() => setTrade(t.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        trade === t.id && styles.chipTextSelected,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={styles.label}>Category (optional)</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="e.g., Panel Upgrades, Rough-ins"
                placeholderTextColor={theme.colors.muted}
              />
            </View>

            {/* Attribution Toggle */}
            <View style={styles.toggleField}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Show my company name</Text>
                <Text style={styles.toggleDescription}>
                  {showCompanyName && companyName
                    ? `Will show: "${companyName}"`
                    : "Share anonymously"}
                </Text>
              </View>
              <Switch
                value={showCompanyName}
                onValueChange={setShowCompanyName}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                thumbColor="#fff"
              />
            </View>

            {/* Items Preview */}
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>
                Items to share ({prepareItems().length})
              </Text>
              <Text style={styles.previewNote}>
                Prices will NOT be shared
              </Text>
              <View style={styles.itemsList}>
                {prepareItems().slice(0, 5).map((item, index) => (
                  <Text key={index} style={styles.itemText}>
                    {item.qty}x {item.name}
                  </Text>
                ))}
                {prepareItems().length > 5 && (
                  <Text style={styles.moreItems}>
                    +{prepareItems().length - 5} more items
                  </Text>
                )}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.shareBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleShare}
                disabled={isSubmitting}
              >
                <Text style={styles.shareText}>
                  {isSubmitting ? "Sharing..." : "Share"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    container: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      maxHeight: "85%",
      padding: theme.spacing(3),
    },
    header: {
      marginBottom: theme.spacing(3),
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    field: {
      marginBottom: theme.spacing(2.5),
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    input: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    multiline: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    chipContainer: {
      flexDirection: "row",
    },
    chip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: 9999,
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginRight: theme.spacing(1),
    },
    chipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    chipText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    chipTextSelected: {
      color: "#000",
      fontWeight: "600",
    },
    toggleField: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2.5),
    },
    toggleInfo: {
      flex: 1,
      marginRight: theme.spacing(2),
    },
    toggleLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    toggleDescription: {
      fontSize: 13,
      color: theme.colors.muted,
      marginTop: 2,
    },
    previewSection: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(3),
    },
    previewTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    previewNote: {
      fontSize: 12,
      color: "#4CAF50", // Success green
      marginBottom: theme.spacing(1.5),
    },
    itemsList: {
      gap: 4,
    },
    itemText: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    moreItems: {
      fontSize: 13,
      color: theme.colors.accent,
      fontWeight: "600",
      marginTop: 4,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing(2),
    },
    cancelBtn: {
      flex: 1,
      padding: theme.spacing(2),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    cancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    shareBtn: {
      flex: 1,
      padding: theme.spacing(2),
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
    },
    shareText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    btnDisabled: {
      opacity: 0.6,
    },
  });
}
