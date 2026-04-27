// contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { getTheme, type ThemeMode } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeContextType = {
  mode: ThemeMode;
  theme: ReturnType<typeof getTheme>;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "@quotecat/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // "system" follows device settings, "light"/"dark" are explicit overrides
  const [mode, setMode] = useState<ThemeMode>("system");
  const systemColorScheme = useColorScheme();

  // Resolve the actual theme to apply
  const resolvedMode: "light" | "dark" =
    mode === "system"
      ? (systemColorScheme === "dark" ? "dark" : "light")
      : mode;

  const [theme, setTheme] = useState(getTheme(resolvedMode));

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Update theme when system color scheme changes (only matters when mode is "system")
  useEffect(() => {
    setTheme(getTheme(resolvedMode));
  }, [resolvedMode]);

  const loadThemePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") {
        setMode(saved);
      }
      // If no saved preference, default to "system"
    } catch (error) {
      console.error("Failed to load theme preference:", error);
    }
  };

  const setThemeMode = async (newMode: ThemeMode) => {
    try {
      setMode(newMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, theme, setThemeMode }}>
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
