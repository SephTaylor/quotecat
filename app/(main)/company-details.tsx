// app/(main)/company-details.tsx
// Edit company details for quotes and PDFs
import { useTheme } from "@/contexts/ThemeContext";
import { loadPreferences, updateCompanyDetails, type CompanyDetails } from "@/lib/preferences";
import { FormInput, BottomBar, Button } from "@/modules/core/ui";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GradientBackground } from "@/components/GradientBackground";

export default function CompanyDetailsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [originalDetails, setOriginalDetails] = useState<CompanyDetails | null>(null);

  // Auto-format phone number
  const formatPhoneNumber = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, "");

    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhone(formatted);
  };

  const load = useCallback(async () => {
    const prefs = await loadPreferences();

    setCompanyName(prefs.company.companyName || "");
    setEmail(prefs.company.email || "");
    setPhone(prefs.company.phone || "");
    setWebsite(prefs.company.website || "");
    setAddress(prefs.company.address || "");
    setOriginalDetails(prefs.company);
    setHasChanges(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Track changes
  React.useEffect(() => {
    if (!originalDetails) return;

    const changed =
      companyName !== originalDetails.companyName ||
      email !== originalDetails.email ||
      phone !== originalDetails.phone ||
      website !== originalDetails.website ||
      address !== originalDetails.address;

    setHasChanges(changed);
  }, [companyName, email, phone, website, address, originalDetails]);

  const handleSave = async () => {
    try {
      await updateCompanyDetails({
        companyName,
        email,
        phone,
        website,
        address,
      });

      Alert.alert(
        "Saved",
        "Your company details have been saved.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error("Failed to save company details:", error);
      Alert.alert("Error", "Could not save company details. Please try again.");
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Company Details",
          headerShown: true,
          headerTitleAlign: 'center', // Center title on all platforms (Android defaults to left)
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
        }}
      />
      <GradientBackground>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.description}>
            These details will appear on your quotes and PDFs
          </Text>

          {/* Company Name */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Ionicons name="business-outline" size={20} color={theme.colors.accent} />
              <Text style={styles.fieldLabel}>Company Name</Text>
            </View>
            <FormInput
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="e.g., ABC Construction"
            />
          </View>

          {/* Email */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.accent} />
              <Text style={styles.fieldLabel}>Email</Text>
            </View>
            <FormInput
              value={email}
              onChangeText={setEmail}
              placeholder="contact@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Ionicons name="call-outline" size={20} color={theme.colors.accent} />
              <Text style={styles.fieldLabel}>Phone</Text>
            </View>
            <FormInput
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              maxLength={14}
            />
          </View>

          {/* Website */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Ionicons name="globe-outline" size={20} color={theme.colors.accent} />
              <Text style={styles.fieldLabel}>Website</Text>
            </View>
            <FormInput
              value={website}
              onChangeText={setWebsite}
              placeholder="www.company.com"
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          {/* Address */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Ionicons name="location-outline" size={20} color={theme.colors.accent} />
              <Text style={styles.fieldLabel}>Address</Text>
            </View>
            <FormInput
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main St, City, State 12345"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <BottomBar>
          <Button
            variant="primary"
            onPress={handleSave}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </BottomBar>
      </GradientBackground>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: theme.spacing(3),
    },
    description: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(3),
      lineHeight: 20,
    },
    field: {
      marginBottom: theme.spacing(3),
    },
    fieldHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    fieldLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      flex: 1,
    },
  });
}
