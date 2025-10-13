// constants/theme.ts
import { Platform, useColorScheme } from "react-native";

/** ---- Your existing theme objects (kept intact) ---- */
const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/** ---- Flat tokens we already use across the app ----
 * Matches the QuoteCat palette we set: light gray bg + black text + yellow brand.
 * These are stable regardless of system scheme so your UI stays consistent.
 */
export const colors = {
  bg: "#F4F6FA",     // app background (light gray)
  text: "#111111",   // primary text
  brand: "#F9C80E",  // QuoteCat yellow
  border: "#E6EAF2", // subtle borders
};

/** ---- Optional: dynamic tokens if you want auto light/dark later ---- */
export function useThemeColors() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? Colors.dark : Colors.light;

  return {
    text: palette.text,
    background: palette.background,
    tint: palette.tint,
    icon: palette.icon,
    tabIconDefault: palette.tabIconDefault,
    tabIconSelected: palette.tabIconSelected,

    // keep our app-flat tokens stable (or swap if you ever want them dynamic)
    bg: colors.bg,
    brand: colors.brand,
    border: colors.border,
  };
}
