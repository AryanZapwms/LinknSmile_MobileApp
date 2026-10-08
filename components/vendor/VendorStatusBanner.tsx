// components/vendor/VendorStatusBanner.tsx
// A one-line notice for the dashboard when something about the seller's
// account needs attention: selling locked, or the subscription ending or in
// its grace period. Shows nothing when all is well. Tapping it opens the
// status screen.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/theme';
import { BLOCK_COPY, describeSubscription, vendorBlock } from '../../services/vendor-access';
import { useVendorStatusStore } from '../../store/vendor-status.store';

export function VendorStatusBanner() {
  const status = useVendorStatusStore((s) => s.status);
  if (!status) return null;

  const block = vendorBlock(status, 'selling');
  const subscription = describeSubscription(status.subscription);

  let notice: { title: string; message: string; blocked: boolean } | null = null;
  if (block) {
    notice = { ...BLOCK_COPY[block], blocked: true };
  } else if (subscription.tone === 'warning') {
    notice = { title: `Subscription: ${subscription.label}`, message: subscription.detail, blocked: false };
  }
  if (!notice) return null;

  const color = notice.blocked ? Theme.colors.danger : '#B45309';
  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: notice.blocked ? Theme.colors.dangerSurface : Theme.colors.warningSurface, borderColor: color }]}
      onPress={() => router.push('/(vendor)/status')}
      activeOpacity={0.8}
    >
      <Ionicons name={notice.blocked ? 'lock-closed-outline' : 'time-outline'} size={20} color={color} />
      <View style={styles.text}>
        <Text style={[styles.title, { color }]}>{notice.title}</Text>
        <Text style={styles.message}>{notice.message}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    marginHorizontal: Theme.spacing.lg, marginBottom: Theme.spacing.md,
    padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1,
  },
  text: { flex: 1 },
  title: { fontSize: Theme.font.sm, fontWeight: '700' },
  message: { fontSize: Theme.font.sm, lineHeight: 18, color: Theme.colors.text, marginTop: 2 },
});
