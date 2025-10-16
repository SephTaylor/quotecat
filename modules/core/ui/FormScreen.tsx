// modules/core/ui/FormScreen.tsx
import { theme } from '@/constants/theme';
import React, { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';

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
      {bottomBar ? <View style={[styles.bottomBar, bottomBarStyle]}>{bottomBar}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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

// Keep your "files export default; barrel re-exports named" convention:
export { FormScreen };

