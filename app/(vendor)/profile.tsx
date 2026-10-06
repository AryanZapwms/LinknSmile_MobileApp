// app/(vendor)/profile.tsx
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
import { telUrl, useSupportContacts, whatsappUrl } from '../../store/app-config.store';
import { Theme } from '../../constants/theme';

interface VendorStats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  walletBalance: number;
}

export default function VendorProfileScreen() {
  const { user, logout } = useAuthStore();
  const support = useSupportContacts();
  const [stats, setStats] = useState<VendorStats>({
    totalProducts: 0, totalOrders: 0, totalRevenue: 0, walletBalance: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

const fetchStats = useCallback(async () => {
  try {
    const [statsRes, walletRes] = await Promise.allSettled([
      api.get('/api/vendor/stats'),
      api.get('/api/vendor/wallet'),
    ]);
    const statsData = statsRes.status === 'fulfilled' ? statsRes.value.data : {};
    const walletData = walletRes.status === 'fulfilled' ? walletRes.value.data : {};

    // Backend returns stats inside `stats` object
    const s = statsData.stats || {};
    setStats({
      totalProducts: s.totalProducts ?? 0,
      totalOrders: s.totalOrders ?? 0,
      totalRevenue: s.totalEarnings ?? 0,       // map totalEarnings → totalRevenue
      walletBalance: walletData.totalBalance ?? 0,
    });
  } catch (err) {
    console.error(err);
  }
}, []);

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const menuSections = [
    {
      title: 'Store',
      items: [
        {
          icon: 'cube-outline',
          label: 'My Products',
          sub: `${stats.totalProducts} listed`,
          onPress: () => router.push('/(vendor)/products'),
        },
        {
          icon: 'receipt-outline',
          label: 'Orders',
          sub: `${stats.totalOrders} total`,
          onPress: () => router.push('/(vendor)/orders'),
        },
        {
          icon: 'wallet-outline',
          label: 'Wallet',
          sub: `₹${stats.walletBalance.toFixed(2)} balance`,
          onPress: () => router.push('/(vendor)/wallet'),
        },
        {
          icon: 'storefront-outline',
          label: 'Shop Settings',
          sub: 'Name, logo, description',
          onPress: () => router.push('/(vendor)/settings'),
        },
        {
          icon: 'card-outline',
          label: 'Bank Details',
          sub: 'Payout account',
          onPress: () => router.push('/(vendor)/bank-details'),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'person-outline',
          label: 'Edit Profile',
          sub: 'Name, phone, address',
          onPress: () => router.push('/(vendor)/edit-profile'),
        },
        {
          icon: 'lock-closed-outline',
          label: 'Change Password',
          sub: 'Update your password',
          onPress: () => router.push('/(vendor)/change-password'),
        },
        {
          icon: 'notifications-outline',
          label: 'Notifications',
          sub: 'Order & payout alerts',
          onPress: () => router.push('/(vendor)/notifications'),
        },
        {
          icon: 'trash-outline',
          label: 'Delete Account',
          sub: 'Close your shop and delete your account',
          onPress: () => router.push('/(vendor)/delete-account'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'call-outline',
          label: 'Call Support',
          sub: support.phone,
          onPress: () => Linking.openURL(telUrl(support.phone)),
        },
        {
          icon: 'chatbubble-outline',
          label: 'WhatsApp Us',
          sub: 'Chat with our team',
          onPress: () => Linking.openURL(whatsappUrl(support.phone)),
        },
        {
          icon: 'document-text-outline',
          label: 'Seller Guidelines',
          sub: 'Rules & best practices',
          onPress: () => router.push('/(vendor)/seller-guidelines'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Theme.colors.primary}
          />
        }
      >
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
                  {(user?.name?.[0] ?? 'V').toUpperCase()}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={() => router.push('/(vendor)/edit-profile')}
            >
              <Ionicons name="camera" size={12} color={Theme.colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? 'Vendor'}</Text>
            <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
            <View style={styles.rolePill}>
              <Ionicons name="storefront-outline" size={12} color={Theme.colors.primary} />
              <Text style={styles.roleText}>Seller</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox icon="cube-outline"    value={stats.totalProducts}              label="Products" />
          <View style={styles.statDivider} />
          <StatBox icon="receipt-outline" value={stats.totalOrders}                label="Orders" />
          <View style={styles.statDivider} />
          <StatBox icon="cash-outline"    value={`₹${stats.totalRevenue.toFixed(0)}`} label="Revenue" />
        </View>

        {/* Wallet Highlight */}
        <TouchableOpacity
          style={styles.walletCard}
          onPress={() => router.push('/(vendor)/wallet')}
          activeOpacity={0.9}
        >
          <View style={styles.walletLeft}>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={styles.walletValue}>₹{stats.walletBalance.toFixed(2)}</Text>
          </View>
          <View style={styles.walletRight}>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={22} color={Theme.colors.primary} />
            </View>
            <Ionicons name="chevron-forward" size={18} color={Theme.colors.border} />
          </View>
        </TouchableOpacity>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.menuItem,
                    i < section.items.length - 1 && styles.menuItemBorder,
                  ]}
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

function StatBox({ icon, value, label }: { icon: string; value: any; label: string }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon as any} size={18} color={Theme.colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.lg,
    backgroundColor: Theme.colors.surface,
    margin: Theme.spacing.lg, padding: Theme.spacing.lg,
    borderRadius: Theme.radius.xl,
    ...Theme.shadow.sm, borderWidth: 1, borderColor: Theme.colors.borderLight,
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
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface,
    marginHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.xl,
    paddingVertical: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    ...Theme.shadow.sm, borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: Theme.colors.border, marginVertical: 4 },
  statValue: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text },
  statLabel: { fontSize: Theme.font.xs, color: Theme.colors.textMuted, fontWeight: '500' },

  walletCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Theme.colors.primarySurface,
    marginHorizontal: Theme.spacing.lg, marginBottom: Theme.spacing.lg,
    borderRadius: Theme.radius.xl, padding: Theme.spacing.lg,
    borderWidth: 1.5, borderColor: Theme.colors.primaryLight,
  },
  walletLeft: { gap: 2 },
  walletLabel: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  walletValue: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.primary },
  walletRight: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm },
  walletIcon: {
    width: 40, height: 40, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },

  menuSection: { marginHorizontal: Theme.spacing.lg, marginBottom: Theme.spacing.lg },
  menuSectionTitle: {
    fontSize: Theme.font.sm, fontWeight: '700',
    color: Theme.colors.textMuted, marginBottom: Theme.spacing.sm,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  menuCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.xl,
    overflow: 'hidden', ...Theme.shadow.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: Theme.spacing.lg, gap: Theme.spacing.md,
  },
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Theme.spacing.sm,
    marginHorizontal: Theme.spacing.lg, borderRadius: Theme.radius.xl,
    paddingVertical: Theme.spacing.lg,
    borderWidth: 1.5, borderColor: Theme.colors.danger,
    backgroundColor: Theme.colors.dangerSurface,
  },
  logoutText: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.danger },
  version: {
    textAlign: 'center', fontSize: 11,
    color: Theme.colors.textMuted, marginTop: Theme.spacing.lg,
  },
});