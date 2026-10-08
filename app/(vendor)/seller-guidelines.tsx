// app/(vendor)/seller-guidelines.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';

export default function SellerGuidelinesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Seller Guidelines</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Ionicons name="cube-outline" size={24} color={Theme.colors.primary} />
          <Text style={styles.sectionTitle}>Product Quality</Text>
          <Text style={styles.text}>
            Ensure your products are genuine, accurately described, and meet quality standards. Misrepresentation leads to order cancellations and may affect your shop rating.
          </Text>
        </View>
        <View style={styles.section}>
          <Ionicons name="time-outline" size={24} color={Theme.colors.primary} />
          <Text style={styles.sectionTitle}>Order Fulfillment</Text>
          <Text style={styles.text}>
            Process orders within 24–48 hours. Provide tracking information promptly. Delays may result in refunds and penalties.
          </Text>
        </View>
        <View style={styles.section}>
          <Ionicons name="star-outline" size={24} color={Theme.colors.primary} />
          <Text style={styles.sectionTitle}>Customer Service</Text>
          <Text style={styles.text}>
            Respond to customer queries within 24 hours. Address complaints professionally. High ratings improve visibility.
          </Text>
        </View>
        <View style={styles.section}>
          <Ionicons name="cash-outline" size={24} color={Theme.colors.primary} />
          <Text style={styles.sectionTitle}>Payouts</Text>
          <Text style={styles.text}>
            Payouts are processed weekly. Ensure bank details are accurate to avoid delays. Minimum withdrawal amount is ₹500.
          </Text>
        </View>
        <View style={styles.section}>
          <Ionicons name="alert-circle-outline" size={24} color={Theme.colors.primary} />
          <Text style={styles.sectionTitle}>Prohibited Items</Text>
          <Text style={styles.text}>
            Do not list counterfeit, illegal, or restricted products. Violations will lead to account suspension.
          </Text>
        </View>
        <Text style={styles.footer}>For more details, contact support.</Text>
      </ScrollView>
    </SafeAreaView>
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
  content: { padding: Theme.spacing.lg, paddingBottom: 40 },
  section: { marginBottom: Theme.spacing.xl },
  sectionTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text, marginTop: 8, marginBottom: 4 },
  text: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 20 },
  footer: { textAlign: 'center', fontSize: Theme.font.xs, color: Theme.colors.textMuted, marginTop: Theme.spacing.xl },
});