// components/HeaderIconButton.tsx
// Reusable icon button for navigation headers
// Handles iOS 18 styling issues with hitSlop instead of padding

import React from 'react';
import { Pressable, Text } from 'react-native';

interface HeaderIconButtonProps {
  onPress: () => void;
  icon: string;
  side?: 'left' | 'right';
}

export function HeaderIconButton({ onPress, icon, side = 'right' }: HeaderIconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={side === 'right' ? { marginRight: 16 } : { marginLeft: 16 }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={{ fontSize: 24 }}>
        {icon}
      </Text>
    </Pressable>
  );
}
