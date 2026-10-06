// app/(customer)/edit-profile.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';

export default function EditProfileScreen() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [image, setImage] = useState(user?.image || null);
  const [loading, setLoading] = useState(false);

  // Debug logs (optional)
  const store = useAuthStore();
  console.log('🔍 Auth store keys:', Object.keys(store));
  console.log('🔍 user:', store.user);
  console.log('🔍 setUser:', store.setUser);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImage(base64Image);
    } else if (!result.canceled) {
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setImage(`data:image/jpeg;base64,${base64}`);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    setLoading(true);
    try {
      // The profile endpoint does not change the email (docs/mobile-api.md).
      const payload: { name: string; phone: string; imageBase64?: string } = { name, phone };
      if (image && image !== user?.image && image.startsWith('data:image')) {
        payload.imageBase64 = image;
      }
      // ✅ Use correct endpoint
      const res = await api.put('/api/users/profile', payload);
      // ✅ Update auth store with new user data
      setUser(res.data.user);
      Alert.alert('Success', 'Profile updated successfully');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update profile');
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="camera" size={30} color={Theme.colors.primary} />
            </View>
          )}
          <View style={styles.editIcon}>
            <Ionicons name="pencil" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter your name" />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={false}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  avatarContainer: { alignItems: 'center', marginVertical: Theme.spacing.xl },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: Theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  editIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Theme.colors.primary, borderRadius: 20, padding: 6 },
  form: { padding: Theme.spacing.lg },
  label: { fontSize: Theme.font.sm, fontWeight: '500', marginBottom: 6, color: Theme.colors.textSecondary },
  input: { borderWidth: 1, borderColor: Theme.colors.border, borderRadius: Theme.radius.md, padding: 12, marginBottom: Theme.spacing.lg, fontSize: Theme.font.md },
  saveBtn: { backgroundColor: Theme.colors.primary, paddingVertical: 14, borderRadius: Theme.radius.md, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: Theme.font.md },
});