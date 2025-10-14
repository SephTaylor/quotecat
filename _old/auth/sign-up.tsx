// app/auth/sign-up.tsx
import { Link, router, Stack } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Button,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }
    try {
      setBusy(true);
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });
      if (error) throw error;
      Alert.alert('Account created', 'You can now sign in.');
      router.replace('/auth/sign-in');
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding' })}
      style={styles.container}
    >
      <Stack.Screen options={{ title: 'Create Account' }} />
      <View style={styles.form}>
        <Text style={styles.title}>Create your account ✨</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          placeholder="Minimum 6 characters"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        <Button title={busy ? 'Creating…' : 'Create Account'} onPress={onSignUp} />

        <View style={styles.footer}>
          <Text>Already have an account?</Text>
          <Link href="/auth/sign-in" style={styles.link}>
            Sign in →
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  form: { gap: 12 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#555' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 4 },
  link: { color: '#007BFF', fontWeight: '600' },
});
