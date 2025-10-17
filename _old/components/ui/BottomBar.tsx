// components/ui/BottomBar.tsx
import { colors } from "@/constants/theme";
import React, { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function PrimaryButton({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
    >
      <Text style={styles.primaryText}>{children}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
    >
      <Text style={styles.secondaryText}>{children}</Text>
    </Pressable>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

// Optional default export if you prefer: import BottomBar from "…/BottomBar"
export default { Row, PrimaryButton, SecondaryButton };

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand, // yellow
  },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "700" },
  secondary: {
    width: 120,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E6EAF2",
  },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: "600" },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
