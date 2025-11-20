// lib/supabase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// Use static property access for Expo's babel transform to work
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate in dev mode
if (__DEV__) {
  if (!SUPABASE_URL) {
    throw new Error(
      `[supabase] Missing EXPO_PUBLIC_SUPABASE_URL. Add it to a .env at project root:\n` +
      `EXPO_PUBLIC_SUPABASE_URL=...\nEXPO_PUBLIC_SUPABASE_ANON_KEY=...\n` +
      `Then restart Metro: npx expo start -c`
    );
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      `[supabase] Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Add it to a .env at project root:\n` +
      `EXPO_PUBLIC_SUPABASE_URL=...\nEXPO_PUBLIC_SUPABASE_ANON_KEY=...\n` +
      `Then restart Metro: npx expo start -c`
    );
  }
}

export const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
