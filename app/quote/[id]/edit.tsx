// app/quote/[id]/edit.tsx
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Quote, getQuoteById, updateQuote } from '../../../lib/quotes';

type Form = {
  clientName: string;
  projectName: string;
  labor: string;     // keep as text for validation UX
  material: string;  // keep as text for validation UX
};

export default function EditQuote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [form, setForm] = useState<Form>({ clientName: '', projectName: '', labor: '', material: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const q: Quote | null = await getQuoteById(String(id));
      if (q) {
        setForm({
          clientName: q.clientName || '',
          projectName: q.projectName || '',
          // ⬇️ empty string if zero so placeholder shows and first keypress isn’t appended to "0"
          labor: q.labor ? String(q.labor) : '',
          material: q.material ? String(q.material) : '',
        });
      }
      setLoading(false);
    })();
  }, [id]);

  const parsedLabor = useMemo(
    () => Number((form.labor || '0').replace(/[^0-9.]/g, '')),
    [form.labor]
  );
  const parsedMaterial = useMemo(
    () => Number((form.material || '0').replace(/[^0-9.]/g, '')),
    [form.material]
  );

  const errors: Partial<Record<keyof Form, string>> = {};
  if (!form.clientName.trim()) errors.clientName = 'Required';
  if (!form.projectName.trim()) errors.projectName = 'Required';
  if (!isFinite(parsedLabor) || parsedLabor < 0) errors.labor = 'Enter a non-negative number';
  if (!isFinite(parsedMaterial) || parsedMaterial < 0) errors.material = 'Enter a non-negative number';

  const isValid = Object.keys(errors).length === 0;

  const onSave = async () => {
    if (!isValid) {
      Alert.alert('Please fix the fields marked in red.');
      return;
    }
    try {
      setSaving(true);
      await updateQuote(String(id), {
        clientName: form.clientName.trim(),
        projectName: form.projectName.trim(),
        labor: parsedLabor || 0,
        material: parsedMaterial || 0,
      });
      Alert.alert('Saved', 'Quote updated.');
      router.back();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
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
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1 }}
    >
      <Stack.Screen options={{ title: 'Edit Quote' }} />
      <ScrollView contentContainerStyle={s.container}>
        <LabeledInput
          label="Client"
          value={form.clientName}
          onChangeText={(t) => setForm({ ...form, clientName: t })}
          placeholder="Client name"
          error={errors.clientName}
        />
        <LabeledInput
          label="Project"
          value={form.projectName}
          onChangeText={(t) => setForm({ ...form, projectName: t })}
          placeholder="Project name"
          error={errors.projectName}
        />
        <LabeledInput
          label="Labor"
          value={form.labor}
          onChangeText={(t) => setForm({ ...form, labor: t })}
          placeholder="0"
          keyboardType="numeric"
          error={errors.labor}
        />
        <LabeledInput
          label="Material"
          value={form.material}
          onChangeText={(t) => setForm({ ...form, material: t })}
          placeholder="0"
          keyboardType="numeric"
          error={errors.material}
        />

        <View style={{ height: 8 }} />
        <Button title={saving ? 'Saving…' : 'Save'} onPress={onSave} disabled={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  error?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{props.label}</Text>
      <TextInput
        style={[s.input, props.error && s.inputError]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        keyboardType={props.keyboardType}
        inputMode={props.keyboardType === 'numeric' ? 'numeric' : 'text'}
        selectTextOnFocus
        autoCapitalize="none"
      />
      {!!props.error && <Text style={s.errorText}>{props.error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, color: '#666', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputError: { borderColor: '#d33' },
  errorText: { marginTop: 6, color: '#d33' },
});
