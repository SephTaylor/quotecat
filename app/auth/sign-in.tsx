// app/auth/sign-in.tsx
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

export default function SignIn() {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // A) On mount: if a session exists, go Home; else show form.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        router.replace('/');           // already signed in
      } else {
        setChecking(false);            // show sign-in UI
      }
    })();
    return () => { mounted = false; };
  }, []);

  // B) Only navigate when a real SIGNED_IN event fires.
  useEffect(() => {
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          router.replace('/');         // go Home once after sign-in
        }
      });
    return () => subscription.unsubscribe();
  }, []);

  const onSignIn = async () => {
    try {
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      // navigation happens in onAuthStateChange above
    } catch (e: any) {
      Alert.alert('Sign-in failed', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <View style={s.center}>
        <Text>Checking session…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={{ flex: 1 }}
    >
      <View style={s.container}>
        <Text style={s.title}>Welcome back</Text>

        <View style={{ height: 16 }} />

        {/* Email */}
        <Text style={s.label}>Email</Text>
        <TextInput
          style={s.input}
          placeholder="you@example.com"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
        />

        <View style={{ height: 12 }} />

        {/* Password */}
        <Text style={s.label}>Password</Text>
        <TextInput
          style={s.input}
          placeholder="••••••••"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <View style={{ height: 16 }} />
        <Button title={submitting ? 'Signing in…' : 'Sign in'} onPress={onSignIn} disabled={submitting} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  label: { fontSize: 13, color: '#4b5563', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    color: '#111827',                // ensure text is visible
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
