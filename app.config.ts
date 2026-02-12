// app.config.ts
import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  // Start from your existing config, then override
  ...config,

  // ---- identity ----
  name: "QuoteCat",
  slug: "quotecat",
  scheme: "quotecat",

  // ---- env passthroughs ----
  extra: {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ...(config.extra as object),
  },

  // ---- plugins (explicit, no spreading to avoid duplicates) ----
  plugins: [
    "expo-router",
    "expo-font",
    "expo-web-browser",
    "expo-sqlite",
  ],

  // ---- experiments ----
  experiments: {
    ...(config as any).experiments,
    typedRoutes: true,
  },
});
