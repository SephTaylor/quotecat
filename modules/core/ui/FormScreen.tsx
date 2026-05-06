// modules/core/ui/FormScreen.tsx
import { useTheme } from "@/contexts/ThemeContext";
import React, { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, View, ViewStyle, KeyboardAvoidingView, Platform, Keyboard, Pressable } from "react-native";
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

  // Dismiss keyboard when tapping outside input fields
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, contentStyle]}
      onScrollBeginDrag={dismissKeyboard}
    >
      <Pressable onPress={dismissKeyboard} style={styles.pressableContent}>
        {children}
      </Pressable>
    </ScrollView>
  ) : (
    <Pressable onPress={dismissKeyboard} style={[styles.content, contentStyle]}>
      {children}
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={styles.root}>
        {content}
        {bottomBar ? (
          // Add breathing room ABOVE the system gesture/nav inset rather than
          // letting the inset be the padding itself. On phones with no system
          // bottom area this still gives spacing(1); on phones with a gesture
          // bar or 3-button nav, the bar sits insets.bottom + spacing(1)
          // above the screen edge so buttons never feel clipped on bigger
          // phones.
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + theme.spacing(1) }, bottomBarStyle]}>{bottomBar}</View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.bg },
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing(2),
      paddingTop: Platform.OS === 'android' ? theme.spacing(1) : theme.spacing(2),
      paddingBottom: theme.spacing(2),
    },
    pressableContent: {
      flexGrow: 1,
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
