// modules/core/ui/FormScreen.tsx
import { useTheme } from "@/contexts/ThemeContext";
import React, { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = PropsWithChildren<{
  /** If true, wraps children in a ScrollView (recommended for forms) */
  scroll?: boolean;
  /** Extra styles for the content container */
  contentStyle?: ViewStyle;
  /** Optional bottom action area (e.g., Save/Done button) */
  bottomBar?: ReactNode;
  /** Extra styles for the bottom bar container */
  bottomBarStyle?: ViewStyle;
}>;

/**
 * FormScreen
 * - Lives inside a route-group layout that already provides <Screen />
 * - Standardizes form padding + fixed bottom action bar
 * - No SafeArea here; outer layout handles that
 */
export default function FormScreen({
  children,
  scroll = true,
  contentStyle,
  bottomBar,
  bottomBarStyle,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      {content}
      {bottomBar ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, theme.spacing(2)) }, bottomBarStyle]}>{bottomBar}</View>
      ) : null}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.bg },
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(2),
    },
    bottomBar: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingHorizontal: theme.spacing(2),
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(2),
    },
  });
}

// Keep your "files export default; barrel re-exports named" convention:
export { FormScreen };
