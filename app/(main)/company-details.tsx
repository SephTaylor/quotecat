// app/(main)/company-details.tsx
// Edit company details for quotes and PDFs
import { useTheme } from "@/contexts/ThemeContext";
import { loadPreferences, updateCompanyDetails, type CompanyDetails } from "@/lib/preferences";
import { getUserState } from "@/lib/user";
import { canAccessAssemblies } from "@/lib/features";
import { FormInput, BottomBar, Button } from "@/modules/core/ui";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import { trackEvent, AnalyticsEvents } from "@/lib/app-analytics";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { showAlert } from "@/lib/alert";
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
  const [isPro, setIsPro] = useState(false);
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
    const [prefs, user] = await Promise.all([
      loadPreferences(),
      getUserState(),
    ]);

    setCompanyName(prefs.company.companyName || "");
    setEmail(prefs.company.email || "");
    setPhone(prefs.company.phone || "");
    setWebsite(prefs.company.website || "");
    setAddress(prefs.company.address || "");
    setOriginalDetails(prefs.company);
    setIsPro(canAccessAssemblies(user));
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

      // Track company details update
      trackEvent(AnalyticsEvents.COMPANY_DETAILS_UPDATED, {
        hasCompanyName: !!companyName,
        hasEmail: !!email,
        hasPhone: !!phone,
        hasWebsite: !!website,
        hasAddress: !!address,
      });

      showAlert(
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
      showAlert("Error", "Could not save company details. Please try again.");
    }
  };

  const handleLogoUpload = () => {
    if (!isPro) {
      showAlert(
        "Pro Feature",
        "Company logo upload is available for Pro subscribers. Upgrade to unlock professional branding features.",
        [{ text: "OK" }]
      );
    } else {
      showAlert("Coming Soon", "Logo upload will be available soon");
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Company Details",
          headerShown: true,
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

          {/* Logo Upload - Pro Feature */}
          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Ionicons name="image-outline" size={20} color={isPro ? theme.colors.accent : theme.colors.muted} />
              <Text style={styles.fieldLabel}>Company Logo</Text>
              {!isPro && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={styles.fieldDescription}>
              Add your logo to quote PDFs for a professional look
            </Text>
            <Pressable
              style={[styles.uploadButton, !isPro && styles.uploadButtonDisabled]}
              onPress={handleLogoUpload}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={isPro ? "#000" : theme.colors.muted}
              />
              <Text style={[styles.uploadButtonText, !isPro && styles.uploadButtonTextDisabled]}>
                {isPro ? "Upload Logo" : "Upgrade to Pro"}
              </Text>
            </Pressable>
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
    fieldDescription: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1.5),
      lineHeight: 18,
    },
    proBadge: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    proBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: "#000",
      letterSpacing: 0.5,
    },
    uploadButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing(1),
    },
    uploadButtonDisabled: {
      backgroundColor: theme.colors.border,
    },
    uploadButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#000",
    },
    uploadButtonTextDisabled: {
      color: theme.colors.muted,
    },
  });
}
