// app/(customer)/order-success/[id].tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../../constants/theme';

export default function OrderSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0, duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const shortId = id && id !== 'success'
    ? `#${id.slice(-8).toUpperCase()}`
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {/* Animated checkmark */}
        <Animated.View style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconInner}>
            <Ionicons name="checkmark" size={52} color={Theme.colors.white} />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.textSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.title}>Order Placed!</Text>
          <Text style={styles.subtitle}>
            Your order has been confirmed and is being processed.
          </Text>
          {shortId && (
            <View style={styles.orderIdBox}>
              <Text style={styles.orderIdLabel}>Order ID</Text>
              <Text style={styles.orderId}>{shortId}</Text>
            </View>
          )}

          {/* Steps */}
          <View style={styles.stepsBox}>
            {[
              { icon: 'checkmark-circle', label: 'Order Confirmed', done: true },
              { icon: 'construct-outline', label: 'Being Prepared', done: false },
              { icon: 'car-outline', label: 'On the Way', done: false },
              { icon: 'home-outline', label: 'Delivered', done: false },
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Ionicons
                  name={step.icon as any}
                  size={20}
                  color={step.done ? Theme.colors.success : Theme.colors.border}
                />
                <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>
                  {step.label}
                </Text>
                {step.done && (
                  <View style={styles.donePill}>
                    <Text style={styles.donePillText}>Done</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Info note */}
          <View style={styles.infoBox}>
            <Ionicons name="mail-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.infoText}>
              You'll receive order updates on your registered email.
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom Actions */}
      <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
        {shortId && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => router.push('/(customer)/orders')}
            activeOpacity={0.85}
          >
            <Ionicons name="receipt-outline" size={18} color={Theme.colors.white} />
            <Text style={styles.trackBtnText}>Track Order</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.shopBtn}
          onPress={() => router.replace('/(customer)/home')}
          activeOpacity={0.85}
        >
          <Text style={styles.shopBtnText}>Continue Shopping</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Theme.spacing.xl },

  iconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Theme.colors.successSurface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
    borderWidth: 3, borderColor: Theme.colors.success,
  },
  iconInner: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Theme.colors.success,
    justifyContent: 'center', alignItems: 'center',
    ...Theme.shadow.lg,
  },

  textSection: { width: '100%', alignItems: 'center' },
  title: { fontSize: Theme.font.xxxl, fontWeight: '800', color: Theme.colors.text, marginBottom: 8 },
  subtitle: {
    fontSize: Theme.font.md, color: Theme.colors.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: Theme.spacing.lg,
  },

  orderIdBox: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.primarySurface,
    borderRadius: Theme.radius.md, paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm, marginBottom: Theme.spacing.xl,
    borderWidth: 1, borderColor: Theme.colors.primaryLight,
  },
  orderIdLabel: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary },
  orderId: { fontSize: Theme.font.md, fontWeight: '800', color: Theme.colors.primary, letterSpacing: 1 },

  stepsBox: {
    width: '100%', backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, padding: Theme.spacing.lg,
    gap: Theme.spacing.md, marginBottom: Theme.spacing.lg,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
    ...Theme.shadow.sm,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md },
  stepLabel: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.textMuted },
  stepLabelDone: { color: Theme.colors.text, fontWeight: '600' },
  donePill: {
    backgroundColor: Theme.colors.successSurface, borderRadius: Theme.radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Theme.colors.success,
  },
  donePillText: { fontSize: 10, color: Theme.colors.success, fontWeight: '700' },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Theme.colors.primarySurface,
    borderRadius: Theme.radius.md, padding: Theme.spacing.md, width: '100%',
  },
  infoText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.text, lineHeight: 18 },

  actions: { padding: Theme.spacing.lg, gap: Theme.spacing.sm },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md, height: 52, ...Theme.shadow.sm,
  },
  trackBtnText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
  shopBtn: {
    borderRadius: Theme.radius.md, height: 48,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.primary,
  },
  shopBtnText: { color: Theme.colors.primary, fontSize: Theme.font.md, fontWeight: '600' },
});