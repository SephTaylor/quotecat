// modules/core/ui/safe-screen.tsx
import React, { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

type ScreenProps = PropsWithChildren<{
  /** If true, wraps children in a ScrollView */
  scroll?: boolean;
  /** Adds extra bottom padding to clear a fixed BottomBar */
  withBottomBar?: boolean;
  /** Extra styles for the outer container */
  style?: ViewStyle;
  /** Extra styles for the inner content container */
  contentStyle?: ViewStyle;
  /** Pull-to-refresh is refreshing */
  refreshing?: boolean;
  /** Pull-to-refresh callback */
  onRefresh?: () => void;
}>;

/**
 * Safe Screen wrapper:
 * - Respects iOS notch / Android status bar (SafeAreaView)
 * - Keyboard-safe on iOS/Android
 * - Optional scroll + BottomBar clearance
 */
export default function Screen({
  children,
  scroll = true,
  withBottomBar = false,
  style,
  contentStyle,
  refreshing = false,
  onRefresh,
}: ScreenProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        withBottomBar && styles.withBottomBar,
        contentStyle,
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.content,
        withBottomBar && styles.withBottomBar,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.root, style]}
      edges={["left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    // Use simple, consistent spacing (adjust if you have a theme helper)
    content: {
      paddingTop: 0,
      paddingHorizontal: 16,
      paddingBottom: 16,
      flexGrow: 1,
    },
    // Extra bottom room if a fixed BottomBar is present
    withBottomBar: {
      paddingBottom: 88,
    },
  });
}

export { Screen };
