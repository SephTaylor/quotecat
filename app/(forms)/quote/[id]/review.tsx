// app/(forms)/quote/[id]/review.tsx
import { router, Stack, useLocalSearchParams } from "expo-router";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { Ionicons } from "@expo/vector-icons";
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
  Share,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getQuoteById, updateQuote } from "@/lib/quotes";
import type { Quote } from "@/lib/quotes";
import { calculateQuoteTotals, calculateQuoteProfitability, getMarginColor, getMarginIcon } from "@/lib/calculations";
import type { OverheadSettings } from "@/lib/preferences";
import { useTheme } from "@/contexts/ThemeContext";
import { useTechContext } from "@/contexts/TechContext";
import { getUserState, consumeUsage } from "@/lib/user";
import { canExportPDF, canExportSpreadsheet, getQuotaRemaining } from "@/lib/features";
import type { UserState } from "@/lib/user";
import { generateAndSharePDF, generateAndShareMultiTierPDF } from "@/lib/pdf";
import { getLinkedQuotes } from "@/lib/quotes";
import { generateAndShareSpreadsheet } from "@/lib/spreadsheet";
import { presentPaywallAndSync } from "@/lib/revenuecat";
import { loadPreferences, type CompanyDetails, type PaymentMethods } from "@/lib/preferences";
import { getCompanyLogo, type CompanyLogo } from "@/lib/logo";
import { createInvoiceFromQuote } from "@/lib/invoices";
import { createContractFromQuote } from "@/lib/contracts";
import { uploadQuote } from "@/lib/quotesSync";
import { getLocalTeamMembers } from "@/lib/teamMembersSync";
import type { TeamMember } from "@/lib/types";
import { ChangeOrderList } from "@/modules/changeOrders/ui";
import { trackEvent, AnalyticsEvents } from "@/lib/app-analytics";

