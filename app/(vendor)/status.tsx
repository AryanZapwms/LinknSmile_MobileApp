// app/(vendor)/status.tsx
// Seller account status (GET /api/vendor/status): shop approval, vendor
// agreement, subscription, and which parts of the seller area are open.
//
// This screen states the subscription status only. It must not offer, or
// point to, a way to pay for a renewal (App Store guideline 3.1.1); see
// docs/mobile-api.md in the web repo.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../constants/theme';
import {
  BLOCK_COPY,
  describeSubscription,
  vendorBlock,
  type StatusTone,
} from '../../services/vendor-access';
import { telUrl, useSupportContacts, whatsappUrl } from '../../store/app-config.store';
import { useVendorStatusStore } from '../../store/vendor-status.store';

const TONE_COLORS: Record<StatusTone, { text: string; background: string }> = {
  ok: { text: Theme.colors.success, background: Theme.colors.successSurface },
  warning: { text: '#B45309', background: Theme.colors.warningSurface },
  blocked: { text: Theme.colors.danger, background: Theme.colors.dangerSurface },
};

function Badge({ label, tone }: { label: string; tone: StatusTone }) {
  const colors = TONE_COLORS[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors.background }]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function Card({ icon, title, badge, children }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  badge: { label: string; tone: StatusTone };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={20} color={Theme.colors.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
        <Badge {...badge} />
      </View>
      {children}
    </View>
  );
}

export default function VendorStatusScreen() {
  const status = useVendorStatusStore((s) => s.status);
  const error = useVendorStatusStore((s) => s.error);
  const reload = useVendorStatusStore((s) => s.load);
  const support = useSupportContacts();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  // The layout only shows the seller area once a status has loaded.
  if (!status) return null;

  const subscription = describeSubscription(status.subscription);
  const sellingBlock = vendorBlock(status, 'selling');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerSide}>
          <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Status</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={Theme.colors.primary} />
        }
      >
        {!!error && (
          <Text style={styles.staleNote}>
            Couldn&apos;t refresh just now. Showing the last known status.
          </Text>
        )}

        <Card
          icon="storefront-outline"
          title="Shop"
          badge={status.isApproved ? { label: 'Approved', tone: 'ok' } : { label: 'Pending approval', tone: 'warning' }}
        >
          <Text style={styles.cardText}>
            {status.isApproved
              ? 'Your shop has been approved.'
              : 'Your shop is being reviewed. You can sell as soon as it is approved.'}
          </Text>
          {!status.isActive && (
            <Text style={styles.cardText}>Your shop is currently not visible to customers.</Text>
          )}
        </Card>

        <Card
          icon="document-text-outline"
          title="Vendor agreement"
          badge={status.mouAccepted ? { label: 'Accepted', tone: 'ok' } : { label: 'Not accepted', tone: 'blocked' }}
        >
          <Text style={styles.cardText}>Version {status.mouVersion}</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(vendor)/mou')}>
            <Text style={styles.linkText}>Read the agreement</Text>
            <Ionicons name="chevron-forward" size={16} color={Theme.colors.primary} />
          </TouchableOpacity>
        </Card>

        <Card icon="ribbon-outline" title="Subscription" badge={{ label: subscription.label, tone: subscription.tone }}>
          <Text style={styles.cardText}>{subscription.detail}</Text>
          {status.subscription.source === 'comped' && (
            <Text style={styles.cardText}>This subscription is complimentary.</Text>
          )}
        </Card>

        <Text style={styles.sectionTitle}>What you can use</Text>
        <View style={styles.card}>
          <View style={styles.accessRow}>
            <Ionicons
              name={sellingBlock ? 'lock-closed-outline' : 'checkmark-circle-outline'}
              size={20}
              color={sellingBlock ? Theme.colors.danger : Theme.colors.success}
            />
            <View style={styles.accessText}>
              <Text style={styles.accessTitle}>Orders and products</Text>
              <Text style={styles.cardText}>{sellingBlock ? BLOCK_COPY[sellingBlock].message : 'Open.'}</Text>
            </View>
          </View>
          <View style={[styles.accessRow, styles.accessRowBorder]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Theme.colors.success} />
            <View style={styles.accessText}>
              <Text style={styles.accessTitle}>Wallet, payouts and bank details</Text>
              <Text style={styles.cardText}>Open. Money you have earned stays available to withdraw.</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Need help?</Text>
        <View style={styles.supportRow}>
          <TouchableOpacity style={styles.supportBtn} onPress={() => void Linking.openURL(telUrl(support.phone))}>
            <Ionicons name="call-outline" size={18} color={Theme.colors.primary} />
            <Text style={styles.supportBtnText}>Call support</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.supportBtn} onPress={() => void Linking.openURL(whatsappUrl(support.phone))}>
            <Ionicons name="logo-whatsapp" size={18} color={Theme.colors.primary} />
            <Text style={styles.supportBtnText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  headerSide: { width: 30, padding: 4 },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  content: { padding: Theme.spacing.lg, paddingBottom: Theme.spacing.xxxl, gap: Theme.spacing.md },
  staleNote: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },

  card: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, gap: Theme.spacing.sm, ...Theme.shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  cardTitle: { flex: 1, fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text },
  cardText: { fontSize: Theme.font.sm, lineHeight: 20, color: Theme.colors.textSecondary },
  badge: { borderRadius: Theme.radius.full, paddingHorizontal: Theme.spacing.md, paddingVertical: 3 },
  badgeText: { fontSize: Theme.font.xs, fontWeight: '700' },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: Theme.spacing.xs },
  linkText: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.primary },

  sectionTitle: {
    fontSize: Theme.font.sm, fontWeight: '700', color: Theme.colors.textSecondary,
    textTransform: 'uppercase', marginTop: Theme.spacing.md,
  },
  accessRow: { flexDirection: 'row', gap: Theme.spacing.md, alignItems: 'flex-start' },
  accessRowBorder: { borderTopWidth: 1, borderTopColor: Theme.colors.borderLight, paddingTop: Theme.spacing.md },
  accessText: { flex: 1 },
  accessTitle: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },

  supportRow: { flexDirection: 'row', gap: Theme.spacing.md },
  supportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.sm,
    borderWidth: 1, borderColor: Theme.colors.primary, borderRadius: Theme.radius.lg, paddingVertical: 12,
    backgroundColor: Theme.colors.surface,
  },
  supportBtnText: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.primary },
});
