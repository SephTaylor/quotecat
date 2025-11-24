// components/HeaderBackButton.tsx
// Reusable back button for navigation headers
// Simple icon-only design, no text, no iOS 18 bubble backgrounds

import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderBackButtonProps {
  onPress: () => void;
}

export function HeaderBackButton({ onPress }: HeaderBackButtonProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.button}
      >
        <Text style={[styles.icon, { color: theme.colors.accent }]}>
          ‹
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 34,
    fontWeight: '300',
    marginLeft: -4, // Optical alignment
  },
});
