// components/HeaderIconButton.tsx
// Reusable icon button for navigation headers
// Uses TouchableOpacity to avoid iOS 18 automatic backgrounds

import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

interface HeaderIconButtonProps {
  onPress: () => void;
  icon: string;
  side?: 'left' | 'right';
}

export function HeaderIconButton({ onPress, icon, side = 'right' }: HeaderIconButtonProps) {
  return (
    <View style={side === 'right' ? { marginRight: 16 } : { marginLeft: 16 }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={{ fontSize: 24 }}>
          {icon}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
