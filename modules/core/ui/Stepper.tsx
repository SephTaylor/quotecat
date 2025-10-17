import { theme } from "@/constants/theme";
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
  const s = styles(size);
  return (
    <View style={s.wrap}>
      <Pressable style={s.btn} onPress={onDec}>
        <Text style={s.txt}>–</Text>
      </Pressable>
      <Text style={s.value}>{value}</Text>
      <Pressable style={s.btn} onPress={onInc}>
        <Text style={s.txt}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = (size: number) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "center", gap: 8 },
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
