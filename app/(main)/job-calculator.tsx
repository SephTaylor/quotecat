// app/(main)/job-calculator.tsx
// Job Calculator - Input screen for calculating material requirements
import { useTheme } from "@/contexts/ThemeContext";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";
import {
  JOB_TYPE_CONFIGS,
  useJobCalculator,
  type JobType,
  type InputFieldConfig,
  type SelectOption,
} from "@/modules/job-calculator";

export default function JobCalculator() {
  const router = useRouter();
  const { theme } = useTheme();
  const calculator = useJobCalculator();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Handle job type selection
  const handleSelectJobType = (type: JobType) => {
    calculator.selectJobType(type);
  };

  // Handle calculate button
  const handleCalculate = async () => {
    await calculator.calculate();
    if (calculator.step === 'results' || calculator.materials.length > 0) {
      router.push("/(main)/job-calculator-results" as any);
    }
  };

  // Watch for successful calculation and navigate
  React.useEffect(() => {
    if (calculator.step === 'results' && calculator.materials.length > 0) {
      router.push({
        pathname: "/(main)/job-calculator-results",
        params: {
          jobType: calculator.jobType,
          materials: JSON.stringify(calculator.materials),
          totalCost: calculator.totalCost.toString(),
        },
      } as any);
    }
  }, [calculator.step, calculator.materials.length]);

  // Job type selection screen
  if (calculator.step === 'select-type') {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Job Calculator",
            headerShown: true,
            headerTitleAlign: "center",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
          }}
        />
        <GradientBackground>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Select Job Type</Text>
              <Text style={styles.headerSubtitle}>
                Choose the type of job to calculate materials
              </Text>
            </View>

            <View style={styles.jobTypeGrid}>
              {JOB_TYPE_CONFIGS.map((config) => (
                <Pressable
                  key={config.id}
                  style={styles.jobTypeCard}
                  onPress={() => handleSelectJobType(config.id)}
                >
                  <Ionicons
                    name={config.icon as any}
                    size={32}
                    color={theme.colors.accent}
                  />
                  <Text style={styles.jobTypeTitle}>{config.title}</Text>
                  <Text style={styles.jobTypeDescription}>
                    {config.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </GradientBackground>
      </>
    );
  }

  // Input form screen
  const jobConfig = JOB_TYPE_CONFIGS.find((c) => c.id === calculator.jobType);
  if (!jobConfig) return null;

  return (
    <>
      <Stack.Screen
        options={{
          title: jobConfig.title,
          headerShown: true,
          headerTitleAlign: "center",
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerLeft: () => (
            <Pressable onPress={calculator.goBack} style={{ padding: 8 }}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.accent} />
            </Pressable>
          ),
        }}
      />
      <GradientBackground>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Enter Job Details</Text>
            <Text style={styles.formSubtitle}>
              Enter the totals from your measurements
            </Text>
          </View>

          {/* Input Fields */}
          <View style={styles.form}>
            {jobConfig.inputs.map((field) => (
              <InputField
                key={field.key}
                field={field}
                value={calculator.inputs[field.key]}
                onChange={(value) => calculator.updateInput(field.key, value)}
                theme={theme}
              />
            ))}
          </View>

          {/* Error Message */}
          {calculator.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{calculator.error}</Text>
            </View>
          )}

          {/* Calculate Button */}
          <Pressable
            style={[
              styles.calculateButton,
              calculator.isCalculating && styles.calculateButtonDisabled,
            ]}
            onPress={handleCalculate}
            disabled={calculator.isCalculating}
          >
            {calculator.isCalculating ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="calculator-outline" size={20} color="#000" />
                <Text style={styles.calculateButtonText}>Calculate Materials</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </GradientBackground>
    </>
  );
}

// Input field component
function InputField({
  field,
  value,
  onChange,
  theme,
}: {
  field: InputFieldConfig;
  value: number | boolean | string | undefined;
  onChange: (value: number | boolean | string) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  if (field.type === "boolean") {
    return (
      <View style={styles.switchRow}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <Switch
          value={value as boolean}
          onValueChange={onChange}
          trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
          thumbColor="#fff"
        />
      </View>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <View style={styles.selectContainer}>
          {field.options.map((option: SelectOption) => (
            <Pressable
              key={String(option.value)}
              style={[
                styles.selectOption,
                value === option.value && styles.selectOptionActive,
              ]}
              onPress={() => onChange(option.value)}
            >
              <Text
                style={[
                  styles.selectOptionText,
                  value === option.value && styles.selectOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // Number input
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>
        {field.label}
        {field.unit && (
          <Text style={styles.fieldUnit}> ({field.unit})</Text>
        )}
      </Text>
      <TextInput
        style={styles.textInput}
        value={value !== undefined ? String(value) : ""}
        onChangeText={(text) => {
          const num = parseFloat(text);
          if (!isNaN(num)) {
            onChange(num);
          } else if (text === "") {
            onChange(0);
          }
        }}
        placeholder={field.placeholder}
        placeholderTextColor={theme.colors.muted}
        keyboardType="numeric"
      />
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    scrollContent: {
      padding: theme.spacing(3),
      paddingBottom: theme.spacing(8),
    },
    header: {
      marginBottom: theme.spacing(3),
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    headerSubtitle: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    jobTypeGrid: {
      gap: theme.spacing(2),
    },
    jobTypeCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      gap: theme.spacing(1),
    },
    jobTypeTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    jobTypeDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
    },
    formHeader: {
      marginBottom: theme.spacing(2),
    },
    formTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    formSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    form: {
      gap: theme.spacing(2),
      marginBottom: theme.spacing(3),
    },
    fieldContainer: {
      gap: theme.spacing(0.5),
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    fieldUnit: {
      fontSize: 13,
      fontWeight: "400",
      color: theme.colors.muted,
    },
    textInput: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1.5),
    },
    selectContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing(1),
    },
    selectOption: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1),
      flex: 1,
      minWidth: "45%",
    },
    selectOptionActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    selectOptionText: {
      fontSize: 13,
      color: theme.colors.text,
      textAlign: "center",
    },
    selectOptionTextActive: {
      color: "#000",
      fontWeight: "600",
    },
    errorContainer: {
      backgroundColor: "#FEE2E2",
      borderRadius: theme.radius.sm,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
    },
    errorText: {
      color: "#DC2626",
      fontSize: 14,
    },
    calculateButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      padding: theme.spacing(2),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing(1),
    },
    calculateButtonDisabled: {
      opacity: 0.6,
    },
    calculateButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
  });
}
