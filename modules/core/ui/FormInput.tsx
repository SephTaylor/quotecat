// modules/core/ui/FormInput.tsx
import { theme } from "@/constants/theme";
import React from "react";
import { StyleSheet, TextInput, TextInputProps } from "react-native";

/**
 * Standard form input component with consistent styling.
 * Wraps TextInput with theme-based styles for borders, padding, and colors.
 */
export default function FormInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.style]}
      placeholderTextColor={props.placeholderTextColor ?? theme.colors.muted}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.5),
    color: theme.colors.text,
    fontSize: 16,
  },
});

// Named export for barrel
export { FormInput };
