// app/quote/[id]/edit.tsx
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Quote, getQuoteById, updateQuote } from '../../../lib/quotes';

type Form = {
  clientName: string;
  projectName: string;
  total: string; // keep as string for the input
};

export default function EditQuote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [form, setForm] = useState<Form>({ clientName: '', projectName: '', total: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const q: Quote | null = await getQuoteById(String(id));
      if (q) {
        setForm({
          clientName: q.clientName || '',
          projectName: q.projectName || '',
          total: String(q.total ?? 0),
        });
      }
      setLoading(false);
    })();
  }, [id]);

  const save = async () => {
    try {
      const payload = {
        clientName: form.clientName.trim(),
        projectName: form.projectName.trim(),
        total: Number(form.total) || 0,
      };
      await updateQuote(String(id), payload);
      Alert.alert('Saved', 'Quote updated.');
      router.back(); // go back to the detail screen
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Stack.Screen options={{ title: 'Edit Quote' }} />

      <Text style={s.label}>Client</Text>
      <TextInput
        style={s.input}
        value={form.clientName}
        onChangeText={(t) => setForm({ ...form, clientName: t })}
        placeholder="Client name"
      />

      <Text style={s.label}>Project</Text>
      <TextInput
        style={s.input}
        value={form.projectName}
        onChangeText={(t) => setForm({ ...form, projectName: t })}
        placeholder="Project name"
      />

      <Text style={s.label}>Total</Text>
      <TextInput
        style={s.input}
        value={form.total}
        onChangeText={(t) => setForm({ ...form, total: t })}
        keyboardType="numeric"
        placeholder="0.00"
      />

      <View style={{ height: 8 }} />
      <Button title="Save" onPress={save} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, color: '#666' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
