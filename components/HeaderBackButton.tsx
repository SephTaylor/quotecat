// components/HeaderBackButton.tsx
// Reusable back button for navigation headers
// Handles iOS 18 styling issues with hitSlop instead of padding

import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderBackButtonProps {
  onPress: () => void;
  label?: string;
}

export function HeaderBackButton({ onPress, label = 'Back' }: HeaderBackButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{ marginLeft: 16 }}
      hitSlop={{ top: 10, bottom: 10, left: 0, right: 20 }}
    >
      <Text style={{ fontSize: 17, color: theme.colors.accent }}>
        ‹ {label}
      </Text>
    </Pressable>
  );
}
