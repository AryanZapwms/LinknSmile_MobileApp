// app/(vendor)/notifications.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>
      <View style={styles.center}>
        <Ionicons name="notifications-outline" size={64} color={Theme.colors.border} />
        <Text style={styles.message}>Coming soon</Text>
        <Text style={styles.subMessage}>You'll be able to manage notification preferences here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.borderLight,
  },
  headerTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Theme.spacing.xl },
  message: { fontSize: Theme.font.lg, fontWeight: '600', color: Theme.colors.text, marginTop: Theme.spacing.lg },
  subMessage: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, textAlign: 'center', marginTop: Theme.spacing.sm },
});