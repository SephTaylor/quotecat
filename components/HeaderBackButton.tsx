// components/HeaderBackButton.tsx
// Reusable back button for navigation headers
// Uses TouchableOpacity to avoid iOS 18 automatic backgrounds

import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderBackButtonProps {
  onPress: () => void;
  label?: string;
}

export function HeaderBackButton({ onPress, label = 'Back' }: HeaderBackButtonProps) {
  const { theme } = useTheme();

  return (
    <View style={{ marginLeft: 16 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 0, right: 20 }}
      >
        <Text style={{ fontSize: 17, color: theme.colors.accent }}>
          ‹ {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
