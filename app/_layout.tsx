// app/_layout.tsx
import { router, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { UpdateRequired } from '../components/ui/UpdateRequired';
import { initMonitoring, withMonitoring } from '../services/monitoring';
import { useAppConfigStore } from '../store/app-config.store';
import { useAuthStore } from '../store/auth.store';

// Crash reporting starts before anything renders (no-op without a Sentry DSN).
initMonitoring();

function RootLayout() {
  const user = useAuthStore((state) => state.user);
  const sessionRestored = useAuthStore((state) => state.sessionRestored);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const loadAppConfig = useAppConfigStore((state) => state.load);
  const updateRequired = useAppConfigStore((state) => state.updateRequired);
  const segments = useSegments() as string[];

  // Once, at app start: read the stored session and fetch the startup config.
  useEffect(() => {
    void restoreSession();
    void loadAppConfig();
  }, [restoreSession, loadAppConfig]);

  // Send people to the right area: signed-out users to login, signed-in users
  // out of the auth screens. This also runs when the session ends (user → null).
  useEffect(() => {
    if (!sessionRestored) return;

    const inAuthGroup = segments[0] === 'auth';
    const isIndexRoute = segments.length === 0;

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
      return;
    }

    if (user && (isIndexRoute || inAuthGroup)) {
      // Vendors get the seller area; everyone else (customers, admins) the shop.
      router.replace(user.role === 'shop_owner' ? '/(vendor)/dashboard' : '/(customer)/home');
    }
  }, [user, sessionRestored, segments]);

  if (updateRequired) {
    return (
      <SafeAreaProvider>
        <UpdateRequired />
      </SafeAreaProvider>
    );
  }

  if (!sessionRestored) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }} />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default withMonitoring(RootLayout);
