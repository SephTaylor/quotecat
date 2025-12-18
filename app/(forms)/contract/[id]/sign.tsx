// app/(forms)/contract/[id]/sign.tsx
// Contractor signature capture screen

import { useTheme } from "@/contexts/ThemeContext";
import { getContractById, addContractorSignature } from "@/lib/contracts";
import { getUserState } from "@/lib/user";
import type { Contract } from "@/lib/types";
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Ionicons } from "@expo/vector-icons";
import SignatureScreen, { SignatureViewRef } from "react-native-signature-canvas";

export default function SignContract() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signatureRef = useRef<SignatureViewRef>(null);

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);

  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  // Load contract and user name
  React.useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const [c, user] = await Promise.all([
        getContractById(id),
        getUserState(),
      ]);
      if (c) {
        setContract(c);
      }
      // Pre-fill with user's name if available
      if (user?.displayName) {
        setSignerName(user.displayName);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasSignature(false);
  };

  const handleEnd = () => {
    setHasSignature(true);
  };

  const handleSave = async () => {
    if (!id || !contract || !signerName.trim()) {
      Alert.alert("Missing Information", "Please enter your name before signing.");
      return;
    }

    if (!hasSignature) {
      Alert.alert("Missing Signature", "Please sign in the box above.");
      return;
    }

    // Get signature as base64
    signatureRef.current?.readSignature();
  };

  const handleSignatureResult = async (signature: string) => {
    if (!id || !contract || !signerName.trim()) return;

    setSaving(true);
    try {
      // Add contractor signature
      const result = await addContractorSignature(
        id,
        signature,
        signerName.trim()
      );

      if (result) {
        Alert.alert(
          "Signature Saved",
          "Your signature has been added to the contract.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert("Error", "Failed to save signature. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Failed to save signature. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Sign Contract",
            headerShown: true,
            headerTitleAlign: "center",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </>
    );
  }

  if (!contract) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Sign Contract",
            headerShown: true,
            headerTitleAlign: "center",
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View style={styles.center}>
          <Text style={styles.errorText}>Contract not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Sign ${contract.contractNumber}`,
          headerShown: true,
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <View style={styles.container}>
        {/* Contract Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.projectName}>{contract.projectName}</Text>
          <Text style={styles.clientName}>For: {contract.clientName}</Text>
          <Text style={styles.totalAmount}>${contract.total.toFixed(2)}</Text>
        </View>

        {/* Signer Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Your Full Name (Contractor)</Text>
          <TextInput
            style={styles.input}
            value={signerName}
            onChangeText={setSignerName}
            placeholder="Enter your full legal name"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="words"
          />
        </View>

        {/* Signature Area */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureHeader}>
            <Text style={styles.label}>Signature</Text>
            <Pressable onPress={handleClear} style={styles.clearButton}>
              <Ionicons name="refresh-outline" size={16} color={theme.colors.muted} />
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.signatureBox}>
            <SignatureScreen
              ref={signatureRef}
              onEnd={handleEnd}
              onOK={handleSignatureResult}
              webStyle={`
                .m-signature-pad {
                  box-shadow: none;
                  border: none;
                  background-color: transparent;
                }
                .m-signature-pad--body {
                  border: none;
                }
                .m-signature-pad--footer {
                  display: none;
                }
                body, html {
                  background-color: ${theme.colors.bg};
                }
              `}
              backgroundColor={theme.colors.bg}
              penColor={theme.colors.text}
            />
          </View>
          <Text style={styles.signatureHint}>Draw your signature above</Text>
        </View>

        {/* Agreement Text */}
        <Text style={styles.agreementText}>
          By signing above, I certify that I am authorized to enter into this agreement on behalf of the contractor.
        </Text>
      </View>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.buttonSecondary, styles.buttonFlex]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[
            styles.buttonPrimary,
            styles.buttonFlex2,
            (!hasSignature || !signerName.trim() || saving) && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={!hasSignature || !signerName.trim() || saving}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
          <Text style={styles.buttonPrimaryText}>
            {saving ? "Saving..." : "Sign Contract"}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], insets: { bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      padding: theme.spacing(2),
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.bg,
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    errorText: {
      fontSize: 18,
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    backButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.lg,
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    summaryCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(3),
      alignItems: "center",
    },
    projectName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 4,
    },
    clientName: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: 8,
    },
    totalAmount: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    inputSection: {
      marginBottom: theme.spacing(3),
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.muted,
      marginBottom: theme.spacing(0.75),
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    signatureSection: {
      flex: 1,
      marginBottom: theme.spacing(2),
    },
    signatureHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(0.75),
    },
    clearButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    clearText: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    signatureBox: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
      overflow: "hidden",
    },
    signatureHint: {
      fontSize: 12,
      color: theme.colors.muted,
      textAlign: "center",
      marginTop: theme.spacing(1),
    },
    agreementText: {
      fontSize: 12,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 18,
    },
    bottomBar: {
      flexDirection: "row",
      padding: theme.spacing(2),
      paddingBottom: Math.max(theme.spacing(2), insets.bottom),
      backgroundColor: theme.colors.bg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: theme.spacing(2),
    },
    buttonFlex: {
      flex: 1,
    },
    buttonFlex2: {
      flex: 2,
    },
    buttonPrimary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(2),
      borderRadius: theme.radius.xl,
      gap: 8,
    },
    buttonPrimaryText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    buttonSecondary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: theme.spacing(2),
      borderRadius: theme.radius.xl,
      gap: 8,
    },
    buttonSecondaryText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });
}
