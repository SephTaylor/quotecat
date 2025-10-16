// app/(main)/_layout.tsx
import { Screen } from '@/modules/core/ui';
import { Slot } from 'expo-router';
import React from 'react';

/**
 * Main app layout:
 * - Wraps every child route in our shared <Screen> shell
 * - Central place to tweak safe areas / padding for all main screens
 */
export default function MainLayout() {
  return (
    <Screen
      scroll={false}
      contentStyle={{ paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }}
    >
      <Slot />
    </Screen>
  );
}
