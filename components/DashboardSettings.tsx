// components/DashboardSettings.tsx
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import type { DashboardPreferences } from "@/lib/preferences";

type DashboardSettingsProps = {
  visible: boolean;
  preferences: DashboardPreferences;
  onClose: () => void;
  onSave: (preferences: DashboardPreferences) => void;
  onReset: () => void;
};

export function DashboardSettings({
  visible,
  preferences,
  onClose,
  onSave,
  onReset,
}: DashboardSettingsProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [localPrefs, setLocalPrefs] =
    useState<DashboardPreferences>(preferences);

  // Update local state when preferences prop changes
  React.useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleSave = () => {
    onSave(localPrefs);
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard Settings</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Customize what appears on your home screen
          </Text>

          {/* Show/Hide Sections */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Show Sections</Text>

            <SettingRow
              label="Quick Stats"
              description="Total, Active, Drafts, Sent"
              value={localPrefs.showStats}
              onToggle={(value) =>
                setLocalPrefs({ ...localPrefs, showStats: value })
              }
              theme={theme}
              styles={styles}
            />

            <SettingRow
              label="Value Tracking"
              description="Total and active quote value"
              value={localPrefs.showValueTracking}
              onToggle={(value) =>
                setLocalPrefs({ ...localPrefs, showValueTracking: value })
              }
              theme={theme}
              styles={styles}
            />

            <SettingRow
              label="Pinned Quotes"
              description="Your starred quotes"
              value={localPrefs.showPinnedQuotes}
              onToggle={(value) =>
                setLocalPrefs({ ...localPrefs, showPinnedQuotes: value })
              }
              theme={theme}
              styles={styles}
            />

            <SettingRow
              label="Recent Quotes"
              description="Latest quotes you've worked on"
              value={localPrefs.showRecentQuotes}
              onToggle={(value) =>
                setLocalPrefs({ ...localPrefs, showRecentQuotes: value })
              }
              theme={theme}
              styles={styles}
            />

            <SettingRow
              label="Quick Actions"
              description="Shortcuts to Quotes and Assemblies"
              value={localPrefs.showQuickActions}
              onToggle={(value) =>
                setLocalPrefs({ ...localPrefs, showQuickActions: value })
              }
              theme={theme}
              styles={styles}
            />
          </View>

          {/* Recent Quotes Count */}
          {localPrefs.showRecentQuotes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Quotes Count</Text>
              <View style={styles.optionsRow}>
                {([3, 5, 10, "all"] as const).map((count) => (
                  <Pressable
                    key={count}
                    style={[
                      styles.optionChip,
                      localPrefs.recentQuotesCount === count &&
                        styles.optionChipActive,
                    ]}
                    onPress={() =>
                      setLocalPrefs({ ...localPrefs, recentQuotesCount: count })
                    }
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        localPrefs.recentQuotesCount === count &&
                          styles.optionChipTextActive,
                      ]}
                    >
                      {count === "all" ? "All" : count}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset to Default</Text>
            </Pressable>

            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SettingRow({
  label,
  description,
  value,
  onToggle,
  theme,
  styles,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  theme: ReturnType<typeof useTheme>["theme"];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#D1D1D6", true: theme.colors.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
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
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
    },
    closeButton: {
      padding: theme.spacing(1),
    },
    closeButtonText: {
      fontSize: 24,
      color: theme.colors.muted,
    },
    content: {
      padding: theme.spacing(2),
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(3),
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    settingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingText: {
      flex: 1,
      marginRight: theme.spacing(2),
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    optionsRow: {
      flexDirection: "row",
      gap: theme.spacing(1),
    },
    optionChip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    optionChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    optionChipText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    optionChipTextActive: {
      color: "#000",
    },
    actions: {
      marginTop: theme.spacing(3),
      gap: theme.spacing(2),
    },
    resetButton: {
      padding: theme.spacing(2),
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      alignItems: "center",
    },
    resetButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    saveButton: {
      padding: theme.spacing(2),
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.accent,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
}
