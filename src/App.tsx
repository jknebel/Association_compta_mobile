import React, { useState } from 'react';
import { Header } from './components/Header';
import { BottomNavigation, MobileTab } from './components/BottomNavigation';
import { LoginScreen } from './screens/LoginScreen';
import { ScanHomeScreen } from './screens/ScanHomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';

interface CurrentUser {
  email: string;
  displayName: string;
  orgName: string;
}

export default function App() {
  // État d'authentification (intégré avec Firebase Auth au ticket MOB-02)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>({
    email: 'membre@asso.ch',
    displayName: 'Alexandre Dupont',
    orgName: 'Troupe du Grand Lac'
  });

  const [activeTab, setActiveTab] = useState<MobileTab>('scan');

  // Si l'utilisateur n'est pas connecté -> écran de connexion
  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={(email) => {
          setCurrentUser({
            email,
            displayName: email.split('@')[0],
            orgName: 'Troupe du Grand Lac'
          });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* En-tête mobile compact */}
      <Header
        userName={currentUser.displayName}
        userEmail={currentUser.email}
        orgName={currentUser.orgName}
        onLogout={() => setCurrentUser(null)}
      />

      {/* Contenu principal selon l'onglet actif */}
      <main className="flex-1 w-full max-w-md mx-auto">
        {activeTab === 'scan' ? <ScanHomeScreen /> : <HistoryScreen />}
      </main>

      {/* Barre de navigation basse fixe (Bottom Tabs) */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingCount={0}
      />
    </div>
  );
}
