import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { BottomNavigation, type MobileTab } from './components/BottomNavigation';
import { LoginScreen } from './screens/LoginScreen';
import { ScanHomeScreen } from './screens/ScanHomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';

const MobileAppContent: React.FC = () => {
  const { userProfile, selectedCompta, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<MobileTab>('scan');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-xs text-slate-400">Restauration de votre session…</p>
      </div>
    );
  }

  if (!userProfile) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* En-tête mobile compact */}
      <Header
        userName={userProfile.displayName}
        userEmail={userProfile.email}
        orgName={selectedCompta?.orgName || userProfile.orgName}
        onLogout={() => {
          void logout();
        }}
      />

      {/* Contenu principal selon l'onglet actif */}
      <main className="flex-1 w-full mx-auto">
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
};

export default function App() {
  return (
    <AuthProvider>
      <MobileAppContent />
    </AuthProvider>
  );
}
