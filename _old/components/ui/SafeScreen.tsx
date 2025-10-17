// components/ui/SafeScreen.tsx
import { colors } from "@/constants/theme";
import React, { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type Props = {
  children: ReactNode;
  scroll?: boolean; // default true
  bottomFixed?: ReactNode | null; // sticky footer; space is reserved automatically
  contentGap?: number; // optional vertical spacing (default 16)
};

export default function SafeScreen({
  children,
  scroll = true,
  bottomFixed = null,
  contentGap = 16,
}: Props) {
  const insets = useSafeAreaInsets();
  const reserved = bottomFixed ? 64 + insets.bottom + 12 : 16;

  const Content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { gap: contentGap, paddingBottom: reserved },
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[styles.content, { gap: contentGap, paddingBottom: reserved }]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: "padding", android: "height" })}
      >
        {Content}
        {bottomFixed ? (
          <View
            style={[
              styles.bottom,
              {
                paddingBottom: insets.bottom + 12,
                height: 64 + insets.bottom + 12,
              },
            ]}
          >
            {bottomFixed}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(244,246,250,0.96)", // matches #F4F6FA
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E6EAF2",
  },
});
