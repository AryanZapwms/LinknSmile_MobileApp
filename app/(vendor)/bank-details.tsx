// app/(vendor)/bank-details.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';

interface BankDetails {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  swiftCode?: string;
  upiId?: string;
}

const EMPTY_FORM: BankDetails = {
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  swiftCode: '',
  upiId: '',
};

function maskAccountNumber(num: string): string {
  if (!num || num.length < 4) return num;
  return '•'.repeat(num.length - 4) + num.slice(-4);
}

export default function VendorBankDetailsScreen() {
  const [form, setForm] = useState<BankDetails>(EMPTY_FORM);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof BankDetails, string>>>({});

  useEffect(() => {
    fetchBankDetails();
  }, []);

  const fetchBankDetails = async () => {
    try {
      const res = await api.get('/api/vendor/bank-details');
      const data = res.data;
      if (data.success && data.bankDetails) {
        setForm({
          accountHolderName: data.bankDetails.accountHolderName || '',
          bankName: data.bankDetails.bankName || '',
          accountNumber: data.bankDetails.accountNumber || '',
          ifscCode: data.bankDetails.ifscCode || '',
          swiftCode: data.bankDetails.swiftCode || '',
          upiId: data.bankDetails.upiId || '',
        });
        setIsComplete(data.isComplete ?? false);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load bank details');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof BankDetails, string>> = {};
    if (!form.accountHolderName.trim()) newErrors.accountHolderName = 'Account holder name is required';
    if (!form.bankName.trim()) newErrors.bankName = 'Bank name is required';
    if (!form.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    } else if (!/^\d{9,18}$/.test(form.accountNumber.trim())) {
      newErrors.accountNumber = 'Account number must be 9–18 digits';
    }
    const hasIfsc = form.ifscCode?.trim();
    const hasSwift = form.swiftCode?.trim();
    if (!hasIfsc && !hasSwift) {
      newErrors.ifscCode = 'Provide at least IFSC (domestic) or SWIFT (international)';
    }
    if (hasIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.trim().toUpperCase())) {
      newErrors.ifscCode = 'Invalid format — e.g. HDFC0001234';
    }
    if (hasSwift && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(form.swiftCode!.trim().toUpperCase())) {
      newErrors.swiftCode = 'Invalid SWIFT/BIC — e.g. HDFCINBBXXX';
    }
    if (form.upiId?.trim() && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(form.upiId.trim())) {
      newErrors.upiId = 'Invalid UPI ID — e.g. name@upi';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        ifscCode: form.ifscCode.trim().toUpperCase(),
        swiftCode: form.swiftCode?.trim().toUpperCase() || undefined,
      };
      const res = await api.put('/api/vendor/bank-details', payload);
      const data = res.data;
      if (res.status === 200 && data.success) {
        setIsComplete(true);
        Alert.alert('Success', 'Bank details saved successfully!');
      } else {
        Alert.alert('Error', data.message || 'Failed to save bank details');
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Bank Details</Text>
              <Text style={styles.headerSubtitle}>Required for receiving payouts</Text>
            </View>
            <View style={[styles.statusBadge, isComplete ? styles.statusComplete : styles.statusIncomplete]}>
              <Ionicons
                name={isComplete ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={isComplete ? Theme.colors.success : '#D97706'}
              />
              <Text style={[styles.statusText, isComplete ? styles.statusTextComplete : styles.statusTextIncomplete]}>
                {isComplete ? 'Payout Ready' : 'Incomplete'}
              </Text>
            </View>
          </View>
        </View>

        {!isComplete && (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle-outline" size={20} color="#D97706" />
            <Text style={styles.warningText}>
              Bank details required for payouts. Please complete all required fields below.
            </Text>
          </View>
        )}

        {/* Account Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Information</Text>
          <Text style={styles.cardSubtitle}>
            Enter your bank account details exactly as they appear in your bank records.
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Holder Name *</Text>
            <TextInput
              style={[styles.input, errors.accountHolderName && styles.inputError]}
              value={form.accountHolderName}
              onChangeText={(text) => setForm({ ...form, accountHolderName: text })}
              placeholder="Full name as per bank records"
            />
            {errors.accountHolderName && <Text style={styles.errorText}>{errors.accountHolderName}</Text>}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bank Name *</Text>
            <TextInput
              style={[styles.input, errors.bankName && styles.inputError]}
              value={form.bankName}
              onChangeText={(text) => setForm({ ...form, bankName: text })}
              placeholder="e.g. HDFC Bank, SBI"
            />
            {errors.bankName && <Text style={styles.errorText}>{errors.bankName}</Text>}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Account Number *</Text>
            <View style={styles.iconInput}>
              <Ionicons name="card-outline" size={20} color={Theme.colors.textMuted} />
              <TextInput
                style={[styles.iconInputField, errors.accountNumber && styles.inputError]}
                value={form.accountNumber}
                onChangeText={(text) => setForm({ ...form, accountNumber: text.replace(/\D/g, '') })}
                placeholder="Digits only, 9–18 characters"
                keyboardType="numeric"
                maxLength={18}
                secureTextEntry={!showAccount}
              />
              <TouchableOpacity onPress={() => setShowAccount(!showAccount)}>
                <Ionicons name={showAccount ? 'eye-off-outline' : 'eye-outline'} size={20} color={Theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            {!showAccount && form.accountNumber && (
              <Text style={styles.maskedPreview}>Preview: {maskAccountNumber(form.accountNumber)}</Text>
            )}
            {errors.accountNumber && <Text style={styles.errorText}>{errors.accountNumber}</Text>}
          </View>
        </View>

        {/* Transfer Codes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transfer Codes</Text>
          <Text style={styles.cardSubtitle}>
            Provide IFSC for domestic (India) transfers and/or SWIFT/BIC for international payouts.
          </Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>IFSC Code *</Text>
            <TextInput
              style={[styles.input, errors.ifscCode && styles.inputError]}
              value={form.ifscCode}
              onChangeText={(text) => setForm({ ...form, ifscCode: text.toUpperCase() })}
              placeholder="e.g. HDFC0001234"
              maxLength={11}
              autoCapitalize="characters"
            />
            {errors.ifscCode && <Text style={styles.errorText}>{errors.ifscCode}</Text>}
            <Text style={styles.hintText}>Required for Indian bank accounts.</Text>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>SWIFT / BIC Code (Optional)</Text>
            <TextInput
              style={[styles.input, errors.swiftCode && styles.inputError]}
              value={form.swiftCode}
              onChangeText={(text) => setForm({ ...form, swiftCode: text.toUpperCase() })}
              placeholder="e.g. HDFCINBBXXX"
              maxLength={11}
              autoCapitalize="characters"
            />
            {errors.swiftCode && <Text style={styles.errorText}>{errors.swiftCode}</Text>}
            <Text style={styles.hintText}>Required for international payouts.</Text>
          </View>
        </View>

        {/* Additional Payment Method */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Additional Payment Method</Text>
          <Text style={styles.cardSubtitle}>Optional — speeds up instant payouts via UPI.</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>UPI ID (Optional)</Text>
            <TextInput
              style={[styles.input, errors.upiId && styles.inputError]}
              value={form.upiId}
              onChangeText={(text) => setForm({ ...form, upiId: text })}
              placeholder="yourname@upi"
            />
            {errors.upiId && <Text style={styles.errorText}>{errors.upiId}</Text>}
          </View>
        </View>

        {/* Security Notice */}
        <View style={styles.securityBox}>
          <Ionicons name="information-circle-outline" size={20} color="#2563EB" />
          <Text style={styles.securityText}>
            <Text style={styles.bold}>Important:</Text> Ensure all details are correct. We are not
            responsible for payments sent to an incorrect account. Changes apply to future payouts.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Theme.colors.white} />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color={Theme.colors.white} />
              <Text style={styles.saveButtonText}>Save Bank Details</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
  headerSubtitle: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Theme.radius.full, gap: 4 },
  statusComplete: { backgroundColor: Theme.colors.successSurface },
  statusIncomplete: { backgroundColor: '#FFF9EC' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusTextComplete: { color: Theme.colors.success },
  statusTextIncomplete: { color: '#D97706' },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF9EC',
    margin: Theme.spacing.lg,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: { flex: 1, fontSize: Theme.font.sm, color: '#B45309', lineHeight: 18 },
  card: {
    backgroundColor: Theme.colors.surface,
    margin: Theme.spacing.lg,
    padding: Theme.spacing.lg,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    ...Theme.shadow.sm,
  },
  cardTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.lg },
  inputGroup: { marginBottom: Theme.spacing.md },
  label: { fontSize: Theme.font.sm, fontWeight: '500', color: Theme.colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
    fontSize: Theme.font.sm,
    color: Theme.colors.text,
    backgroundColor: Theme.colors.background,
  },
  inputError: { borderColor: Theme.colors.danger },
  errorText: { fontSize: 12, color: Theme.colors.danger, marginTop: 4 },
  hintText: { fontSize: 11, color: Theme.colors.textMuted, marginTop: 4 },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: Theme.colors.background,
  },
  iconInputField: { flex: 1, paddingVertical: 12, fontSize: Theme.font.sm, color: Theme.colors.text, marginLeft: 8 },
  maskedPreview: { fontSize: 11, color: Theme.colors.textMuted, marginTop: 4, fontFamily: 'monospace' },
  securityBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    marginHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.lg,
    gap: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  securityText: { flex: 1, fontSize: Theme.font.xs, color: '#1E40AF', lineHeight: 18 },
  bold: { fontWeight: '700' },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primary,
    marginHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.lg,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.white },
});