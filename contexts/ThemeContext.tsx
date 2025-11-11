// contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { getTheme, type ThemeMode, type GradientMode } from "@/constants/theme";
import { loadPreferences, savePreferences } from "@/lib/preferences";

type ThemeContextType = {
  mode: ThemeMode;
  gradientMode: GradientMode;
  theme: ReturnType<typeof getTheme>;
  setThemeMode: (mode: ThemeMode) => void;
  setGradientMode: (mode: GradientMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [gradientMode, setGradientModeState] = useState<GradientMode>("warm");
  const [theme, setTheme] = useState(getTheme("light", "warm"));

  // Load saved theme and gradient preferences on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const prefs = await loadPreferences();
      const savedThemeMode = prefs.appearance?.themeMode || "light";
      const savedGradientMode = prefs.appearance?.gradientMode || "warm";

      setMode(savedThemeMode);
      setGradientModeState(savedGradientMode);
      setTheme(getTheme(savedThemeMode, savedGradientMode));
    } catch (error) {
      console.error("Failed to load theme preference:", error);
    }
  };

  const setThemeMode = async (newMode: ThemeMode) => {
    try {
      setMode(newMode);
      setTheme(getTheme(newMode, gradientMode));

      // Save to preferences
      const prefs = await loadPreferences();
      prefs.appearance.themeMode = newMode;
      await savePreferences(prefs);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  };

  const setGradientMode = async (newGradientMode: GradientMode) => {
    try {
      setGradientModeState(newGradientMode);
      setTheme(getTheme(mode, newGradientMode));

      // Save to preferences
      const prefs = await loadPreferences();
      prefs.appearance.gradientMode = newGradientMode;
      await savePreferences(prefs);
    } catch (error) {
      console.error("Failed to save gradient preference:", error);
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, gradientMode, theme, setThemeMode, setGradientMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
