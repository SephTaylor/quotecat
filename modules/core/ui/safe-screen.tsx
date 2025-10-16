// modules/core/ui/safe-screen.tsx
import React, { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScreenProps = PropsWithChildren<{
  /** If true, wraps children in a ScrollView */
  scroll?: boolean;
  /** Adds extra bottom padding to clear a fixed BottomBar */
  withBottomBar?: boolean;
  /** Extra styles for the outer container */
  style?: ViewStyle;
  /** Extra styles for the inner content container */
  contentStyle?: ViewStyle;
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
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        withBottomBar && styles.withBottomBar,
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, withBottomBar && styles.withBottomBar, contentStyle]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, style]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Use simple, consistent spacing (adjust if you have a theme helper)
  content: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  // Extra bottom room if a fixed BottomBar is present
  withBottomBar: {
    paddingBottom: 88,
  },
});
export { Screen };
