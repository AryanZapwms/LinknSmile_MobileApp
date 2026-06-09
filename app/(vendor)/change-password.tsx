// app/(vendor)/change-password.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import { Theme } from '../../constants/theme';

interface PasswordStrength {
  score: number;       // 0–4
  label: string;
  color: string;
}

function getStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: '', color: Theme.colors.border };
  let score = 0;
  if (pw.length >= 8)                    score++;
  if (/[A-Z]/.test(pw))                  score++;
  if (/[0-9]/.test(pw))                  score++;
  if (/[^A-Za-z0-9]/.test(pw))           score++;
  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = [
    Theme.colors.danger,
    '#D97706',
    Theme.colors.warning,
    Theme.colors.success,
    Theme.colors.success,
  ];
  return { score, label: labels[score], color: colors[score] };
}

export default function ChangePasswordScreen() {
  const { logout } = useAuthStore();

  const [current, setCurrent]     = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [errors, setErrors]           = useState<Record<string, string>>({});

  const newPwRef    = useRef<TextInput>(null);
  const confirmRef  = useRef<TextInput>(null);
  const shakeAnim   = useRef(new Animated.Value(0)).current;

  const strength = getStrength(newPw);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const clearError = (field: string) =>
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!current)           e.current = 'Current password is required';
    if (!newPw)             e.newPw   = 'New password is required';
    else if (newPw.length < 6) e.newPw = 'Minimum 6 characters';
    if (!confirm)           e.confirm = 'Please confirm your new password';
    else if (newPw !== confirm) e.confirm = 'Passwords do not match';
    if (current && newPw && current === newPw)
      e.newPw = 'New password must be different from current password';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { shake(); return; }
    setSaving(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: current,
        newPassword: newPw,
      });

      Alert.alert(
        'Password Changed',
        'Your password has been updated. Please sign in again with your new password.',
        [{
          text: 'Sign In',
          onPress: async () => {
            await logout();
            // _layout.tsx watches user → null and redirects to /auth/login
          },
        }]
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.error ??
        err.response?.data?.message ??
        'Failed to change password. Please try again.';

      // Surface wrong-current-password as a field error
      if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('incorrect')) {
        setErrors({ current: 'Current password is incorrect' });
      } else {
        Alert.alert('Error', msg);
      }
      shake();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Security note */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Theme.colors.primary} />
          <Text style={styles.infoText}>
            Use a strong, unique password. You'll be signed out after changing it.
          </Text>
        </View>

        <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>

          {/* Current Password */}
          <PwField
            label="Current Password"
            value={current}
            onChange={(v) => { setCurrent(v); clearError('current'); }}
            show={showCurrent}
            onToggle={() => setShowCurrent((s) => !s)}
            error={errors.current}
            placeholder="Your current password"
            returnKeyType="next"
            onSubmitEditing={() => newPwRef.current?.focus()}
          />

          <View style={styles.divider} />

          {/* New Password */}
          <PwField
            label="New Password"
            value={newPw}
            onChange={(v) => { setNewPw(v); clearError('newPw'); }}
            show={showNew}
            onToggle={() => setShowNew((s) => !s)}
            error={errors.newPw}
            placeholder="Min. 6 characters"
            inputRef={newPwRef}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />

          {/* Strength meter */}
          {newPw.length > 0 && (
            <View style={styles.strengthRow}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.strengthBar,
                    { backgroundColor: i < strength.score ? strength.color : Theme.colors.border },
                  ]}
                />
              ))}
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}

          {/* Password tips */}
          {newPw.length > 0 && strength.score < 3 && (
            <View style={styles.tipsBox}>
              {[
                { check: newPw.length >= 8,          tip: 'At least 8 characters' },
                { check: /[A-Z]/.test(newPw),         tip: 'One uppercase letter' },
                { check: /[0-9]/.test(newPw),         tip: 'One number' },
                { check: /[^A-Za-z0-9]/.test(newPw),  tip: 'One special character' },
              ].map((item, i) => (
                <View key={i} style={styles.tipRow}>
                  <Ionicons
                    name={item.check ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={item.check ? Theme.colors.success : Theme.colors.textMuted}
                  />
                  <Text style={[styles.tipText, item.check && styles.tipTextDone]}>
                    {item.tip}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.divider} />

          {/* Confirm Password */}
          <PwField
            label="Confirm New Password"
            value={confirm}
            onChange={(v) => { setConfirm(v); clearError('confirm'); }}
            show={showConfirm}
            onToggle={() => setShowConfirm((s) => !s)}
            error={errors.confirm}
            placeholder="Re-enter new password"
            inputRef={confirmRef}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          {/* Match indicator */}
          {confirm.length > 0 && (
            <View style={styles.matchRow}>
              <Ionicons
                name={newPw === confirm ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={newPw === confirm ? Theme.colors.success : Theme.colors.danger}
              />
              <Text style={[
                styles.matchText,
                { color: newPw === confirm ? Theme.colors.success : Theme.colors.danger },
              ]}>
                {newPw === confirm ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            </View>
          )}
        </Animated.View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={Theme.colors.white} size="small" />
            : (
              <>
                <Ionicons name="lock-closed-outline" size={20} color={Theme.colors.white} />
                <Text style={styles.saveBtnText}>Update Password</Text>
              </>
            )
          }
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PwField({
  label, value, onChange, show, onToggle, error,
  placeholder, inputRef, returnKeyType, onSubmitEditing,
}: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; error?: string;
  placeholder?: string; inputRef?: any;
  returnKeyType?: any; onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, error && styles.inputRowError]}>
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color={error ? Theme.colors.danger : Theme.colors.textMuted}
          style={{ marginRight: Theme.spacing.sm }}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={placeholder}
          placeholderTextColor={Theme.colors.textMuted}
          returnKeyType={returnKeyType ?? 'done'}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={returnKeyType === 'done'}
        />
        <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
          <Ionicons
            name={show ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={Theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },

  scroll: { padding: Theme.spacing.lg, paddingBottom: 48 },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.primarySurface,
    borderRadius: Theme.radius.md, padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    borderWidth: 1, borderColor: Theme.colors.primaryLight,
  },
  infoText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.text, lineHeight: 18 },

  card: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.lg,
    borderWidth: 1, borderColor: Theme.colors.borderLight, ...Theme.shadow.sm,
  },
  divider: { height: 1, backgroundColor: Theme.colors.borderLight, marginVertical: Theme.spacing.md },

  fieldWrap: { marginBottom: Theme.spacing.sm },
  fieldLabel: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.md,
    height: 50, backgroundColor: Theme.colors.surfaceSecondary,
  },
  inputRowError: { borderColor: Theme.colors.danger, backgroundColor: '#FFF5F3' },
  input: { flex: 1, fontSize: Theme.font.md, color: Theme.colors.text },
  eyeBtn: { padding: Theme.spacing.xs },
  fieldError: { fontSize: 11, color: Theme.colors.danger, marginTop: 3 },

  strengthRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginTop: Theme.spacing.sm,
  },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 70, textAlign: 'right' },

  tipsBox: {
    marginTop: Theme.spacing.sm, gap: 4,
    backgroundColor: Theme.colors.surfaceSecondary,
    borderRadius: Theme.radius.md, padding: Theme.spacing.md,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipText: { fontSize: 12, color: Theme.colors.textMuted },
  tipTextDone: { color: Theme.colors.success, textDecorationLine: 'line-through' },

  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Theme.spacing.sm },
  matchText: { fontSize: 12, fontWeight: '600' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.xl,
    paddingVertical: Theme.spacing.lg, ...Theme.shadow.sm,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
});