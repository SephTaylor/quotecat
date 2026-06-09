// components/HealthCheckShareCard.tsx
// Strava-style anonymous share card for a Pricing Health Check result.
//
// Designed to be captured as an image via react-native-view-shot and shared
// to iMessage / WhatsApp / native share sheet. NO client names, NO quote
// names, NO specific dollar amounts beyond the aggregate. The point is the
// number, the brand, and the moment ("I do the work to catch this").

import React, { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";

export type HealthCheckShareCardProps = {
  flaggedCount: number;
  totalEstimatedLostProfit: number;
  windowDays: number;
  targetMargin: number;
};

// Fixed dimensions — Instagram square-friendly. View-shot captures at this
// size regardless of screen. Don't make this percentage-based.
const CARD_SIZE = 600;

export const HealthCheckShareCard = forwardRef<View, HealthCheckShareCardProps>(
  ({ flaggedCount, totalEstimatedLostProfit, windowDays, targetMargin }, ref) => {
    const lostFmt = totalEstimatedLostProfit.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        {/* Top-left brand mark */}
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>QuoteCat</Text>
          <View style={styles.brandDot} />
          <Text style={styles.brandSubtext}>Pricing Health Check</Text>
        </View>

        {/* Main figure */}
        <View style={styles.main}>
          <Text style={styles.window}>Last {windowDays} days</Text>
          <Text style={styles.bigNumber}>{flaggedCount}</Text>
          <Text style={styles.bigLabel}>
            quote{flaggedCount === 1 ? "" : "s"} underpriced
          </Text>
        </View>

        {/* Lost-profit row */}
        <View style={styles.lostBlock}>
          <Text style={styles.lostAmount}>~${lostFmt}</Text>
          <Text style={styles.lostLabel}>estimated profit on the table</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Target margin {targetMargin}% · calculated by QuoteCat
          </Text>
          <Text style={styles.footerUrl}>quotecat.ai</Text>
        </View>
      </View>
    );
  }
);

HealthCheckShareCard.displayName = "HealthCheckShareCard";

const styles = StyleSheet.create({
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: "#0f1115",
    padding: 48,
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandText: {
    color: "#F97316",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4b5563",
  },
  brandSubtext: {
    color: "#9ca3af",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  main: {
    alignItems: "flex-start",
  },
  window: {
    color: "#6b7280",
    fontSize: 16,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  bigNumber: {
    color: "#fff",
    fontSize: 220,
    fontWeight: "900",
    lineHeight: 220,
    letterSpacing: -8,
    marginBottom: -8,
  },
  bigLabel: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  lostBlock: {
    borderLeftWidth: 4,
    borderLeftColor: "#F97316",
    paddingLeft: 16,
  },
  lostAmount: {
    color: "#fff",
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1,
  },
  lostLabel: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
  },
  footerUrl: {
    color: "#F97316",
    fontSize: 14,
    fontWeight: "700",
  },
});
