// app/(forms)/quote/[id]/edit-items.tsx
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { getQuoteById, updateQuote } from "@/lib/quotes";
import { useTheme } from "@/contexts/ThemeContext";
import { Text, View, StyleSheet, Pressable, ScrollView } from "react-native";
import type { QuoteItem } from "@/lib/types";

export default function EditItems() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const [items, setItems] = useState<QuoteItem[]>([]);

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const loadItems = useCallback(async () => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (q) {
      setItems(q.items ?? []);
    }
  }, [id]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleUpdateItemQty = async (itemId: string, delta: number) => {
    if (!id) return;

    const updatedItems = items
      .map((item) => {
        if (item.id === itemId) {
          const newQty = Math.max(0, item.qty + delta);
          return { ...item, qty: newQty };
        }
        return item;
      })
      .filter((item) => item.qty > 0); // Remove items with 0 quantity

    setItems(updatedItems);

    // Save to storage
    await updateQuote(id, { items: updatedItems });
  };

  const totalCost = items.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Edit Items",
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

      <View style={styles.container}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items in quote</Text>
            <Text style={styles.emptySubtext}>
              Go back and add materials to get started
            </Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.scrollView}>
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
                          onPress={() => handleUpdateItemQty(item.id, -1)}
                        >
                          <Text style={styles.stepText}>−</Text>
                        </Pressable>
                        <Text style={styles.qtyText}>{item.qty}</Text>
                        <Pressable
                          style={styles.stepBtn}
                          onPress={() => handleUpdateItemQty(item.id, 1)}
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

              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>Total Materials Cost</Text>
                <Text style={styles.summaryAmount}>${totalCost.toFixed(2)}</Text>
              </View>
            </ScrollView>

            <View style={styles.bottomBar}>
              <Pressable
                style={styles.doneBtn}
                onPress={() => router.back()}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </>
        )}
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
    scrollView: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(4),
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
    },
    itemsList: {
      margin: theme.spacing(2),
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
      height: 32,
      width: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.card,
    },
    stepText: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.text,
    },
    qtyText: {
      minWidth: 28,
      textAlign: "center",
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    itemTotal: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    summary: {
      margin: theme.spacing(2),
      marginTop: 0,
      padding: theme.spacing(2),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    summaryAmount: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.colors.accent,
    },
    bottomBar: {
      padding: theme.spacing(2),
      backgroundColor: theme.colors.bg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    doneBtn: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      height: 48,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    doneText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#000",
    },
  });
}
