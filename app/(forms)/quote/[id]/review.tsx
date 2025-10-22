// app/(forms)/quote/[id]/review.tsx
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Linking,
} from "react-native";
import { getQuoteById } from "@/lib/quotes";
import type { Quote } from "@/lib/quotes";
import { useTheme } from "@/contexts/ThemeContext";
import { getUserState, saveUserState } from "@/lib/user";
import { canExportPDF, canExportSpreadsheet, getQuotaRemaining } from "@/lib/features";
import type { UserState } from "@/lib/user";
import { generateAndSharePDF } from "@/lib/pdf";
import { generateAndShareSpreadsheet } from "@/lib/spreadsheet";

export default function QuoteReviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const qid = Array.isArray(params.id) ? params.id[0] : (params.id ?? null);
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingSpreadsheet, setIsExportingSpreadsheet] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!qid) return;
        const [q, user] = await Promise.all([getQuoteById(qid), getUserState()]);
        setQuote(q ?? null);
        setUserState(user);
      } finally {
        setLoading(false);
      }
    })();
  }, [qid]);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Calculate totals
  const materialsFromItems = quote?.items?.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  ) ?? 0;

  const materialEstimate = quote?.materialEstimate ?? 0;
  const labor = quote?.labor ?? 0;
  const overhead = quote?.overhead ?? 0;
  const markupPercent = quote?.markupPercent ?? 0;

  const subtotal = materialsFromItems + materialEstimate + labor + overhead;
  const markupAmount = (subtotal * markupPercent) / 100;
  const grandTotal = subtotal + markupAmount;

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
        await generateAndSharePDF(quote, {
          includeBranding: userState.tier === "free"
        });

        // Increment PDF count for free users
        if (userState.tier === "free") {
          const updatedState = {
            ...userState,
            pdfsThisMonth: userState.pdfsThisMonth + 1,
          };
          await saveUserState(updatedState);
          setUserState(updatedState);
        }

        Alert.alert("Success", "PDF shared successfully!");
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
        `This will use 1 of your ${remaining} remaining PDF exports this month.\n\nFree PDFs include QuoteCat branding. Upgrade to Pro for unlimited exports with your own branding.`,
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
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
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
            headerStyle: {
              backgroundColor: theme.colors.bg,
            },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: {
              color: theme.colors.text,
            },
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

        // Increment spreadsheet count for free users
        if (userState.tier === "free") {
          const updatedState = {
            ...userState,
            spreadsheetsThisMonth: userState.spreadsheetsThisMonth + 1,
          };
          await saveUserState(updatedState);
          setUserState(updatedState);
        }

        Alert.alert("Success", "Spreadsheet shared successfully!");
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
        `This will use your ${remaining} remaining spreadsheet export this month.\n\nSpreadsheet exports work in Excel, Google Sheets, Numbers, and accounting software. Upgrade to Pro for unlimited exports.`,
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

  return (
    <>
      <Stack.Screen
        options={{
          title: "Quote Review",
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

            {overhead > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Overhead</Text>
                <Text style={styles.totalValue}>${overhead.toFixed(2)}</Text>
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

        {/* Export Info for Free Users */}
        {!isPro && (
          <View style={styles.promoCard}>
            <View style={styles.promoHeader}>
              <Text style={styles.promoTitle}>Free Tier</Text>
            </View>
            <Text style={styles.promoText}>
              {pdfRemaining} PDF export{pdfRemaining !== 1 ? "s" : ""} remaining this month
            </Text>
            <Text style={styles.promoText}>
              {spreadsheetRemaining} spreadsheet export{spreadsheetRemaining !== 1 ? "s" : ""} remaining this month
            </Text>
            <Text style={styles.promoSubtext}>
              Upgrade for unlimited exports, custom branding, and more
            </Text>
            <Pressable
              style={styles.upgradeButton}
              onPress={() => {
                // TODO: Navigate to upgrade screen or website
                Alert.alert(
                  "Upgrade to Pro",
                  "Get unlimited PDF and spreadsheet exports, remove QuoteCat branding, and unlock premium features.\n\nVisit https://www.quotecat.ai to learn more.",
                  [{ text: "OK" }]
                );
              }}
            >
              <Text style={styles.upgradeButtonText}>Learn About Pro</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.buttonSmall, styles.buttonSecondary]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonSecondaryText}>Edit</Text>
        </Pressable>

        <Pressable
          style={[styles.buttonSmall, styles.buttonPrimary, isExporting && styles.buttonDisabled]}
          onPress={handleExportPDF}
          disabled={isExporting}
        >
          <Text style={styles.buttonPrimaryText}>
            {isExporting ? "..." : "PDF"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.buttonSmall, styles.buttonPrimary, isExportingSpreadsheet && styles.buttonDisabled]}
          onPress={handleExportSpreadsheet}
          disabled={isExportingSpreadsheet}
        >
          <Text style={styles.buttonPrimaryText}>
            {isExportingSpreadsheet ? "..." : "Spreadsheet"}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
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
  });
}
