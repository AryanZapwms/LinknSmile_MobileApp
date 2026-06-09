// app/auth/login.tsx
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
import { useAuthStore } from '../../store/auth.store';
import { useCartStore } from '../../store/cart.store';
import { Theme } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { login, isLoading } = useAuthStore();
  const { loadCart } = useCartStore();
  const passwordRef = useRef<TextInput>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const validateEmail = (val: string) => {
    if (!val.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Enter a valid email address';
    return '';
  };

  const validatePassword = (val: string) => {
    if (!val) return 'Password is required';
    if (val.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const handleLogin = async () => {
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);

    if (eErr || pErr) {
      shake();
      return;
    }

    const success = await login(email.trim().toLowerCase(), password);

    if (success) {
      await loadCart();
      // _layout.tsx handles redirect based on user.role
    } else {
      shake();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Brand */}
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="storefront" size={36} color={Theme.colors.white} />
            </View>
            <Text style={styles.brandName}>LinkAndSmile</Text>
            <Text style={styles.brandTagline}>Your marketplace, simplified</Text>
          </View>

          {/* Card */}
          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            {/* Email */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Email address</Text>
              <View style={[styles.inputRow, emailError ? styles.inputRowError : null]}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={emailError ? Theme.colors.danger : Theme.colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setEmailError(''); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.fieldWrapper}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity onPress={() => router.push('/auth/forgot-password' as any)}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.inputRow, passwordError ? styles.inputRowError : null]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={passwordError ? Theme.colors.danger : Theme.colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Theme.colors.textMuted}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setPasswordError(''); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Theme.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={Theme.colors.white} size="small" />
              ) : (
                <Text style={styles.submitText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>New to LinkAndSmile?</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register */}
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push('/auth/register')}
              activeOpacity={0.85}
            >
              <Text style={styles.registerText}>Create an account</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Theme.spacing.lg, paddingBottom: Theme.spacing.xxxl },

  brandSection: { alignItems: 'center', paddingTop: 48, paddingBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Theme.spacing.md,
    ...Theme.shadow.md,
  },
  brandName: { fontSize: Theme.font.xxl, fontWeight: '800', color: Theme.colors.text, letterSpacing: -0.5 },
  brandTagline: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 4 },

  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xxl,
    ...Theme.shadow.md,
  },
  cardTitle: { fontSize: Theme.font.xl, fontWeight: '700', color: Theme.colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.xxl },

  fieldWrapper: { marginBottom: Theme.spacing.lg },
  fieldLabel: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 6 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  forgotText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '500' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md, backgroundColor: Theme.colors.surfaceSecondary,
    paddingHorizontal: Theme.spacing.md, height: 50,
  },
  inputRowError: { borderColor: Theme.colors.danger, backgroundColor: '#FFF5F3' },
  inputIcon: { marginRight: Theme.spacing.sm },
  input: {
    flex: 1, fontSize: Theme.font.md,
    color: Theme.colors.text, height: '100%',
  },
  eyeButton: { padding: Theme.spacing.xs },
  errorText: { fontSize: 12, color: Theme.colors.danger, marginTop: 4, marginLeft: 2 },

  submitButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: Theme.spacing.sm,
    ...Theme.shadow.sm,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700', letterSpacing: 0.3 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Theme.spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: Theme.colors.border },
  dividerText: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginHorizontal: Theme.spacing.sm },

  registerButton: {
    borderWidth: 1.5, borderColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    height: 52, justifyContent: 'center', alignItems: 'center',
  },
  registerText: { color: Theme.colors.primary, fontSize: Theme.font.md, fontWeight: '600' },
});