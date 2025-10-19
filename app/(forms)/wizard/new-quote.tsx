import { Stack, useRouter, type Href } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { saveQuote } from "@/lib/quotes";
import { BottomBar, Button, FormInput, Screen } from "@/modules/core/ui";

export default function NewQuote() {
  const { theme } = useTheme();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");

  const canCreate = title.trim().length > 0;

  const createQuote = async () => {
    if (!canCreate) return;

    const id = "q-" + Date.now().toString(36);

    await saveQuote({
      id,
      name: title.trim(),
      clientName: clientName.trim() || undefined,
      items: [],
      labor: 0,
    } as any);

    // Navigate to the quote edit screen where they can add materials
    router.replace(`/quote/${id}/edit` as Href);
  };

  return (
    <>
      <Stack.Screen options={{ title: "New Quote" }} />

      <Screen scroll>
        <View style={styles.container}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            Project Name
          </Text>
          <FormInput
            placeholder="e.g., Master bedroom remodel"
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            autoFocus
          />

          <Text
            style={[
              styles.label,
              { color: theme.colors.text, marginTop: 24 },
            ]}
          >
            Client Name (optional)
          </Text>
          <FormInput
            placeholder="e.g., John Smith"
            value={clientName}
            onChangeText={setClientName}
            returnKeyType="done"
            onSubmitEditing={createQuote}
          />

          <Text style={[styles.helper, { color: theme.colors.muted }]}>
            You can add materials and details after creating the quote.
          </Text>
        </View>
      </Screen>

      <BottomBar>
        <Button variant="secondary" onPress={() => router.back()}>
          Cancel
        </Button>

        <Button variant="primary" onPress={createQuote} disabled={!canCreate}>
          Create Quote
        </Button>
      </BottomBar>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    fontWeight: "700",
    marginBottom: 8,
    fontSize: 14,
  },
  helper: {
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
});
