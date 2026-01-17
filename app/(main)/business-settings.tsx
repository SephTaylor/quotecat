// app/(main)/business-settings.tsx
// Business configuration screen for Pro/Premium users
// Techs see read-only view of owner's settings

import { useTheme } from "@/contexts/ThemeContext";
import { useTechContext } from "@/contexts/TechContext";
import { getUserState, type UserState } from "@/lib/user";
import { canAccessAssemblies } from "@/lib/features";
import {
  loadPreferences,
  updateInvoiceSettings,
  updateContractSettings,
  updatePricingSettings,
  type UserPreferences,
} from "@/lib/preferences";
import { uploadCompanyLogo, getCompanyLogo, deleteLogo, type CompanyLogo } from "@/lib/logo";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { HeaderBackButton } from "@/components/HeaderBackButton";

export default function BusinessSettings() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isTech, ownerCompanyName } = useTechContext();

  const [userState, setUserState] = useState<UserState | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [logo, setLogo] = useState<CompanyLogo | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Techs can view settings but cannot edit them
  const hasProAccess = userState ? canAccessAssemblies(userState) : false;
  const hasPremiumAccess = userState?.tier === "premium";
  const canEdit = !isTech; // Techs cannot edit - they view owner's settings

  const load = useCallback(async () => {
    setLoading(true);
    const [user, prefs, companyLogo] = await Promise.all([
      getUserState(),
      loadPreferences(),
      getCompanyLogo(),
    ]);
    setUserState(user);
    setPreferences(prefs);
    setLogo(companyLogo);
    setLoading(false);
  }, []);

  const handleUploadLogo = async () => {
    if (!hasProAccess) return;
    try {
      setUploadingLogo(true);
      const uploadedLogo = await uploadCompanyLogo();
      if (uploadedLogo) {
        setLogo(uploadedLogo);
      }
      // If null, user cancelled - do nothing
    } catch (error) {
      console.error("Failed to upload logo:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    Alert.alert("Delete Logo", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setUploadingLogo(true);
            await deleteLogo();
            setLogo(null);
          } catch {
            Alert.alert("Error", "Failed to delete logo");
          } finally {
            setUploadingLogo(false);
          }
        },
      },
    ]);
  };

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLearnMore = () => Linking.openURL("https://quotecat.ai");

  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  if (loading || !preferences) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Business Settings",
            headerShown: true,
            headerTitleAlign: "center",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Business Settings",
          headerShown: true,
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
      >
          {/* Tech Read-Only Banner */}
          {isTech && (
            <View style={styles.techBanner}>
              <Ionicons name="information-circle" size={20} color={theme.colors.accent} />
              <View style={styles.techBannerText}>
                <Text style={styles.techBannerTitle}>Viewing {ownerCompanyName}'s Settings</Text>
                <Text style={styles.techBannerSubtitle}>
                  These settings are managed by the business owner and will be used on your quotes and invoices.
                </Text>
              </View>
            </View>
          )}

          {/* Company Section */}
        <Pressable style={styles.section} onPress={Keyboard.dismiss}>
          <Text style={styles.sectionTitle}>Company</Text>
          <View style={styles.card}>
            <Pressable
              style={styles.row}
              onPress={() => (hasProAccess && canEdit) ? router.push("/(main)/company-details") : (!hasProAccess ? handleLearnMore() : undefined)}
              disabled={isTech}
            >
              <Text style={styles.rowLabel}>Company Details</Text>
              {hasProAccess ? (
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {preferences.company?.companyName || "Not set"}
                  </Text>
                  {canEdit && <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />}
                </View>
              ) : (
                <LockBadge theme={theme} />
              )}
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.logoLeft}>
                <Text style={styles.rowLabel}>Logo</Text>
                {logo?.base64 && (
                  <Image source={{ uri: logo.base64 }} style={styles.logoThumb} resizeMode="contain" />
                )}
              </View>
              {!hasProAccess ? (
                <LockBadge theme={theme} />
              ) : canEdit ? (
                <View style={styles.logoButtons}>
                  <Pressable style={styles.textButton} onPress={handleUploadLogo} disabled={uploadingLogo}>
                    {uploadingLogo ? (
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                    ) : (
                      <Text style={styles.textButtonLabel}>{logo ? "Change" : "Upload"}</Text>
                    )}
                  </Pressable>
                  {logo && (
                    <Pressable style={styles.deleteButton} onPress={handleDeleteLogo}>
                      <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                    </Pressable>
                  )}
                </View>
              ) : (
                <Text style={styles.rowValue}>{logo ? "Set" : "Not set"}</Text>
              )}
            </View>
          </View>
        </Pressable>

        {/* Documents Section */}
        <Pressable style={styles.section} onPress={Keyboard.dismiss}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <View style={styles.card}>
            <InlineField
              label="Invoice Prefix"
              value={preferences.invoice?.prefix || "INV"}
              enabled={hasProAccess && canEdit}
              onSave={async (v) => setPreferences(await updateInvoiceSettings({ prefix: v.trim().toUpperCase() }))}
              onLocked={handleLearnMore}
              theme={theme}
              readOnly={isTech}
            />
            <InlineField
              label="Next Invoice #"
              value={String(preferences.invoice?.nextNumber || 1)}
              keyboardType="number-pad"
              enabled={hasProAccess && canEdit}
              onSave={async (v) => { const n = parseInt(v, 10); if (n > 0) setPreferences(await updateInvoiceSettings({ nextNumber: n })); }}
              onLocked={handleLearnMore}
              theme={theme}
              readOnly={isTech}
            />
            <View style={styles.divider} />
            <InlineField
              label="Contract Prefix"
              value={preferences.contract?.prefix || "CTR"}
              enabled={hasPremiumAccess && canEdit}
              premium
              onSave={async (v) => setPreferences(await updateContractSettings({ prefix: v.trim().toUpperCase() }))}
              onLocked={handleLearnMore}
              theme={theme}
              readOnly={isTech}
            />
            <InlineField
              label="Next Contract #"
              value={String(preferences.contract?.nextNumber || 1)}
              keyboardType="number-pad"
              enabled={hasPremiumAccess && canEdit}
              premium
              onSave={async (v) => { const n = parseInt(v, 10); if (n > 0) setPreferences(await updateContractSettings({ nextNumber: n })); }}
              onLocked={handleLearnMore}
              theme={theme}
              readOnly={isTech}
            />
          </View>
        </Pressable>

        {/* Payment Methods Section */}
        <Pressable style={styles.section} onPress={Keyboard.dismiss}>
          <Text style={styles.sectionTitle}>Payment Collection</Text>
          <View style={styles.card}>
            <Pressable
              style={styles.row}
              onPress={() => (hasProAccess && canEdit) ? router.push("/(main)/payment-methods" as never) : (!hasProAccess ? handleLearnMore() : undefined)}
              disabled={isTech}
            >
              <Text style={styles.rowLabel}>Payment Methods</Text>
              {hasProAccess ? (
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {isTech ? "View only" : "Add Zelle, Venmo, etc."}
                  </Text>
                  {canEdit && <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />}
                </View>
              ) : (
                <LockBadge theme={theme} />
              )}
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>
            Payment info will appear on your invoices
          </Text>
        </Pressable>

        {/* Pricing Section */}
        <Pressable style={styles.section} onPress={Keyboard.dismiss}>
          <Text style={styles.sectionTitle}>Pricing Defaults</Text>
          <View style={styles.card}>
            <InlineField
              label="Default Tax"
              value={String(preferences.pricing?.defaultTaxPercent || 0)}
              suffix="%"
              keyboardType="decimal-pad"
              enabled={hasProAccess && canEdit}
              onSave={async (v) => { const n = parseFloat(v) || 0; if (n >= 0 && n <= 100) setPreferences(await updatePricingSettings({ defaultTaxPercent: n })); }}
              onLocked={handleLearnMore}
              theme={theme}
              readOnly={isTech}
            />
            <InlineField
              label="Default Markup"
              value={String(preferences.pricing?.defaultMarkupPercent || 0)}
              suffix="%"
              keyboardType="decimal-pad"
              enabled={hasProAccess && canEdit}
              onSave={async (v) => { const n = parseFloat(v) || 0; if (n >= 0) setPreferences(await updatePricingSettings({ defaultMarkupPercent: n })); }}
              onLocked={handleLearnMore}
              theme={theme}
              readOnly={isTech}
            />
            <InlineField
              label="Default Labor Rate"
              value={String(preferences.pricing?.defaultLaborRate || 0)}
              prefix="$"
              suffix="/hr"
              keyboardType="decimal-pad"
              enabled={hasProAccess && canEdit}
              onSave={async (v) => { const n = parseFloat(v) || 0; if (n >= 0) setPreferences(await updatePricingSettings({ defaultLaborRate: n })); }}
              onLocked={handleLearnMore}
              theme={theme}
              readOnly={isTech}
            />
            <InlineField
              label="Zip Code"
              value={preferences.pricing?.zipCode || ""}
              placeholder="—"
              keyboardType="number-pad"
              enabled={hasProAccess && canEdit}
              onSave={async (v) => setPreferences(await updatePricingSettings({ zipCode: v.trim() }))}
              onLocked={handleLearnMore}
              theme={theme}
              readOnly={isTech}
            />
          </View>
        </Pressable>

      </ScrollView>
    </>
  );
}

