// components/LaborInput.tsx
// Smart labor input component for Pro users
// Supports flat rate OR hours × rate calculation

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { computeLaborEntryTotal } from "@/lib/types";
import type { LaborEntry } from "@/lib/types";

type LaborInputMode = "flat" | "calculated";

type Props = {
  value: number; // The total labor value (source of truth)
  onChange: (value: number, entry?: LaborEntry) => void;
  defaultRate?: number; // Default hourly rate from settings
  initialEntry?: LaborEntry; // Existing entry to edit
};

export function LaborInput({ value, onChange, defaultRate = 0, initialEntry }: Props) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Determine initial mode based on existing entry
  const [mode, setMode] = useState<LaborInputMode>(() => {
    if (initialEntry?.hours && initialEntry?.rate) return "calculated";
    return "flat";
  });

  // Flat mode state
  const [flatValue, setFlatValue] = useState(() => {
    if (initialEntry?.flatAmount !== undefined) return initialEntry.flatAmount.toString();
    return value > 0 ? value.toString() : "";
  });

  // Calculated mode state
  const [hours, setHours] = useState(() => {
    if (initialEntry?.hours) return initialEntry.hours.toString();
    return "";
  });
  const [rate, setRate] = useState(() => {
    if (initialEntry?.rate) return initialEntry.rate.toString();
    if (defaultRate > 0) return defaultRate.toString();
    return "";
  });

  // Sync flat value when external value changes (e.g., loading quote)
  useEffect(() => {
    if (mode === "flat" && value > 0 && !flatValue) {
      setFlatValue(value.toString());
    }
  }, [value, mode, flatValue]);

  // Calculate total in calculated mode
  const calculatedTotal = React.useMemo(() => {
    const h = parseFloat(hours) || 0;
    const r = parseFloat(rate) || 0;
    return h * r;
  }, [hours, rate]);

  // Handle flat value change
  const handleFlatChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    setFlatValue(cleaned);
    const num = parseFloat(cleaned) || 0;
    onChange(num, { id: "labor", flatAmount: num });
  };

  // Handle hours change
  const handleHoursChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    setHours(cleaned);
    const h = parseFloat(cleaned) || 0;
    const r = parseFloat(rate) || 0;
    const total = h * r;
    onChange(total, { id: "labor", hours: h, rate: r });
  };

  // Handle rate change
  const handleRateChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    setRate(cleaned);
    const h = parseFloat(hours) || 0;
    const r = parseFloat(cleaned) || 0;
    const total = h * r;
    onChange(total, { id: "labor", hours: h, rate: r });
  };

  // Toggle between modes
  const toggleMode = () => {
    if (mode === "flat") {
      // Switching to calculated - try to reverse-engineer hours from flat value
      const flatNum = parseFloat(flatValue) || 0;
      const defaultRateNum = defaultRate || parseFloat(rate) || 0;
      if (flatNum > 0 && defaultRateNum > 0) {
        const estimatedHours = flatNum / defaultRateNum;
        setHours(estimatedHours.toFixed(1));
        setRate(defaultRateNum.toString());
      } else if (defaultRateNum > 0 && !rate) {
        // Pre-fill rate from default even when starting fresh (no flat amount)
        setRate(defaultRateNum.toString());
      }
      setMode("calculated");
    } else {
      // Switching to flat - use calculated total
      setFlatValue(calculatedTotal > 0 ? calculatedTotal.toFixed(2) : "");
      setMode("flat");
      if (calculatedTotal > 0) {
        onChange(calculatedTotal, { id: "labor", flatAmount: calculatedTotal });
      }
    }
  };

  // Format number on blur
  const formatOnBlur = (setter: (v: string) => void, currentValue: string, decimals = 2) => {
    const num = parseFloat(currentValue);
    if (!isNaN(num)) {
      setter(num.toFixed(decimals));
    }
  };

  return (
    <View style={styles.container}>
      {mode === "flat" ? (
        // Flat rate mode
        <View style={styles.flatContainer}>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput
              style={styles.input}
              value={flatValue}
              onChangeText={handleFlatChange}
              onBlur={() => formatOnBlur(setFlatValue, flatValue)}
              placeholder="0.00"
              placeholderTextColor={theme.colors.muted}
              keyboardType="decimal-pad"
            />
          </View>
          <Pressable onPress={toggleMode} hitSlop={8}>
            <Text style={styles.modeToggle}>or use calculator</Text>
          </Pressable>
        </View>
      ) : (
        // Calculated mode (hours × rate)
        <View style={styles.calculatedContainer}>
          <View style={styles.calculatedRow}>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.smallInput, styles.hoursInput]}
                value={hours}
                onChangeText={handleHoursChange}
                onBlur={() => formatOnBlur(setHours, hours, 1)}
                placeholder="0"
                placeholderTextColor={theme.colors.muted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputLabel}>hrs</Text>
            </View>
            <Text style={styles.operator}>×</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.currencyPrefixSmall}>$</Text>
              <TextInput
                style={[styles.smallInput, styles.rateInput]}
                value={rate}
                onChangeText={handleRateChange}
                onBlur={() => formatOnBlur(setRate, rate)}
                placeholder="0.00"
                placeholderTextColor={theme.colors.muted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputLabel}>/hr</Text>
            </View>
          </View>
          <View style={styles.calculatedFooter}>
            <Text style={styles.calculatedTotal}>
              = ${calculatedTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Pressable onPress={toggleMode} hitSlop={8}>
              <Text style={styles.modeToggle}>enter flat rate</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    flatContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    currencyPrefix: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.muted,
      marginRight: 4,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "600",
      padding: 0,
    },
    modeToggle: {
      fontSize: 12,
      color: theme.colors.accent,
      fontWeight: "500",
    },
    calculatedContainer: {
      gap: theme.spacing(1.5),
    },
    calculatedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
    },
    inputGroup: {
      flexDirection: "row",
      alignItems: "center",
    },
    smallInput: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "600",
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing(1),
      paddingVertical: theme.spacing(0.5),
      minWidth: 50,
      textAlign: "center",
    },
    hoursInput: {
      minWidth: 45,
    },
    rateInput: {
      minWidth: 60,
    },
    currencyPrefixSmall: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
      marginRight: 2,
    },
    inputLabel: {
      fontSize: 12,
      color: theme.colors.muted,
      marginLeft: 4,
    },
    operator: {
      fontSize: 16,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    calculatedFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    calculatedTotal: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "700",
    },
  });
}

export default LaborInput;
