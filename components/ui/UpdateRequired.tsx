// Shown instead of the app when GET /api/app-config says this version is no
// longer supported (the backend changed in a way old builds can't handle).
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Theme } from '../../constants/theme';
import { useAppLinks } from '../../store/app-config.store';

export function UpdateRequired() {
  const { website } = useAppLinks();

  const openStore = async () => {
    const androidPackage = Constants.expoConfig?.android?.package;
    if (Platform.OS === 'android' && androidPackage) {
      const opened = await Linking.openURL(`market://details?id=${androidPackage}`).then(
        () => true,
        () => false
      );
      if (opened) return;
      await Linking.openURL(`https://play.google.com/store/apps/details?id=${androidPackage}`).catch(() => {});
      return;
    }
    await Linking.openURL(website).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="cloud-download-outline" size={40} color={Theme.colors.white} />
      </View>
      <Text style={styles.title}>Update required</Text>
      <Text style={styles.message}>
        This version of the app is no longer supported. Please update to keep shopping and managing your orders.
      </Text>
      <TouchableOpacity style={styles.button} onPress={openStore} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Update now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: Theme.spacing.xxxl, backgroundColor: Theme.colors.background,
  },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Theme.colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: Theme.spacing.xxl,
  },
  title: { fontSize: Theme.font.xxl, fontWeight: '800', color: Theme.colors.text, marginBottom: Theme.spacing.sm },
  message: {
    fontSize: Theme.font.md, color: Theme.colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: Theme.spacing.xxl,
  },
  button: {
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.xxxl, height: 52, justifyContent: 'center',
  },
  buttonText: { color: Theme.colors.white, fontSize: Theme.font.md, fontWeight: '700' },
});
