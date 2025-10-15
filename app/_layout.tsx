// app/_layout.tsx
import { ServicesProvider } from '@/modules/providers/ServicesProvider';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Explicitly import index to avoid any resolver quirks.
import catalogRepo from '../modules/catalog/index';
import quotesRepo from '../modules/quotes/index';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ServicesProvider services={{ catalog: catalogRepo }}>
        <Stack
          screenOptions={{
            // global header/colors can live here
          }}
        />
      </ServicesProvider>
    </SafeAreaProvider>
  );
}
<ServicesProvider services={{ catalog: catalogRepo, quotes: quotesRepo }}>
  <Stack /* ... */ />
</ServicesProvider>