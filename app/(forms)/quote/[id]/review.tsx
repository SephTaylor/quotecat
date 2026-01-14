// app/(forms)/quote/[id]/review.tsx
import { router, Stack, useLocalSearchParams } from "expo-router";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  ActionSheetIOS,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getQuoteById } from "@/lib/quotes";
import type { Quote } from "@/lib/quotes";
import { calculateQuoteTotals } from "@/lib/calculations";
import { useTheme } from "@/contexts/ThemeContext";
import { getUserState, incrementPdfCount, incrementSpreadsheetCount } from "@/lib/user";
import { canExportPDF, canExportSpreadsheet, getQuotaRemaining } from "@/lib/features";
import type { UserState } from "@/lib/user";
import { generateAndSharePDF } from "@/lib/pdf";
import { generateAndShareSpreadsheet } from "@/lib/spreadsheet";
import { loadPreferences, type CompanyDetails } from "@/lib/preferences";
import { getCompanyLogo, type CompanyLogo } from "@/lib/logo";
import { createInvoiceFromQuote } from "@/lib/invoices";
import { createContractFromQuote } from "@/lib/contracts";
import { ChangeOrderList } from "@/modules/changeOrders/ui";

export default function QuoteReviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const qid = Array.isArray(params.id) ? params.id[0] : (params.id ?? null);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [logo, setLogo] = useState<CompanyLogo | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingSpreadsheet, setIsExportingSpreadsheet] = useState(false);
  const [showPercentageModal, setShowPercentageModal] = useState(false);
  const [percentageInput, setPercentageInput] = useState("");
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [selectedDueDate, setSelectedDueDate] = useState<Date>(new Date());
  const [pendingInvoicePercentage, setPendingInvoicePercentage] = useState<number>(100);
  const [isCreatingContract, setIsCreatingContract] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!qid) return;
        const [q, user, prefs] = await Promise.all([
          getQuoteById(qid),
          getUserState(),
          loadPreferences()
        ]);
        setQuote(q ?? null);
        setUserState(user);
        setCompanyDetails(prefs.company);

        // Load logo from local storage
        try {
          const companyLogo = await getCompanyLogo();
          setLogo(companyLogo);
        } catch (error) {
          console.error("Failed to load logo:", error);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [qid]);

  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  // Use centralized calculation (markup on line items only, includes tax)
  const totals = quote ? calculateQuoteTotals(quote) : null;
  const materialsFromItems = totals?.materialsFromItems ?? 0;
  const materialEstimate = totals?.materialEstimate ?? 0;
  const labor = totals?.labor ?? 0;
  const markupPercent = totals?.markupPercent ?? 0;
  const markupAmount = totals?.markupAmount ?? 0;
  const subtotal = totals?.subtotal ?? 0;
  const taxAmount = totals?.taxAmount ?? 0;
  const grandTotal = totals?.total ?? 0;

  const handleExportPDF = async () => {
    if (!userState || !quote) return;

    const { allowed, reason, remaining } = canExportPDF(userState);

    if (!allowed) {
      Alert.alert(
        "Limit Reached",
        reason,
        [
          { text: "OK", style: "cancel" }
        ]
      );
      return;
    }

    const exportPDF = async () => {
      try {
        setIsExporting(true);

        // Generate PDF with or without branding based on tier
        // Strip data URL prefix if present - PDF template adds it back
        const rawBase64 = logo?.base64?.replace(/^data:image\/\w+;base64,/, '');
        await generateAndSharePDF(quote, {
          includeBranding: userState.tier === "free",
          companyDetails: companyDetails ?? undefined,
          logoBase64: rawBase64
        });

        // Increment counter for free users
        // Note: expo-sharing doesn't tell us if user cancelled, but the confirmation
        // dialog before export means user has already committed to using an export
        if (userState.tier === "free") {
          await incrementPdfCount();
          // Update local state to reflect new count
          const updatedState = await getUserState();
          setUserState(updatedState);
        }

      } catch (error) {
        Alert.alert("Error", "Failed to generate PDF. Please try again.");
        console.error("PDF generation error:", error);
      } finally {
        setIsExporting(false);
      }
    };

    // Show remaining for free users
    if (userState.tier === "free" && remaining !== undefined) {
      Alert.alert(
        "Export PDF",
        `This will use 1 of your ${remaining} remaining PDF exports.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Export", onPress: exportPDF }
        ]
      );
    } else {
      // Pro user - just export
      await exportPDF();
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Quote Review",
            headerShown: true,
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </>
    );
  }

  if (!qid || !quote) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Quote Review",
            headerShown: true,
            headerTitleAlign: 'center',
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
            headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <View style={styles.center}>
          <Text style={styles.errorText}>Quote not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const pdfRemaining = userState ? getQuotaRemaining(userState, "pdfs") : 0;
  const spreadsheetRemaining = userState ? getQuotaRemaining(userState, "spreadsheets") : 0;
  const isPro = userState?.tier === "pro";
  const isPremium = userState?.tier === "premium";

  const handleExportSpreadsheet = async () => {
    if (!userState || !quote) return;

    const { allowed, reason, remaining } = canExportSpreadsheet(userState);

    if (!allowed) {
      Alert.alert(
        "Limit Reached",
        reason,
        [
          { text: "OK", style: "cancel" }
        ]
      );
      return;
    }

    const exportSheet = async () => {
      try {
        setIsExportingSpreadsheet(true);

        // Generate CSV spreadsheet
        await generateAndShareSpreadsheet(quote);

        // Increment counter for free users
        if (userState.tier === "free") {
          await incrementSpreadsheetCount();
          // Update local state to reflect new count
          const updatedState = await getUserState();
          setUserState(updatedState);
        }

      } catch (error) {
        Alert.alert("Error", "Failed to generate spreadsheet. Please try again.");
        console.error("Spreadsheet generation error:", error);
      } finally {
        setIsExportingSpreadsheet(false);
      }
    };

    // Show remaining for free users
    if (userState.tier === "free" && remaining !== undefined) {
      Alert.alert(
        "Export Spreadsheet",
        `This will use 1 of your ${remaining} remaining spreadsheet exports.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Export", onPress: exportSheet }
        ]
      );
    } else {
      // Pro user - just export
      await exportSheet();
    }
  };

  const showDueDatePicker = (percentage: number) => {
    // Set default due date to 30 days from now
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    setSelectedDueDate(defaultDueDate);
    setPendingInvoicePercentage(percentage);
    setShowDueDateModal(true);
  };

  const handleCreateInvoice = async () => {
    if (!quote) return;

    try {
      const invoice = await createInvoiceFromQuote(quote.id, pendingInvoicePercentage, selectedDueDate);
      const isPartial = pendingInvoicePercentage !== 100;
      setShowDueDateModal(false);
      Alert.alert(
        "Success!",
        `${isPartial ? pendingInvoicePercentage + '% down payment invoice' : 'Invoice'} ${invoice.invoiceNumber} created successfully!`,
        [{ text: "OK" }]
      );
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create invoice",
        [{ text: "OK" }]
      );
    }
  };

  const handleDepositInvoice = () => {
    if (Platform.OS === "ios") {
      Alert.prompt(
        "Down Payment Invoice",
        "Enter the down payment percentage (1-99):",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Next",
            onPress: (value: string | undefined) => {
              const percentage = parseInt(value || "0", 10);
              if (percentage > 0 && percentage < 100) {
                showDueDatePicker(percentage);
              } else {
                Alert.alert("Invalid Percentage", "Please enter a number between 1 and 99.");
              }
            },
          },
        ],
        "plain-text",
        "",
        "number-pad"
      );
    } else {
      // Android - show custom modal with text input
      setPercentageInput("");
      setShowPercentageModal(true);
    }
  };

  const handlePercentageSubmit = () => {
    const percentage = parseInt(percentageInput || "0", 10);
    if (percentage > 0 && percentage < 100) {
      setShowPercentageModal(false);
      showDueDatePicker(percentage);
    } else {
      Alert.alert("Invalid Percentage", "Please enter a number between 1 and 99.");
    }
  };

  const handleCreateContract = async () => {
    if (!quote) return;

    try {
      setIsCreatingContract(true);
      const contract = await createContractFromQuote(quote);
      if (contract) {
        Alert.alert(
          "Contract Created",
          `Contract ${contract.contractNumber} created successfully.`,
          [
            {
              text: "View Contract",
              onPress: () => router.push(`/(forms)/contract/${contract.id}/edit`),
            },
            { text: "OK" },
          ]
        );
      } else {
        Alert.alert("Error", "Failed to create contract. Please try again.");
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to create contract"
      );
    } finally {
      setIsCreatingContract(false);
    }
  };

  const showExportMenu = () => {
    // Build options based on user tier
    const options = [
      "Export as PDF",
      "Export as CSV",
    ];

    // Add invoice options for Pro/Premium users
    if (isPro || isPremium) {
      options.push("Create Full Invoice");
      options.push("Create Down Payment Invoice");
    }

    // Add contract option for Premium users
    if (isPremium) {
      options.push("Create Contract");
    }

    options.push("Cancel");

    const cancelIndex = options.length - 1;

    const handleSelection = (buttonIndex: number) => {
      const selectedOption = options[buttonIndex];
      switch (selectedOption) {
        case "Export as PDF":
          handleExportPDF();
          break;
        case "Export as CSV":
          handleExportSpreadsheet();
          break;
        case "Create Full Invoice":
          showDueDatePicker(100);
          break;
        case "Create Down Payment Invoice":
          handleDepositInvoice();
          break;
        case "Create Contract":
          handleCreateContract();
          break;
        // Cancel - do nothing
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          title: "Export Options",
        },
        handleSelection
      );
    } else {
      // Android - use Alert with buttons (limited to 3 for best UX, show as nested menus)
      const androidButtons: { text: string; onPress?: () => void; style?: "cancel" | "default" | "destructive" }[] = [
        { text: "Export as PDF", onPress: () => handleExportPDF() },
        { text: "Export as CSV", onPress: () => handleExportSpreadsheet() },
      ];

      // Add invoice option for Pro/Premium users
      if (isPro || isPremium) {
        androidButtons.push({
          text: "Create Invoice...",
          onPress: () => {
            // Show invoice submenu
            Alert.alert(
              "Create Invoice",
              "Select invoice type",
              [
                { text: "Full Invoice", onPress: () => showDueDatePicker(100) },
                { text: "Down Payment Invoice", onPress: () => handleDepositInvoice() },
                { text: "Cancel", style: "cancel" },
              ],
              { cancelable: true }
            );
          }
        });
      }

      // Add contract option for Premium users
      if (isPremium) {
        androidButtons.push({
          text: "Create Contract",
          onPress: () => handleCreateContract(),
        });
      }

      androidButtons.push({ text: "Cancel", style: "cancel" });

      Alert.alert(
        "Export Options",
        "Choose an export format",
        androidButtons,
        { cancelable: true }
      );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Quote Review",
          headerShown: true,
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
          headerLeft: () => <HeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Logo Preview */}
        {logo?.base64 && (
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: logo.base64 }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Company Details Section */}
        {companyDetails && (companyDetails.companyName || companyDetails.email || companyDetails.phone || companyDetails.website || companyDetails.address) && (
          <View style={styles.companyCard}>
            {companyDetails.companyName && (
              <Text style={styles.companyName}>{companyDetails.companyName}</Text>
            )}
            {companyDetails.email && (
              <Text style={styles.companyDetail}>Email: {companyDetails.email}</Text>
            )}
            {companyDetails.phone && (
              <Text style={styles.companyDetail}>Phone: {companyDetails.phone}</Text>
            )}
            {companyDetails.website && (
              <Text style={styles.companyDetail}>Website: {companyDetails.website}</Text>
            )}
            {companyDetails.address && (
              <Text style={styles.companyDetail}>{companyDetails.address}</Text>
            )}
          </View>
        )}

        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.projectName}>{quote.name || "Untitled Quote"}</Text>
          {quote.clientName && (
            <Text style={styles.clientName}>For: {quote.clientName}</Text>
          )}
          <Text style={styles.dateText}>
            {new Date(quote.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Line Items */}
        {quote.items && quote.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Materials</Text>
            <View style={styles.itemsCard}>
              {quote.items.map((item, index) => (
                <View
                  key={item.id || index}
                  style={[
                    styles.itemRow,
                    index === quote.items.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDetails}>
                      ${item.unitPrice.toFixed(2)} × {item.qty}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>
                    ${(item.unitPrice * item.qty).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Totals Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>
          {markupAmount > 0 && (
            <Text style={styles.exportNote}>
              Note: Detailed breakdown shown here. PDF export shows simplified total only.
            </Text>
          )}
          <View style={styles.totalsCard}>
            {materialsFromItems > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Materials</Text>
                <Text style={styles.totalValue}>${materialsFromItems.toFixed(2)}</Text>
              </View>
            )}

            {materialEstimate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Materials (Estimate)</Text>
                <Text style={styles.totalValue}>${materialEstimate.toFixed(2)}</Text>
              </View>
            )}

            {labor > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Labor</Text>
                <Text style={styles.totalValue}>${labor.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.subtotalLabel}>Subtotal</Text>
              <Text style={styles.subtotalValue}>${subtotal.toFixed(2)}</Text>
            </View>

            {markupAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Markup ({markupPercent}%)</Text>
                <Text style={styles.totalValue}>${markupAmount.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.dividerBold} />

            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>${grandTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Change History Section - shows tracked changes */}
        {quote.changeHistory && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Change History</Text>
            <View style={styles.changeHistoryCard}>
              <Text style={styles.changeHistoryText}>{quote.changeHistory}</Text>
            </View>
          </View>
        )}

        {/* Change Orders Section - Pro/Premium only */}
        {(isPro || isPremium) && qid && (
          <ChangeOrderList quoteId={qid} theme={theme} limit={3} />
        )}

        {/* Export Info for Free Users */}
        {!isPro && !isPremium && (
          <View style={styles.promoCard}>
            <View style={styles.promoHeader}>
              <Text style={styles.promoTitle}>Free Tier</Text>
            </View>
            <Text style={styles.promoText}>
              {pdfRemaining} PDF export{pdfRemaining !== 1 ? "s" : ""} remaining
            </Text>
            <Text style={styles.promoText}>
              {spreadsheetRemaining} spreadsheet export{spreadsheetRemaining !== 1 ? "s" : ""} remaining
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.buttonLarge, styles.buttonPrimary, (isExporting || isExportingSpreadsheet || isCreatingContract) && styles.buttonDisabled]}
          onPress={showExportMenu}
          disabled={isExporting || isExportingSpreadsheet || isCreatingContract}
        >
          <Text style={styles.buttonPrimaryText}>
            {isCreatingContract ? "Creating..." : (isExporting || isExportingSpreadsheet) ? "..." : "Export"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.buttonSmall, styles.buttonSecondary]}
          onPress={() => router.push("/(main)/(tabs)/quotes")}
        >
          <Text style={styles.buttonSecondaryText}>Done</Text>
        </Pressable>
      </View>

      {/* Percentage Input Modal (Android) */}
      <Modal
        visible={showPercentageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPercentageModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPercentageModal(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Down Payment Invoice</Text>
            <Text style={styles.modalDescription}>Enter the down payment percentage (1-99):</Text>
            <TextInput
              style={styles.modalInput}
              value={percentageInput}
              onChangeText={setPercentageInput}
              keyboardType="number-pad"
              placeholder="e.g., 50"
              placeholderTextColor={theme.colors.muted}
              autoFocus
              maxLength={2}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowPercentageModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCreate]}
                onPress={handlePercentageSubmit}
              >
                <Text style={styles.modalButtonCreateText}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Due Date Picker - iOS */}
      {Platform.OS === "ios" && showDueDateModal && (
        <Modal
          visible={showDueDateModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDueDateModal(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowDueDateModal(false)}
          >
            <Pressable
              style={styles.datePickerModal}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShowDueDateModal(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle}>Select Due Date</Text>
                <Pressable onPress={handleCreateInvoice}>
                  <Text style={styles.modalDone}>Create</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={selectedDueDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => date && setSelectedDueDate(date)}
                textColor={theme.colors.text}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Due Date Picker - Android */}
      {Platform.OS === "android" && showDueDateModal && (
        <DateTimePicker
          value={selectedDueDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDueDateModal(false);
            if (event.type === "set" && date) {
              setSelectedDueDate(date);
              handleCreateInvoice();
            }
          }}
        />
      )}
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
      paddingBottom: theme.spacing(12),
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.bg,
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
    logoContainer: {
      alignItems: "flex-start",
      marginBottom: theme.spacing(2),
      height: 40,
    },
    logoImage: {
      height: 40,
      width: 120,
    },
    companyCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(3),
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.accent,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    companyName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    companyDetail: {
      fontSize: 13,
      color: theme.colors.muted,
      marginBottom: 4,
    },
    header: {
      marginBottom: theme.spacing(3),
      paddingBottom: theme.spacing(2),
      borderBottomWidth: 2,
      borderBottomColor: theme.colors.accent,
    },
    projectName: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    clientName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
    },
    dateText: {
      fontSize: 14,
      color: theme.colors.muted,
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
    exportNote: {
      fontSize: 12,
      fontStyle: "italic",
      color: theme.colors.muted,
      marginBottom: theme.spacing(1),
    },
    itemsCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    itemRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemLeft: {
      flex: 1,
      marginRight: theme.spacing(2),
    },
    itemName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    itemDetails: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    itemTotal: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    totalsCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    totalLabel: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    totalValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    subtotalLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtotalValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing(1.5),
    },
    dividerBold: {
      height: 2,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing(1.5),
    },
    grandTotalLabel: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
    },
    grandTotalValue: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    promoCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      padding: theme.spacing(2),
      marginTop: theme.spacing(2),
    },
    promoHeader: {
      marginBottom: theme.spacing(1.5),
      paddingBottom: theme.spacing(1),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    promoTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.text,
    },
    promoText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 6,
    },
    promoSubtext: {
      fontSize: 12,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1.5),
    },
    upgradeButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing(1.5),
      paddingHorizontal: theme.spacing(2),
      borderRadius: theme.radius.md,
      alignItems: "center",
      marginTop: theme.spacing(1),
    },
    upgradeButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#000",
    },
    bottomBar: {
      flexDirection: "row",
      padding: theme.spacing(2),
      paddingBottom: Math.max(theme.spacing(2), insets.bottom), // Respect Android nav bar
      backgroundColor: theme.colors.bg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: theme.spacing(2),
    },
    button: {
      flex: 1,
      height: 48,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonSmall: {
      flex: 1,
      height: 48,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonLarge: {
      flex: 2,
      height: 48,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonSecondary: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonSecondaryText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    buttonPrimary: {
      backgroundColor: theme.colors.accent,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonPrimaryText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#000",
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(3),
      width: "100%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    modalDescription: {
      fontSize: 14,
      color: theme.colors.muted,
      marginBottom: theme.spacing(2),
    },
    modalInput: {
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    modalButtons: {
      flexDirection: "row",
      gap: theme.spacing(2),
    },
    modalButton: {
      flex: 1,
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    modalButtonCancel: {
      backgroundColor: theme.colors.bg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonCancelText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    modalButtonCreate: {
      backgroundColor: theme.colors.accent,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonCreateText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#000",
    },
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.spacing(3),
    },
    datePickerModal: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      width: "100%",
      paddingBottom: theme.spacing(4),
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalCancel: {
      fontSize: 16,
      color: theme.colors.muted,
      fontWeight: "600",
    },
    modalDone: {
      fontSize: 16,
      color: theme.colors.accent,
      fontWeight: "700",
    },
    changeHistoryCard: {
      backgroundColor: "#FFF9F0",
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: "#F59E0B",
      padding: theme.spacing(2),
    },
    changeHistoryText: {
      fontSize: 13,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: "#333",
      lineHeight: 20,
    },
  });
}
