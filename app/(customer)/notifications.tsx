import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';

export default function NotificationsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const push = await AsyncStorage.getItem('notif_push');
    const email = await AsyncStorage.getItem('notif_email');
    const sms = await AsyncStorage.getItem('notif_sms');
    setPushEnabled(push !== 'false');
    setEmailEnabled(email !== 'false');
    setSmsEnabled(sms === 'true');
  };

  const saveSetting = async (key: string, value: boolean) => {
    await AsyncStorage.setItem(key, value.toString());
    // Optionally call backend API to sync
  };

  const togglePush = (val: boolean) => {
    setPushEnabled(val);
    saveSetting('notif_push', val);
  };
  const toggleEmail = (val: boolean) => {
    setEmailEnabled(val);
    saveSetting('notif_email', val);
  };
  const toggleSms = (val: boolean) => {
    setSmsEnabled(val);
    saveSetting('notif_sms', val);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Push Notifications</Text>
            <Text style={styles.sub}>Receive alerts on your device</Text>
          </View>
          <Switch value={pushEnabled} onValueChange={togglePush} trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }} />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Email Notifications</Text>
            <Text style={styles.sub}>Order updates and promotions</Text>
          </View>
          <Switch value={emailEnabled} onValueChange={toggleEmail} trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }} />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>SMS Alerts</Text>
            <Text style={styles.sub}>Delivery status via text</Text>
          </View>
          <Switch value={smsEnabled} onValueChange={toggleSms} trackColor={{ false: Theme.colors.border, true: Theme.colors.primary }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  card: { backgroundColor: Theme.colors.surface, margin: Theme.spacing.lg, borderRadius: Theme.radius.xl, padding: Theme.spacing.lg, ...Theme.shadow.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  label: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  sub: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Theme.colors.borderLight, marginVertical: 12 },
});