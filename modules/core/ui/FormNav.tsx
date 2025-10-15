import { theme } from '@/constants/theme';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function FormNav({
  onBack, onNext, nextDisabled, nextLabel = 'Next',
}: {
  onBack(): void;
  onNext(): void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <View style={s.row}>
      <Pressable style={[s.btn, s.secondary]} onPress={onBack}><Text style={s.txt}>Back</Text></Pressable>
      <Pressable style={[s.btn, nextDisabled && s.disabled]} disabled={nextDisabled} onPress={onNext}>
        <Text style={[s.txt, s.dark]}>{nextLabel}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.accent,
  },
  secondary: { backgroundColor: theme.colors.card },
  disabled: { opacity: 0.5 },
  txt: { fontWeight: '800', color: theme.colors.text },
  dark: { color: '#000' },
});
