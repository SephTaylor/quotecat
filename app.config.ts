// app.config.ts
import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  // start from whatever you already had
  ...config,

  // ---- your app identity ----
  name: 'QuoteCat',
  slug: 'quotecat',
  scheme: 'quotecat',

  // ---- env passthroughs ----
  extra: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    ...(config.extra as object),
  },

  // ---- add Expo Router plugin ----
  plugins: [...(config.plugins ?? []), 'expo-router'],

  // ---- optional: typed route hints in TS ----
  experiments: { ...((config as any).experiments ?? {}), typedRoutes: true },
});
