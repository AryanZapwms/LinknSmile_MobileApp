// app/(customer)/profile.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../services/api';
import { telUrl, useAppLinks, useSupportContacts, whatsappUrl } from '../../store/app-config.store';
import { formatMoney } from '../../utils/money';
import { Theme } from '../../constants/theme';
import { Share } from 'react-native';

interface ProfileStats {
  totalOrders: number;
  totalSpent: number;
  pendingOrders: number;
}

export default function CustomerProfileScreen() {
  const { user, logout } = useAuthStore();
  const support = useSupportContacts();
  const links = useAppLinks();
  const [stats, setStats] = useState<ProfileStats>({ totalOrders: 0, totalSpent: 0, pendingOrders: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/orders');
      const orders = res.data?.orders ?? res.data ?? [];
      if (Array.isArray(orders)) {
        setStats({
          totalOrders: orders.length,
          totalSpent: orders
            .filter((o: any) => o.orderStatus !== 'cancelled')
            .reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0),
          pendingOrders: orders.filter((o: any) => ['pending', 'processing'].includes(o.orderStatus)).length,
        });
      }
    } catch { /* stats stay at defaults */ }
  }, []);

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = async () => { setRefreshing(true); await fetchStats(); setRefreshing(false); };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

const menuSections = [
  {
    title: 'Shopping',
    items: [
      { icon: 'receipt-outline', label: 'My Orders', sub: `${stats.totalOrders} orders`, onPress: () => router.push('/(customer)/orders') },
      { icon: 'time-outline', label: 'Pending Orders', sub: `${stats.pendingOrders} awaiting action`, onPress: () => router.push({ pathname: '/(customer)/orders', params: { filter: 'pending' } }) },
      { icon: 'heart-outline', label: 'Favourites', sub: 'Saved items', onPress: () => router.push('/(customer)/favourites') },
      { icon: 'location-outline', label: 'Saved Addresses', sub: 'Manage delivery addresses', onPress: () => router.push('/(customer)/addresses') },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: 'person-outline', label: 'Edit Profile', sub: 'Name, email, phone', onPress: () => router.push('/(customer)/edit-profile') },
      { icon: 'lock-closed-outline', label: 'Change Password', sub: 'Update your password', onPress: () => router.push('/(customer)/change-password') },
      { icon: 'notifications-outline', label: 'Notifications', sub: 'Manage alerts', onPress: () => router.push('/(customer)/notifications') },
      { icon: 'trash-outline', label: 'Delete Account', sub: 'Permanently delete your account and data', onPress: () => router.push('/(customer)/delete-account') },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: 'call-outline', label: 'Call Support', sub: support.phone, onPress: () => Linking.openURL(telUrl(support.phone)) },
      { icon: 'chatbubble-outline', label: 'WhatsApp Us', sub: 'Chat with our team', onPress: () => Linking.openURL(whatsappUrl(support.phone)) },
      { icon: 'mail-outline', label: 'Email Support', sub: support.email, onPress: () => Linking.openURL(`mailto:${support.email}`) },
      { icon: 'document-text-outline', label: 'Terms & Privacy', sub: 'Legal information', onPress: () => router.push('/(customer)/terms') },
    ],
  },
];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Theme.colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            {user?.image ? (
              <Image source={{ uri: user.image }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {(user?.name?.[0] ?? 'U').toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.editAvatarBtn}>
              <Ionicons name="camera" size={12} color={Theme.colors.white} />
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? 'Customer'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
            <View style={styles.rolePill}>
              <Ionicons name="bag-handle-outline" size={12} color={Theme.colors.primary} />
              <Text style={styles.roleText}>Customer</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="receipt-outline" value={stats.totalOrders} label="Orders" />
          <View style={styles.statDivider} />
          <StatCard icon="time-outline" value={stats.pendingOrders} label="Pending" color={Theme.colors.warning} />
          <View style={styles.statDivider} />
          <StatCard icon="cash-outline" value={`${formatMoney(Math.round(stats.totalSpent))}`} label="Spent" />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <QuickAction icon="cart-outline" label="Cart" onPress={() => router.push('/(customer)/cart')} />
          <QuickAction icon="receipt-outline" label="Orders" onPress={() => router.push('/(customer)/orders')} />
          <QuickAction icon="headset-outline" label="Support" onPress={() => Linking.openURL(telUrl(support.phone))} />
          <QuickAction icon="share-social-outline" label="Share App"  onPress={() => Share.share({ message: `Check out LinkAndSmile: ${links.website}` })} />
        </View>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.menuItem, i < section.items.length - 1 && styles.menuItemBorder]}
                  onPress={item.onPress}
                  activeOpacity={0.75}
                >
                  <View style={styles.menuIconBox}>
                    <Ionicons name={item.icon as any} size={20} color={Theme.colors.primary} />
                  </View>
                  <View style={styles.menuItemText}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSub}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Theme.colors.border} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={Theme.colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>LinkAndSmile v1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, value, label, color }: { icon: string; value: any; label: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={18} color={color ?? Theme.colors.primary} />
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon as any} size={22} color={Theme.colors.primary} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
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

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.lg,
    backgroundColor: Theme.colors.surface, margin: Theme.spacing.lg,
    padding: Theme.spacing.lg, borderRadius: Theme.radius.xl, ...Theme.shadow.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  avatarSection: { position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Theme.colors.primaryLight,
  },
  avatarInitial: { fontSize: Theme.font.xxl, fontWeight: '800', color: Theme.colors.primary },
  editAvatarBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Theme.colors.surface,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  profileEmail: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 2 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: Theme.colors.primarySurface,
    borderRadius: Theme.radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  roleText: { fontSize: 11, color: Theme.colors.primary, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', backgroundColor: Theme.colors.surface,
    marginHorizontal: Theme.spacing.lg, borderRadius: Theme.radius.xl,
    paddingVertical: Theme.spacing.lg, marginBottom: Theme.spacing.lg,
    ...Theme.shadow.sm, borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: Theme.colors.border, marginVertical: 4 },
  statValue: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
  statLabel: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, fontWeight: '500' },

  quickActions: {
    flexDirection: 'row', backgroundColor: Theme.colors.surface,
    marginHorizontal: Theme.spacing.lg, borderRadius: Theme.radius.xl,
    paddingVertical: Theme.spacing.lg, marginBottom: Theme.spacing.lg,
    ...Theme.shadow.sm, borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  quickAction: { flex: 1, alignItems: 'center', gap: 6 },
  quickActionIcon: {
    width: 46, height: 46, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
  },
  quickActionLabel: { fontSize: 11, color: Theme.colors.textSecondary, fontWeight: '500' },

  menuSection: { marginHorizontal: Theme.spacing.lg, marginBottom: Theme.spacing.lg },
  menuSectionTitle: { fontSize: Theme.font.sm, fontWeight: '700', color: Theme.colors.textMuted, marginBottom: Theme.spacing.sm, letterSpacing: 0.5, textTransform: 'uppercase' },
  menuCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.xl,
    overflow: 'hidden', ...Theme.shadow.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: Theme.spacing.lg, gap: Theme.spacing.md },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight },
  menuIconBox: {
    width: 40, height: 40, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
  },
  menuItemText: { flex: 1 },
  menuLabel: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  menuSub: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginTop: 2 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.sm,
    marginHorizontal: Theme.spacing.lg, borderRadius: Theme.radius.xl,
    paddingVertical: Theme.spacing.lg,
    borderWidth: 1.5, borderColor: Theme.colors.danger,
    backgroundColor: Theme.colors.dangerSurface,
  },
  logoutText: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.danger },
  version: { textAlign: 'center', fontSize: 11, color: Theme.colors.textMuted, marginTop: Theme.spacing.lg },
});