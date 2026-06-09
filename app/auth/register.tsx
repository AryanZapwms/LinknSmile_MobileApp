// app/auth/register.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';

type Role = 'customer' | 'vendor';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Full name is required';
    else if (name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';

    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) newErrors.email = 'Enter a valid email';

    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Minimum 6 characters';

    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const clearError = (field: string) => {
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const handleRegister = async () => {
    if (!validate()) { shake(); return; }

    setIsLoading(true);
    try {
      const endpoint = role === 'vendor' ? '/api/auth/register-vendor' : '/api/auth/register';
      await api.post(endpoint, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });

      // Navigate to OTP verification
      router.push({ pathname: '/auth/otp', params: { email: email.trim().toLowerCase(), flow: 'register' } });
    } catch (error: any) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Registration failed. Please try again.';
      Alert.alert('Registration Failed', message);
      shake();
    } finally {
      setIsLoading(false);
    }
  };

  const Field = ({
    label, value, onChange, placeholder, secure, showToggle, onToggle,
    inputRef, nextRef, keyboardType, error, field,
  }: any) => (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Theme.colors.textMuted}
          value={value}
          onChangeText={(v) => { onChange(v); clearError(field); }}
          secureTextEntry={secure && !showToggle}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
          returnKeyType={nextRef ? 'next' : 'done'}
          onSubmitEditing={() => nextRef?.current?.focus()}
          blurOnSubmit={!nextRef}
        />
        {secure !== undefined && (
          <TouchableOpacity onPress={onToggle} style={styles.eyeButton}>
            <Ionicons
              name={showToggle ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={Theme.colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="person-add-outline" size={28} color={Theme.colors.white} />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join LinkAndSmile today</Text>
          </View>

          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Role Toggle */}
            <View style={styles.roleSection}>
              <Text style={styles.fieldLabel}>I want to</Text>
              <View style={styles.roleToggle}>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'customer' && styles.roleOptionActive]}
                  onPress={() => setRole('customer')}
                >
                  <Ionicons
                    name="bag-handle-outline"
                    size={18}
                    color={role === 'customer' ? Theme.colors.white : Theme.colors.textSecondary}
                  />
                  <Text style={[styles.roleOptionText, role === 'customer' && styles.roleOptionTextActive]}>
                    Shop
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'vendor' && styles.roleOptionActive]}
                  onPress={() => setRole('vendor')}
                >
                  <Ionicons
                    name="storefront-outline"
                    size={18}
                    color={role === 'vendor' ? Theme.colors.white : Theme.colors.textSecondary}
                  />
                  <Text style={[styles.roleOptionText, role === 'vendor' && styles.roleOptionTextActive]}>
                    Sell
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Fields */}
            <Field
              label="Full Name" field="name" value={name} onChange={setName}
              placeholder="John Doe" nextRef={emailRef} error={errors.name}
            />
            <Field
              label="Email Address" field="email" value={email} onChange={setEmail}
              placeholder="you@example.com" inputRef={emailRef} nextRef={passwordRef}
              keyboardType="email-address" error={errors.email}
            />
            <Field
              label="Password" field="password" value={password} onChange={setPassword}
              placeholder="Min. 6 characters" secure inputRef={passwordRef}
              nextRef={confirmRef} showToggle={showPassword} onToggle={() => setShowPassword(!showPassword)}
              error={errors.password}
            />
            <Field
              label="Confirm Password" field="confirmPassword" value={confirmPassword}
              onChange={setConfirmPassword} placeholder="Re-enter password" secure
              inputRef={confirmRef} showToggle={showConfirm} onToggle={() => setShowConfirm(!showConfirm)}
              error={errors.confirmPassword}
            />

            {/* Terms note */}
            <Text style={styles.termsText}>
              By registering, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={Theme.colors.white} size="small" />
              ) : (
                <Text style={styles.submitText}>
                  {role === 'vendor' ? 'Register as Seller' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Already have an account?</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.replace('/auth/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.loginText}>Sign In</Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 32 }} />
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

  header: { alignItems: 'center', paddingBottom: Theme.spacing.xxl },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Theme.spacing.md, ...Theme.shadow.md,
  },
  title: { fontSize: Theme.font.xxl, fontWeight: '800', color: Theme.colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xxl,
    ...Theme.shadow.md,
  },

  roleSection: { marginBottom: Theme.spacing.lg },
  roleToggle: {
    flexDirection: 'row', gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.surfaceSecondary,
    borderRadius: Theme.radius.md, padding: 4, marginTop: 8,
  },
  roleOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: Theme.radius.sm,
  },
  roleOptionActive: { backgroundColor: Theme.colors.primary, ...Theme.shadow.sm },
  roleOptionText: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.textSecondary },
  roleOptionTextActive: { color: Theme.colors.white },

  fieldWrapper: { marginBottom: Theme.spacing.md },
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

  termsText: { fontSize: 12, color: Theme.colors.textMuted, textAlign: 'center', marginBottom: Theme.spacing.lg, lineHeight: 18 },
  termsLink: { color: Theme.colors.primary, fontWeight: '500' },

  submitButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    height: 52, justifyContent: 'center', alignItems: 'center',
    ...Theme.shadow.sm,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700', letterSpacing: 0.3 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Theme.spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: Theme.colors.border },
  dividerText: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginHorizontal: Theme.spacing.sm },

  loginButton: {
    borderWidth: 1.5, borderColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    height: 52, justifyContent: 'center', alignItems: 'center',
  },
  loginText: { color: Theme.colors.primary, fontSize: Theme.font.md, fontWeight: '600' },
});