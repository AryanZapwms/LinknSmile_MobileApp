import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';

interface Address {
  _id: string;
  label: 'Home' | 'Work' | 'Other';
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

type AddressForm = Omit<Address, '_id'> & { _id?: string };

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState<AddressForm>({
    label: 'Home',
    name: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    pincode: '',
    isDefault: false,
  });

  const fetchAddresses = async () => {
    try {
      const res = await api.get('/api/addresses');
      setAddresses(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAddresses(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.phone || !form.street || !form.city || !form.state || !form.pincode) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/api/addresses/${editingId}`, form);
      } else {
        await api.post('/api/addresses', form);
      }
      await fetchAddresses();
      closeModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId === id) return;
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          try {
            await api.delete(`/api/addresses/${id}`);
            await fetchAddresses();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete address');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const setDefault = async (id: string) => {
    try {
      await api.patch(`/api/addresses/${id}/default`);
      await fetchAddresses();
    } catch (error) {
      Alert.alert('Error', 'Failed to set default');
    }
  };

  const openModal = (address?: Address) => {
    if (address) {
      setEditingId(address._id);
      setForm({ ...address });
    } else {
      setEditingId(null);
      setForm({
        label: 'Home',
        name: '',
        phone: '',
        street: '',
        city: '',
        state: '',
        pincode: '',
        isDefault: false,
      });
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
  };

  const renderAddress = ({ item }: { item: Address }) => (
    <View style={styles.addressCard}>
      <View style={styles.cardHeader}>
        <View style={styles.labelRow}>
          <Ionicons name="location-outline" size={18} color={Theme.colors.primary} />
          <Text style={styles.label}>{item.label}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => openModal(item)}>
            <Ionicons name="pencil-outline" size={20} color={Theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item._id)} disabled={deletingId === item._id}>
            {deletingId === item._id ? (
              <ActivityIndicator size="small" color={Theme.colors.danger} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={Theme.colors.danger} />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.phone}>{item.phone}</Text>
      <Text style={styles.addressText}>
        {item.street}, {item.city}, {item.state} - {item.pincode}
      </Text>
      {!item.isDefault && (
        <TouchableOpacity style={styles.setDefaultBtn} onPress={() => setDefault(item._id)}>
          <Text style={styles.setDefaultText}>Set as Default</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <TouchableOpacity onPress={() => openModal()}>
          <Ionicons name="add-circle" size={28} color={Theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={addresses}
          renderItem={renderAddress}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={60} color={Theme.colors.border} />
              <Text style={styles.emptyText}>No addresses saved</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
                <Text style={styles.addBtnText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Address' : 'New Address'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.labelText}>Label</Text>
                <View style={styles.labelOptions}>
                  {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                    <TouchableOpacity
                      key={lbl}
                      style={[styles.labelOption, form.label === lbl && styles.labelOptionActive]}
                      onPress={() => setForm({ ...form, label: lbl })}
                    >
                      <Text style={[styles.labelOptionText, form.label === lbl && { color: '#fff' }]}>
                        {lbl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TextInput style={styles.input} placeholder="Full Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
              <TextInput style={styles.input} placeholder="Phone Number" keyboardType="phone-pad" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} />
              <TextInput style={styles.input} placeholder="Street Address" value={form.street} onChangeText={(t) => setForm({ ...form, street: t })} />
              <TextInput style={styles.input} placeholder="City" value={form.city} onChangeText={(t) => setForm({ ...form, city: t })} />
              <TextInput style={styles.input} placeholder="State" value={form.state} onChangeText={(t) => setForm({ ...form, state: t })} />
              <TextInput style={styles.input} placeholder="Pincode" keyboardType="numeric" value={form.pincode} onChangeText={(t) => setForm({ ...form, pincode: t })} />
              <TouchableOpacity style={styles.defaultCheckbox} onPress={() => setForm({ ...form, isDefault: !form.isDefault })}>
                <Ionicons name={form.isDefault ? 'checkbox' : 'square-outline'} size={22} color={Theme.colors.primary} />
                <Text style={styles.defaultCheckboxText}>Set as default address</Text>
              </TouchableOpacity>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// styles remain unchanged (same as your original)
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  list: { padding: Theme.spacing.lg },
  addressCard: { backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg, padding: Theme.spacing.lg, marginBottom: Theme.spacing.md, ...Theme.shadow.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.primary },
  defaultBadge: { backgroundColor: Theme.colors.successSurface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Theme.radius.full },
  defaultText: { fontSize: 10, color: Theme.colors.success },
  actions: { flexDirection: 'row', gap: Theme.spacing.md },
  name: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  phone: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 2 },
  addressText: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, marginTop: 4 },
  setDefaultBtn: { marginTop: Theme.spacing.sm, alignSelf: 'flex-start' },
  setDefaultText: { fontSize: Theme.font.sm, color: Theme.colors.primary, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: Theme.font.md, color: Theme.colors.textMuted, marginVertical: Theme.spacing.md },
  addBtn: { backgroundColor: Theme.colors.primary, paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.sm, borderRadius: Theme.radius.md },
  addBtnText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Theme.spacing.lg },
  modalContent: { backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.xl, padding: Theme.spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: Theme.font.lg, fontWeight: '700', marginBottom: Theme.spacing.lg },
  inputGroup: { marginBottom: Theme.spacing.md },
  labelText: { fontSize: Theme.font.sm, fontWeight: '500', marginBottom: 6 },
  labelOptions: { flexDirection: 'row', gap: 10 },
  labelOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Theme.radius.full, backgroundColor: Theme.colors.surfaceSecondary },
  labelOptionActive: { backgroundColor: Theme.colors.primary },
  labelOptionText: { color: Theme.colors.text },
  input: { borderWidth: 1, borderColor: Theme.colors.border, borderRadius: Theme.radius.md, padding: 12, marginBottom: Theme.spacing.md, fontSize: Theme.font.md },
  defaultCheckbox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Theme.spacing.lg },
  defaultCheckboxText: { fontSize: Theme.font.sm, color: Theme.colors.text },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Theme.spacing.md, marginTop: Theme.spacing.md },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: Theme.radius.md, borderWidth: 1, borderColor: Theme.colors.border },
  cancelText: { color: Theme.colors.text },
  saveBtn: { backgroundColor: Theme.colors.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: Theme.radius.md },
  saveText: { color: '#fff', fontWeight: '600' },
});