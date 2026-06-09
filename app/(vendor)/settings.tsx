// app/(vendor)/settings.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';

interface ShopSettings {
  shopName: string;
  description: string;
  contactInfo: {
    phone: string;
    email: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  commissionRate: number;
}

export default function VendorSettingsScreen() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/api/vendor/settings');
      const data = res.data;
      if (data.success) {
        const shop = data.shop;
        setSettings({
          shopName: shop.shopName || '',
          description: shop.description || '',
          contactInfo: shop.contactInfo || { phone: '', email: '' },
          address: shop.address || { street: '', city: '', state: '', pincode: '', country: 'India' },
          commissionRate: shop.commissionRate || 10
        });
      } else {
        Alert.alert('Error', 'Failed to load settings');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.put('/api/vendor/settings', settings);
      const data = res.data;
      if (data.success) {
        Alert.alert('Success', 'Settings updated successfully!');
      } else {
        Alert.alert('Error', data.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
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
          <Text style={styles.headerTitle}>Shop Settings</Text>
        </View>

        {/* Shop Profile */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shop Profile</Text>
          <Text style={styles.cardSubtitle}>Update your shop's basic identity.</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Shop Name *</Text>
            <TextInput
              style={styles.input}
              value={settings.shopName}
              onChangeText={(text) => setSettings({ ...settings, shopName: text })}
              placeholder="Enter shop name"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={settings.description}
              onChangeText={(text) => setSettings({ ...settings, description: text })}
              placeholder="Tell customers about your shop..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={Theme.colors.textMuted} />
            <Text style={styles.infoText}>
              Your current platform commission rate is <Text style={styles.bold}>{settings.commissionRate}%</Text>.
              Contact admin to request a rate change.
            </Text>
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Information</Text>
          <Text style={styles.cardSubtitle}>How customers and admin can reach you.</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <View style={styles.iconInput}>
              <Ionicons name="call-outline" size={20} color={Theme.colors.textMuted} />
              <TextInput
                style={styles.iconInputField}
                value={settings.contactInfo.phone}
                onChangeText={(text) => setSettings({
                  ...settings,
                  contactInfo: { ...settings.contactInfo, phone: text }
                })}
                placeholder="9876543210"
                keyboardType="phone-pad"
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address *</Text>
            <View style={styles.iconInput}>
              <Ionicons name="mail-outline" size={20} color={Theme.colors.textMuted} />
              <TextInput
                style={styles.iconInputField}
                value={settings.contactInfo.email}
                onChangeText={(text) => setSettings({
                  ...settings,
                  contactInfo: { ...settings.contactInfo, email: text }
                })}
                placeholder="vendor@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {/* Address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shop Address</Text>
          <Text style={styles.cardSubtitle}>Primary business location.</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Street Address *</Text>
            <TextInput
              style={styles.input}
              value={settings.address.street}
              onChangeText={(text) => setSettings({
                ...settings,
                address: { ...settings.address, street: text }
              })}
              placeholder="123 Business Lane"
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={styles.input}
                value={settings.address.city}
                onChangeText={(text) => setSettings({
                  ...settings,
                  address: { ...settings.address, city: text }
                })}
                placeholder="Mumbai"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>State *</Text>
              <TextInput
                style={styles.input}
                value={settings.address.state}
                onChangeText={(text) => setSettings({
                  ...settings,
                  address: { ...settings.address, state: text }
                })}
                placeholder="Maharashtra"
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Pincode *</Text>
              <TextInput
                style={styles.input}
                value={settings.address.pincode}
                onChangeText={(text) => setSettings({
                  ...settings,
                  address: { ...settings.address, pincode: text }
                })}
                placeholder="400001"
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Country *</Text>
              <TextInput
                style={styles.input}
                value={settings.address.country}
                onChangeText={(text) => setSettings({
                  ...settings,
                  address: { ...settings.address, country: text }
                })}
                placeholder="India"
              />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleUpdate}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Theme.colors.white} />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color={Theme.colors.white} />
              <Text style={styles.saveButtonText}>Save All Changes</Text>
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
  headerTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
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
  textArea: { height: 100, textAlignVertical: 'top' },
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
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.primarySurface,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    marginTop: Theme.spacing.sm,
    gap: 8,
  },
  infoText: { flex: 1, fontSize: Theme.font.xs, color: Theme.colors.textSecondary, lineHeight: 18 },
  bold: { fontWeight: '700', color: Theme.colors.primary },
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