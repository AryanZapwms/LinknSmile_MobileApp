// app/auth/otp.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/api-client';
import { errorMessage } from '../../services/api-error';
import { Theme } from '../../constants/theme';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

// Used for two flows, chosen by the `flow` param:
//   register → verifies the sign-up code, then sends the user to sign in
//   reset    → checks the password-reset code, then opens the new-password screen
export default function OTPScreen() {
  const { email, flow } = useLocalSearchParams<{ email: string; flow: 'register' | 'reset' }>();
  const isReset = flow === 'reset';
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const canResend = countdown <= 0;

  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const otp = digits.join('');
  const isComplete = otp.length === OTP_LENGTH && digits.every((d) => d !== '');

  const handleDigitChange = (value: string, index: number) => {
    // Pasting the whole code into one box fills all of them.
    if (value.length === OTP_LENGTH && /^\d+$/.test(value)) {
      setDigits(value.split(''));
      inputRefs.current[OTP_LENGTH - 1]?.focus();
      void verifyCode(value);
      return;
    }

    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newDigits.every((d) => d !== '')) void verifyCode(newDigits.join(''));
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const clearCode = () => {
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  const verifyCode = async (code: string) => {
    if (code.length !== OTP_LENGTH || isVerifying || !email) return;
    Keyboard.dismiss();
    setIsVerifying(true);

    try {
      if (isReset) {
        // The code is checked again (and used up) when the new password is saved.
        await apiClient.auth.verifyResetOtp(email, code);
        router.replace({ pathname: '/auth/reset-password', params: { email, otp: code } });
      } else {
        await apiClient.auth.verifyOtp(email, code);
        Alert.alert(
          'Account Verified! 🎉',
          'Your account has been created successfully. Please sign in.',
          [{ text: 'Sign In', onPress: () => router.replace('/auth/login') }]
        );
      }
    } catch (error) {
      Alert.alert('Verification Failed', errorMessage(error, 'Invalid or expired code.'));
      clearCode();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = () => verifyCode(otp);

  const handleResend = async () => {
    if (!canResend || !email) return;
    setIsResending(true);
    setCountdown(RESEND_COOLDOWN);

    try {
      // Each flow has its own kind of code.
      if (isReset) await apiClient.auth.forgotPassword(email);
      else await apiClient.auth.resendOtp(email);
      clearCode();
      Alert.alert('Code Sent', `A new code has been sent to ${email}`);
    } catch (error) {
      Alert.alert('Error', errorMessage(error, 'Could not resend the code.'));
      setCountdown(0); // let them try again straight away
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Back */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="mail-open-outline" size={36} color={Theme.colors.white} />
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a {OTP_LENGTH}-digit code to
        </Text>
        <Text style={styles.email} numberOfLines={1}>{email}</Text>

        {/* OTP Boxes */}
        <View style={styles.otpRow}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.otpBox,
                digit ? styles.otpBoxFilled : null,
                index === digits.findIndex((d) => d === '') ? styles.otpBoxFocused : null,
              ]}
              value={digit}
              onChangeText={(v) => handleDigitChange(v, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              selectTextOnFocus
              textAlign="center"
              caretHidden
            />
          ))}
        </View>

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.verifyButton, (!isComplete || isVerifying) && styles.verifyButtonDisabled]}
          onPress={handleVerify}
          disabled={!isComplete || isVerifying}
          activeOpacity={0.85}
        >
          {isVerifying ? (
            <ActivityIndicator color={Theme.colors.white} size="small" />
          ) : (
            <Text style={styles.verifyText}>Verify Code</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn&apos;t receive the code? </Text>
          {canResend ? (
            <TouchableOpacity onPress={handleResend} disabled={isResending}>
              {isResending ? (
                <ActivityIndicator size="small" color={Theme.colors.primary} />
              ) : (
                <Text style={styles.resendLink}>Resend</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.countdown}>Resend in {countdown}s</Text>
          )}
        </View>

        {/* Info note */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={Theme.colors.primary} />
          <Text style={styles.infoText}>
            Check your spam folder if you don&apos;t see the email.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  backButton: { margin: Theme.spacing.lg, alignSelf: 'flex-start', padding: 4 },
  content: { flex: 1, paddingHorizontal: Theme.spacing.xl, alignItems: 'center', paddingTop: Theme.spacing.xxl },

  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Theme.spacing.xxl, ...Theme.shadow.lg,
  },

  title: { fontSize: Theme.font.xxl, fontWeight: '800', color: Theme.colors.text, marginBottom: 8 },
  subtitle: { fontSize: Theme.font.md, color: Theme.colors.textSecondary, textAlign: 'center' },
  email: {
    fontSize: Theme.font.md, fontWeight: '700',
    color: Theme.colors.primary, marginTop: 2, marginBottom: Theme.spacing.xxxl,
    maxWidth: 280, textAlign: 'center',
  },

  otpRow: {
    flexDirection: 'row', gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.xxxl,
  },
  otpBox: {
    width: 48, height: 56, borderRadius: Theme.radius.md,
    borderWidth: 1.5, borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.surface,
    fontSize: Theme.font.xl, fontWeight: '700', color: Theme.colors.text,
    textAlign: 'center',
  },
  otpBoxFilled: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primarySurface },
  otpBoxFocused: { borderColor: Theme.colors.primaryLight },

  verifyButton: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    height: 52, width: '100%',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Theme.spacing.xl, ...Theme.shadow.sm,
  },
  verifyButtonDisabled: { opacity: 0.5 },
  verifyText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700', letterSpacing: 0.3 },

  resendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Theme.spacing.xl },
  resendLabel: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  resendLink: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '700' },
  countdown: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, fontWeight: '500' },

  infoBox: {
    flexDirection: 'row', gap: Theme.spacing.sm, alignItems: 'flex-start',
    backgroundColor: Theme.colors.primarySurface,
    borderRadius: Theme.radius.md, padding: Theme.spacing.md,
    width: '100%',
  },
  infoText: { flex: 1, fontSize: 12, color: Theme.colors.text, lineHeight: 18 },
});