// components/vendor/MouAgreement.tsx
// The vendor agreement (MOU): read it, tick the box, "I Agree".
// GET /api/vendor/mou for the text, POST /api/vendor/mou to accept.
//
// Used in two places:
// - as the gate app/(vendor)/_layout.tsx shows INSTEAD of the seller area
//   while the current agreement version is not accepted (`gate`). Nothing
//   else is reachable then, so the gate also offers sign-out and account
//   deletion;
// - as the screen /(vendor)/mou, to re-read an agreement already accepted.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../constants/theme';
import { apiClient } from '../../services/api-client';
import { errorMessage } from '../../services/api-error';
import { formatStatusDate } from '../../services/vendor-access';
import { useAuthStore } from '../../store/auth.store';
import { useVendorStatusStore } from '../../store/vendor-status.store';
import { DeleteAccount } from '../account/DeleteAccount';
import { MouDocument } from './MouDocument';

/** GET /api/vendor/mou. */
type VendorMou = Awaited<ReturnType<typeof apiClient.vendor.mou>>;

export function MouAgreement({ gate = false }: { gate?: boolean }) {
  const logout = useAuthStore((s) => s.logout);
  const reloadStatus = useVendorStatusStore((s) => s.load);

  const [mou, setMou] = useState<VendorMou | null>(null);
  const [loadError, setLoadError] = useState('');
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const load = useCallback(
    () =>
      apiClient.vendor
        .mou()
        .then(setMou, (error) => setLoadError(errorMessage(error, 'Could not load the agreement.'))),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const retryLoad = () => {
    setLoadError('');
    void load();
  };

  /** Re-reads the seller status; once it says "accepted" the layout opens the seller area. */
  const continueToSellerArea = async () => {
    await reloadStatus();
    if (useVendorStatusStore.getState().error) {
      setSubmitError(
        "Your acceptance is recorded, but we couldn't refresh your account. Check your internet connection and tap Continue."
      );
    }
  };

  const accept = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const { acceptedAt } = await apiClient.vendor.acceptMou();
      setMou((current) => (current ? { ...current, accepted: true, acceptedAt } : current));
      await continueToSellerArea();
    } catch (error) {
      setSubmitError(errorMessage(error, 'Could not record your acceptance. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const retryContinue = async () => {
    setSubmitting(true);
    setSubmitError('');
    await continueToSellerArea();
    setSubmitting(false);
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out', 'You can sign in again at any time to review the agreement.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
    ]);

  if (deletingAccount) return <DeleteAccount onBack={() => setDeletingAccount(false)} />;

  return (
    <SafeAreaView style={styles.safe} edges={gate ? ['top', 'bottom'] : ['top']}>
      <View style={styles.header}>
        {gate ? (
          <View style={styles.headerSide} />
        ) : (
          <TouchableOpacity onPress={() => router.back()} style={styles.headerSide}>
            <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Vendor Agreement</Text>
        <View style={styles.headerSide} />
      </View>

      {!mou ? (
        <View style={styles.centered}>
          {loadError ? (
            <>
              <Ionicons name="cloud-offline-outline" size={40} color={Theme.colors.textMuted} />
              <Text style={styles.centeredText}>{loadError}</Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={retryLoad}>
                <Text style={styles.secondaryBtnText}>Try again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator size="large" color={Theme.colors.primary} />
          )}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {gate && !mou.accepted && (
              <View style={styles.notice}>
                <Ionicons name="document-text-outline" size={20} color={Theme.colors.primary} />
                <Text style={styles.noticeText}>
                  Please read and accept the vendor agreement (version {mou.version}) to use your seller account.
                </Text>
              </View>
            )}
            <MouDocument content={mou.content} />
          </ScrollView>

          <View style={styles.footer}>
            {mou.accepted ? (
              <View style={styles.acceptedRow}>
                <Ionicons name="checkmark-circle" size={20} color={Theme.colors.success} />
                <Text style={styles.acceptedText}>
                  You accepted version {mou.version}
                  {mou.acceptedAt ? ` on ${formatStatusDate(mou.acceptedAt)}` : ''}.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setChecked((value) => !value)}
                disabled={submitting}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={checked ? Theme.colors.primary : Theme.colors.textMuted}
                />
                <Text style={styles.checkText}>
                  I have read and agree to the Vendor Memorandum of Understanding (version {mou.version}).
                </Text>
              </TouchableOpacity>
            )}

            {!!submitError && <Text style={styles.errorText}>{submitError}</Text>}

            {!mou.accepted && (
              <TouchableOpacity
                style={[styles.primaryBtn, (!checked || submitting) && styles.primaryBtnDisabled]}
                onPress={() => void accept()}
                disabled={!checked || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Theme.colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>I Agree</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Accepted, but still on the gate: the status could not be refreshed yet. */}
            {mou.accepted && gate && (
              <TouchableOpacity
                style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
                onPress={() => void retryContinue()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Theme.colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Continue</Text>
                )}
              </TouchableOpacity>
            )}

            {gate && (
              <View style={styles.gateLinks}>
                <TouchableOpacity onPress={confirmSignOut} disabled={submitting}>
                  <Text style={styles.linkText}>Sign out</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDeletingAccount(true)} disabled={submitting}>
                  <Text style={[styles.linkText, styles.linkDanger]}>Delete my account</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}

      {/* Without the agreement text there is still a way out. */}
      {!mou && gate && (
        <View style={[styles.footer, styles.gateLinks]}>
          <TouchableOpacity onPress={confirmSignOut}>
            <Text style={styles.linkText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg, paddingVertical: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight,
  },
  headerSide: { width: 30, padding: 4 },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Theme.spacing.xxl, gap: Theme.spacing.md },
  centeredText: { fontSize: Theme.font.md, color: Theme.colors.textSecondary, textAlign: 'center' },

  content: { padding: Theme.spacing.lg, paddingBottom: Theme.spacing.xxxl },
  notice: {
    flexDirection: 'row', gap: Theme.spacing.md, alignItems: 'flex-start',
    backgroundColor: Theme.colors.primarySurface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.lg,
  },
  noticeText: { flex: 1, fontSize: Theme.font.sm, lineHeight: 20, color: Theme.colors.text },

  footer: {
    padding: Theme.spacing.lg, gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1, borderTopColor: Theme.colors.borderLight,
  },
  checkRow: { flexDirection: 'row', gap: Theme.spacing.md, alignItems: 'flex-start' },
  checkText: { flex: 1, fontSize: Theme.font.sm, lineHeight: 20, color: Theme.colors.text },
  acceptedRow: { flexDirection: 'row', gap: Theme.spacing.sm, alignItems: 'center' },
  acceptedText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.text },
  errorText: { fontSize: Theme.font.sm, color: Theme.colors.danger },

  primaryBtn: {
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.lg,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.white },
  secondaryBtn: {
    borderWidth: 1, borderColor: Theme.colors.primary, borderRadius: Theme.radius.lg,
    paddingVertical: 10, paddingHorizontal: Theme.spacing.xxl,
  },
  secondaryBtnText: { fontSize: Theme.font.md, fontWeight: '600', color: Theme.colors.primary },

  gateLinks: { flexDirection: 'row', justifyContent: 'space-between' },
  linkText: { fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.textSecondary, paddingVertical: 4 },
  linkDanger: { color: Theme.colors.danger },
});
