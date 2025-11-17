// lib/supabase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

function requireEnv(
  name: "EXPO_PUBLIC_SUPABASE_URL" | "EXPO_PUBLIC_SUPABASE_ANON_KEY",
): string {
  // Try process.env first (development with .env file)
  let v = process.env[name];

  // Fallback to Constants.expoConfig.extra (production builds)
  if (!v && Constants.expoConfig?.extra) {
    v = Constants.expoConfig.extra[name];
  }

  if (!v) {
    const msg =
      `[supabase] Missing ${name}. Add it to a .env at project root:\n` +
      `EXPO_PUBLIC_SUPABASE_URL=...\nEXPO_PUBLIC_SUPABASE_ANON_KEY=...\n` +
      `Then restart Metro: npx expo start -c`;
    if (__DEV__) {
      throw new Error(msg);
    }
    console.error(msg);
    // Return empty string instead of undefined to prevent crash
    return '';
  }

  return v;
}

// Lazy initialization to prevent module-load-time crashes
let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    const SUPABASE_URL = requireEnv("EXPO_PUBLIC_SUPABASE_URL");
    const SUPABASE_ANON_KEY = requireEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");

    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
    return getSupabase()[prop as keyof SupabaseClient];
  },
});
