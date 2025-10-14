// app/quote/[id]/edit.tsx
import { theme } from '@/constants/theme';
import { getQuoteById, saveQuote, type Quote } from '@/lib/quotes';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EditQuote() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      const q = await getQuoteById(id);
      if (q) {
        setQuote(q);
        setName(q.name || '');
      }
    })();
  }, [id]);

  const onDone = async () => {
    if (!id) return;
    await saveQuote({ id, name });
    router.back();
  };

  const bottomPad = Math.max(insets.bottom, theme.spacing(2));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>Project name</Text>
          <TextInput
            placeholder="e.g., Interior wall demo"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor={theme.colors.muted}
          />

          <View style={{ height: theme.spacing(4) }} />

          <Text style={styles.h2}>Items</Text>
          <Text style={styles.helper}>
            Use the Materials picker to add seed-only items. Categories are collapsed by default.
          </Text>

          {/* Add Materials button */}
          <View style={{ height: theme.spacing(2) }} />
          <Pressable
            onPress={() => id && router.push(`/quote/${id}/materials`)}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.card,
              borderRadius: theme.radius.lg,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontWeight: '800', color: theme.colors.text }}>Add materials</Text>
          </Pressable>
        </ScrollView>

        {/* Sticky bottom Done bar (clear of home indicator) */}
        <View style={[styles.bottomBar, { paddingBottom: bottomPad }]}>
          <Pressable style={styles.doneBtn} onPress={onDone}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: theme.spacing(2),
  },
  label: {
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.5),
    color: theme.colors.text,
    fontSize: 16,
  },
  h2: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  helper: { fontSize: 12, color: theme.colors.muted },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing(2),
    paddingTop: theme.spacing(1.5),
  },
  doneBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  doneText: { fontSize: 16, fontWeight: '800', color: '#000' },
});
