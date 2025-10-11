// app/quote/[id]/edit.tsx
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { getQuoteById, updateQuote, type Quote } from '../../../lib/quotes';

type Form = {
  clientName: string;
  projectName: string;
  labor: string;     // keep as text for validation UX
  material: string;  // keep as text for validation UX
};

type Errors = {
  clientName?: string;
  projectName?: string;
  labor?: string;
  material?: string;
};

export default function EditQuote() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  const [form, setForm] = useState<Form>({
    clientName: '',
    projectName: '',
    labor: '',
    material: '',
  });

  useEffect(() => {
    (async () => {
      if (!id) {
        setQuote(null);
        setLoading(false);
        return;
      }
      const q = await getQuoteById(String(id));
      setQuote(q ?? null);
      if (q) {
        setForm({
          clientName: q.clientName ?? '',
          projectName: q.projectName ?? '',
          labor: String(q.labor ?? ''),
          material: String(q.material ?? ''),
        });
      }
      setLoading(false);
    })();
  }, [id]);

  // Parse with empty → 0 fallback; allow decimals
  const parsedLabor = useMemo(
    () => Number((form.labor || '0').replace(/[^0-9.]/g, '')),
    [form.labor]
  );
  const parsedMaterial = useMemo(
    () => Number((form.material || '0').replace(/[^0-9.]/g, '')),
    [form.material]
  );

  const errors: Errors = {};
  if (!form.clientName.trim()) errors.clientName = 'Required';
  if (!form.projectName.trim()) errors.projectName = 'Required';
  if (!Number.isFinite(parsedLabor) || parsedLabor < 0) errors.labor = 'Enter a non-negative number';
  if (!Number.isFinite(parsedMaterial) || parsedMaterial < 0) errors.material = 'Enter a non-negative number';
  const isValid = Object.keys(errors).length === 0;

  const onSave = async () => {
    if (!quote || !id) return;
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
        // total omitted → updateQuote will recompute
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const moneyKeyboard: 'default' | 'numeric' | 'decimal-pad' =
    Platform.OS === 'ios' ? 'decimal-pad' : 'numeric';

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={s.center}>
        <Text>Quote not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1 }}
    >
      <Stack.Screen
        options={{
          title: 'Edit Quote',
          headerRight: () => (
            <Button title={saving ? 'Saving…' : 'Save'} onPress={onSave} disabled={saving} />
          ),
        }}
      />
      <ScrollView contentContainerStyle={s.container}>
        <LabeledInput
          label="Client"
          placeholder="Client name"
          value={form.clientName}
          onChangeText={(t) => setForm((f) => ({ ...f, clientName: t }))}
          error={errors.clientName}
        />
        <LabeledInput
          label="Project"
          placeholder="Project name"
          value={form.projectName}
          onChangeText={(t) => setForm((f) => ({ ...f, projectName: t }))}
          error={errors.projectName}
        />
        <LabeledInput
          label="Labor"
          placeholder="0"
          value={form.labor}
          onChangeText={(t) => setForm((f) => ({ ...f, labor: t }))}
          keyboardType={moneyKeyboard}
          error={errors.labor}
        />
        <LabeledInput
          label="Material"
          placeholder="0"
          value={form.material}
          onChangeText={(t) => setForm((f) => ({ ...f, material: t }))}
          keyboardType={moneyKeyboard}
          error={errors.material}
        />

        <View style={{ height: 12 }} />
        <Button title="Cancel" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
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
        selectTextOnFocus
        autoCapitalize="none"
      />
      {!!props.error && <Text style={s.errorText}>{props.error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16 },
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
