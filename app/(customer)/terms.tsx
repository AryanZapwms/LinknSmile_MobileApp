// app/(customer)/terms.tsx
// Legal documents. The text lives on the website (one copy, always current);
// the URLs come from GET /api/app-config.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAppLinks } from '../../store/app-config.store';
import { Theme } from '../../constants/theme';

export default function TermsScreen() {
  const links = useAppLinks();

  const documents = [
    { icon: 'document-text-outline', label: 'Terms of Service', sub: 'The rules for using LinkAndSmile', url: links.terms },
    { icon: 'shield-checkmark-outline', label: 'Privacy Policy', sub: 'What data we collect and how we use it', url: links.privacyPolicy },
    { icon: 'return-down-back-outline', label: 'Refund Policy', sub: 'Returns, cancellations and refunds', url: links.refundPolicy },
  ] as const;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Privacy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {documents.map((doc) => (
          <TouchableOpacity
            key={doc.label}
            style={styles.row}
            onPress={() => void WebBrowser.openBrowserAsync(doc.url)}
            activeOpacity={0.8}
          >
            <View style={styles.iconBox}>
              <Ionicons name={doc.icon} size={20} color={Theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{doc.label}</Text>
              <Text style={styles.rowSub}>{doc.sub}</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={Theme.colors.textMuted} />
          </TouchableOpacity>
        ))}
        <Text style={styles.note}>
          To delete your account and personal data, go to Profile → Delete Account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  content: { padding: Theme.spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.md,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primarySurface, justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.text },
  rowSub: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, marginTop: 2 },
  note: { fontSize: Theme.font.sm, color: Theme.colors.textMuted, lineHeight: 20, marginTop: Theme.spacing.sm },
});
