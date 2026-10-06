// components/vendor/SellingGate.tsx
// Locks the selling screens (orders, products) the way the server locks their
// endpoints: when the subscription is not active, or the shop is not approved
// yet. Wallet, payouts, bank details and settings are NOT wrapped in this:
// they stay open so sellers can always reach money they already earned.
//
// While a screen is locked its component is not mounted at all, so it makes
// no requests the server would refuse.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../constants/theme';
import { BLOCK_COPY, vendorBlock, type VendorBlock } from '../../services/vendor-access';
import { useVendorStatusStore } from '../../store/vendor-status.store';

/** Why selling is locked for the signed-in seller, or null when it is open. */
export function useSellingBlock(): VendorBlock | null {
  return useVendorStatusStore((s) => (s.status ? vendorBlock(s.status, 'selling') : null));
}

/** Wraps a selling screen: `export default withSellingGate(OrdersScreen, 'Orders')`. */
export function withSellingGate<P extends object>(Screen: React.ComponentType<P>, title: string) {
  function GatedScreen(props: P) {
    const block = useSellingBlock();
    // MOU_REQUIRED never gets this far: the layout shows the agreement instead.
    if (block === 'SUBSCRIPTION_EXPIRED' || block === 'SHOP_PENDING') {
      return <SellingLocked block={block} title={title} />;
    }
    return <Screen {...props} />;
  }
  GatedScreen.displayName = `withSellingGate(${title})`;
  return GatedScreen;
}

function SellingLocked({ block, title }: { block: VendorBlock; title: string }) {
  const reloadStatus = useVendorStatusStore((s) => s.load);
  const [refreshing, setRefreshing] = useState(false);
  const copy = BLOCK_COPY[block];
  const pendingApproval = block === 'SHOP_PENDING';

  const refresh = async () => {
    setRefreshing(true);
    await reloadStatus();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={Theme.colors.primary} />
        }
      >
        <View style={styles.iconCircle}>
          <Ionicons
            name={pendingApproval ? 'hourglass-outline' : 'lock-closed-outline'}
            size={32}
            color={Theme.colors.primary}
          />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.message}>{copy.message}</Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(vendor)/status')}>
          <Text style={styles.primaryBtnText}>View account status</Text>
        </TouchableOpacity>
        {!pendingApproval && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(vendor)/wallet')}>
            <Text style={styles.secondaryBtnText}>Open wallet</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.hint}>Pull down to check again.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  headerTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },

  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: Theme.spacing.xxl, gap: Theme.spacing.md },
  iconCircle: {
    width: 72, height: 72, borderRadius: Theme.radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Theme.colors.primarySurface,
  },
  title: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text, textAlign: 'center' },
  message: { fontSize: Theme.font.md, lineHeight: 22, color: Theme.colors.textSecondary, textAlign: 'center' },

  primaryBtn: {
    alignSelf: 'stretch', alignItems: 'center', marginTop: Theme.spacing.md,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.lg, paddingVertical: 14,
  },
  primaryBtnText: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.white },
  secondaryBtn: {
    alignSelf: 'stretch', alignItems: 'center',
    borderWidth: 1, borderColor: Theme.colors.primary, borderRadius: Theme.radius.lg, paddingVertical: 13,
  },
  secondaryBtnText: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.primary },
  hint: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, marginTop: Theme.spacing.sm },
});
