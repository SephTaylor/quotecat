// constants/theme.ts
export type ThemeMode = "light" | "dark";

export type ColorScheme = {
  bg: string;
  bgGradient: string[]; // [start, end] colors for gradient
  text: string;
  accent: string;
  muted: string;
  card: string;
  border: string;
  danger: string;
};

const lightColors: ColorScheme = {
  bg: "#f7f7f7",
  bgGradient: ["#e5e5e5", "#ffe4cc"], // Light gray to soft orange (default)
  text: "#111111",
  accent: "#F97316", // Construction orange
  muted: "#666666",
  card: "#ffffff",
  border: "#e5e5e5",
  danger: "#c0392b",
};

const lightColorsGray: ColorScheme = {
  bg: "#f7f7f7",
  bgGradient: ["#d5d5d5", "#ffffff"], // Gray to white (neutral option)
  text: "#111111",
  accent: "#F97316", // Construction orange
  muted: "#666666",
  card: "#ffffff",
  border: "#e5e5e5",
  danger: "#c0392b",
};

const darkColors: ColorScheme = {
  bg: "#0a0a0a",
  bgGradient: ["#000000", "#3a3a3a"], // More noticeable black to darker gray
  text: "#f5f5f5",
  accent: "#F97316", // Construction orange (same in both modes)
  muted: "#a0a0a0",
  card: "#1a1a1a",
  border: "#2a2a2a",
  danger: "#e74c3c",
};

export type GradientMode = "warm" | "neutral";

export const themes = {
  light: lightColors,
  lightGray: lightColorsGray,
  dark: darkColors,
};

// Default theme (light mode)
export const theme = {
  colors: lightColors,
  spacing: (n: number) => n * 10, // theme.spacing(2) === 20 (increased for more breathing room)
  radius: { sm: 8, md: 12, lg: 16, xl: 24 },
};

export function getTheme(mode: ThemeMode, gradientMode: GradientMode = "warm") {
  // Dark mode always uses dark gradient (no warm option)
  if (mode === "dark") {
    return {
      colors: themes.dark,
      spacing: (n: number) => n * 10,
      radius: { sm: 8, md: 12, lg: 16, xl: 24 },
    };
  }

  // Light mode can be warm (orange) or neutral (gray)
  const colors = gradientMode === "neutral" ? themes.lightGray : themes.light;
  return {
    colors,
    spacing: (n: number) => n * 10,
    radius: { sm: 8, md: 12, lg: 16, xl: 24 },
  };
}
