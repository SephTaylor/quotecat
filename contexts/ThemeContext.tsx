// contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
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
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [theme, setTheme] = useState(getTheme("dark"));

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        setMode(saved);
        setTheme(getTheme(saved));
      }
    } catch (error) {
      console.error("Failed to load theme preference:", error);
    }
  };

  const setThemeMode = async (newMode: ThemeMode) => {
    try {
      setMode(newMode);
      setTheme(getTheme(newMode));
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
