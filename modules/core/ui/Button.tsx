// modules/core/ui/Button.tsx
import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { Pressable, PressableProps, StyleSheet, Text } from "react-native";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = Omit<PressableProps, "style"> & {
  /** Button text */
  children: React.ReactNode;
  /** Visual variant - primary (accent) or secondary (card) */
  variant?: ButtonVariant;
  /** Disabled state */
  disabled?: boolean;
};

/**
 * Standard button component used across the app.
 * - Primary: accent background, black text
 * - Secondary: card background, theme text
 * - Disabled: opacity 0.5 (primary) or 0.95 (secondary idle)
 */
export default function Button({
  children,
  variant = "primary",
  disabled = false,
  ...pressableProps
}: ButtonProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const isPrimary = variant === "primary";

  return (
    <Pressable
      {...pressableProps}
      disabled={disabled}
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        disabled && (isPrimary ? styles.disabled : styles.primaryIdle),
      ]}
    >
      <Text style={isPrimary ? styles.primaryText : styles.secondaryText}>
        {children}
      </Text>
    </Pressable>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    base: {
      flex: 1,
      height: 48,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    primary: {
      backgroundColor: theme.colors.accent,
    },
    secondary: {
      backgroundColor: theme.colors.card,
    },
    disabled: { opacity: 0.5 },
    primaryIdle: { opacity: 0.95 },
    primaryText: { fontWeight: "800", color: "#000" },
    secondaryText: { fontWeight: "800", color: theme.colors.text },
  });
}

// Named export for barrel
export { Button };
