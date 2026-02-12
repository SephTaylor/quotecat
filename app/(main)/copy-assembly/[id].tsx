// app/(main)/copy-assembly/[id].tsx
// Copy a community assembly with pricebook matching

import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { Screen } from "@/modules/core/ui";
import { fetchSharedAssemblyById, recordCopy } from "@/lib/sharedAssembliesApi";
import {
  matchItemsToPricebook,
  getMatchSummary,
  sortMatchResultsByPriority,
  createPricebookEntryFromSharedItem,
} from "@/lib/pricebookMatching";
import { savePricebookItem } from "@/lib/pricebook";
import { saveAssembly } from "@/modules/assemblies/storage";
import type { SharedAssembly, ItemMatchResult, PricebookItem } from "@/lib/types";
import type { Assembly, AssemblyItem } from "@/modules/assemblies/types";

type ItemState = {
  result: ItemMatchResult;
  selectedPricebookItem?: PricebookItem;
  manualPrice?: number;
  createNew: boolean; // Whether to create a new pricebook entry
};

export default function CopyAssemblyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // State
  const [sharedAssembly, setSharedAssembly] = useState<SharedAssembly | null>(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemStates, setItemStates] = useState<ItemState[]>([]);


  // Load shared assembly and match items
  useEffect(() => {
    const load = async () => {
      if (!id) return;

      try {
        const assembly = await fetchSharedAssemblyById(id);
        if (!assembly) {
          Alert.alert("Not Found", "This assembly is no longer available.");
          router.back();
          return;
        }

        setSharedAssembly(assembly);
        setMatching(true);

        // Match items to pricebook
        const matchResults = await matchItemsToPricebook(assembly.items);
        const sorted = sortMatchResultsByPriority(matchResults);

        // Initialize state for each item
        const states: ItemState[] = sorted.map((result) => ({
          result,
          selectedPricebookItem: result.matchedPricebookItem,
          createNew: result.matchType === "none",
          manualPrice: 0,
        }));

        setItemStates(states);
      } catch (error) {
        console.error("Failed to load shared assembly:", error);
        Alert.alert("Error", "Could not load the assembly.");
        router.back();
      } finally {
        setLoading(false);
        setMatching(false);
      }
    };

    load();
  }, [id]);

  // Update an item's state
  const updateItemState = useCallback(
    (index: number, updates: Partial<ItemState>) => {
      setItemStates((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
      );
    },
    []
  );

  // Select a different pricebook item
  const selectPricebookItem = useCallback(
    (index: number, pricebookItem: PricebookItem) => {
      updateItemState(index, {
        selectedPricebookItem: pricebookItem,
        createNew: false,
      });
    },
    [updateItemState]
  );

  // Toggle create new
  const toggleCreateNew = useCallback(
    (index: number) => {
      setItemStates((prev) =>
        prev.map((item, i) =>
          i === index
            ? { ...item, createNew: !item.createNew, selectedPricebookItem: undefined }
            : item
        )
      );
    },
    []
  );

  // Save the assembly
  const handleSave = async () => {
    if (!sharedAssembly) return;

    // Check for items needing prices
    const needsPrice = itemStates.filter(
      (s) => s.createNew && (s.manualPrice === undefined || s.manualPrice <= 0)
    );

    if (needsPrice.length > 0) {
      Alert.alert(
        "Prices Required",
        `Please enter prices for ${needsPrice.length} item${needsPrice.length > 1 ? "s" : ""}.`
      );
      return;
    }

    setSaving(true);

    try {
      // Create new pricebook items for "create new" items
      const newPricebookItems = new Map<string, PricebookItem>();

      for (const itemState of itemStates) {
        if (itemState.createNew) {
          const newItem = createPricebookEntryFromSharedItem(
            itemState.result.sharedItem,
            itemState.manualPrice || 0
          );
          const savedItem = await savePricebookItem({
            ...newItem,
            id: `pb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          newPricebookItems.set(itemState.result.sharedItem.name, savedItem);
        }
      }

      // Build assembly items
      const assemblyItems: AssemblyItem[] = itemStates.map((itemState) => {
        const sharedItem = itemState.result.sharedItem;

        if (itemState.createNew) {
          const pricebookItem = newPricebookItems.get(sharedItem.name);
          return {
            productId: pricebookItem?.id || `unknown-${Date.now()}`,
            source: "pricebook" as const,
            qty: sharedItem.qty,
            name: sharedItem.name,
          };
        } else if (itemState.selectedPricebookItem) {
          return {
            productId: itemState.selectedPricebookItem.id,
            source: "pricebook" as const,
            qty: sharedItem.qty,
            name: itemState.selectedPricebookItem.name,
          };
        } else {
          // Fallback - shouldn't happen
          return {
            productId: `unknown-${Date.now()}`,
            source: "pricebook" as const,
            qty: sharedItem.qty,
            name: sharedItem.name,
          };
        }
      });

      // Create local assembly
      const localAssembly: Assembly = {
        id: `copied-${Date.now()}`,
        name: sharedAssembly.name,
        description: sharedAssembly.description,
        category: sharedAssembly.category,
        items: assemblyItems,
      };

      await saveAssembly(localAssembly);

      // Record the copy (fire-and-forget, don't block user)
      recordCopy(sharedAssembly.id, localAssembly.id).catch(() => {});

      Alert.alert(
        "Assembly Copied",
        `"${sharedAssembly.name}" has been added to your assemblies.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Failed to save assembly:", error);
      Alert.alert("Error", "Could not save the assembly. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Get match summary
  const summary = itemStates.length > 0 ? getMatchSummary(itemStates.map((s) => s.result)) : null;

  // Render an item row
  const renderItem = ({ item, index }: { item: ItemState; index: number }) => {
    const { result, selectedPricebookItem, createNew, manualPrice } = item;
    const sharedItem = result.sharedItem;

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{sharedItem.name}</Text>
          <Text style={styles.itemQty}>x{sharedItem.qty}</Text>
        </View>

        {/* Match status */}
        {result.matchType === "exact" && !createNew && (
          <View style={styles.matchRow}>
            <View style={[styles.statusBadge, styles.statusExact]}>
              <Text style={styles.statusText}>Matched</Text>
            </View>
            <Text style={styles.matchedName} numberOfLines={1}>
              {selectedPricebookItem?.name}
            </Text>
            <Text style={styles.matchedPrice}>
              ${selectedPricebookItem?.unitPrice.toFixed(2)}
            </Text>
          </View>
        )}

        {result.matchType === "fuzzy" && !createNew && (
          <View style={styles.matchRow}>
            <View style={[styles.statusBadge, styles.statusFuzzy]}>
              <Text style={styles.statusText}>Similar</Text>
            </View>
            <Text style={styles.matchedName} numberOfLines={1}>
              {selectedPricebookItem?.name}
            </Text>
            <Text style={styles.matchedPrice}>
              ${selectedPricebookItem?.unitPrice.toFixed(2)}
            </Text>
          </View>
        )}

        {(result.matchType === "none" || createNew) && (
          <View style={styles.matchRow}>
            <View style={[styles.statusBadge, styles.statusNone]}>
              <Text style={styles.statusText}>New</Text>
            </View>
            <TextInput
              style={styles.priceInput}
              placeholder="Enter price"
              placeholderTextColor={theme.colors.muted}
              keyboardType="decimal-pad"
              value={manualPrice ? manualPrice.toString() : ""}
              onChangeText={(text) => {
                const price = parseFloat(text) || 0;
                updateItemState(index, { manualPrice: price });
              }}
            />
          </View>
        )}

        {/* Alternative matches */}
        {result.suggestedMatches && result.suggestedMatches.length > 0 && !createNew && (
          <View style={styles.alternatives}>
            <Text style={styles.alternativesLabel}>Other options:</Text>
            {result.suggestedMatches.slice(0, 2).map((alt) => (
              <Pressable
                key={alt.id}
                style={styles.altOption}
                onPress={() => selectPricebookItem(index, alt)}
              >
                <Text style={styles.altName} numberOfLines={1}>
                  {alt.name}
                </Text>
                <Text style={styles.altPrice}>${alt.unitPrice.toFixed(2)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Toggle create new */}
        {result.matchType !== "none" && (
          <Pressable
            style={styles.createNewToggle}
            onPress={() => toggleCreateNew(index)}
          >
            <Text style={styles.createNewText}>
              {createNew ? "Use existing match" : "Create new item instead"}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  if (loading || matching) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Copy Assembly",
            headerShown: true,
            headerStyle: { backgroundColor: theme.colors.bg },
            headerTintColor: theme.colors.accent,
            headerTitleStyle: { color: theme.colors.text },
          }}
        />
        <Screen scroll={false} contentStyle={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>
            {matching ? "Matching items to pricebook..." : "Loading..."}
          </Text>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Copy Assembly",
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.accent,
          headerTitleStyle: { color: theme.colors.text },
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
              ]}
            >
              <Text style={styles.saveButtonText}>
                {saving ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          ),
        }}
      />
      <Screen scroll={false} contentStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{sharedAssembly?.name}</Text>
          {summary && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {summary.matched} matched | {summary.fuzzy} similar | {summary.unmatched} new
              </Text>
            </View>
          )}
        </View>

        {/* Items list */}
        <FlatList
          data={itemStates}
          keyExtractor={(_, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      </Screen>
    </>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      marginTop: theme.spacing(2),
      fontSize: 14,
      color: theme.colors.muted,
    },
    header: {
      padding: theme.spacing(2),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    summaryRow: {
      flexDirection: "row",
    },
    summaryText: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    listContent: {
      padding: theme.spacing(2),
    },
    itemCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    itemHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing(1.5),
    },
    itemName: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
      marginRight: theme.spacing(1),
    },
    itemQty: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.muted,
    },
    matchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    statusBadge: {
      paddingHorizontal: theme.spacing(1),
      paddingVertical: 2,
      borderRadius: theme.radius.sm,
    },
    statusExact: {
      backgroundColor: "rgba(76, 175, 80, 0.2)",
    },
    statusFuzzy: {
      backgroundColor: "rgba(255, 193, 7, 0.2)",
    },
    statusNone: {
      backgroundColor: "rgba(244, 67, 54, 0.2)",
    },
    statusText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.text,
    },
    matchedName: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.text,
    },
    matchedPrice: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    priceInput: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(1),
      fontSize: 14,
      color: theme.colors.text,
    },
    alternatives: {
      marginTop: theme.spacing(1.5),
      paddingTop: theme.spacing(1.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    alternativesLabel: {
      fontSize: 12,
      color: theme.colors.muted,
      marginBottom: theme.spacing(1),
    },
    altOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing(0.75),
    },
    altName: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.text,
    },
    altPrice: {
      fontSize: 13,
      color: theme.colors.muted,
    },
    createNewToggle: {
      marginTop: theme.spacing(1.5),
      paddingTop: theme.spacing(1),
    },
    createNewText: {
      fontSize: 12,
      color: theme.colors.accent,
    },
    saveButton: {
      paddingHorizontal: theme.spacing(2),
      paddingVertical: theme.spacing(0.75),
    },
    saveButtonPressed: {
      opacity: 0.7,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.accent,
    },
  });
}
