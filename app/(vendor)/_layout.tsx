// app/(vendor)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView, TouchableOpacity, Text,
  View, useWindowDimensions, ActivityIndicator, AppState, Linking, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { telUrl, useSupportContacts } from '../../store/app-config.store';
import { useVendorStatusStore } from '../../store/vendor-status.store';
import { MouAgreement } from '../../components/vendor/MouAgreement';
import type { ApiError } from '../../services/api-error';
import { vendorBlock } from '../../services/vendor-access';
import { Theme } from '../../constants/theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

const TABS = [
  { name: 'dashboard',  title: 'Dashboard', icon: 'grid-outline' },
  { name: 'products',   title: 'Products',  icon: 'cube-outline' },
  { name: 'orders',     title: 'Orders',    icon: 'receipt-outline' },
  { name: 'wallet',     title: 'Wallet',    icon: 'wallet-outline' },
  { name: 'profile',    title: 'Profile',   icon: 'person-outline' },
];

// Hidden screens that are navigated to via router.push, not tabs
const HIDDEN_SCREENS = [
  'settings',
  'bank-details',
  'edit-profile',
  'change-password',
  'notifications',
  'seller-guidelines',
  'delete-account',
  'status',
  'mou',
];

const TAB_WIDTH = 80;

function CustomTabBar({ state, navigation }: any) {
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const offset = state.index * TAB_WIDTH - width / 2 + TAB_WIDTH / 2;
    scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: true });
  }, [state.index, width]);

  return (
       <View style={{
      backgroundColor: Theme.colors.tabBar,
      borderTopWidth: 1,
      borderTopColor: Theme.colors.tabBarBorder,
      paddingBottom: insets.bottom, // ← use safe area bottom padding
    }}>
       <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Theme.spacing.sm }}
      >
        {TABS.map((tab, index) => {
          const isActive = state.index === index;
          return (
            <TouchableOpacity
              key={tab.name}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: Theme.spacing.sm,
                paddingHorizontal: Theme.spacing.lg,
                minWidth: TAB_WIDTH,
              }}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={24}
                color={isActive ? Theme.colors.tabActive : Theme.colors.tabInactive}
              />
              <Text style={{
                fontSize: 11,
                marginTop: 3,
                fontWeight: isActive ? '700' : '500',
                color: isActive ? Theme.colors.tabActive : Theme.colors.tabInactive,
              }}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Shown instead of the seller area when the seller's status can't be loaded. */
function StatusUnavailable({ error, retrying, onRetry, onSignOut }: {
  error: ApiError;
  retrying: boolean;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const support = useSupportContacts();
  // GET /api/vendor/status answers 404 when the account has no shop.
  const noShop = error.status === 404;

  return (
    <SafeAreaView style={styles.unavailable}>
      <Ionicons
        name={noShop ? 'storefront-outline' : 'cloud-offline-outline'}
        size={44}
        color={Theme.colors.textMuted}
      />
      <Text style={styles.unavailableTitle}>
        {noShop ? 'No shop on this account' : "Couldn't load your seller account"}
      </Text>
      <Text style={styles.unavailableText}>
        {noShop
          ? "We couldn't find a shop for this seller account. Please contact support."
          : error.message}
      </Text>
      {noShop ? (
        <TouchableOpacity style={styles.unavailableBtn} onPress={() => void Linking.openURL(telUrl(support.phone))}>
          <Text style={styles.unavailableBtnText}>Call support</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.unavailableBtn} onPress={onRetry} disabled={retrying}>
          {retrying ? (
            <ActivityIndicator color={Theme.colors.white} />
          ) : (
            <Text style={styles.unavailableBtnText}>Try again</Text>
          )}
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onSignOut} disabled={retrying}>
        <Text style={styles.unavailableLink}>Sign out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

export default function VendorLayout() {
  const { user, sessionRestored, logout } = useAuthStore();
  const isVendor = user?.role === 'shop_owner';
  const userId = user?.id;
  const status = useVendorStatusStore((s) => s.status);
  const statusError = useVendorStatusStore((s) => s.error);
  const statusLoading = useVendorStatusStore((s) => s.loading);
  const loadStatus = useVendorStatusStore((s) => s.load);

  useEffect(() => {
    if (sessionRestored && user && user.role !== 'shop_owner') {
      router.replace('/(customer)/home');
    }
  }, [sessionRestored, user]);

  // Tapping a notification opens the orders tab (order details open from the
  // list there). Registering the device for push happens after sign-in, in
  // store/auth.store.ts.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(vendor)/orders');
    });
    return () => subscription.remove();
  }, []);

  // What a seller may use is decided by the server (GET /api/vendor/status).
  // Ask when the seller area opens and each time the app returns to the
  // foreground: an agreement, a subscription or an approval can change while
  // the app sits in the background.
  useEffect(() => {
    if (!isVendor) return;
    void loadStatus();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadStatus();
    });
    return () => subscription.remove();
  }, [isVendor, userId, loadStatus]);

  const spinner = (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background }}>
      <ActivityIndicator size="large" color={Theme.colors.primary} />
    </View>
  );

  if (!sessionRestored) return spinner;

  if (!isVendor) return null;

  // Nothing of the seller area is shown until the server has said what is open.
  if (!status) {
    if (!statusError) return spinner;
    return (
      <StatusUnavailable
        error={statusError}
        retrying={statusLoading}
        onRetry={() => void loadStatus()}
        onSignOut={() => void logout()}
      />
    );
  }

  // MOU_REQUIRED blocks the whole seller area: only the agreement is usable.
  // (Expired subscription and pending approval lock the selling screens only;
  // see components/vendor/SellingGate.tsx.)
  if (vendorBlock(status, 'account') === 'MOU_REQUIRED') return <MouAgreement gate />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
      {HIDDEN_SCREENS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  unavailable: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: Theme.spacing.md,
    padding: Theme.spacing.xxl, backgroundColor: Theme.colors.background,
  },
  unavailableTitle: { fontSize: Theme.font.xl, fontWeight: '800', color: Theme.colors.text, textAlign: 'center' },
  unavailableText: { fontSize: Theme.font.md, lineHeight: 22, color: Theme.colors.textSecondary, textAlign: 'center' },
  unavailableBtn: {
    alignSelf: 'stretch', alignItems: 'center', marginTop: Theme.spacing.md,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.lg, paddingVertical: 14,
  },
  unavailableBtnText: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.white },
  unavailableLink: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.textSecondary, padding: Theme.spacing.sm },
});
