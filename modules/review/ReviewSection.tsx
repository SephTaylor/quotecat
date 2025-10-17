// modules/review/ReviewSection.tsx
import { theme } from "@/constants/theme";
import React, { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

type Props = PropsWithChildren<{
  title?: string;
  right?: ReactNode;
  style?: ViewStyle;
}>;

/**
 * ReviewSection
 * - Simple titled block to group review content (items, totals, notes)
 * - Pure presentational scaffold (no data fetching)
 */
export default function ReviewSection({
  title,
  right,
  style,
  children,
}: Props) {
  return (
    <View style={[styles.section, style]}>
      {(title || right) && (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : <View />}
          {right ? <View>{right}</View> : null}
        </View>
      )}
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1),
  },
  title: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
});

// keep default export + named re-export for your barrel pattern
export { ReviewSection };
