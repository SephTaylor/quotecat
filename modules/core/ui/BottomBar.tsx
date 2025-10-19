// modules/core/ui/BottomBar.tsx
import { useTheme } from "@/contexts/ThemeContext";
import React, { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type BottomBarProps = PropsWithChildren;

function BottomBar({ children }: BottomBarProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, theme.spacing(2)) },
      ]}
    >
      <View style={styles.row}>{children}</View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    bar: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingTop: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
    },
    row: { flexDirection: "row", gap: theme.spacing(1) },
  });
}

export default BottomBar; // default export (backwards compatible)
export { BottomBar }; // named export (barrel-friendly)
// (no second export of BottomBarProps — it's already exported above)
