import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function Stepper({
  value,
  onDec,
  onInc,
  size = 32,
}: {
  value: number;
  onDec(): void;
  onInc(): void;
  size?: number;
}) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme, size), [theme, size]);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.btn} onPress={onDec}>
        <Text style={styles.txt}>–</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable style={styles.btn} onPress={onInc}>
        <Text style={styles.txt}>+</Text>
      </Pressable>
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  size: number,
) {
  return StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1) },
    btn: {
      height: size,
      width: size,
      borderRadius: size / 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    txt: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
    value: {
      minWidth: 20,
      textAlign: "center",
      color: theme.colors.text,
      fontWeight: "700",
    },
  });
}
