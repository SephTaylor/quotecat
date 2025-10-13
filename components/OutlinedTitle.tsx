// app/components/OutlinedTitle.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/theme";

type Props = { title?: string };

export default function OutlinedTitle({ title = "QuoteCat" }: Props) {
  return (
    <View style={styles.wrap}>
      {/* outline (behind) */}
      <Text numberOfLines={1} style={[styles.text, styles.outline]}>
        {title}
      </Text>
      {/* fill (front) */}
      <Text numberOfLines={1} style={[styles.text, styles.fill]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", height: 28, justifyContent: "center" },
  text: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  outline: {
    position: "absolute",
    textShadowColor: colors.text,
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 0,
    color: colors.primary, // visible if shadow unsupported
  },
  fill: {
    color: colors.primary,
  },
});