export default function QuoteReviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const qid = Array.isArray(params.id) ? params.id[0] : (params.id ?? null);
  const { theme } = useTheme();
  const { effectiveTier } = useTechContext();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);
  const [logo, setLogo] = useState<CompanyLogo | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingSpreadsheet, setIsExportingSpreadsheet] = useState(false);
  const [showPercentageModal, setShowPercentageModal] = useState(false);
  const [percentageInput, setPercentageInput] = useState("");
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [selectedDueDate, setSelectedDueDate] = useState<Date>(new Date());
  const [pendingInvoicePercentage, setPendingInvoicePercentage] = useState<number>(100);
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [targetMaterialsMarginPercent, setTargetMaterialsMarginPercent] = useState(0);
  const [overheadSettings, setOverheadSettings] = useState<OverheadSettings | undefined>(undefined);
  const [defaultLaborRate, setDefaultLaborRate] = useState(0);
  const [defaultLaborCostRate, setDefaultLaborCostRate] = useState(0);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (qid) trackEvent(AnalyticsEvents.REVIEW_OPENED, { quoteId: qid });
  }, [qid]);

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
        setPaymentMethods(prefs.paymentMethods);
        setTargetMaterialsMarginPercent(prefs.pricing?.targetMaterialsMarginPercent || 0);
        setOverheadSettings(prefs.overhead);
        setDefaultLaborRate(prefs.pricing?.defaultLaborRate || 0);
        setDefaultLaborCostRate(prefs.pricing?.defaultLaborCostRate || 0);

        // Load team members for per-worker cost rates
        const members = getLocalTeamMembers();
        setTeamMembers(members);

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
  const materialsMarginPercent = totals?.materialsMarginPercent ?? 0;
  const subtotal = totals?.subtotal ?? 0;
  const taxAmount = totals?.taxAmount ?? 0;
  const grandTotal = totals?.total ?? 0;

  // Calculate profitability (Pro/Premium with cost rate configured)
  const profitability = quote && defaultLaborCostRate > 0 && defaultLaborRate > 0
    ? calculateQuoteProfitability(quote, overheadSettings, { defaultLaborRate, defaultLaborCostRate }, teamMembers)
    : null;

  const handleExportPDF = async () => {
    if (!userState || !quote) return;

    const { allowed, reason, remaining } = canExportPDF(userState);

    if (!allowed) {
      Alert.alert(
        "Limit Reached",
        reason,
        [
          { text: "OK", style: "cancel" },
          { text: "Upgrade", onPress: () => presentPaywallAndSync() }
        ]
      );
      return;
    }

    // After a successful PDF export, offer to flip a Draft quote to Sent.
    // Sharing as a Link auto-flips status; PDF export historically did not, so
    // quotes silently stayed in Draft after being handed to the client.
    const promptMarkAsSent = () => {
      if (!quote || quote.status !== "draft") return;
      Alert.alert(
        "Mark this quote as Sent?",
        "Update its status now that the PDF has been exported?",
        [
          { text: "Not Now", style: "cancel" },
          {
            text: "Yes, mark as Sent",
            onPress: async () => {
              const updated = await updateQuote(quote.id, { status: "sent" });
              if (updated) setQuote(updated);
            },
          },
        ]
      );
    };

    // Export single quote PDF
    const exportSinglePDF = async () => {
      try {
        setIsExporting(true);

        // Atomic quota claim — server-enforced for signed-in users, local
        // fallback for anonymous. Pro/Premium short-circuit immediately.
        const usage = await consumeUsage("pdf");
        if (!usage.allowed) {
          Alert.alert("Limit Reached", usage.reason || "PDF export limit reached for this month.");
          return;
        }
        if (userState.tier === "free") {
          setUserState(await getUserState());
        }

        // Generate PDF with or without branding based on tier
        // Strip data URL prefix if present - PDF template adds it back
        const rawBase64 = logo?.base64?.replace(/^data:image\/\w+;base64,/, '');
        await generateAndSharePDF(quote, {
          includeBranding: userState.tier === "free",
          companyDetails: companyDetails ?? undefined,
          logoBase64: rawBase64,
          paymentMethods: paymentMethods ?? undefined,
        });

        promptMarkAsSent();

      } catch (error) {
        Alert.alert("Error", "Failed to generate PDF. Please try again.");
        console.error("PDF generation error:", error);
      } finally {
        setIsExporting(false);
      }
    };

    // Export all tier options as combined PDF
    const exportTierGroupPDF = async () => {
      try {
        setIsExporting(true);

        // Atomic quota claim before generation (counts as 1 export for all tiers).
        const usage = await consumeUsage("pdf");
        if (!usage.allowed) {
          Alert.alert("Limit Reached", usage.reason || "PDF export limit reached for this month.");
          return;
        }
        if (userState.tier === "free") {
          setUserState(await getUserState());
        }

        // Get all linked quotes including this one
        const linkedQuotes = await getLinkedQuotes(quote.id);

        const rawBase64 = logo?.base64?.replace(/^data:image\/\w+;base64,/, '');
        await generateAndShareMultiTierPDF(linkedQuotes, {
          includeBranding: userState.tier === "free",
          companyDetails: companyDetails ?? undefined,
          logoBase64: rawBase64,
          paymentMethods: paymentMethods ?? undefined,
        });

        promptMarkAsSent();

      } catch (error) {
        Alert.alert("Error", "Failed to generate PDF. Please try again.");
        console.error("PDF generation error:", error);
      } finally {
        setIsExporting(false);
      }
    };

    // Check if this quote is part of a tier group
    const isTierGroup = quote.tierGroupId || (quote.linkedQuoteIds && quote.linkedQuoteIds.length > 0);
    const isFreeUser = userState.tier === "free";

    // Build the export flow
    const proceedWithExport = async (exportAll: boolean) => {
      if (exportAll) {
        await exportTierGroupPDF();
      } else {
        await exportSinglePDF();
      }
    };

    // If tier group, ask which export option
    if (isTierGroup) {
      const tierName = quote.tier || "This Option";
      // Include remaining count for free users
      const message = isFreeUser && remaining !== undefined
        ? `This will use 1 of your ${remaining} remaining PDF exports.\n\nWould you like to export just this option or all pricing options?`
        : "Would you like to export just this option or all pricing options?";

      Alert.alert(
        "Export PDF",
        message,
        [
          { text: "Cancel", style: "cancel" },
          { text: `Just ${tierName}`, onPress: () => proceedWithExport(false) },
          { text: "All Options", onPress: () => proceedWithExport(true) },
        ]
      );
    } else if (isFreeUser && remaining !== undefined) {
      // Show remaining for free users (not a tier group)
      Alert.alert(
        "Export PDF",
        `This will use 1 of your ${remaining} remaining PDF exports.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Export", onPress: () => proceedWithExport(false) }
        ]
      );
    } else {
      // Pro user, not a tier group - just export
      await proceedWithExport(false);
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
  // Use effectiveTier from TechContext (techs inherit owner's tier)
  const isPro = effectiveTier === "pro" || effectiveTier === "premium";
  const isPremium = effectiveTier === "premium";

  const handleExportSpreadsheet = async () => {
    if (!userState || !quote) return;

    const { allowed, reason, remaining } = canExportSpreadsheet(userState);

    if (!allowed) {
      Alert.alert(
        "Limit Reached",
        reason,
        [
          { text: "OK", style: "cancel" },
          { text: "Upgrade", onPress: () => presentPaywallAndSync() }
        ]
      );
      return;
    }

    const exportSheet = async () => {
      try {
        setIsExportingSpreadsheet(true);

        // Atomic quota claim before generation.
        const usage = await consumeUsage("csv");
        if (!usage.allowed) {
          Alert.alert("Limit Reached", usage.reason || "Spreadsheet export limit reached for this month.");
          return;
        }
        if (userState.tier === "free") {
          setUserState(await getUserState());
        }

        // Generate CSV spreadsheet
        await generateAndShareSpreadsheet(quote);

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

    // Contracts can only be created from Approved/Completed quotes — lib/contracts.ts
    // returns null silently otherwise, which surfaces as a baffling "Failed to create
    // contract" error. Catch that path here and offer a one-tap status flip.
    let workingQuote: Quote = quote;
    if (quote.status !== "approved" && quote.status !== "completed") {
      const userApproved = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Mark this quote as Approved?",
          "Contracts are created from approved quotes. Mark this quote as Approved and continue?",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Mark Approved & Continue", onPress: () => resolve(true) },
          ]
        );
      });

      if (!userApproved) return;

      const updated = await updateQuote(quote.id, { status: "approved" });
      if (!updated) {
        Alert.alert("Error", "Could not update quote status. Please try again.");
        return;
      }
      workingQuote = updated;
      setQuote(updated);
    }

    try {
      setIsCreatingContract(true);
      const contract = await createContractFromQuote(workingQuote);
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

  const handleShareLink = async () => {
    if (!quote) return;

    try {
      // Ensure quote is synced to cloud before sharing
      const synced = await uploadQuote(quote);
      if (!synced) {
        Alert.alert(
          "Sync Required",
          "Unable to sync quote to cloud. Please check your internet connection and try again."
        );
        return;
      }

      const url = `https://portal.quotecat.ai/q/${quote.id}`;
      await Share.share({
        message: `View your quote for ${quote.name}: ${url}`,
        url, // iOS uses this for the share sheet
      });
    } catch (error) {
      console.error("Share link error:", error);
      Alert.alert("Error", "Failed to share quote link. Please try again.");
    }
  };

  const showExportMenu = () => {
    // Show every option to every tier with 🔒 prefix on tier-gated ones; tapping
    // a locked option fires the paywall. Converts the export menu from a hidden
    // list into a visible upgrade hook.
    const upgrade = () => { presentPaywallAndSync(); };
    // ActionSheetIOS / Android Alert can't render icons, so use Apple's
    // convention for tier-gated options: the tier name as a parenthesized
    // suffix. No emoji — keeps the menu native-feeling and on-brand.
    const lockLabel = (label: string, tier: "Pro" | "Premium") => `${label} (${tier})`;

    const menuItems: { label: string; action: () => void }[] = [
      { label: "Export as PDF", action: handleExportPDF },
      { label: "Export as CSV", action: handleExportSpreadsheet },
      isPro || isPremium
        ? { label: "Share as Link", action: handleShareLink }
        : { label: lockLabel("Share as Link", "Pro"), action: upgrade },
      isPro || isPremium
        ? { label: "Create Full Invoice", action: () => showDueDatePicker(100) }
        : { label: lockLabel("Create Full Invoice", "Pro"), action: upgrade },
      isPro || isPremium
        ? { label: "Create Down Payment Invoice", action: handleDepositInvoice }
        : { label: lockLabel("Create Down Payment Invoice", "Pro"), action: upgrade },
      isPremium
        ? { label: "Create Contract", action: handleCreateContract }
        : { label: lockLabel("Create Contract", "Premium"), action: upgrade },
    ];

    if (Platform.OS === "ios") {
      const options = [...menuItems.map(m => m.label), "Cancel"];
      const cancelIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          title: "Export Options",
        },
        (buttonIndex) => {
          if (buttonIndex === cancelIndex) return;
          menuItems[buttonIndex]?.action();
        }
      );
    } else {
      const androidButtons: { text: string; onPress?: () => void; style?: "cancel" | "default" | "destructive" }[] =
        menuItems.map(m => ({ text: m.label, onPress: () => m.action() }));
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
        {/* Logo Preview - Pro+ only */}
        {isPro && logo?.base64 && (
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: logo.base64 }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Company Details Section - Pro+ only */}
        {isPro && companyDetails && (companyDetails.companyName || companyDetails.email || companyDetails.phone || companyDetails.website || companyDetails.address) && (
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
                      ${item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {item.qty}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>
                    ${(item.unitPrice * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <Text style={styles.totalValue}>${materialsFromItems.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}

            {markupAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Markup ({markupPercent}%)</Text>
                <Text style={styles.totalValue}>${markupAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}

            {/* Materials Margin — shown to all tiers when there's a markup.
                Ungated 2026-05-26 (matches edit.tsx) so free users get the
                financial-intelligence recognition moment on the review screen
                too. Pro/Premium differentiation stays in cloud sync,
                unlimited exports, custom assemblies, contracts, team, etc. */}
            {markupAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Materials Margin</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {targetMaterialsMarginPercent > 0 && (
                    <View style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: materialsMarginPercent >= targetMaterialsMarginPercent
                        ? '#22c55e'
                        : materialsMarginPercent >= targetMaterialsMarginPercent - 5
                          ? '#eab308'
                          : '#ef4444',
                    }}>
                      <Ionicons
                        name={materialsMarginPercent >= targetMaterialsMarginPercent ? 'checkmark' : 'warning'}
                        size={12}
                        color="white"
                      />
                    </View>
                  )}
                  <Text style={styles.totalValue}>{materialsMarginPercent.toFixed(1)}%</Text>
                </View>
              </View>
            )}

            {materialEstimate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Materials (Estimate)</Text>
                <Text style={styles.totalValue}>${materialEstimate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}

            {labor > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Labor</Text>
                <Text style={styles.totalValue}>${labor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.subtotalLabel}>Subtotal</Text>
              <Text style={styles.subtotalValue}>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>

            {taxAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax ({totals?.taxPercent ?? 0}%)</Text>
                <Text style={styles.totalValue}>${taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}

            <View style={styles.dividerBold} />

            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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

        {/* Profitability Setup Prompt - State 1: Neither rate set.
            Ungated 2026-05-26 (matches edit.tsx) so free users get the entry
            point to configure their billable rate. */}
        {!profitability && defaultLaborRate === 0 && (
          <Pressable
            style={styles.section}
            onPress={() => router.push('/(main)/labor-rate-calculator')}
          >
            <View style={[styles.totalsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={[styles.totalLabel, { color: theme.colors.accent }]}>
                Set up billable rate to see profit
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.accent} />
            </View>
          </Pressable>
        )}

        {/* Profitability Setup Prompt - State 2: Billable set, cost rate missing.
            Ungated 2026-05-26 — see State 1 comment. */}
        {!profitability && defaultLaborRate > 0 && defaultLaborCostRate === 0 && (
          <Pressable
            style={styles.section}
            onPress={() => router.push('/(main)/business-settings')}
          >
            <View style={[styles.totalsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={[styles.totalLabel, { color: theme.colors.muted }]}>
                Add cost rate in Settings to see margin
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
            </View>
          </Pressable>
        )}

        {/* Profitability Section — shown to all tiers when overhead + cost
            rates are configured. Ungated 2026-05-26 to deliver the full
            financial-intelligence recognition moment on the review screen. */}
        {profitability && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profitability</Text>
            <View style={styles.totalsCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Revenue</Text>
                <Text style={styles.totalValue}>
                  ${profitability.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Materials Cost</Text>
                <Text style={[styles.totalValue, { color: theme.colors.muted }]}>
                  −${profitability.materialsCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Labor Cost</Text>
                <Text style={[styles.totalValue, { color: theme.colors.muted }]}>
                  −${profitability.laborCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Overhead ({overheadSettings?.overheadPercent?.toFixed(0) || 0}%)
                </Text>
                <Text style={[styles.totalValue, { color: theme.colors.muted }]}>
                  −${profitability.overheadCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={styles.dividerBold} />

              <View style={styles.totalRow}>
                <Text style={styles.subtotalLabel}>Profit</Text>
                <Text style={[styles.subtotalValue, { color: profitability.profit >= 0 ? '#22c55e' : '#ef4444' }]}>
                  ${profitability.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.subtotalLabel}>
                  Margin {overheadSettings?.targetProfitMarginPercent ? `(Target: ${overheadSettings.targetProfitMarginPercent}%)` : ''}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: getMarginColor(profitability.marginPercent, overheadSettings?.targetProfitMarginPercent),
                  }}>
                    <Ionicons
                      name={getMarginIcon(profitability.marginPercent, overheadSettings?.targetProfitMarginPercent) as any}
                      size={12}
                      color="white"
                    />
                  </View>
                  <Text style={[styles.subtotalValue, { color: getMarginColor(profitability.marginPercent, overheadSettings?.targetProfitMarginPercent) }]}>
                    {profitability.marginPercent.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
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
