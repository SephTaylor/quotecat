// app/quote/[id]/edit.tsx
import { theme } from '@/constants/theme';
import { getQuoteById, saveQuote, type Quote } from '@/lib/quotes';
import { Screen } from '@/modules/core/ui';
import MoneyInput from '@/modules/core/ui/MoneyInput';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function EditQuote() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  // Keep the state type, silence the unused value.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_quote, setQuote] = useState<Quote | null>(null);
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [labor, setLabor] = useState<number>(0); // numeric now

  const load = useCallback(async () => {
    if (!id) return;
    const q = await getQuoteById(id);
    if (q) {
      setQuote(q);
      setName(q.name || '');
      setClientName(q.clientName || '');
      setLabor(Number.isFinite(q.labor) ? (q.labor as number) : 0);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const onDone = async () => {
    if (!id) return;
    await saveQuote({
      id,
      name,
      clientName,
      labor, // already numeric
    });
    router.back();
  };

  return (
    <Screen
      scroll={false}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentStyle={{ paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }}
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Project name</Text>
          <TextInput
            placeholder="e.g., Interior wall demo"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor={theme.colors.muted}
          />

          <View style={{ height: theme.spacing(2) }} />

          <Text style={styles.label}>Client name</Text>
          <TextInput
            placeholder="e.g., Acme LLC"
            value={clientName}
            onChangeText={setClientName}
            style={styles.input}
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="words"
          />

          <View style={{ height: theme.spacing(2) }} />

          <Text style={styles.label}>Labor</Text>
          <MoneyInput
            value={labor}
            onChangeValue={setLabor}
            placeholder="0.00"
            // match your input styling
            style={styles.input}
            placeholderTextColor={theme.colors.muted}
          />

          <View style={{ height: theme.spacing(3) }} />

          <Text style={styles.h2}>Items</Text>
          <Text style={styles.helper}>
            Use the Materials picker to add seed-only items. Categories are collapsed by default.
          </Text>

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

        <View style={styles.bottomBar}>
          <Pressable style={styles.doneBtn} onPress={onDone}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: theme.spacing(2) },
  label: { fontSize: 12, color: theme.colors.muted, marginBottom: 6 },
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
    paddingBottom: theme.spacing(2),
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
