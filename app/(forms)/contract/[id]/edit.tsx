// app/(forms)/contract/[id]/edit.tsx
// Contract editing screen for Premium users

import { useTheme } from "@/contexts/ThemeContext";
import { getContractWithSignatures, updateContract, markContractSent, getContractShareLink, deleteSignature } from "@/lib/contracts";
import { onContractChanged, notifyContractChanged } from "@/lib/contractEvents";
import type { Contract } from "@/lib/types";
import { ContractStatusMeta } from "@/lib/types";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Ionicons } from "@expo/vector-icons";
import { shareCalendarEvent, contractToCalendarEvent } from "@/lib/calendar";

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
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showCompletionPicker, setShowCompletionPicker] = useState(false);
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
      setStartDate(c.startDate || "");
      setCompletionDate(c.completionDate || "");
      setTermsAndConditions(c.termsAndConditions || "");
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load])
  );

  // Side-channel refresh: sign/revert flows fire notifyContractChanged so we
  // refetch even when useFocusEffect doesn't refire (e.g. Alert+router.back
  // race when returning from the signature screen).
  useEffect(() => {
    if (!id) return;
    const unsub = onContractChanged((cid) => {
      if (cid === id) load();
    });
    return unsub;
  }, [id, load]);

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
        startDate: startDate || undefined,
        completionDate: completionDate || undefined,
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

    // Guard: contractor must sign before sending. Without this, the portal
    // refuses the customer's signature ("Waiting for contractor signature")
    // and the link looks broken to the client — Mike Kane hit this trap.
    const hasContractorSig = contract.signatures?.some(s => s.signerType === "contractor");
    if (!hasContractorSig) {
      Alert.alert(
        "Sign First",
        "Please sign the contract before sending it. Your customer can't sign a contract you haven't agreed to."
      );
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

  // Re-share the existing link without changing status. Used when a contract
  // is already Sent/Viewed — contractor wants to nudge or resend.
  const handleShareLink = async () => {
    if (!id || !contract) return;
    try {
      const shareLink = getContractShareLink(id);
      await Share.share({
        message: `Please review and sign the contract for ${projectName || "your project"}:\n\n${shareLink}`,
        title: `Contract: ${contract.contractNumber}`,
      });
    } catch {
      Alert.alert("Error", "Failed to open share sheet.");
    }
  };

  const handleSignContract = () => {
    // Navigate to signature capture screen
    router.push(`/(forms)/contract/${id}/sign`);
  };

  const handleClearSignature = (signatureId: string, signerType: string) => {
    Alert.alert(
      "Clear Signature",
      `Are you sure you want to remove the ${signerType} signature?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            const success = await deleteSignature(signatureId);
            if (success) {
              // Reload contract to refresh signatures
              await load();
            } else {
              Alert.alert("Error", "Failed to clear signature.");
            }
          },
        },
      ]
    );
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

  // Single rollback path. Clears BOTH signatures (a signed contract reverted
  // to Draft has to start the signing flow over) and resets status to draft.
  // No partial states — keeps the state machine linear and predictable.
  const handleRevertToDraft = () => {
    if (!id || !contract) return;
    if (contract.status === "draft") return;

    const sigCount = contract.signatures?.length ?? 0;
    const sigNote =
      sigCount > 0
        ? `\n\nThis will clear ${sigCount === 1 ? "the signature" : "both signatures"} so the contract can be edited and re-signed.`
        : "";

    Alert.alert(
      "Revert to Draft?",
      `Move this contract back to Draft for editing.${sigNote}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revert",
          style: "destructive",
          onPress: async () => {
            try {
              if (contract.signatures && contract.signatures.length > 0) {
                await Promise.all(
                  contract.signatures.map(s => deleteSignature(s.id))
                );
              }
              const updated = await updateContract(id, { status: "draft" });
              if (updated) {
                await load();
                notifyContractChanged(id);
              }
            } catch {
              Alert.alert("Error", "Failed to revert to draft.");
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
  const hasContractorSig = !!contract.signatures?.some(s => s.signerType === "contractor");
  const isOut = contract.status === "sent" || contract.status === "viewed";
  // Anomaly: the contract was sent before the contractor signed. The portal
  // refuses the customer's signature in this state, so the link looks broken.
  // This banner names the problem and offers the one-tap recovery.
  const showUnsignedSentBanner = isOut && !hasContractorSig;

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
        {/* Status Badge — read-only. Forward motion happens via the morph
            button at the bottom; rollback lives here next to the badge so the
            relationship between "what status this is" and "how to go back" is
            visually obvious. */}
        <View style={styles.statusRow}>
          <View style={styles.statusGroup}>
            <View
              style={[styles.statusBadge, { backgroundColor: statusMeta.color + "20" }]}
            >
              <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
              <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
            </View>
            {(contract.status === "sent" ||
              contract.status === "viewed" ||
              contract.status === "signed") && (
              <Pressable style={styles.revertLink} onPress={handleRevertToDraft}>
                <Ionicons name="arrow-undo-outline" size={14} color={theme.colors.muted} />
                <Text style={styles.revertLinkText}>Revert to Draft</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.totalText}>${contract.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>

        {showUnsignedSentBanner && (
          <View style={styles.anomalyBanner}>
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.anomalyTitle}>Customer can&apos;t sign this yet</Text>
              <Text style={styles.anomalyBody}>
                You sent this contract before signing it. The portal won&apos;t let your client sign a contract you haven&apos;t agreed to. Revert to Draft, sign, then re-send.
              </Text>
              <Pressable style={styles.anomalyAction} onPress={handleRevertToDraft}>
                <Text style={styles.anomalyActionText}>Revert to Draft</Text>
              </Pressable>
            </View>
          </View>
        )}

        {contract.status === "changes_requested" && (
          <View style={styles.responseBanner}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.responseTitle}>
                {clientName || "Your client"} requested changes
              </Text>
              {contract.changeRequestMessage && (
                <Text style={styles.responseQuote}>
                  &ldquo;{contract.changeRequestMessage}&rdquo;
                </Text>
              )}
              <Text style={styles.responseBody}>
                Revert to Draft, make the changes they asked for, sign, and re-send.
              </Text>
              <Pressable style={styles.anomalyAction} onPress={handleRevertToDraft}>
                <Text style={styles.anomalyActionText}>Revert to Draft</Text>
              </Pressable>
            </View>
          </View>
        )}

        {contract.status === "declined" && (
          <View style={styles.declinedBanner}>
            <Ionicons name="close-circle-outline" size={20} color="#991B1B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.declinedTitle}>
                {clientName || "Your client"} declined this contract
              </Text>
              {contract.declineReason && (
                <Text style={styles.responseQuote}>
                  &ldquo;{contract.declineReason}&rdquo;
                </Text>
              )}
              <Text style={styles.responseBody}>
                If you want to re-pitch, Revert to Draft, make edits, and re-send.
              </Text>
              <Pressable style={styles.anomalyAction} onPress={handleRevertToDraft}>
                <Text style={styles.anomalyActionText}>Revert to Draft</Text>
              </Pressable>
            </View>
          </View>
        )}

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

            {/* Work dates — power the Add to Calendar handoff below.
                Both optional; contractor can set either or both. */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Work Start Date</Text>
              <Pressable style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
                <Text style={startDate ? styles.dateInputText : styles.dateInputPlaceholder}>
                  {startDate
                    ? new Date(startDate).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Set start date"}
                </Text>
                {startDate ? (
                  <Pressable onPress={() => setStartDate("")} hitSlop={8}>
                    <Text style={styles.dateInputClear}>Clear</Text>
                  </Pressable>
                ) : (
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.muted} />
                )}
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Estimated Completion Date</Text>
              <Pressable style={styles.dateInput} onPress={() => setShowCompletionPicker(true)}>
                <Text style={completionDate ? styles.dateInputText : styles.dateInputPlaceholder}>
                  {completionDate
                    ? new Date(completionDate).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Set completion date"}
                </Text>
                {completionDate ? (
                  <Pressable onPress={() => setCompletionDate("")} hitSlop={8}>
                    <Text style={styles.dateInputClear}>Clear</Text>
                  </Pressable>
                ) : (
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.muted} />
                )}
              </Pressable>
            </View>

            {(startDate || completionDate) && (
              <Pressable
                style={styles.addToCalendarButton}
                onPress={async () => {
                  const evt = contractToCalendarEvent({
                    ...contract,
                    startDate: startDate || undefined,
                    completionDate: completionDate || undefined,
                    projectName: projectName || contract.projectName,
                    clientName: clientName || contract.clientName,
                    clientAddress: clientAddress || contract.clientAddress,
                  });
                  if (!evt) return;
                  try {
                    await shareCalendarEvent(evt);
                  } catch (e) {
                    Alert.alert("Couldn't open calendar", e instanceof Error ? e.message : "Please try again.");
                  }
                }}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.colors.accent} />
                <Text style={styles.addToCalendarText}>Add to Calendar</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* iOS date picker modals — one per field. */}
        {Platform.OS === "ios" && showStartPicker && (
          <Modal transparent animationType="fade" visible={showStartPicker}>
            <Pressable style={styles.datePickerOverlay} onPress={() => setShowStartPicker(false)}>
              <View style={styles.datePickerModal}>
                <View style={styles.datePickerHeader}>
                  <Pressable onPress={() => setShowStartPicker(false)}>
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.datePickerTitle}>Work Start Date</Text>
                  <Pressable onPress={() => setShowStartPicker(false)}>
                    <Text style={styles.datePickerDone}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={startDate ? new Date(startDate) : new Date()}
                  mode="date"
                  display="spinner"
                  onChange={(_event, date) => {
                    if (date) setStartDate(date.toISOString());
                  }}
                  textColor={theme.colors.text}
                />
              </View>
            </Pressable>
          </Modal>
        )}
        {Platform.OS === "android" && showStartPicker && (
          <DateTimePicker
            value={startDate ? new Date(startDate) : new Date()}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowStartPicker(false);
              if (event.type === "set" && date) setStartDate(date.toISOString());
            }}
          />
        )}
        {Platform.OS === "ios" && showCompletionPicker && (
          <Modal transparent animationType="fade" visible={showCompletionPicker}>
            <Pressable style={styles.datePickerOverlay} onPress={() => setShowCompletionPicker(false)}>
              <View style={styles.datePickerModal}>
                <View style={styles.datePickerHeader}>
                  <Pressable onPress={() => setShowCompletionPicker(false)}>
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </Pressable>
                  <Text style={styles.datePickerTitle}>Completion Date</Text>
                  <Pressable onPress={() => setShowCompletionPicker(false)}>
                    <Text style={styles.datePickerDone}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={completionDate ? new Date(completionDate) : (startDate ? new Date(startDate) : new Date())}
                  mode="date"
                  display="spinner"
                  minimumDate={startDate ? new Date(startDate) : undefined}
                  onChange={(_event, date) => {
                    if (date) setCompletionDate(date.toISOString());
                  }}
                  textColor={theme.colors.text}
                />
              </View>
            </Pressable>
          </Modal>
        )}
        {Platform.OS === "android" && showCompletionPicker && (
          <DateTimePicker
            value={completionDate ? new Date(completionDate) : (startDate ? new Date(startDate) : new Date())}
            mode="date"
            display="default"
            minimumDate={startDate ? new Date(startDate) : undefined}
            onChange={(event, date) => {
              setShowCompletionPicker(false);
              if (event.type === "set" && date) setCompletionDate(date.toISOString());
            }}
          />
        )}

        {/* Materials Summary */}
        {contract.materials && contract.materials.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Materials ({contract.materials.length} items)</Text>
            <View style={styles.card}>
              {contract.materials.map((item, index) => (
                <View key={item.id || index} style={[styles.materialRow, index === contract.materials.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>{item.name}</Text>
                    <Text style={styles.materialDetails}>${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {item.qty}</Text>
                  </View>
                  <Text style={styles.materialTotal}>${(item.unitPrice * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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
                  {contract.status === "draft" ? (
                    <Pressable
                      style={styles.clearSignatureButton}
                      onPress={() => handleClearSignature(
                        contract.signatures!.find(s => s.signerType === "contractor")!.id,
                        "contractor"
                      )}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={theme.colors.muted} />
                      <Text style={styles.clearSignatureText}>Clear Signature</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.signatureLockedHint}>
                      To change this signature, use Revert to Draft below.
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.signaturePending}>
                  <Ionicons name="create-outline" size={24} color={theme.colors.muted} />
                  <Text style={styles.signaturePendingText}>Not signed yet</Text>
                  {contract.status === "draft" ? (
                    <Pressable style={styles.signButton} onPress={handleSignContract}>
                      <Text style={styles.signButtonText}>Sign Now</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.signatureLockedHint}>
                      To sign, use Revert to Draft below.
                    </Text>
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

      {/* Bottom Action Bar — single morph button. Label and handler derive
          from status + signature presence. Rollback ("Revert to Draft") lives
          up by the status badge, not here. */}
      <View style={styles.bottomBar}>
        <MorphActionButton
          status={contract.status}
          hasContractorSig={hasContractorSig}
          styles={styles}
          onSign={handleSignContract}
          onSend={handleSendContract}
          onShare={handleShareLink}
          onComplete={handleMarkComplete}
        />
      </View>
    </>
  );
}

type MorphProps = {
  status: Contract["status"];
  hasContractorSig: boolean;
  styles: ReturnType<typeof createStyles>;
  onSign: () => void;
  onSend: () => void;
  onShare: () => void;
  onComplete: () => void;
};

function MorphActionButton({
  status,
  hasContractorSig,
  styles,
  onSign,
  onSend,
  onShare,
  onComplete,
}: MorphProps) {
  // Draft: nothing signed → Sign. Contractor signed → Send.
  if (status === "draft") {
    if (!hasContractorSig) {
      return (
        <Pressable style={[styles.buttonPrimary, styles.buttonFull]} onPress={onSign}>
          <Ionicons name="create-outline" size={20} color="#000" />
          <Text style={styles.buttonPrimaryText}>Sign</Text>
        </Pressable>
      );
    }
    return (
      <Pressable style={[styles.buttonPrimary, styles.buttonFull]} onPress={onSend}>
        <Ionicons name="send-outline" size={20} color="#000" />
        <Text style={styles.buttonPrimaryText}>Send to Client</Text>
      </Pressable>
    );
  }

  // Sent or Viewed: contract is with the client. Show Share (re-send link).
  if (status === "sent" || status === "viewed") {
    return (
      <Pressable style={[styles.buttonPrimary, styles.buttonFull]} onPress={onShare}>
        <Ionicons name="share-outline" size={20} color="#000" />
        <Text style={styles.buttonPrimaryText}>Share Link</Text>
      </Pressable>
    );
  }

  // Signed: client has signed, ready to mark complete when work is done.
  if (status === "signed") {
    return (
      <Pressable style={[styles.buttonPrimary, styles.buttonFull]} onPress={onComplete}>
        <Ionicons name="checkmark-done-outline" size={20} color="#000" />
        <Text style={styles.buttonPrimaryText}>Mark Complete</Text>
      </Pressable>
    );
  }

  // Completed / declined / expired — terminal states, no forward action.
  // Show an informational tag matching previous behavior for completed.
  if (status === "completed") {
    return (
      <View style={styles.completedInfo}>
        <Ionicons name="checkmark-done-circle" size={20} color="#5856D6" />
        <Text style={styles.completedText}>Work Completed — Ready to Invoice</Text>
      </View>
    );
  }

  return null;
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
    statusGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
      flexShrink: 1,
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
    dateInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dateInputText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    dateInputPlaceholder: {
      fontSize: 16,
      color: theme.colors.muted,
    },
    dateInputClear: {
      fontSize: 13,
      color: theme.colors.accent,
      fontWeight: "600",
    },
    addToCalendarButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: theme.spacing(1),
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      backgroundColor: "transparent",
    },
    addToCalendarText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    datePickerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    datePickerModal: {
      backgroundColor: theme.colors.card,
      paddingBottom: theme.spacing(3),
    },
    datePickerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    datePickerTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    datePickerCancel: {
      fontSize: 15,
      color: theme.colors.muted,
    },
    datePickerDone: {
      fontSize: 15,
      color: theme.colors.accent,
      fontWeight: "700",
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
    },
    buttonFull: {
      alignSelf: "stretch",
      flex: 1,
    },
    revertLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    revertLinkText: {
      fontSize: 13,
      color: theme.colors.muted,
      textDecorationLine: "underline",
    },
    anomalyBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
      marginBottom: theme.spacing(3),
      backgroundColor: "#FEF3C7",
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: "#FCD34D",
    },
    responseBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
      marginBottom: theme.spacing(3),
      backgroundColor: "#FEF3C7",
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: "#F59E0B",
    },
    responseTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: "#92400E",
      marginBottom: 6,
    },
    responseBody: {
      fontSize: 13,
      lineHeight: 18,
      color: "#78350F",
      marginTop: 8,
    },
    responseQuote: {
      fontSize: 13,
      lineHeight: 19,
      color: "#78350F",
      fontStyle: "italic",
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: "rgba(255,255,255,0.6)",
      borderLeftWidth: 3,
      borderLeftColor: "#B45309",
      borderRadius: 4,
    },
    declinedBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing(1.5),
      padding: theme.spacing(2),
      marginBottom: theme.spacing(3),
      backgroundColor: "#FEE2E2",
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: "#FCA5A5",
    },
    declinedTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: "#991B1B",
      marginBottom: 6,
    },
    anomalyTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: "#92400E",
      marginBottom: 4,
    },
    anomalyBody: {
      fontSize: 13,
      lineHeight: 18,
      color: "#78350F",
    },
    anomalyAction: {
      marginTop: theme.spacing(1),
      alignSelf: "flex-start",
      backgroundColor: "#B45309",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.md,
    },
    anomalyActionText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#FFFFFF",
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
    clearSignatureButton: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: theme.spacing(1.5),
      gap: 4,
    },
    clearSignatureText: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    signatureLockedHint: {
      fontSize: 12,
      color: theme.colors.muted,
      fontStyle: "italic",
      marginTop: theme.spacing(1),
      textAlign: "center",
      paddingHorizontal: theme.spacing(2),
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
