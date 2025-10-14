import { theme } from '@/constants/theme';
import React, { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function BottomBar({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, theme.spacing(2)) }]}>
      <View style={styles.row}>{children}</View>
    </View>
  );
}
export default BottomBar;

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card, paddingTop: theme.spacing(1.5), paddingHorizontal: theme.spacing(2) },
  row: { flexDirection: 'row', gap: theme.spacing(1) },
});
