// components/LaborModeToggle.tsx
// Segmented control for Premium users to toggle between Simple and Team labor modes

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";

export type LaborMode = "simple" | "team";

type Props = {
  mode: LaborMode;
  onChange: (mode: LaborMode) => void;
  disabled?: boolean;
};

export function LaborModeToggle({ mode, onChange, disabled = false }: Props) {
  const { theme, mode: themeMode } = useTheme();
  const isDark = themeMode === "dark";
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <Pressable
        style={[
          styles.option,
          mode === "simple" && styles.optionSelected,
        ]}
        onPress={() => !disabled && onChange("simple")}
        disabled={disabled}
      >
        <Ionicons
          name="calculator-outline"
          size={16}
          color={mode === "simple" ? "#fff" : theme.colors.text}
        />
        <Text
          style={[
            styles.optionText,
            mode === "simple" && styles.optionTextSelected,
          ]}
        >
          Simple
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.option,
          mode === "team" && styles.optionSelected,
        ]}
        onPress={() => !disabled && onChange("team")}
        disabled={disabled}
      >
        <Ionicons
          name="people-outline"
          size={16}
          color={mode === "team" ? "#fff" : theme.colors.text}
        />
        <Text
          style={[
            styles.optionText,
            mode === "team" && styles.optionTextSelected,
          ]}
        >
          Team
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], isDark: boolean) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    containerDisabled: {
      opacity: 0.5,
    },
    option: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: theme.radius.sm,
    },
    optionSelected: {
      backgroundColor: theme.colors.accent,
    },
    optionText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    optionTextSelected: {
      color: "#fff",
    },
  });
}

export default LaborModeToggle;
