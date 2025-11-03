import { useTheme } from "@/contexts/ThemeContext";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function Stepper({
  value,
  onDec,
  onInc,
  onChange,
  size = 32,
}: {
  value: number;
  onDec(): void;
  onInc(): void;
  onChange?: (value: number) => void;
  size?: number;
}) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme, size), [theme, size]);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = () => {
    setEditValue(""); // Clear immediately
    setIsEditing(true);
  };

  const handleFinishEdit = () => {
    const newValue = parseInt(editValue, 10);
    if (!isNaN(newValue) && newValue >= 0 && onChange) {
      onChange(newValue);
    }
    setIsEditing(false);
    setEditValue("");
  };

  const handleTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setEditValue(cleaned);
  };

  const handleFocus = () => {
    setEditValue(""); // Clear on focus to ensure empty start
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.btn} onPress={onDec}>
        <Text style={styles.txt}>–</Text>
      </Pressable>
      {isEditing && onChange ? (
        <TextInput
          style={styles.input}
          value={editValue}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleFinishEdit}
          keyboardType="number-pad"
          autoFocus
        />
      ) : (
        <Pressable onPress={onChange ? handleStartEdit : undefined}>
          <Text style={styles.value}>{value}</Text>
        </Pressable>
      )}
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
    input: {
      minWidth: 40,
      height: 32,
      textAlign: "center",
      color: theme.colors.text,
      fontWeight: "700",
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      paddingHorizontal: 4,
    },
  });
}
