// app/(vendor)/edit-profile.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../services/api';
import { storage } from '../../utils/storage';
import { Theme } from '../../constants/theme';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export default function EditProfileScreen() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile>({
    name: '', email: '', phone: '',
    address: '', city: '', state: '', pincode: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<UserProfile>>({});

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/api/users/profile');
      const d = res.data;
      setProfile({
        name:    d.name    ?? user?.name  ?? '',
        email:   d.email   ?? user?.email ?? '',
        phone:   d.phone   ?? '',
        address: d.address ?? '',
        city:    d.city    ?? '',
        state:   d.state   ?? '',
        pincode: d.pincode ?? '',
      });
    } catch {
      // Fall back to session data
      setProfile({
        name:    user?.name  ?? '',
        email:   user?.email ?? '',
        phone: '', address: '', city: '', state: '', pincode: '',
      });
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const e: Partial<UserProfile> = {};
    if (!profile.name.trim()) e.name = 'Name is required';
    if (profile.phone.trim() && !/^\d{10}$/.test(profile.phone.trim()))
      e.phone = 'Enter a valid 10-digit number';
    if (profile.pincode.trim() && !/^\d{6}$/.test(profile.pincode.trim()))
      e.pincode = 'Enter a valid 6-digit pincode';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.put('/api/users/profile', profile);

      // Update the stored user session so auth store reflects new name
      const sessionStr = await storage.getUserSession();
      if (sessionStr) {
        const parsed = JSON.parse(sessionStr);
        parsed.name = profile.name;
        await storage.setUserSession(JSON.stringify(parsed));
        // Patch zustand state directly without adding updateUser to store
        useAuthStore.setState((s) => ({
          user: s.user ? { ...s.user, name: profile.name } : s.user,
        }));
      }

      Alert.alert('Saved!', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.response?.data?.message ?? 'Failed to save';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: keyof UserProfile, value: string) => {
    setProfile((p) => ({ ...p, [field]: value }));
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>

          <Field label="Full Name *"     value={profile.name}    onChange={(v) => setField('name', v)}    placeholder="John Doe"            error={errors.name} />
          <Field label="Email"           value={profile.email}   onChange={() => {}}                       placeholder="Email"               disabled />
          <Field label="Phone Number"    value={profile.phone}   onChange={(v) => setField('phone', v)}   placeholder="10-digit number"      error={errors.phone} keyboardType="phone-pad" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Address</Text>

          <Field label="Street Address"  value={profile.address} onChange={(v) => setField('address', v)} placeholder="House / Flat, Street" />
          <View style={styles.rowFields}>
            <View style={{ flex: 1 }}>
              <Field label="City"  value={profile.city}    onChange={(v) => setField('city', v)}    placeholder="Mumbai" />
            </View>
            <View style={{ width: Theme.spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Field label="State" value={profile.state}   onChange={(v) => setField('state', v)}   placeholder="Maharashtra" />
            </View>
          </View>
          <Field label="Pincode" value={profile.pincode} onChange={(v) => setField('pincode', v)} placeholder="6-digit pincode" error={errors.pincode} keyboardType="number-pad" maxLength={6} />
        </View>

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
                <Ionicons name="save-outline" size={20} color={Theme.colors.white} />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </>
            )
          }
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChange, placeholder, error,
  keyboardType, maxLength, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string;
  keyboardType?: any; maxLength?: number; disabled?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          error && styles.fieldInputError,
          disabled && styles.fieldInputDisabled,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Theme.colors.textMuted}
        editable={!disabled}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },

  scroll: { padding: Theme.spacing.lg, paddingBottom: 48 },

  card: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.lg,
    borderWidth: 1, borderColor: Theme.colors.borderLight, ...Theme.shadow.sm,
  },
  cardTitle: {
    fontSize: Theme.font.md, fontWeight: '700',
    color: Theme.colors.text, marginBottom: Theme.spacing.lg,
  },

  rowFields: { flexDirection: 'row' },
  fieldWrap: { marginBottom: Theme.spacing.md },
  fieldLabel: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5, borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.md,
    height: 48, fontSize: Theme.font.md, color: Theme.colors.text,
    backgroundColor: Theme.colors.surface,
  },
  fieldInputError: { borderColor: Theme.colors.danger, backgroundColor: '#FFF5F3' },
  fieldInputDisabled: { backgroundColor: Theme.colors.surfaceSecondary, color: Theme.colors.textMuted },
  fieldError: { fontSize: 11, color: Theme.colors.danger, marginTop: 3 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.xl,
    paddingVertical: Theme.spacing.lg, ...Theme.shadow.sm,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
});