import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../store/cart.store';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'; // ← added TouchableOpacity
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../constants/theme';

// Logging tab bar to see which routes are being rendered
function LoggingTabBar({ state, descriptors, navigation }: any) {
  console.log('[TabBar] Current routes:', state.routes.map(r => r.name));
  console.log('[TabBar] Index:', state.index);
  
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: Theme.colors.tabBar, paddingBottom: insets.bottom }}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <TouchableOpacity key={route.key} onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
            <Ionicons name={getIconName(route.name)} size={24} color={isFocused ? Theme.colors.primary : Theme.colors.tabInactive} />
            <Text style={{ fontSize: 11, color: isFocused ? Theme.colors.primary : Theme.colors.tabInactive }}>
              {route.name === 'home' ? 'Home' : route.name === 'cart' ? 'Cart' : route.name === 'orders' ? 'Orders' : route.name === 'profile' ? 'Profile' : route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function getIconName(routeName: string): string {
  switch(routeName) {
    case 'home': return 'home-outline';
    case 'cart': return 'cart-outline';
    case 'orders': return 'receipt-outline';
    case 'profile': return 'person-outline';
    default: return 'help-outline';
  }
}

function CartTabIcon({ color, size }: { color: string; size: number }) {
  const totalItems = useCartStore((s) => s.getTotalItems());
  return (
    <View>
      <Ionicons name="cart-outline" size={size} color={color} />
      {totalItems > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{totalItems > 9 ? '9+' : totalItems}</Text>
        </View>
      )}
    </View>
  );
}

// List of all screens you want to hide from the tab bar
const HIDDEN_SCREENS = [
  'checkout',
  'product/list',
  'product/[id]',
  'order-success/[id]',
  'profile/orders/[id]',
  'addresses',          // 👈 add this
  'edit-profile',       // 👈 add this
  'change-password',    // 👈 add this
  'notifications',      // 👈 add this
  'terms',              // 👈 add this
  'wishlist',           // if you have it
];

export default function CustomerLayout() {
  const insets = useSafeAreaInsets();
  console.log('[CustomerLayout] Rendering tabs. Visible screens: Home, Cart, Orders, Profile');
  console.log('[CustomerLayout] Hidden screens:', HIDDEN_SCREENS);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: Theme.colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Theme.colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: Theme.colors.tabBarBorder,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
      }}
    //   tabBar={(props) => <LoggingTabBar {...props} />
    // }   // ← use custom tab bar for logging
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => <CartTabIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />

      {/* Explicitly hide all unwanted screens */}
      {HIDDEN_SCREENS.map((screenName) => (
        <Tabs.Screen key={screenName} name={screenName} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -5, right: -8,
    backgroundColor: Theme.colors.danger,
    borderRadius: 999, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Theme.colors.white,
  },
  badgeText: { fontSize: 9, color: Theme.colors.white, fontWeight: '800' },
});