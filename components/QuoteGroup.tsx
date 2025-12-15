// components/QuoteGroup.tsx
// Collapsible group for linked quotes (multi-tier)

import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { SwipeableQuoteItem } from "./SwipeableQuoteItem";
import { calculateTotal } from "@/lib/validation";
import type { Quote } from "@/lib/types";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type QuoteGroupProps = {
  quotes: Quote[];
  onEdit: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
  onDuplicate: (quote: Quote) => void;
  onTogglePin: (quote: Quote) => void;
  onLongPress: (quote: Quote) => void;
  onCreateTier: (quote: Quote) => void;
  onExportAllTiers: (quote: Quote) => void;
};

export function QuoteGroup({
  quotes,
  onEdit,
  onDelete,
  onDuplicate,
  onTogglePin,
  onLongPress,
  onCreateTier,
  onExportAllTiers,
}: QuoteGroupProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Sort quotes by tier name
  const sortedQuotes = [...quotes].sort((a, b) => {
    if (a.tier && b.tier) return a.tier.localeCompare(b.tier);
    if (a.tier) return -1;
    if (b.tier) return 1;
    return 0;
  });

  // Use first quote for group header info
  const primaryQuote = sortedQuotes[0];

  // Calculate total range
  const totals = sortedQuotes.map(q => calculateTotal(q));
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.container}>
      {/* Group Header */}
      <Pressable style={styles.header} onPress={toggleExpanded}>
        <View style={styles.headerLeft}>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={20}
            color={theme.colors.muted}
          />
          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {primaryQuote.name || "Untitled Project"}
              </Text>
              <View style={styles.optionsBadge}>
                <Text style={styles.optionsBadgeText}>{quotes.length} Options</Text>
              </View>
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>
              {primaryQuote.clientName || "No client"}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.priceRange}>
            {minTotal === maxTotal
              ? `$${minTotal.toFixed(0)}`
              : `$${minTotal.toFixed(0)} - $${maxTotal.toFixed(0)}`}
          </Text>
        </View>
      </Pressable>

      {/* Expanded Content */}
      {expanded && (
        <View style={styles.content}>
          {sortedQuotes.map((quote) => (
            <View key={quote.id} style={styles.quoteWrapper}>
              <View style={styles.tierIndicator}>
                <View style={styles.tierLine} />
                <View style={styles.tierDot} />
              </View>
              <View style={styles.quoteItem}>
                <SwipeableQuoteItem
                  item={quote}
                  onEdit={() => onEdit(quote)}
                  onDelete={() => onDelete(quote)}
                  onDuplicate={() => onDuplicate(quote)}
                  onTogglePin={() => onTogglePin(quote)}
                  onLongPress={() => onLongPress(quote)}
                  onCreateTier={() => onCreateTier(quote)}
                  onExportAllTiers={() => onExportAllTiers(quote)}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: {
      marginBottom: theme.spacing(2),
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: "#5856D6", // Purple border to indicate grouped
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing(2),
      backgroundColor: `${"#5856D6"}10`, // Light purple background
    },
    headerLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.5),
    },
    headerInfo: {
      flex: 1,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
      flexShrink: 1,
    },
    optionsBadge: {
      backgroundColor: "#5856D6",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    optionsBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#FFF",
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.muted,
      marginTop: 2,
    },
    headerRight: {
      marginLeft: theme.spacing(2),
    },
    priceRange: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    content: {
      paddingBottom: theme.spacing(1),
    },
    quoteWrapper: {
      flexDirection: "row",
      paddingLeft: theme.spacing(2),
    },
    tierIndicator: {
      width: 20,
      alignItems: "center",
      marginRight: theme.spacing(1),
    },
    tierLine: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: "#5856D6",
      opacity: 0.3,
    },
    tierDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#5856D6",
      marginTop: theme.spacing(4),
    },
    quoteItem: {
      flex: 1,
    },
  });
}
