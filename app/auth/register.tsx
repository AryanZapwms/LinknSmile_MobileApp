// app/auth/register.tsx
// Customer and seller sign-up. Both end on the OTP screen: the account (and,
// for sellers, the shop) is only created once the emailed code is verified.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Linking,
  Platform,
  TextInput,
  Animated,
  ActivityIndicator,
  Alert,
  type KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api-client';
import { errorMessage, retryAfterText, toApiError } from '../../services/api-error';
import { customerRegisterSchema, fieldErrors, vendorRegisterSchema } from '../../services/form-schemas';
import { useAppLinks } from '../../store/app-config.store';
import { Theme } from '../../constants/theme';

type Role = 'customer' | 'vendor';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  shopName: '',
  description: '',
  street: '',
  city: '',
  state: '',
  pincode: '',
  gstNumber: '',
  panNumber: '',
};
type FormState = typeof EMPTY_FORM;
type FieldName = keyof FormState;

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  multiline?: boolean;
  /** Password fields: hidden unless `visible`; shows the eye toggle. */
  secure?: boolean;
  visible?: boolean;
  onToggleVisible?: () => void;
}

// Defined outside the screen component on purpose: a component created inside
// render is a new type on every keystroke, which remounts the input and drops
// the keyboard focus.
function Field({
  label, value, onChangeText, error, placeholder, keyboardType, autoCapitalize,
  maxLength, multiline, secure, visible, onToggleVisible,
}: FieldProps) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, multiline && styles.inputRowMultiline, error ? styles.inputRowError : null]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholder={placeholder}
          placeholderTextColor={Theme.colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !visible}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' || secure ? 'none' : 'words')}
          autoCorrect={false}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {secure && (
          <TouchableOpacity onPress={onToggleVisible} style={styles.eyeButton}>
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={Theme.colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export default function RegisterScreen() {
  const [role, setRole] = useState<Role>('customer');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const links = useAppLinks();

  const [shakeAnim] = useState(() => new Animated.Value(0));
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  /** Props shared by every field: value, change handler (clears its error), error. */
  const bind = (field: FieldName) => ({
    value: form[field],
    error: errors[field],
    onChangeText: (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
  });

  const handleRegister = async () => {
    if (isLoading) return;

    // Validate with the schema for the chosen role; `send` is the matching request.
    let email: string;
    let send: () => Promise<unknown>;
    if (role === 'vendor') {
      const parsed = vendorRegisterSchema.safeParse(form);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        shake();
        return;
      }
      const { confirmPassword: _confirm, ...vendor } = parsed.data;
      email = vendor.email;
      send = () =>
        apiClient.auth.registerVendor({
          ...vendor,
          description: vendor.description || undefined,
          gstNumber: vendor.gstNumber || undefined,
          panNumber: vendor.panNumber || undefined,
        });
    } else {
      const parsed = customerRegisterSchema.safeParse(form);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        shake();
        return;
      }
      email = parsed.data.email;
      send = () => apiClient.auth.registerCustomer(parsed.data);
    }
    setErrors({});

    setIsLoading(true);
    try {
      await send();
      router.push({ pathname: '/auth/otp', params: { email, flow: 'register' } });
    } catch (error) {
      const apiError = toApiError(error);
      const message =
        apiError.status === 429
          ? `Too many attempts. ${retryAfterText(apiError.retryAfterSeconds)}`
          : errorMessage(apiError, 'Registration failed. Please try again.');
      Alert.alert('Registration Failed', message);
      shake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="person-add-outline" size={28} color={Theme.colors.white} />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join LinkAndSmile today</Text>
          </View>

          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Role toggle */}
            <View style={styles.roleSection}>
              <Text style={styles.fieldLabel}>I want to</Text>
              <View style={styles.roleToggle}>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'customer' && styles.roleOptionActive]}
                  onPress={() => { setRole('customer'); setErrors({}); }}
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
                  onPress={() => { setRole('vendor'); setErrors({}); }}
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

            {role === 'vendor' && <Text style={styles.sectionTitle}>Your details</Text>}
            <Field label="Full Name" placeholder="John Doe" {...bind('name')} />
            <Field
              label="Email Address" placeholder="you@example.com"
              keyboardType="email-address" {...bind('email')}
            />
            {role === 'vendor' && (
              <Field
                label="Mobile Number" placeholder="10-digit mobile number"
                keyboardType="phone-pad" maxLength={10} {...bind('phone')}
              />
            )}
            <Field
              label="Password" placeholder="Min. 6 characters" secure
              visible={showPassword} onToggleVisible={() => setShowPassword((v) => !v)}
              {...bind('password')}
            />
            <Field
              label="Confirm Password" placeholder="Re-enter password" secure
              visible={showConfirm} onToggleVisible={() => setShowConfirm((v) => !v)}
              {...bind('confirmPassword')}
            />

            {role === 'vendor' && (
              <>
                <Text style={styles.sectionTitle}>Your shop</Text>
                <Field label="Shop Name" placeholder="e.g. Asha Handlooms" {...bind('shopName')} />
                <Field
                  label="About your shop (optional)" placeholder="What do you sell?"
                  autoCapitalize="sentences" multiline {...bind('description')}
                />
                <Field
                  label="Street Address" placeholder="Shop no., building, street"
                  autoCapitalize="sentences" {...bind('street')}
                />
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Field label="City" placeholder="Mumbai" {...bind('city')} />
                  </View>
                  <View style={styles.rowItem}>
                    <Field label="State" placeholder="Maharashtra" {...bind('state')} />
                  </View>
                </View>
                <Field
                  label="PIN Code" placeholder="6-digit PIN code"
                  keyboardType="number-pad" maxLength={6} {...bind('pincode')}
                />
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Field
                      label="GST No. (optional)" placeholder="GSTIN"
                      autoCapitalize="characters" maxLength={15} {...bind('gstNumber')}
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <Field
                      label="PAN (optional)" placeholder="PAN"
                      autoCapitalize="characters" maxLength={10} {...bind('panNumber')}
                    />
                  </View>
                </View>
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={16} color={Theme.colors.primary} />
                  <Text style={styles.infoText}>
                    After you verify your email, our team reviews your shop. You can start listing products once it is approved.
                  </Text>
                </View>
              </>
            )}

            <Text style={styles.termsText}>
              By registering, you agree to our{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(links.terms)}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(links.privacyPolicy)}>Privacy Policy</Text>
            </Text>

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

  sectionTitle: {
    fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text,
    marginTop: Theme.spacing.sm, marginBottom: Theme.spacing.md,
  },
  row: { flexDirection: 'row', gap: Theme.spacing.sm },
  rowItem: { flex: 1 },

  fieldWrapper: { marginBottom: Theme.spacing.md },
  fieldLabel: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md, backgroundColor: Theme.colors.surfaceSecondary,
    paddingHorizontal: Theme.spacing.md, height: 50,
  },
  inputRowMultiline: { height: 84, alignItems: 'flex-start', paddingVertical: Theme.spacing.sm },
  inputRowError: { borderColor: Theme.colors.danger, backgroundColor: '#FFF5F3' },
  input: { flex: 1, fontSize: Theme.font.md, color: Theme.colors.text, height: '100%' },
  inputMultiline: { height: '100%' },
  eyeButton: { padding: Theme.spacing.xs },
  errorText: { fontSize: 12, color: Theme.colors.danger, marginTop: 4, marginLeft: 2 },

  infoBox: {
    flexDirection: 'row', gap: Theme.spacing.sm, alignItems: 'flex-start',
    backgroundColor: Theme.colors.primarySurface,
    borderRadius: Theme.radius.md, padding: Theme.spacing.md, marginBottom: Theme.spacing.md,
  },
  infoText: { flex: 1, fontSize: 12, color: Theme.colors.text, lineHeight: 18 },

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
