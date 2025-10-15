// app/_layout.tsx
import { ServicesProvider } from '@/modules/providers/ServicesProvider';
import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <ServicesProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ServicesProvider>
  );
}
