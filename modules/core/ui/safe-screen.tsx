import { theme } from '@/constants/theme';
import React, { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Screen({ children, scroll = false }: PropsWithChildren<{ scroll?: boolean }>) {
  const body = <View style={[styles.inner, { paddingTop: theme.spacing(2) }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.root} edges={['top','left','right']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  inner: { flexGrow: 1, paddingHorizontal: theme.spacing(2) },
  scroll: { flexGrow: 1 },
});
