// app/(forms)/quote/[id]/edit.tsx
import { useTheme } from "@/contexts/ThemeContext";
import {
  getQuoteById,
  updateQuote,
  deleteQuote,
  type Quote,
} from "@/lib/quotes";
import { FormInput, FormScreen } from "@/modules/core/ui";
import { parseMoney } from "@/modules/settings/money";
import { getItemId } from "@/lib/validation";
import type { QuoteStatus, QuoteItem } from "@/lib/types";
import { QuoteStatusMeta } from "@/lib/types";
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

export default function EditQuote() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  const [, setQuote] = useState<Quote | null>(null);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [tier, setTier] = useState("");
  const [labor, setLabor] = useState<string>(""); // empty string to show placeholder
  const [materialEstimate, setMaterialEstimate] = useState<string>(""); // Quick estimate for materials
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [pinned, setPinned] = useState(false);
  const [isNewQuote, setIsNewQuote] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [overhead, setOverhead] = useState<string>(""); // Flat overhead cost
  const [markupPercent, setMarkupPercent] = useState<string>(""); // Markup percentage

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Calculate quote totals
  const calculations = React.useMemo(() => {
    const materialsFromItems = items.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0
    );
    const materialsEstimateValue = parseMoney(materialEstimate);
    const laborValue = parseMoney(labor);
    const overheadValue = parseMoney(overhead);
    const markupPercentValue = parseFloat(markupPercent) || 0;

    // Subtotal before markup
    const subtotal = materialsFromItems + materialsEstimateValue + laborValue + overheadValue;

    // Calculate markup
    const markupAmount = (subtotal * markupPercentValue) / 100;

    // Final total
    const total = subtotal + markupAmount;

    return {
      materialsFromItems,
      materialsEstimateValue,
      laborValue,
      overheadValue,
      subtotal,
      markupAmount,
      total,
    };
  }, [items, materialEstimate, labor, overhead, markupPercent]);

  const load = useCallback(async () => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (q) {
      setQuote(q);
      setName(q.name || "");
      setClientName(q.clientName || "");
      setTier(q.tier || "");
      // Only set labor if it's non-zero, otherwise leave empty to show placeholder
      setLabor(q.labor && q.labor !== 0 ? q.labor.toFixed(2) : "");
      // Load material estimate if present
      setMaterialEstimate(q.materialEstimate && q.materialEstimate !== 0 ? q.materialEstimate.toFixed(2) : "");
      setStatus(q.status || "draft");
      setPinned(q.pinned || false);
      setItems(q.items ?? []);
      setOverhead(q.overhead && q.overhead !== 0 ? q.overhead.toFixed(2) : "");
      setMarkupPercent(q.markupPercent && q.markupPercent !== 0 ? q.markupPercent.toString() : "");
      // Check if this is a newly created empty quote
      setIsNewQuote(!q.name && !q.clientName && q.labor === 0);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const validateRequiredFields = (): boolean => {
    if (!name.trim()) {
      Alert.alert("Required Field", "Please enter a project name.");
      return false;
    }

    if (!clientName.trim()) {
      Alert.alert("Required Field", "Please enter a client name.");
      return false;
    }

    return true;
  };

  const onDone = async () => {
    if (!id) return;

    // Validate required fields
    if (!validateRequiredFields()) {
      return;
    }

    // Save the quote
    await updateQuote(id, {
      name: name.trim(),
      clientName: clientName.trim(),
      tier: tier.trim() || undefined,
      labor: parseMoney(labor),
      materialEstimate: parseMoney(materialEstimate),
      overhead: parseMoney(overhead),
      markupPercent: parseFloat(markupPercent) || 0,
      status,
      pinned,
    });

    // No longer a new quote after saving
    setIsNewQuote(false);
    router.back();
  };

  const handleGoBack = async () => {
    // If this is a new quote that hasn't been modified, delete it
    if (isNewQuote && !name.trim() && !clientName.trim() && !labor.trim()) {
      if (id) {
        await deleteQuote(id);
      }
    }
    router.back();
  };


  const handleUpdateItemQty = async (itemId: string, delta: number) => {
    if (!id) return;

    const updatedItems = items.map((item) => {
      const currentId = getItemId(item);
      if (currentId === itemId) {
        const newQty = Math.max(0, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }).filter((item) => item.qty > 0); // Remove items with 0 quantity

    setItems(updatedItems);

    // Save to storage
    await updateQuote(id, { items: updatedItems });
  };

  const formatLaborInput = (text: string) => {
    // Remove non-numeric characters except decimal point
    const cleaned = text.replace(/[^0-9.]/g, "");

    // Ensure only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }

    // Limit decimal places to 2
    if (parts.length === 2 && parts[1].length > 2) {
      return parts[0] + "." + parts[1].slice(0, 2);
    }

    return cleaned;
  };

  const formatMoneyOnBlur = (value: string): string => {
    if (!value || value === "") return "";

    // If there's no decimal point, add .00
    if (!value.includes(".")) {
      return value + ".00";
    }

    // If there's a decimal but only one digit after it, add a zero
    const parts = value.split(".");
    if (parts[1].length === 1) {
      return value + "0";
    }

    // Otherwise return as is (already has 2 decimal places)
    return value;
  };

  // Handle cleanup when navigating away
  useEffect(() => {
    return () => {
      // Only cleanup on unmount, not on every re-render
      if (isNewQuote && !name.trim() && !clientName.trim() && !labor.trim()) {
        if (id) {
          deleteQuote(id).catch(() => {
            // Silently handle error on cleanup
          });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on unmount

  return (
    <>
      <Stack.Screen
        options={{
          title: "Edit Quote",
          headerShown: true,
          headerLeft: () => (
            <Pressable
              onPress={handleGoBack}
              style={{ paddingLeft: 16, paddingVertical: 8 }}
            >
              <Text style={{ fontSize: 17, color: theme.colors.accent }}>
                ‹ Back
              </Text>
            </Pressable>
          ),
          headerStyle: {
            backgroundColor: theme.colors.bg,
          },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: {
            color: theme.colors.text,
          },
        }}
      />
      <FormScreen
        scroll
        contentStyle={{
          paddingHorizontal: theme.spacing(2),
          paddingTop: theme.spacing(2),
          paddingBottom: theme.spacing(2),
        }}
        bottomBar={
          <View style={styles.bottomBar}>
            <Pressable style={styles.doneBtn} onPress={onDone}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
            <Pressable
              style={styles.reviewBtn}
              onPress={async () => {
                if (!id) return;

                // Validate required fields before proceeding
                if (!validateRequiredFields()) {
                  return;
                }

                await updateQuote(id, {
                  name: name.trim(),
                  clientName: clientName.trim(),
                  tier: tier.trim() || undefined,
                  labor: parseMoney(labor),
                  materialEstimate: parseMoney(materialEstimate),
                  overhead: parseMoney(overhead),
                  markupPercent: parseFloat(markupPercent) || 0,
                  status,
                  pinned,
                  items,
                });
                router.push(`/quote/${id}/review`);
              }}
            >
              <Text style={styles.reviewText}>Review & Export</Text>
            </Pressable>
          </View>
        }
      >
        <Text style={styles.label}>Project name *</Text>
        <FormInput
          placeholder="The job that pays the bills..."
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (text.trim()) setIsNewQuote(false);
          }}
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Client name *</Text>
        <FormInput
          placeholder="Who's the lucky customer?"
          value={clientName}
          onChangeText={(text) => {
            setClientName(text);
            if (text.trim()) setIsNewQuote(false);
          }}
          autoCapitalize="words"
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Labor</Text>
        <FormInput
          placeholder="0.00"
          value={labor}
          onChangeText={(text) => setLabor(formatLaborInput(text))}
          onBlur={() => setLabor(formatMoneyOnBlur(labor))}
          keyboardType="decimal-pad"
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>
          Materials (Quick Estimate)
          <Text style={styles.labelOptional}> - Optional</Text>
        </Text>
        <Text style={styles.helperText}>
          For a ballpark quote without detailed line items
        </Text>
        <FormInput
          placeholder="0.00"
          value={materialEstimate}
          onChangeText={(text) => setMaterialEstimate(formatLaborInput(text))}
          onBlur={() => setMaterialEstimate(formatMoneyOnBlur(materialEstimate))}
          keyboardType="decimal-pad"
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Status</Text>
        <View style={styles.statusGrid}>
          {(Object.keys(QuoteStatusMeta) as QuoteStatus[]).map((s) => (
            <Pressable
              key={s}
              style={[
                styles.statusChip,
                status === s && styles.statusChipActive,
                status === s && {
                  backgroundColor: QuoteStatusMeta[s].color,
                  borderColor: QuoteStatusMeta[s].color,
                },
              ]}
              onPress={() => setStatus(s)}
            >
              <Text
                style={[
                  styles.statusChipText,
                  status === s && styles.statusChipTextActive,
                ]}
              >
                {QuoteStatusMeta[s].label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: theme.spacing(2) }} />

        <Pressable style={styles.pinToggle} onPress={() => setPinned(!pinned)}>
          <Text style={styles.pinIcon}>{pinned ? "⭐" : "☆"}</Text>
          <Text style={styles.pinText}>
            {pinned ? "Pinned to Dashboard" : "Pin to Dashboard"}
          </Text>
        </Pressable>

        <View style={{ height: theme.spacing(3) }} />

        <Text style={styles.h2}>Items</Text>

        <View style={{ height: theme.spacing(2) }} />

        {items.length === 0 && (
          <View style={styles.emptyMaterials}>
            <Text style={styles.emptyMaterialsText}>
              No materials added yet
            </Text>
            <Text style={styles.emptyMaterialsHint}>
              Tap &quot;Add materials&quot; below to browse the catalog or use assemblies
            </Text>
          </View>
        )}

        {items.length > 0 && (
          <>
            <View style={styles.itemsList}>
              {items.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.itemRow,
                    index === items.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>
                      ${item.unitPrice.toFixed(2)} each
                    </Text>
                  </View>

                  <View style={styles.itemControls}>
                    <View style={styles.stepper}>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => handleUpdateItemQty(getItemId(item), -1)}
                      >
                        <Text style={styles.stepText}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyText}>{item.qty}</Text>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() => handleUpdateItemQty(getItemId(item), 1)}
                      >
                        <Text style={styles.stepText}>+</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.itemTotal}>
                      ${(item.unitPrice * item.qty).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={{ height: theme.spacing(2) }} />
          </>
        )}

        <Pressable
          onPress={async () => {
            if (!id) return;
            // Save current state before navigating (without validation)
            await updateQuote(id, {
              name: name.trim() || "Untitled",
              clientName: clientName.trim(),
              tier: tier.trim() || undefined,
              labor: parseMoney(labor),
              materialEstimate: parseMoney(materialEstimate),
              overhead: parseMoney(overhead),
              markupPercent: parseFloat(markupPercent) || 0,
              status,
              pinned,
            });
            router.push(`/quote/${id}/materials`);
          }}
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.lg,
            height: 48,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontWeight: "800", color: theme.colors.text }}>
            Add materials
          </Text>
        </Pressable>

        <View style={{ height: theme.spacing(3) }} />

        <Text style={styles.h2}>Overhead & Markup</Text>

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Overhead / Additional Costs</Text>
        <FormInput
          placeholder="0.00"
          value={overhead}
          onChangeText={(text) => setOverhead(formatLaborInput(text))}
          onBlur={() => setOverhead(formatMoneyOnBlur(overhead))}
          keyboardType="decimal-pad"
        />

        <View style={{ height: theme.spacing(2) }} />

        <Text style={styles.label}>Markup Percentage</Text>
        <View style={styles.inputWithSuffix}>
          <FormInput
            placeholder="0"
            value={markupPercent}
            onChangeText={(text) => {
              // Only allow numbers and one decimal point
              const cleaned = text.replace(/[^0-9.]/g, "");
              const parts = cleaned.split(".");
              if (parts.length > 2) {
                setMarkupPercent(parts[0] + "." + parts.slice(1).join(""));
              } else {
                setMarkupPercent(cleaned);
              }
            }}
            keyboardType="decimal-pad"
            style={styles.inputWithSuffixField}
          />
          <Text style={styles.inputSuffix}>%</Text>
        </View>

        <View style={{ height: theme.spacing(3) }} />

        <View style={styles.totalsCard}>
          <Text style={styles.totalsTitle}>Quote Total</Text>

          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Materials (Items)</Text>
            <Text style={styles.totalsValue}>
              ${calculations.materialsFromItems.toFixed(2)}
            </Text>
          </View>

          {calculations.materialsEstimateValue > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Materials (Estimate)</Text>
              <Text style={styles.totalsValue}>
                ${calculations.materialsEstimateValue.toFixed(2)}
              </Text>
            </View>
          )}

          {calculations.laborValue > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Labor</Text>
              <Text style={styles.totalsValue}>
                ${calculations.laborValue.toFixed(2)}
              </Text>
            </View>
          )}

          {calculations.overheadValue > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Overhead</Text>
              <Text style={styles.totalsValue}>
                ${calculations.overheadValue.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.totalsDivider} />

          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabelBold}>Subtotal</Text>
            <Text style={styles.totalsValueBold}>
              ${calculations.subtotal.toFixed(2)}
            </Text>
          </View>

          {calculations.markupAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                Markup ({markupPercent}%)
              </Text>
              <Text style={styles.totalsValue}>
                ${calculations.markupAmount.toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.totalsDivider} />

          <View style={styles.totalsRow}>
            <Text style={styles.totalsFinalLabel}>Total</Text>
            <Text style={styles.totalsFinalValue}>
              ${calculations.total.toFixed(2)}
            </Text>
          </View>
        </View>
      </FormScreen>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    label: { fontSize: 12, color: theme.colors.text, marginBottom: 6, fontWeight: "600" },
    labelOptional: {
      fontSize: 11,
      color: theme.colors.muted,
      fontStyle: "italic"
    },
    inputWithSuffix: {
      position: "relative",
    },
    inputWithSuffixField: {
      paddingRight: theme.spacing(5),
    },
    inputSuffix: {
      position: "absolute",
      right: theme.spacing(2),
      top: "50%",
      transform: [{ translateY: -10 }],
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    helperText: {
      fontSize: 11,
      color: theme.colors.muted,
      marginBottom: 6,
      fontStyle: "italic"
    },
    h2: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 6,
    },
    helper: { fontSize: 12, color: theme.colors.muted },
    statusGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing(1),
    },
    statusChip: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(1),
      borderRadius: 999,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statusChipActive: {
      borderWidth: 2,
    },
    statusChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    statusChipTextActive: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
    pinToggle: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    pinIcon: {
      fontSize: 20,
      marginRight: theme.spacing(1.5),
    },
    pinText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    bottomBar: {
      flexDirection: "row",
      gap: theme.spacing(2),
    },
    doneBtn: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      height: 48,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    doneText: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
    reviewBtn: {
      flex: 1,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      height: 48,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    reviewText: { fontSize: 16, fontWeight: "800", color: "#000" },
    assemblyBtn: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing(2),
      height: 48,
      borderWidth: 2,
      borderColor: theme.colors.accent,
    },
    assemblyText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    emptyMaterials: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(4),
      alignItems: "center",
      marginBottom: theme.spacing(2),
    },
    emptyMaterialsIcon: {
      fontSize: 48,
      marginBottom: theme.spacing(1.5),
    },
    emptyMaterialsText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: theme.spacing(0.5),
      textAlign: "center",
    },
    emptyMaterialsHint: {
      fontSize: 13,
      color: theme.colors.muted,
      textAlign: "center",
      lineHeight: 18,
    },
    itemsList: {
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
    itemInfo: {
      flex: 1,
      marginRight: theme.spacing(2),
    },
    itemName: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 4,
    },
    itemPrice: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    itemControls: {
      alignItems: "flex-end",
      gap: theme.spacing(1),
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stepBtn: {
      height: 28,
      width: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.card,
    },
    stepText: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.colors.text,
    },
    qtyText: {
      minWidth: 24,
      textAlign: "center",
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 14,
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
    totalsTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.text,
      marginBottom: theme.spacing(2),
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1),
    },
    totalsLabel: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    totalsValue: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "600",
    },
    totalsLabelBold: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "700",
    },
    totalsValueBold: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: "700",
    },
    totalsDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: theme.spacing(1.5),
    },
    totalsFinalLabel: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.text,
    },
    totalsFinalValue: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.accent,
    },
  });
}
