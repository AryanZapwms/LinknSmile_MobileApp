// app/(vendor)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView, TouchableOpacity, Text,
  View, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { Theme } from '../../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export default function VendorLayout() {
  const { user, sessionRestored } = useAuthStore();

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

  if (!sessionRestored) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background }}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  if (user?.role !== 'shop_owner') return null;

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