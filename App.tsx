import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

/**
 * Point d'entrée initial du projet AssoCompta Scan.
 * Voir les tickets GitHub Issues (MOB-01 à MOB-08) pour l'implémentation des écrans.
 */
export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.card}>
        <Text style={styles.badge}>ASSOCOMPTA SCAN</Text>
        <Text style={styles.title}>Dépôt de Pièces Justificatives & Remboursements</Text>
        <Text style={styles.subtitle}>
          Socle React Native (Expo) prêt pour le développement des tickets MOB-01 à MOB-08.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  badge: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
});
