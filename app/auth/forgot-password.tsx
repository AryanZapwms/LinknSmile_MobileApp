// app/auth/forgot-password.tsx
// Step 1 of password reset: ask for the email and have a 6-digit code sent
// (POST /api/auth/forgot-password). Step 2 is the OTP screen (flow "reset"),
// step 3 is auth/reset-password.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api-client';
import { retryAfterText, toApiError } from '../../services/api-error';
import { forgotPasswordSchema } from '../../services/form-schemas';
import { Theme } from '../../constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (isSending) return;

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email address');
      return;
    }
    setError('');

    setIsSending(true);
    try {
      // The server answers the same way whether or not the email has an
      // account, so this screen never reveals who is registered.
      await apiClient.auth.forgotPassword(parsed.data.email);
      router.push({ pathname: '/auth/otp', params: { email: parsed.data.email, flow: 'reset' } });
    } catch (err) {
      const apiError = toApiError(err, 'Could not send the code. Please try again.');
      setError(
        apiError.status === 429
          ? `Too many requests. ${retryAfterText(apiError.retryAfterSeconds)}`
          : apiError.message
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={32} color={Theme.colors.white} />
            </View>
            <Text style={styles.title}>Forgot password?</Text>
            <Text style={styles.subtitle}>
              Enter the email you signed up with. If it has an account, we will send a 6-digit code to reset your password.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Email address</Text>
            <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={error ? Theme.colors.danger : Theme.colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Theme.colors.textMuted}
                value={email}
                onChangeText={(value) => { setEmail(value); setError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, isSending && styles.submitButtonDisabled]}
              onPress={handleSend}
              disabled={isSending}
              activeOpacity={0.85}
            >
              {isSending ? (
                <ActivityIndicator color={Theme.colors.white} size="small" />
              ) : (
                <Text style={styles.submitText}>Send code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => router.replace('/auth/login')}>
              <Text style={styles.linkText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Theme.spacing.lg, paddingBottom: Theme.spacing.xxxl },
  backButton: { marginTop: Theme.spacing.lg, marginBottom: Theme.spacing.sm, alignSelf: 'flex-start', padding: 4 },

  header: { alignItems: 'center', paddingTop: Theme.spacing.lg, paddingBottom: Theme.spacing.xxl },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Theme.spacing.lg, ...Theme.shadow.md,
  },
  title: { fontSize: Theme.font.xxl, fontWeight: '800', color: Theme.colors.text, marginBottom: 8 },
  subtitle: {
    fontSize: Theme.font.sm, color: Theme.colors.textSecondary,
    textAlign: 'center', lineHeight: 20, paddingHorizontal: Theme.spacing.md,
  },

  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xxl,
    ...Theme.shadow.md,
  },
  fieldLabel: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md, backgroundColor: Theme.colors.surfaceSecondary,
    paddingHorizontal: Theme.spacing.md, height: 50,
  },
  inputRowError: { borderColor: Theme.colors.danger, backgroundColor: '#FFF5F3' },
  inputIcon: { marginRight: Theme.spacing.sm },
  input: { flex: 1, fontSize: Theme.font.md, color: Theme.colors.text, height: '100%' },
  errorText: { fontSize: 12, color: Theme.colors.danger, marginTop: 4, marginLeft: 2 },

  submitButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: Theme.spacing.xl, ...Theme.shadow.sm,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700', letterSpacing: 0.3 },

  linkButton: { alignItems: 'center', paddingVertical: Theme.spacing.lg },
  linkText: { color: Theme.colors.primary, fontSize: Theme.font.sm, fontWeight: '600' },
});
