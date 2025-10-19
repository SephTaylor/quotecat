import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function FormNav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Next",
}: {
  onBack(): void;
  onNext(): void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <Pressable style={[styles.btn, styles.secondary]} onPress={onBack}>
        <Text style={styles.txt}>Back</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, nextDisabled && styles.disabled]}
        disabled={nextDisabled}
        onPress={onNext}
      >
        <Text style={[styles.txt, styles.dark]}>{nextLabel}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    row: { flexDirection: "row", gap: 12 },
    btn: {
      flex: 1,
      height: 48,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.accent,
    },
    secondary: { backgroundColor: theme.colors.card },
    disabled: { opacity: 0.5 },
    txt: { fontWeight: "800", color: theme.colors.text },
    dark: { color: "#000" },
  });
}
