// components/WizardFAB.tsx
// Floating action button to launch the Quote Wizard (Drew)

import React from 'react';
import { Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';

export function WizardFAB() {
  const router = useRouter();

  const handlePress = () => {
    router.push('/(main)/wizard');
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        {
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
      ]}
      onPress={handlePress}
    >
      <Image
        source={require('@/assets/images/drew-avatar.png')}
        style={styles.avatar}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    // Shadow for Android
    elevation: 5,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
});
