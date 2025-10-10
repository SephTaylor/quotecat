// app.config.ts
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: "QuoteCat",
  slug: "quotecat",
  scheme: "quotecat", // keep a scheme for future deep links
  extra: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
};

export default config;
