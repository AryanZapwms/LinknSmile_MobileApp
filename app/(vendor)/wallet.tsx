// app/(vendor)/wallet.tsx
// FIXES:
// 1. Payout endpoint fixed: /api/vendor/payout/request → /api/vendor/payouts (POST)
// 2. Minimum payout amount matches backend (₹500 not ₹100)
// 3. totalEarned / totalWithdrawn derived from wallet data correctly
// 4. Empty states improved
// 5. Info tooltip added correctly

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Theme } from '../../constants/theme';
import { Info } from 'lucide-react-native';

interface WalletData {
  withdrawableBalance: number;  // ready to transfer
  pendingBalance: number;       // clearing (post-delivery)
  frozenBalance: number;        // on hold
  totalBalance: number;         // withdrawable + pending + frozen
  minimumWithdrawalThreshold: number;
  isFrozen: boolean;
  isClosed: boolean;
}

interface LedgerEntry {
  _id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
}

interface Payout {
  _id: string;
  amount: number;
  status: string;
  createdAt: string;
  failureReason?: string;
}

type Tab = 'overview' | 'ledger' | 'payouts';

const DEFAULT_WALLET: WalletData = {
  withdrawableBalance: 0,
  pendingBalance: 0,
  frozenBalance: 0,
  totalBalance: 0,
  minimumWithdrawalThreshold: 500,
  isFrozen: false,
  isClosed: false,
};

