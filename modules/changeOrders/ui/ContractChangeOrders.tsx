// modules/changeOrders/ui/ContractChangeOrders.tsx
//
// The Change Orders section on a contract, and the entry point for raising one.
//
// Sits directly under the status badge rather than down with Materials and
// Signatures. Once a contract is signed everything below it is a record: the
// client details, the scope, the materials and the signatures are all fixed.
// Change orders are the only live thing on the screen, and the contractor
// opening this is usually standing in front of the customer who just asked for
// something. Putting it first is the difference between one tap and a scroll.
//
// Not in the bottom bar: that is a single morph button by design (v1.2.14), and
// a second primary action there would undo that decision.

import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import type { Contract } from "@/lib/types";
import type { ChangeOrder } from "../types";
import { ChangeOrderCard } from "./ChangeOrderCard";
import { getChangeOrdersForContract } from "../storageSQLite";
import { canAddChangeOrder, whyCannotAddChangeOrder } from "@/lib/changeOrders";

type Theme = {
  colors: {
    card: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    bg?: string;
  };
  spacing: (n: number) => number;
  radius: { md: number };
};

type Props = {
  contract: Contract;
  theme: Theme;
};

export function ContractChangeOrders({ contract, theme }: Props) {
  const router = useRouter();
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const styles = createStyles(theme);

  const refresh = useCallback(async () => {
    const cos = await getChangeOrdersForContract(contract.id);
    setChangeOrders(cos);
    setLoaded(true);
  }, [contract.id]);

  // Reload on focus so a change order raised on the next screen appears on the
  // way back, the same way the contract's own signatures refresh.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Two screens this section needs do not exist yet for contracts:
  //
  //   create  /(forms)/change-order/new   does not exist at all. Routing there
  //           shows expo-router's unmatched-route error.
  //   detail  /(main)/change-order/[id]   exists, but is built entirely around
  //           a quote: it refuses to render without one and its PDF export
  //           takes a Quote. A contract-parented change order has no quote.
  //
  // Until both are built the section stays read-only and inert rather than
  // offering taps that dead-end, which is the exact failure it was written to
  // replace on the quote screen.
  //
  // Flip this in the same commit that lands both screens.
  const CHANGE_ORDER_SCREENS_EXIST = true;
  const CREATE_SCREEN_EXISTS = CHANGE_ORDER_SCREENS_EXIST;

  const allowed = canAddChangeOrder(contract) && CREATE_SCREEN_EXISTS;
  const blockedReason = whyCannotAddChangeOrder(contract);

  // Nothing to say on an unsigned contract with no history: the contractor is
  // still building it and a change order is not a concept yet. Once there ARE
  // change orders the section stays, whatever the status, because hiding a
  // signed modification would be worse than showing it out of context.
  if (!allowed && changeOrders.length === 0) return null;
  if (!loaded) return null;

  const total = changeOrders
    .filter((co) => co.status !== "declined")
    .reduce((sum, co) => sum + co.netChange, 0);

  const handleAdd = () => {
    router.push(`/(forms)/change-order/new?contractId=${contract.id}` as never);
  };

  const handleOpen = (co: ChangeOrder) => {
    router.push(`/(main)/change-order/${co.id}?contractId=${contract.id}` as never);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          Change Orders{changeOrders.length > 0 ? ` (${changeOrders.length})` : ""}
        </Text>
        {total !== 0 && (
          <Text style={[styles.total, total < 0 && styles.totalNegative]}>
            {total > 0 ? "+" : "-"}${Math.abs(total).toFixed(2)}
          </Text>
        )}
      </View>

      {changeOrders.length === 0 ? (
        <Text style={styles.empty}>
          {CREATE_SCREEN_EXISTS
            ? "Nothing has changed on this job yet. If your customer asks for something extra, raise it here so it gets signed and billed."
            : "Nothing has changed on this job yet."}
        </Text>
      ) : (
        changeOrders.map((co) => (
          <ChangeOrderCard
            key={co.id}
            changeOrder={co}
            theme={theme}
            onPress={CHANGE_ORDER_SCREENS_EXIST ? () => handleOpen(co) : undefined}
          />
        ))
      )}

      {allowed ? (
        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Ionicons name="add" size={18} color={theme.colors.accent} />
          <Text style={styles.addButtonText}>Add Change Order</Text>
        </Pressable>
      ) : (
        // Say why rather than silently hiding the button. A contractor who
        // expects to raise one and finds nothing assumes the app is broken.
        CREATE_SCREEN_EXISTS && blockedReason && (
          <Text style={styles.blocked}>{blockedReason}</Text>
        )
      )}
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    section: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing(1),
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    total: {
      fontSize: 15,
      fontWeight: "700",
      color: "#34C759",
    },
    totalNegative: {
      color: "#FF3B30",
    },
    empty: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
      marginBottom: theme.spacing(1.5),
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.accent,
      borderStyle: "dashed",
      marginTop: theme.spacing(1),
    },
    addButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    blocked: {
      fontSize: 13,
      color: theme.colors.muted,
      lineHeight: 18,
      fontStyle: "italic",
      marginTop: theme.spacing(0.5),
    },
  });
}
