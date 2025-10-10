// app/new-quote.tsx
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated, Keyboard,
  KeyboardAvoidingView,
  Platform, Pressable,
  ScrollView,
  StyleSheet,
  Text, TextInput,
  View
} from 'react-native';
import { saveQuote } from '../lib/quotes';

export default function NewQuote() {
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [materialCost, setMaterialCost] = useState('');
  const [saved, setSaved] = useState(false);

  const colorAnim = useState(new Animated.Value(0))[0]; // 0 blue → 1 green
  const scrollRef = useRef<ScrollView>(null);

  const laborNum = useMemo(() => parseFloat(laborCost.replace(',', '.')) || 0, [laborCost]);
  const materialNum = useMemo(() => parseFloat(materialCost.replace(',', '.')) || 0, [materialCost]);
  const total = useMemo(() => laborNum + materialNum, [laborNum, materialNum]);

  const isDisabled = !clientName || !projectName;

  const handleSubmit = async () => {
    if (isDisabled) return;
    try {
      await saveQuote({
        clientName,
        projectName,
        labor: laborNum,
        material: materialNum,
      });
    } catch (e) {
      Alert.alert('Save failed', 'Please try again.');
      return;
    }

    // Animate success + clear
    setSaved(true);
    Animated.timing(colorAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start(() => {
      Keyboard.dismiss();
      setClientName('');
      setProjectName('');
      setLaborCost('');
      setMaterialCost('');
      scrollRef.current?.scrollTo({ y: 0, animated: true });

      setTimeout(() => {
        Animated.timing(colorAnim, { toValue: 0, duration: 400, useNativeDriver: false })
          .start(() => setSaved(false));
      }, 900);
    });
  };

  const buttonBackground = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#007BFF', '#28a745'],
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>✍️ New Quote</Text>

        <Text style={styles.label}>Client Name</Text>
        <TextInput style={styles.input} placeholder="Enter client name" value={clientName} onChangeText={setClientName} />

        <Text style={styles.label}>Project Name</Text>
        <TextInput style={styles.input} placeholder="Enter project name" value={projectName} onChangeText={setProjectName} />

        <Text style={styles.label}>Labor Cost</Text>
        <TextInput style={styles.input} placeholder="0.00" keyboardType="decimal-pad" inputMode="decimal" value={laborCost} onChangeText={setLaborCost} />

        <Text style={styles.label}>Material Cost</Text>
        <TextInput style={styles.input} placeholder="0.00" keyboardType="decimal-pad" inputMode="decimal" value={materialCost} onChangeText={setMaterialCost} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Animated.View style={[styles.saveButton, { backgroundColor: buttonBackground }]}>
          <Pressable
            style={({ pressed }) => [styles.pressable, pressed && !saved && { opacity: 0.9 }, isDisabled && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={isDisabled}
          >
            <Text style={styles.saveButtonText}>{saved ? '✅ Saved!' : 'Save Quote'}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatMoney(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

const styles = StyleSheet.create({
  scrollContainer: { padding: 20, backgroundColor: '#f9f9f9', flexGrow: 1, paddingBottom: 80 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '500', marginTop: 6 },
  input: { height: 42, borderColor: '#ccc', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, backgroundColor: '#fff' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  totalLabel: { fontSize: 16, fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: '700' },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#ccc', backgroundColor: '#fff' },
  saveButton: { borderRadius: 8, overflow: 'hidden' },
  pressable: { paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: '#a0c8f5' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
