// lib/supabase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// Lazy initialization to prevent module-load-time crashes
let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
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

    supabaseInstance = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseInstance;
}

// Export a Proxy that lazily initializes the client on first access
// This maintains backwards compatibility with existing code
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabase();
    const value = client[prop as keyof SupabaseClient];
    // Bind functions to maintain proper 'this' context
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
