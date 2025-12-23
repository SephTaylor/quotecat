// components/HeaderBackButton.tsx
// Reusable back button for navigation headers
// Shows "< Back" on iOS, just chevron on Android

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderBackButtonProps {
  onPress: () => void;
}

export function HeaderBackButton({ onPress }: HeaderBackButtonProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.button}
    >
      <Ionicons
        name="chevron-back"
        size={22}
        color={theme.colors.accent}
        style={styles.icon}
      />
      {Platform.OS === 'ios' && (
        <Text style={[styles.label, { color: theme.colors.accent }]}>
          Back
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    paddingRight: 8,
    height: 44,
    marginLeft: -4,
    marginTop: -4, // Optical vertical centering
  },
  icon: {
    marginRight: -2,
  },
  label: {
    fontSize: 17,
    fontWeight: '400',
  },
});
