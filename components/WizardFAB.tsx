// components/WizardFAB.tsx
// Floating action button to launch the Quote Wizard (Drew)

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';

export function WizardFAB() {
  const { theme } = useTheme();
  const router = useRouter();

  const handlePress = () => {
    router.push('/(main)/wizard');
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        {
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}
      onPress={handlePress}
    >
      <Ionicons name="chatbubble-ellipses" size={32} color={theme.colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
