// app/_layout.tsx
import { Stack, useSegments } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/auth.store';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

export default function RootLayout() {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const sessionRestored = useAuthStore((state) => state.sessionRestored);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const segments = useSegments();

  console.log('[Layout] Rendering RootLayout');
  console.log('[Layout] Current segments:', segments);
  console.log('[Layout] Session restored:', sessionRestored);
  console.log('[Layout] User:', user);

  // Restore session once on mount
  useEffect(() => {
    console.log('[Layout] useEffect: restoring session...');
    if (!sessionRestored) {
      restoreSession();
    }
  }, []);

// Handle role-based redirects
useEffect(() => {
  if (!sessionRestored) return;

  const inAuthGroup = segments[0] === 'auth';
  const isIndexRoute = segments.length === 0;

  // If no user and trying to access non-auth route, go to login
  if (!user && !inAuthGroup) {
    router.replace('/auth/login');
    return;
  }

  // If user exists, only redirect from auth or index routes
  if (user && (isIndexRoute || inAuthGroup)) {
    // Determine target route based on role
    let targetRoute: string;
    if (user.role === 'shop_owner') {
      targetRoute = '/(vendor)/dashboard';
    } else {
      // Treat 'user', 'customer', or any other role as customer
      targetRoute = '/(customer)/home';
    }
    console.log(`[Layout] Redirecting from ${segments.join('/')} to ${targetRoute}`);
    router.replace(targetRoute);
  }
}, [user, sessionRestored, segments]);

  // Show loading spinner until session restored
  if (!sessionRestored) {
    console.log('[Layout] Showing loading spinner...');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  console.log('[Layout] Rendering Stack');
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }} />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}