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
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
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
    "expo-web-browser",
  ],

  // ---- experiments ----
  experiments: {
    ...(config as any).experiments,
    typedRoutes: true,
  },
});
