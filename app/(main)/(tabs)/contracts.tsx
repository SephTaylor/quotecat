// app/(main)/(tabs)/contracts.tsx
// Contracts list screen for Premium users

import { useTheme } from "@/contexts/ThemeContext";
import { listContracts, deleteContract, createContractFromQuote } from "@/lib/contracts";
import { getUserState } from "@/lib/user";
import { listQuotes } from "@/lib/quotes";
import type { Contract } from "@/lib/types";
import type { Quote } from "@/lib/quotes";
import {
  useFocusEffect,
  useRouter,
  useLocalSearchParams,
} from "expo-router";
import React, { useCallback, useState, useEffect } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SwipeableContractItem } from "@/components/SwipeableContractItem";

export default function ContractsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();
  const insets = useSafeAreaInsets();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [approvedQuotes, setApprovedQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const user = await getUserState();
    const premium = user?.tier === "premium";
    setIsPremium(premium);

    if (premium) {
      const [contractData, quotesData] = await Promise.all([
        listContracts(),
        listQuotes(),
      ]);
      setContracts(contractData);
      // Filter to only approved/completed quotes that don't already have contracts
      // Also exclude unsaved quotes (id === "new")
      const contractQuoteIds = new Set(contractData.map(c => c.quoteId));
      const available = quotesData.filter(
        q => q.id !== "new" &&
             (q.status === "approved" || q.status === "completed") &&
             !contractQuoteIds.has(q.id)
      );
      setApprovedQuotes(available);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleContractPress = (contract: Contract) => {
    router.push(`/(forms)/contract/${contract.id}/edit`);
  };

  const createFromQuote = useCallback(async (quote: Quote) => {
    try {
      const contract = await createContractFromQuote(quote);
      if (contract) {
        await load();
        router.push(`/(forms)/contract/${contract.id}/edit`);
      } else {
        Alert.alert(
          "Error",
          "Failed to create contract. Please make sure you are signed in."
        );
      }
    } catch (error) {
      console.error("Contract creation error:", error);
      Alert.alert(
        "Error",
        "Failed to create contract. Please make sure you are signed in."
      );
    }
  }, [load, router]);

  const handleCreateContract = useCallback(() => {
    if (approvedQuotes.length === 0) {
      Alert.alert(
        "No Approved Quotes",
        "You need an approved quote to create a contract. Approve a quote first, then come back here."
      );
      return;
    }

    // Build options list
    const options = approvedQuotes.map(q => q.name || q.clientName || "Untitled Quote");
    options.push("Cancel");

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Select a Quote",
          message: "Choose an approved quote to create a contract from",
          options,
          cancelButtonIndex: options.length - 1,
        },
        async (buttonIndex) => {
          if (buttonIndex < approvedQuotes.length) {
            await createFromQuote(approvedQuotes[buttonIndex]);
          }
        }
      );
    } else {
      // Android fallback - use Alert with buttons (limited to 3)
      // For more options, we'd need a modal picker
      if (approvedQuotes.length <= 2) {
        const buttons = approvedQuotes.map(q => ({
          text: q.name || q.clientName || "Untitled",
          onPress: () => createFromQuote(q),
        }));
        buttons.push({ text: "Cancel", onPress: async () => {} });

        Alert.alert("Select a Quote", "Choose an approved quote to create a contract from", buttons);
      } else {
        // Too many options for Alert, just use the first one or show a message
        Alert.alert(
          "Create Contract",
          `Create a contract from "${approvedQuotes[0].name || approvedQuotes[0].clientName || "your approved quote"}"?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Create", onPress: () => createFromQuote(approvedQuotes[0]) },
          ]
        );
      }
    }
  }, [approvedQuotes, createFromQuote]);

  // Watch for trigger param to open quote picker
  useEffect(() => {
    if (trigger === "create" && isPremium && !loading) {
      if (approvedQuotes.length > 0) {
        handleCreateContract();
      } else {
        Alert.alert(
          "No Approved Quotes",
          "You need an approved quote to create a contract. Approve a quote first, then come back here."
        );
      }
      router.setParams({ trigger: undefined });
    }
  }, [trigger, isPremium, loading, approvedQuotes.length, handleCreateContract, router]);

  const handleDeleteContract = (contract: Contract) => {
    Alert.alert(
      "Delete Contract",
      `Are you sure you want to delete ${contract.contractNumber}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const success = await deleteContract(contract.id);
            if (success) {
              setContracts((prev) => prev.filter((c) => c.id !== contract.id));
            } else {
              Alert.alert("Error", "Failed to delete contract.");
            }
          },
        },
      ]
    );
  };

  const styles = React.useMemo(() => createStyles(theme, insets), [theme, insets]);

  const renderContract = ({ item }: { item: Contract }) => {
    return (
      <SwipeableContractItem
        item={item}
        onPress={() => handleContractPress(item)}
        onDelete={() => handleDeleteContract(item)}
      />
    );
  };

  // Non-premium users see locked state
  if (!loading && !isPremium) {
    return (
      <View style={styles.container}>
        <View style={styles.lockedState}>
          <View style={styles.lockedIconContainer}>
            <Ionicons name="lock-closed" size={48} color="#5856D6" />
          </View>
          <Text style={styles.lockedTitle}>Premium Feature</Text>
          <Text style={styles.lockedSubtitle}>
            Create legally-binding contracts with digital signatures
          </Text>
          <View style={styles.lockedFeatures}>
            <View style={styles.lockedFeatureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#5856D6" />
              <Text style={styles.lockedFeatureText}>Generate contracts from quotes</Text>
            </View>
            <View style={styles.lockedFeatureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#5856D6" />
              <Text style={styles.lockedFeatureText}>Digital signature capture</Text>
            </View>
            <View style={styles.lockedFeatureRow}>
              <Ionicons name="checkmark-circle" size={20} color="#5856D6" />
              <Text style={styles.lockedFeatureText}>Share contracts with clients</Text>
            </View>
          </View>
          <Pressable
            style={styles.upgradeButton}
            onPress={() => router.push("/(auth)/sign-in" as never)}
          >
            <Text style={styles.upgradeButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : contracts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-outline" size={64} color={theme.colors.muted} />
          <Text style={styles.emptyTitle}>No Contracts Yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap + to create a contract from an approved quote
          </Text>
        </View>
      ) : (
        <FlatList
          data={contracts}
          keyExtractor={(item) => item.id}
          renderItem={renderContract}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </GestureHandlerRootView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"], insets: { bottom: number }) {
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
      fontSize: 16,
      color: theme.colors.muted,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(4),
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
    },
    lockedState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(4),
    },
    lockedIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "#5856D620",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing(2),
    },
    lockedTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: theme.spacing(1),
    },
    lockedSubtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: "center",
      marginBottom: theme.spacing(3),
    },
    lockedFeatures: {
      gap: theme.spacing(1.5),
      marginBottom: theme.spacing(4),
    },
    lockedFeatureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    lockedFeatureText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    upgradeButton: {
      backgroundColor: "#5856D6",
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.lg,
    },
    upgradeButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#FFF",
    },
    listContent: {
      padding: theme.spacing(2),
      paddingBottom: Math.max(theme.spacing(2), insets.bottom),
    },
  });
}
