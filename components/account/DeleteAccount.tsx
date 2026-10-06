// components/account/DeleteAccount.tsx
// Permanent account deletion (DELETE /api/users/me), required by the App
// Store and Google Play. Shared by the customer and vendor areas.
//
// The server refuses while something is still open (orders in progress, and
// for sellers: frozen wallet, uncleared sales, a payout in flight, missing bank
// details). Each refusal is shown with its reason and a way to resolve it.
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '../../constants/theme';
import { apiClient } from '../../services/api-client';
import { retryAfterText, toApiError, type ApiError } from '../../services/api-error';
import { telUrl, useSupportContacts } from '../../store/app-config.store';
import { useAuthStore } from '../../store/auth.store';

const CONFIRM_WORD = 'DELETE';

/** A reason the server gave for not deleting the account, in the user's terms. */
interface Blocker {
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

/**
 * `onBack` is passed when this is shown from the vendor-agreement gate
 * (components/vendor/MouAgreement.tsx) instead of as a route. The seller
 * screens can't be opened from there, so refusals are explained without
 * links to them.
 */
export function DeleteAccount({ onBack }: { onBack?: () => void } = {}) {
  const user = useAuthStore((s) => s.user);
  const signOutAfterAccountDeletion = useAuthStore((s) => s.signOutAfterAccountDeletion);
  const support = useSupportContacts();
  const isVendor = user?.role === 'shop_owner';

  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [blocker, setBlocker] = useState<Blocker | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canSubmit = confirmText.trim().toUpperCase() === CONFIRM_WORD && password.length > 0 && !deleting;

  const goBack = onBack ?? (() => router.back());
  const linkTo = (label: string, href: Href) => (onBack ? undefined : { label, onPress: () => router.push(href) });
  const callSupport = { label: `Call support · ${support.phone}`, onPress: () => void Linking.openURL(telUrl(support.phone)) };

  /** Turns the server's refusal into something the user can act on. */
  const explain = (error: ApiError): Blocker => {
    switch (error.code) {
      case 'OPEN_ORDERS': {
        const count = Number(error.data?.openOrders) || 0;
        return {
          title: count > 0 ? `${count} order${count === 1 ? ' is' : 's are'} still in progress` : 'Orders still in progress',
          message: error.message,
          action: linkTo('View orders', isVendor ? '/(vendor)/orders' : '/(customer)/orders'),
        };
      }
      case 'WALLET_FROZEN':
        return { title: 'Your wallet is frozen', message: error.message, action: callSupport };
      case 'PENDING_SALES':
        return {
          title: 'Some sales have not cleared yet',
          message: error.message,
          action: linkTo('Open wallet', '/(vendor)/wallet'),
        };
      case 'PAYOUT_IN_PROGRESS':
        return {
          title: 'A payout is being processed',
          message: error.message,
          action: linkTo('Open wallet', '/(vendor)/wallet'),
        };
      case 'BANK_DETAILS_REQUIRED':
        return {
          title: 'Bank details needed',
          message: error.message,
          action: linkTo('Add bank details', '/(vendor)/bank-details'),
        };
      case 'WALLET_BALANCE': // older servers; newer ones settle the balance automatically
        return {
          title: 'Wallet balance remaining',
          message: error.message,
          action: linkTo('Open wallet', '/(vendor)/wallet'),
        };
      case 'FORBIDDEN':
        return { title: "This account can't be deleted here", message: error.message, action: callSupport };
      case 'RATE_LIMITED':
        return { title: 'Too many attempts', message: retryAfterText(error.retryAfterSeconds) };
      default:
        return {
          title: error.isNetworkError ? 'No connection' : 'Could not delete the account',
          message: error.message,
          action: error.isNetworkError ? undefined : callSupport,
        };
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setBlocker(null);
    setPasswordError('');
    try {
      await apiClient.users.deleteAccount({ confirm: CONFIRM_WORD, password });
      // The account is gone: wipe everything local. The root layout then shows
      // the login screen.
      await signOutAfterAccountDeletion();
      Alert.alert('Account deleted', 'Your account and personal data have been deleted.');
    } catch (raw) {
      const error = toApiError(raw, 'Could not delete the account. Please try again or contact support.');
      if (error.code === 'INVALID_CREDENTIALS') {
        setPasswordError('Password is incorrect.');
      } else if (error.code === 'UNAUTHORIZED') {
        // The session ended while this screen was open; the app is already
        // returning to the login screen.
      } else {
        setBlocker(explain(error));
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    if (!canSubmit) return;
    Alert.alert(
      'Delete your account?',
      'This is permanent and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => void deleteAccount() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} disabled={deleting}>
          <Ionicons name="arrow-back" size={22} color={Theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={22} color={Theme.colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>This permanently deletes your account</Text>
              <Text style={styles.warningText}>You will be signed out on all devices and will not be able to sign in again.</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>What happens</Text>
          <Bullet text="Your profile details, saved addresses, cart and favourites are deleted." />
          <Bullet text="Reviews you wrote stay, shown as written by a deleted user." />
          <Bullet text="Records of past orders are kept, as the law requires for tax and accounting, without your profile details." />
          {isVendor && (
            <>
              <Bullet text="Your shop is closed and its products are no longer sold." />
              <Bullet text="Any balance you can withdraw is paid to your bank account as a final settlement." />
            </>
          )}

          <Text style={styles.sectionTitle}>Before you can delete</Text>
          <Bullet text="All your orders must be delivered or cancelled." />
          {isVendor && (
            <Bullet text="Your sales must have cleared, no payout may be in progress, and your bank details must be saved for the final settlement." />
          )}

          {blocker && (
            <View style={styles.blockerCard}>
              <View style={styles.blockerTop}>
                <Ionicons name="alert-circle" size={20} color={Theme.colors.danger} />
                <Text style={styles.blockerTitle}>{blocker.title}</Text>
              </View>
              <Text style={styles.blockerText}>{blocker.message}</Text>
              {blocker.action && (
                <TouchableOpacity style={styles.blockerAction} onPress={blocker.action.onPress}>
                  <Text style={styles.blockerActionText}>{blocker.action.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Theme.colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={styles.fieldLabel}>Type {CONFIRM_WORD} to confirm</Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={Theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />

          <Text style={styles.fieldLabel}>Your password</Text>
          <View style={[styles.passwordRow, passwordError ? styles.inputError : null]}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={(value) => { setPassword(value); setPasswordError(''); }}
              placeholder="Enter your password"
              placeholderTextColor={Theme.colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!deleting}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={{ padding: 4 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Theme.colors.textMuted} />
            </TouchableOpacity>
          </View>
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          <TouchableOpacity
            style={[styles.deleteBtn, !canSubmit && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {deleting ? (
              <ActivityIndicator color={Theme.colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={Theme.colors.white} />
                <Text style={styles.deleteBtnText}>Delete my account permanently</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={goBack} disabled={deleting}>
            <Text style={styles.cancelBtnText}>Keep my account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
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
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  content: { padding: Theme.spacing.lg, paddingBottom: 120 },

  warningCard: {
    flexDirection: 'row', gap: Theme.spacing.md, alignItems: 'flex-start',
    backgroundColor: Theme.colors.dangerSurface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, borderWidth: 1, borderColor: Theme.colors.danger,
  },
  warningTitle: { fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text, marginBottom: 4 },
  warningText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 19 },

  sectionTitle: {
    fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text,
    marginTop: Theme.spacing.xl, marginBottom: Theme.spacing.sm,
  },
  bullet: { flexDirection: 'row', gap: Theme.spacing.sm, alignItems: 'flex-start', marginBottom: 6 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Theme.colors.textMuted, marginTop: 8 },
  bulletText: { flex: 1, fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 20 },

  blockerCard: {
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg, marginTop: Theme.spacing.xl,
    borderWidth: 1.5, borderColor: Theme.colors.danger,
  },
  blockerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  blockerTitle: { flex: 1, fontSize: Theme.font.md, fontWeight: '700', color: Theme.colors.text },
  blockerText: { fontSize: Theme.font.sm, color: Theme.colors.textSecondary, lineHeight: 20 },
  blockerAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Theme.spacing.md },
  blockerActionText: { fontSize: Theme.font.sm, fontWeight: '700', color: Theme.colors.primary },

  fieldLabel: {
    fontSize: Theme.font.sm, fontWeight: '600', color: Theme.colors.text,
    marginTop: Theme.spacing.xl, marginBottom: 6,
  },
  input: {
    borderWidth: 1.5, borderColor: Theme.colors.border, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md, height: 50, fontSize: Theme.font.md,
    color: Theme.colors.text, backgroundColor: Theme.colors.surface, letterSpacing: 1,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Theme.colors.border, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md, height: 50, backgroundColor: Theme.colors.surface,
  },
  passwordInput: { flex: 1, fontSize: Theme.font.md, color: Theme.colors.text, height: '100%' },
  inputError: { borderColor: Theme.colors.danger, backgroundColor: '#FFF5F3' },
  errorText: { fontSize: 12, color: Theme.colors.danger, marginTop: 4 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.danger, borderRadius: Theme.radius.md,
    height: 52, marginTop: Theme.spacing.xxl,
  },
  deleteBtnDisabled: { opacity: 0.45 },
  deleteBtnText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: Theme.spacing.lg },
  cancelBtnText: { color: Theme.colors.primary, fontSize: Theme.font.md, fontWeight: '600' },
});
