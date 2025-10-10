// app/quote/_layout.tsx
import { Stack } from 'expo-router';

export default function QuoteLayout() {
  return (
    <Stack>
      {/* Optional: if you ever add app/quote/index.tsx */}
      <Stack.Screen name="index" options={{ title: 'Quotes' }} />

      {/* Handles /quote/[id] → app/quote/[id]/index.tsx */}
      <Stack.Screen name="[id]" options={{ title: 'Quote' }} />

      {/* Handles /quote/[id]/edit → app/quote/[id]/edit.tsx */}
      <Stack.Screen
        name="[id]/edit"
        options={{ title: 'Edit Quote', presentation: 'modal' }}
      />
    </Stack>
  );
}
