import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';

export default function TermsScreen() {
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
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.paragraph}>
          Welcome to LinkAndSmile. By using our app, you agree to these terms...
        </Text>
        <Text style={styles.paragraph}>
          (Add your actual terms here – Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.)
        </Text>

        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.paragraph}>
          We value your privacy. Your data is used only for order processing and improving our services...
        </Text>
        <Text style={styles.paragraph}>
          (Add your actual privacy policy text.)
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: Theme.colors.borderLight },
  headerTitle: { fontSize: Theme.font.lg, fontWeight: '700', color: Theme.colors.text },
  content: { padding: Theme.spacing.lg },
  title: { fontSize: Theme.font.lg, fontWeight: '700', marginTop: Theme.spacing.lg, marginBottom: Theme.spacing.sm, color: Theme.colors.text },
  paragraph: { fontSize: Theme.font.md, lineHeight: 22, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.md },
});