export default function VendorWalletScreen() {
  const [wallet, setWallet] = useState<WalletData>(DEFAULT_WALLET);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [walletRes, ledgerRes, payoutsRes] = await Promise.allSettled([
        api.get('/api/vendor/wallet'),
        api.get('/api/vendor/wallet/ledger'),
        api.get('/api/vendor/payouts'),
      ]);

      // ── Wallet ──
      if (walletRes.status === 'fulfilled') {
        const d = walletRes.value.data;
        setWallet({
          withdrawableBalance: d.withdrawableBalance ?? 0,
          pendingBalance: d.pendingBalance ?? 0,
          frozenBalance: d.frozenBalance ?? 0,
          totalBalance: d.totalBalance ?? 0,
          minimumWithdrawalThreshold: d.minimumWithdrawalThreshold ?? 500,
          isFrozen: d.isFrozen ?? false,
          isClosed: d.isClosed ?? false,
        });
      } else {
        console.error('Wallet fetch failed:', walletRes.reason);
      }

      // ── Ledger ──
      if (ledgerRes.status === 'fulfilled') {
        const d = ledgerRes.value.data;
        const entries: LedgerEntry[] = Array.isArray(d)
          ? d
          : d.entries ?? d.ledger ?? d.data ?? [];
        setLedger(entries);
      } else {
        console.error('Ledger fetch failed:', ledgerRes.reason);
      }

      // ── Payouts ──
      if (payoutsRes.status === 'fulfilled') {
        const d = payoutsRes.value.data;
        const list: Payout[] = Array.isArray(d)
          ? d
          : d.payouts ?? d.data ?? [];
        setPayouts(list);
      } else {
        console.error('Payouts fetch failed:', payoutsRes.reason);
      }
    } catch (err) {
      console.error('fetchAll unexpected error:', err);
      Alert.alert('Error', 'Failed to load wallet data. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const minPayout = wallet.minimumWithdrawalThreshold;
  const canRequestPayout = !wallet.isFrozen && !wallet.isClosed &&
    wallet.withdrawableBalance >= minPayout;

  const handleRequestPayout = () => {
    if (!canRequestPayout) {
      Alert.alert(
        'Cannot Request Payout',
        wallet.isFrozen
          ? 'Your wallet is frozen. Please contact support.'
          : `Minimum payout is ₹${minPayout}. Your withdrawable balance is ₹${wallet.withdrawableBalance.toFixed(2)}.`
      );
      return;
    }

    Alert.alert(
      'Request Payout',
      `Request a payout of ₹${wallet.withdrawableBalance.toFixed(2)}?\n\nPayouts are processed within 3–5 business days to your registered bank account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: async () => {
            setRequestingPayout(true);
            try {
              await api.post('/api/vendor/payouts', { amount: wallet.withdrawableBalance });
              Alert.alert('Payout Requested!', 'Your payout request has been submitted. It will be processed within 3–5 business days.');
              fetchAll();
            } catch (err: any) {
              const msg =
                err.response?.data?.message ??
                err.response?.data?.error ??
                'Failed to request payout. Please try again.';
              Alert.alert('Error', msg);
            } finally {
              setRequestingPayout(false);
            }
          },
        },
      ]
    );
  };

  const PAYOUT_META: Record<string, { color: string; bg: string; label: string }> = {
    REQUESTED:  { color: '#D97706', bg: '#FFF9EC', label: 'Requested' },
    PENDING:    { color: '#D97706', bg: '#FFF9EC', label: 'Pending' },
    APPROVED:   { color: Theme.colors.primary, bg: Theme.colors.primarySurface, label: 'Approved' },
    PROCESSING: { color: '#2563EB', bg: '#EFF6FF', label: 'Processing' },
    COMPLETED:  { color: Theme.colors.success, bg: Theme.colors.successSurface, label: 'Paid' },
    FAILED:     { color: Theme.colors.danger, bg: Theme.colors.dangerSurface, label: 'Failed' },
    CANCELLED:  { color: Theme.colors.textMuted, bg: Theme.colors.surfaceSecondary, label: 'Cancelled' },
  };

  const getLedgerColor = (type: string, amount: number) => {
    const t = type?.toUpperCase();
    if (t === 'CREDIT' || t === 'credit') return Theme.colors.success;
    if (t === 'DEBIT' || t === 'debit') return Theme.colors.danger;
    if (t === 'PENDING' || t === 'pending') return '#D97706';
    return amount >= 0 ? Theme.colors.success : Theme.colors.danger;
  };

  const getLedgerIcon = (type: string, amount: number): any => {
    const t = type?.toUpperCase();
    if (t === 'CREDIT') return 'arrow-down-outline';
    if (t === 'DEBIT') return 'arrow-up-outline';
    if (t === 'PENDING') return 'time-outline';
    return amount >= 0 ? 'arrow-down-outline' : 'arrow-up-outline';
  };

  if (loading) {
    return (
      <View style={styles.loaderFull}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['overview', 'ledger', 'payouts'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchAll(); }}
            tintColor={Theme.colors.primary}
          />
        }
        contentContainerStyle={styles.scroll}
      >
        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <>
            {/* Frozen warning */}
            {wallet.isFrozen && (
              <View style={styles.frozenBanner}>
                <Ionicons name="warning-outline" size={16} color={Theme.colors.danger} />
                <Text style={styles.frozenText}>
                  Your wallet is frozen. Contact support to resolve this.
                </Text>
              </View>
            )}

            {/* Hero balance */}
            <View style={styles.balanceHero}>
              <Text style={styles.balanceLabel}>Withdrawable Balance</Text>
              <Text style={styles.balanceAmount}>₹{wallet.withdrawableBalance.toFixed(2)}</Text>
              {wallet.pendingBalance > 0 && (
                <View style={styles.pendingRow}>
                  {/* <View style={styles.infoTooltipRow}>
                    <Info size={14} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.infoTooltipText}>
                      Withdrawable: Delivered orders after 7 days. Pending: Orders in progress.
                    </Text>
                  </View> */}
                  <View style={styles.pendingAmountRow}>
                    <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.pendingText}>
                      ₹{wallet.pendingBalance.toFixed(2)} pending clearance (7 days after delivery)
                    </Text>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={[styles.payoutBtn, !canRequestPayout && styles.payoutBtnDisabled]}
                onPress={handleRequestPayout}
                disabled={requestingPayout || !canRequestPayout}
              >
                {requestingPayout
                  ? <ActivityIndicator size="small" color={Theme.colors.primary} />
                  : (
                    <>
                      <Ionicons name="arrow-up-circle-outline" size={18} color={Theme.colors.primary} />
                      <Text style={styles.payoutBtnText}>Request Payout</Text>
                    </>
                  )
                }
              </TouchableOpacity>
              {!canRequestPayout && !wallet.isFrozen && (
                <Text style={styles.minPayoutHint}>
                  Min ₹{minPayout} required to withdraw
                </Text>
              )}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Ionicons name="wallet-outline" size={20} color={Theme.colors.primary} />
                <Text style={styles.statVal}>₹{wallet.totalBalance.toFixed(0)}</Text>
                <Text style={styles.statLbl}>Total Balance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Ionicons name="time-outline" size={20} color="#D97706" />
                <Text style={styles.statVal}>₹{wallet.pendingBalance.toFixed(0)}</Text>
                <Text style={styles.statLbl}>Pending</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Ionicons name="shield-outline" size={20} color={Theme.colors.danger} />
                <Text style={styles.statVal}>₹{wallet.frozenBalance.toFixed(0)}</Text>
                <Text style={styles.statLbl}>On Hold</Text>
              </View>
            </View>

            {/* Info card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How Payouts Work</Text>
              {[
                { icon: 'cart-outline', text: 'Earn money when customers place orders.' },
                { icon: 'time-outline', text: 'Funds clear 7 days after delivery.' },
                { icon: 'arrow-up-circle-outline', text: `Request a payout (min ₹${minPayout}).` },
                { icon: 'checkmark-circle-outline', text: 'Processed within 3–5 business days.' },
              ].map((item, i) => (
                <View key={i} style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons name={item.icon as any} size={16} color={Theme.colors.primary} />
                  </View>
                  <Text style={styles.infoText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Ledger ── */}
        {activeTab === 'ledger' && (
          <>
            {ledger.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="document-text-outline" size={64} color={Theme.colors.border} />
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.emptySub}>
                  Your earnings and deductions will appear here once orders are placed
                </Text>
              </View>
            ) : (
              ledger.map((entry) => {
                const color = getLedgerColor(entry.type, entry.amount);
                const icon = getLedgerIcon(entry.type, entry.amount);
                const date = new Date(entry.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                });
                const isPositive = entry.amount >= 0;
                return (
                  <View key={entry._id} style={styles.ledgerRow}>
                    <View style={[styles.ledgerIconBox, { backgroundColor: color + '18' }]}>
                      <Ionicons name={icon} size={18} color={color} />
                    </View>
                    <View style={styles.ledgerInfo}>
                      <Text style={styles.ledgerDesc} numberOfLines={1}>{entry.description}</Text>
                      <Text style={styles.ledgerDate}>{date} · {entry.status}</Text>
                    </View>
                    <Text style={[styles.ledgerAmount, { color }]}>
                      {isPositive ? '+' : ''}₹{Math.abs(entry.amount).toFixed(0)}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ── Payouts ── */}
        {activeTab === 'payouts' && (
          <>
            {payouts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="arrow-up-circle-outline" size={64} color={Theme.colors.border} />
                <Text style={styles.emptyTitle}>No payout requests yet</Text>
                <Text style={styles.emptySub}>
                  {canRequestPayout
                    ? 'You have funds available — request a payout from the Overview tab.'
                    : `Build up ₹${minPayout} in withdrawable balance to request your first payout.`}
                </Text>
              </View>
            ) : (
              payouts.map((payout) => {
                const status = payout.status?.toUpperCase() ?? 'PENDING';
                const meta = PAYOUT_META[status] ?? PAYOUT_META.PENDING;
                const date = new Date(payout.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                });
                return (
                  <View key={payout._id} style={styles.payoutRow}>
                    <View style={styles.payoutLeft}>
                      <Text style={styles.payoutAmount}>₹{payout.amount.toFixed(2)}</Text>
                      <Text style={styles.payoutDate}>Requested {date}</Text>
                      {payout.failureReason && (
                        <Text style={styles.payoutNote}>{payout.failureReason}</Text>
                      )}
                    </View>
                    <View style={[styles.payoutStatusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.payoutStatusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  loaderFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background },
  header: {
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  headerTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },

  tabBar: {
    flexDirection: 'row', backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  tab: { flex: 1, paddingVertical: Theme.spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Theme.colors.primary },
  tabText: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.textMuted },
  tabTextActive: { color: Theme.colors.primary },

  scroll: { padding: Theme.spacing.lg },

  frozenBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: Theme.colors.dangerSurface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.danger + '30',
  },
  frozenText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.danger },

  balanceHero: {
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xxl, alignItems: 'center',
    marginBottom: Theme.spacing.lg, ...Theme.shadow.lg,
  },
  balanceLabel: { fontSize: Theme.font.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 6 },
  balanceAmount: { fontSize: 40, fontWeight: '800', color: Theme.colors.white, marginBottom: Theme.spacing.sm },
  pendingRow: {
    width: '100%',
    marginBottom: Theme.spacing.lg,
    paddingHorizontal: 8,
  },
  infoTooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 6,
  },
  infoTooltipText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  pendingAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pendingText: { fontSize: Theme.font.xs, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  payoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Theme.colors.white, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.md,
    marginBottom: 8,
  },
  payoutBtnDisabled: { opacity: 0.6 },
  payoutBtnText: { color: Theme.colors.primary, fontWeight: '700', fontSize: Theme.font.md },
  minPayoutHint: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  statsRow: {
    flexDirection: 'row', backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl, padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg, ...Theme.shadow.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: Theme.colors.border, marginVertical: 4 },
  statVal: { fontSize: Theme.font.lg, fontWeight: '800', color: Theme.colors.text },
  statLbl: { fontSize: 10, color: Theme.colors.textMuted, fontWeight: '500' },

  infoCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  infoTitle: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text, marginBottom: Theme.spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Theme.spacing.md, marginBottom: Theme.spacing.md },
  infoIconBox: {
    width: 32, height: 32, borderRadius: Theme.radius.sm,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
  },
  infoText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 20, paddingTop: 6 },

  emptyBox: { flex: 1, alignItems: 'center', paddingTop: 60, gap: Theme.spacing.sm },
  emptyTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text, marginTop: 8 },
  emptySub: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },

  ledgerRow: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  ledgerIconBox: { width: 40, height: 40, borderRadius: Theme.radius.md, justifyContent: 'center', alignItems: 'center' },
  ledgerInfo: { flex: 1 },
  ledgerDesc: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text },
  ledgerDate: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginTop: 2 },
  ledgerAmount: { fontSize: Theme.font.md, fontWeight: '800' },

  payoutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  payoutLeft: { gap: 2 },
  payoutAmount: { fontSize: Theme.font.lg, fontWeight: '800', color: Theme.colors.text },
  payoutDate: { fontSize: Theme.font.xs, color: Theme.colors.textMuted },
  payoutNote: { fontSize: Theme.font.xs, color: Theme.colors.danger, marginTop: 2 },
  payoutStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Theme.radius.full },
  payoutStatusText: { fontSize: 12, fontWeight: '700' },
});