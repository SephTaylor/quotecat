// app/(forms)/contract/[id]/edit.tsx
// Contract editing screen for Premium users

import { useTheme } from "@/contexts/ThemeContext";
import { getContractWithSignatures, updateContract, markContractSent, getContractShareLink } from "@/lib/contracts";
import type { Contract } from "@/lib/types";
import { ContractStatusMeta } from "@/lib/types";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Ionicons } from "@expo/vector-icons";

export default function EditContract() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [projectName, setProjectName] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState("");

  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  // Load contract data with signatures
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const c = await getContractWithSignatures(id);
    if (c) {
      setContract(c);
      setClientName(c.clientName || "");
      setClientEmail(c.clientEmail || "");
      setClientPhone(c.clientPhone || "");
      setClientAddress(c.clientAddress || "");
      setProjectName(c.projectName || "");
      setScopeOfWork(c.scopeOfWork || "");
      setPaymentTerms(c.paymentTerms || "");
      setTermsAndConditions(c.termsAndConditions || "");
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  const handleGoBack = async () => {
    // Auto-save on back
    if (id) {
      await updateContract(id, {
        clientName: clientName.trim() || "Unnamed Client",
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        projectName: projectName.trim() || "Untitled Project",
        scopeOfWork: scopeOfWork.trim() || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        termsAndConditions: termsAndConditions.trim() || undefined,
      });
    }
    router.back();
  };

  const handleSendContract = async () => {
    if (!id || !contract) return;

    // Validate required fields
    if (!clientEmail.trim()) {
      Alert.alert("Missing Email", "Please enter a client email address before sending.");
      return;
    }

    Alert.alert(
      "Send Contract",
      `This will mark the contract as sent and share a link with ${clientName || "the client"}.\n\nThe client will be able to view and sign the contract.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            try {
              // Save first
              await updateContract(id, {
                clientName: clientName.trim() || "Unnamed Client",
                clientEmail: clientEmail.trim(),
                clientPhone: clientPhone.trim() || undefined,
                clientAddress: clientAddress.trim() || undefined,
                projectName: projectName.trim() || "Untitled Project",
                scopeOfWork: scopeOfWork.trim() || undefined,
                paymentTerms: paymentTerms.trim() || undefined,
                termsAndConditions: termsAndConditions.trim() || undefined,
              });

              // Mark as sent
              const updated = await markContractSent(id);
              if (updated) {
                setContract(updated);

                // Share the link
                const shareLink = getContractShareLink(id);
                await Share.share({
                  message: `Please review and sign the contract for ${projectName || "your project"}:\n\n${shareLink}`,
                  title: `Contract: ${contract.contractNumber}`,
                });
              }
            } catch {
              Alert.alert("Error", "Failed to send contract.");
            }
          },
        },
      ]
    );
  };

  const handleSignContract = () => {
    // Navigate to signature capture screen
    router.push(`/(forms)/contract/${id}/sign`);
  };

  const handleMarkComplete = async () => {
    if (!id || !contract) return;

    Alert.alert(
      "Mark as Complete",
      "This will mark the contract as completed, indicating the work is finished and ready for invoicing.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Complete",
          onPress: async () => {
            try {
              const updated = await updateContract(id, { status: "completed" });
              if (updated) {
                setContract(updated);
              }
            } catch {
              Alert.alert("Error", "Failed to update contract status.");
            }
          },
        },
      ]
    );
  };

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    const limited = digits.slice(0, 10);
    if (limited.length === 0) return "";
    if (limited.length <= 3) return `(${limited}`;
    if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Contract",
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
            title: "Contract",
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

  const statusMeta = ContractStatusMeta[contract.status];

  return (
    <>
      <Stack.Screen
        options={{
          title: contract.contractNumber,
          headerShown: true,
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerLeft: () => <HeaderBackButton onPress={handleGoBack} />,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
          <Text style={styles.totalText}>${contract.total.toFixed(2)}</Text>
        </View>

        {/* Client Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client Information</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Client Name</Text>
              <TextInput
                style={styles.input}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Enter client name"
                placeholderTextColor={theme.colors.muted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={clientEmail}
                onChangeText={setClientEmail}
                placeholder="client@example.com"
                placeholderTextColor={theme.colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={clientPhone}
                onChangeText={(text) => setClientPhone(formatPhoneNumber(text))}
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.colors.muted}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={clientAddress}
                onChangeText={setClientAddress}
                placeholder="Enter client address"
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </View>

        {/* Project Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Details</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Project Name</Text>
              <TextInput
                style={styles.input}
                value={projectName}
                onChangeText={setProjectName}
                placeholder="Enter project name"
                placeholderTextColor={theme.colors.muted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Scope of Work</Text>
              <TextInput
                style={[styles.input, styles.textAreaLarge]}
                value={scopeOfWork}
                onChangeText={setScopeOfWork}
                placeholder="Describe the work to be performed..."
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={6}
              />
            </View>
          </View>
        </View>

        {/* Materials Summary */}
        {contract.materials && contract.materials.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Materials ({contract.materials.length} items)</Text>
            <View style={styles.card}>
              {contract.materials.map((item, index) => (
                <View key={item.id || index} style={[styles.materialRow, index === contract.materials.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>{item.name}</Text>
                    <Text style={styles.materialDetails}>${item.unitPrice.toFixed(2)} × {item.qty}</Text>
                  </View>
                  <Text style={styles.materialTotal}>${(item.unitPrice * item.qty).toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Terms Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Terms</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={paymentTerms}
                onChangeText={setPaymentTerms}
                placeholder="e.g., 50% deposit, 50% on completion"
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Terms & Conditions</Text>
              <TextInput
                style={[styles.input, styles.textAreaLarge]}
                value={termsAndConditions}
                onChangeText={setTermsAndConditions}
                placeholder="Enter additional terms and conditions..."
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={6}
              />
            </View>
          </View>
        </View>

        {/* Signatures Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signatures</Text>
          <View style={styles.card}>
            {/* Contractor Signature */}
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>Contractor</Text>
              {contract.signatures?.find(s => s.signerType === "contractor") ? (
                <View style={styles.signatureContent}>
                  <Image
                    source={{ uri: contract.signatures.find(s => s.signerType === "contractor")!.signatureImage }}
                    style={styles.signatureImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.signatureMeta}>
                    {contract.signatures.find(s => s.signerType === "contractor")!.signerName}
                  </Text>
                  <Text style={styles.signatureDate}>
                    {new Date(contract.signatures.find(s => s.signerType === "contractor")!.signedAt).toLocaleDateString()}
                  </Text>
                </View>
              ) : (
                <View style={styles.signaturePending}>
                  <Ionicons name="create-outline" size={24} color={theme.colors.muted} />
                  <Text style={styles.signaturePendingText}>Not signed yet</Text>
                  {contract.status === "draft" && (
                    <Pressable style={styles.signButton} onPress={handleSignContract}>
                      <Text style={styles.signButtonText}>Sign Now</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            <View style={styles.signatureDivider} />

            {/* Client Signature */}
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureLabel}>Client</Text>
              {contract.signatures?.find(s => s.signerType === "client") ? (
                <View style={styles.signatureContent}>
                  <Image
                    source={{ uri: contract.signatures.find(s => s.signerType === "client")!.signatureImage }}
                    style={styles.signatureImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.signatureMeta}>
                    {contract.signatures.find(s => s.signerType === "client")!.signerName}
                  </Text>
                  <Text style={styles.signatureDate}>
                    {new Date(contract.signatures.find(s => s.signerType === "client")!.signedAt).toLocaleDateString()}
                  </Text>
                </View>
              ) : (
                <View style={styles.signaturePending}>
                  <Ionicons name="time-outline" size={24} color={theme.colors.muted} />
                  <Text style={styles.signaturePendingText}>
                    {contract.status === "draft" ? "Send contract to client for signature" : "Awaiting client signature"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {contract.status === "draft" && (
          <>
            <Pressable
              style={[styles.buttonSecondary, styles.buttonFlex]}
              onPress={handleSignContract}
            >
              <Ionicons name="create-outline" size={20} color={theme.colors.text} />
              <Text style={styles.buttonSecondaryText}>Sign</Text>
            </Pressable>
            <Pressable
              style={[styles.buttonPrimary, styles.buttonFlex2]}
              onPress={handleSendContract}
            >
              <Ionicons name="send-outline" size={20} color="#000" />
              <Text style={styles.buttonPrimaryText}>Send to Client</Text>
            </Pressable>
          </>
        )}
        {contract.status === "sent" && (
          <View style={styles.sentInfo}>
            <Ionicons name="time-outline" size={20} color={theme.colors.muted} />
            <Text style={styles.sentText}>
              Sent {contract.sentAt ? new Date(contract.sentAt).toLocaleDateString() : ""}
            </Text>
          </View>
        )}
        {contract.status === "signed" && (
          <Pressable
            style={[styles.buttonPrimary, { flex: 1 }]}
            onPress={handleMarkComplete}
          >
            <Ionicons name="checkmark-done-outline" size={20} color="#000" />
            <Text style={styles.buttonPrimaryText}>Mark Complete</Text>
          </Pressable>
        )}
        {contract.status === "completed" && (
          <View style={styles.completedInfo}>
            <Ionicons name="checkmark-done-circle" size={20} color="#5856D6" />
            <Text style={styles.completedText}>Work Completed - Ready to Invoice</Text>
          </View>
        )}
      </View>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], insets: { bottom: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    content: {
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(16),
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
    statusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(3),
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(0.75),
      borderRadius: 9999,
      gap: 6,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 14,
      fontWeight: "600",
    },
    totalText: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    section: {
      marginBottom: theme.spacing(3),
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1.5),
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    inputGroup: {
      marginBottom: theme.spacing(2),
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
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    textAreaLarge: {
      minHeight: 120,
      textAlignVertical: "top",
    },
    materialRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    materialInfo: {
      flex: 1,
      marginRight: theme.spacing(2),
    },
    materialName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    materialDetails: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    materialTotal: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
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
    sentInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    sentText: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    signedInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    signedText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#34C759",
    },
    completedInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    completedText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#5856D6",
    },
    signatureBlock: {
      paddingVertical: theme.spacing(2),
    },
    signatureLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1.5),
    },
    signatureContent: {
      alignItems: "center",
    },
    signatureImage: {
      width: "100%",
      height: 80,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      marginBottom: theme.spacing(1),
    },
    signatureMeta: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    signatureDate: {
      fontSize: 12,
      color: theme.colors.muted,
      marginTop: 2,
    },
    signaturePending: {
      alignItems: "center",
      paddingVertical: theme.spacing(2),
    },
    signaturePendingText: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: theme.spacing(1),
      textAlign: "center",
    },
    signatureDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing(1),
    },
    signButton: {
      marginTop: theme.spacing(2),
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing(3),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.lg,
    },
    signButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
  });
}
