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
  bgGradient: ["#d5d5d5", "#ffffff"], // More noticeable light gray to white
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

export const themes = {
  light: lightColors,
  dark: darkColors,
};

// Default theme (light mode)
export const theme = {
  colors: lightColors,
  spacing: (n: number) => n * 10, // theme.spacing(2) === 20 (increased for more breathing room)
  radius: { sm: 8, md: 12, lg: 16, xl: 24 },
};

export function getTheme(mode: ThemeMode) {
  return {
    colors: themes[mode],
    spacing: (n: number) => n * 10, // Increased from 8 to 10 for better spacing
    radius: { sm: 8, md: 12, lg: 16, xl: 24 },
  };
}
