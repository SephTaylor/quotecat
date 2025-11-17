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
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: { backgroundColor: "#000000" },
      },
    ],
    "expo-font",
    // Removed ALL plugins that weren't in build 4
  ],

  // ---- experiments ----
  experiments: {
    ...(config as any).experiments,
    typedRoutes: true,
  },
});
