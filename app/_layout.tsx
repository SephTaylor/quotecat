// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      {/* Home list at / */}
      <Stack.Screen name="index" options={{ title: 'QuoteCat' }} />

      {/* Your modal, if you use it */}
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />

      {/* New quote screen at /new-quote */}
      <Stack.Screen name="new-quote" options={{ title: 'New Quote' }} />

      {/* Tabs folder, if present */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* ✅ DO NOT register [id] or [id]/edit here */}
    </Stack>
  );
}
