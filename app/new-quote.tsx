// app/new-quote.tsx
import { Stack, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
import { saveQuote } from '../lib/quotes';

type Errors = {
  clientName?: string;
  projectName?: string;
  labor?: string;
  material?: string;
};

export default function NewQuote() {
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [labor, setLabor] = useState('');    // start empty; placeholder shows 0
  const [material, setMaterial] = useState('');
  const [saving, setSaving] = useState(false);

  // Parse with empty → 0 fallback
  const parsedLabor = useMemo(
    () => Number((labor || '0').replace(/[^0-9.]/g, '')),
    [labor]
  );
  const parsedMaterial = useMemo(
    () => Number((material || '0').replace(/[^0-9.]/g, '')),
    [material]
  );

  const errors: Errors = {};
  if (!clientName.trim()) errors.clientName = 'Required';
  if (!projectName.trim()) errors.projectName = 'Required';
  if (!Number.isFinite(parsedLabor) || parsedLabor < 0) errors.labor = 'Enter a non-negative number';
  if (!Number.isFinite(parsedMaterial) || parsedMaterial < 0) errors.material = 'Enter a non-negative number';

  const isValid = Object.keys(errors).length === 0;

  const onSave = async () => {
    if (!isValid) {
      Alert.alert('Please fix the fields marked in red.');
      return;
    }
    try {
      setSaving(true);
      await saveQuote({
        clientName: clientName.trim(),
        projectName: projectName.trim(),
        labor: parsedLabor || 0,
        material: parsedMaterial || 0,
      });
      router.back(); // return to Home
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  // iOS gets a decimal pad so you can enter ".", Android keeps numeric.
  const moneyKeyboard: 'default' | 'numeric' | 'decimal-pad' =
    Platform.OS === 'ios' ? 'decimal-pad' : 'numeric';

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1 }}
    >
      <Stack.Screen options={{ title: 'New Quote' }} />
      <ScrollView contentContainerStyle={s.container}>
        <LabeledInput
          label="Client"
          placeholder="Client name"
          value={clientName}
          onChangeText={setClientName}
          error={errors.clientName}
        />
        <LabeledInput
          label="Project"
          placeholder="Project name"
          value={projectName}
          onChangeText={setProjectName}
          error={errors.projectName}
        />
        <LabeledInput
          label="Labor"
          placeholder="0"
          value={labor}
          onChangeText={setLabor}
          keyboardType={moneyKeyboard}
          error={errors.labor}
        />
        <LabeledInput
          label="Material"
          placeholder="0"
          value={material}
          onChangeText={setMaterial}
          keyboardType={moneyKeyboard}
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
        // inputMode is a web prop; on RN we can omit it safely
        selectTextOnFocus
        autoCapitalize="none"
      />
      {!!props.error && <Text style={s.errorText}>{props.error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
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
