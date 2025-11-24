// components/HeaderIconButton.tsx
// Reusable icon button for navigation headers
// Uses TouchableOpacity to avoid iOS 18 automatic backgrounds

import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderIconButtonProps {
  onPress: () => void;
  icon: string;
  side?: 'left' | 'right';
  color?: string;
}

export function HeaderIconButton({ onPress, icon, side = 'right', color }: HeaderIconButtonProps) {
  const { theme } = useTheme();
  const iconColor = color || theme.colors.accent;

  return (
    <View style={[
      styles.container,
      side === 'right' ? styles.rightSide : styles.leftSide
    ]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.button}
      >
        <Text style={[styles.icon, { color: iconColor }]}>
          {icon}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightSide: {
    marginRight: 8,
  },
  leftSide: {
    marginLeft: 8,
  },
  button: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    textAlign: 'center',
  },
});
