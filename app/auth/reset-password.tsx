// app/auth/reset-password.tsx
// Step 3 of password reset: choose the new password. `email` and `otp` come
// from the OTP screen; the server checks the code again here and uses it up
// (POST /api/auth/reset-password).
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api-client';
import { retryAfterText, toApiError } from '../../services/api-error';
import { fieldErrors, resetPasswordSchema } from '../../services/form-schemas';
import { Theme } from '../../constants/theme';

export default function ResetPasswordScreen() {
  const { email, otp } = useLocalSearchParams<{ email: string; otp: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const startOver = () => router.replace('/auth/forgot-password');

  const handleSave = async () => {
    if (isSaving) return;
    if (!email || !otp) {
      // Opened without going through the code screen.
      startOver();
      return;
    }

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    setIsSaving(true);
    try {
      await apiClient.auth.resetPassword(email, otp, parsed.data.password);
      Alert.alert('Password changed', 'You can now sign in with your new password.', [
        { text: 'Sign In', onPress: () => router.replace('/auth/login') },
      ]);
    } catch (err) {
      const apiError = toApiError(err, 'Could not reset the password. Please try again.');
      if (apiError.status === 429) {
        Alert.alert('Too many attempts', retryAfterText(apiError.retryAfterSeconds));
      } else if (apiError.status === 400) {
        // The code expired or was already used: a new one is needed.
        Alert.alert('Code no longer valid', apiError.message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Get a new code', onPress: startOver },
        ]);
      } else {
        Alert.alert('Error', apiError.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/auth/login')}>
            <Ionicons name="close" size={22} color={Theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-open-outline" size={32} color={Theme.colors.white} />
            </View>
            <Text style={styles.title}>New password</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Choose a new password for {email}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>New password</Text>
            <View style={[styles.inputRow, errors.password ? styles.inputRowError : null]}>
              <TextInput
                style={styles.input}
                placeholder="Min. 6 characters"
                placeholderTextColor={Theme.colors.textMuted}
                value={password}
                onChangeText={(value) => { setPassword(value); setErrors({}); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

            <Text style={[styles.fieldLabel, { marginTop: Theme.spacing.lg }]}>Confirm new password</Text>
            <View style={[styles.inputRow, errors.confirmPassword ? styles.inputRowError : null]}>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor={Theme.colors.textMuted}
                value={confirmPassword}
                onChangeText={(value) => { setConfirmPassword(value); setErrors({}); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator color={Theme.colors.white} size="small" />
              ) : (
                <Text style={styles.submitText}>Save new password</Text>
              )}
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
  input: { flex: 1, fontSize: Theme.font.md, color: Theme.colors.text, height: '100%' },
  eyeButton: { padding: Theme.spacing.xs },
  errorText: { fontSize: 12, color: Theme.colors.danger, marginTop: 4, marginLeft: 2 },

  submitButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: Theme.spacing.xl, ...Theme.shadow.sm,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700', letterSpacing: 0.3 },
});
