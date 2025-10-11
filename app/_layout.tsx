// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,        // show one global header (fixes status bar overlap)
        headerBackTitle: 'Home',  // back label when leaving quote screens
      }}
    >
      {/* Home list at / */}
      <Stack.Screen name="index"   options={{ title: 'QuoteCat' }} />

      {/* Create form at /new-quote */}
      <Stack.Screen name="new-quote" options={{ title: 'New Quote' }} />

      {/* Quote details and edit (explicitly registered at root) */}
      <Stack.Screen name="quote/[id]/index" options={{ title: 'Quote' }} />
      <Stack.Screen name="quote/[id]/edit"  options={{ title: 'Edit Quote' }} />

      {/* If you actually use these, keep them; otherwise remove to avoid warnings */}
      {/* <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} /> */}
      {/* <Stack.Screen name="(tabs)" options={{ headerShown: false }} /> */}
    </Stack>
  );
}
