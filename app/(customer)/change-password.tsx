import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';

export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleSubmit = async () => {
    if (!current || !newPassword || !confirm) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/change-password', { currentPassword: current, newPassword });
      Alert.alert('Success', 'Password changed successfully');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showCurrent}
              value={current}
              onChangeText={setCurrent}
              placeholder="Enter current password"
            />
            <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={styles.eye}>
              <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={20} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.input}
              secureTextEntry={!showNew}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 6 characters"
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eye}>
              <Ionicons name={showNew ? 'eye-off' : 'eye'} size={20} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter new password"
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Update Password</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  form: { padding: Theme.spacing.lg },
  inputGroup: { marginBottom: Theme.spacing.lg },
  label: { fontSize: Theme.font.sm, fontWeight: '500', marginBottom: 6, color: Theme.colors.textSecondary },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Theme.colors.border, borderRadius: Theme.radius.md },
  input: { flex: 1, padding: 12, fontSize: Theme.font.md },
  eye: { paddingHorizontal: 12 },
  submitBtn: { backgroundColor: Theme.colors.primary, paddingVertical: 14, borderRadius: Theme.radius.md, alignItems: 'center', marginTop: Theme.spacing.md },
  submitText: { color: '#fff', fontWeight: '700', fontSize: Theme.font.md },
});