// Lock Badge Component
function LockBadge({ theme }: { theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: `${theme.colors.accent}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, gap: 4 }}>
      <Ionicons name="lock-closed" size={12} color={theme.colors.accent} />
      <Text style={{ fontSize: 11, fontWeight: "600", color: theme.colors.accent }}>Pro</Text>
    </View>
  );
}

// Premium Badge Component
function PremiumBadge({ theme }: { theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#7C3AED20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, gap: 4 }}>
      <Ionicons name="star" size={12} color="#7C3AED" />
      <Text style={{ fontSize: 11, fontWeight: "600", color: "#7C3AED" }}>Premium</Text>
    </View>
  );
}

// Inline Field Component
function InlineField({
  label, value, placeholder, prefix, suffix, keyboardType = "default", enabled, premium, onSave, onLocked, theme, readOnly = false
}: {
  label: string;
  value: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  enabled: boolean;
  premium?: boolean;
  onSave: (v: string) => Promise<void>;
  onLocked: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
  readOnly?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const savedValueRef = React.useRef(value);

  React.useEffect(() => {
    setLocal(value);
    savedValueRef.current = value;
  }, [value]);

  const handleBlur = async () => {
    setIsFocused(false);
    if (local !== savedValueRef.current) {
      savedValueRef.current = local;
      await onSave(local);
    }
  };

  // Read-only mode for techs: show value but no editing
  if (readOnly) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
        <Text style={{ fontSize: 15, color: theme.colors.text }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {prefix && <Text style={{ fontSize: 15, color: theme.colors.muted, marginRight: 2 }}>{prefix}</Text>}
          <Text style={{ fontSize: 15, color: theme.colors.muted }}>{value || placeholder || "—"}</Text>
          {suffix && <Text style={{ fontSize: 15, color: theme.colors.muted, marginLeft: 4 }}>{suffix}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
      <Pressable onPress={Keyboard.dismiss} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 15, color: theme.colors.text }}>{label}</Text>
        {!enabled && <Ionicons name="lock-closed" size={12} color={theme.colors.accent} />}
      </Pressable>
      {enabled ? (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {prefix && <Text style={{ fontSize: 15, color: theme.colors.muted, marginRight: 2 }}>{prefix}</Text>}
          <TextInput
            style={{
              fontSize: 15,
              color: theme.colors.text,
              textAlign: "right",
              minWidth: 70,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: theme.colors.bg,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: isFocused ? theme.colors.accent : theme.colors.border,
            }}
            value={local}
            onChangeText={setLocal}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onSubmitEditing={handleBlur}
            placeholder={placeholder || "—"}
            placeholderTextColor={theme.colors.muted}
            keyboardType={keyboardType}
            selectTextOnFocus={true}
            inputAccessoryViewID={null as any}
          />
          {suffix && <Text style={{ fontSize: 15, color: theme.colors.muted, marginLeft: 4 }}>{suffix}</Text>}
        </View>
      ) : (
        <Pressable onPress={onLocked} style={{ flexDirection: "row", alignItems: "center" }}>
          {prefix && <Text style={{ fontSize: 15, color: theme.colors.muted, marginRight: 2, opacity: 0.6 }}>{prefix}</Text>}
          <View style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            backgroundColor: theme.colors.bg,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: theme.colors.border,
            opacity: 0.6,
          }}>
            <Text style={{ fontSize: 15, color: theme.colors.muted }}>{value || placeholder || "—"}</Text>
          </View>
          {suffix && <Text style={{ fontSize: 15, color: theme.colors.muted, marginLeft: 4 }}>{suffix}</Text>}
        </Pressable>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], insets: { bottom: number }) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: 16, paddingBottom: Math.max(24, insets.bottom) },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg },
    // Tech banner styles
    techBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: `${theme.colors.accent}15`,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${theme.colors.accent}30`,
      padding: 12,
      marginBottom: 20,
      gap: 10,
    },
    techBannerText: {
      flex: 1,
    },
    techBannerTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    techBannerSubtitle: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
    },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
    sectionHint: { fontSize: 12, color: theme.colors.muted, marginTop: 8, marginLeft: 4 },
    card: { backgroundColor: theme.colors.card, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 16, paddingVertical: 8 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
    rowLabel: { fontSize: 15, color: theme.colors.text },
    rowRight: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1, justifyContent: "flex-end" },
    rowValue: { fontSize: 15, color: theme.colors.muted, maxWidth: 150 },
    divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 4 },
    logoLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    logoThumb: { width: 48, height: 24 },
    logoButtons: { flexDirection: "row", alignItems: "center", gap: 12 },
    textButton: { paddingVertical: 4, paddingHorizontal: 8 },
    textButtonLabel: { fontSize: 15, color: theme.colors.accent, fontWeight: "600" },
    deleteButton: { padding: 4 },
  });
}
