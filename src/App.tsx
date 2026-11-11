import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { BottomNavigation, type MobileTab } from './components/BottomNavigation';
import { LoginScreen } from './screens/LoginScreen';
import { ScanHomeScreen } from './screens/ScanHomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { RentalsScreen } from './screens/RentalsScreen';
import {
  getOfflineReceiptQueue,
  syncPendingOfflineReceipts,
} from './services/receiptUploadService';
import { subscribeRentals } from './services/rentalService';

const MobileAppContent: React.FC = () => {
  const { userProfile, authorizedComptas, selectedCompta, loading, logout, canAccessRentals } = useAuth();
  const [activeTab, setActiveTab] = useState<MobileTab>('scan');
  const [pendingCount, setPendingCount] = useState<number>(() => getOfflineReceiptQueue().length);
  const [pendingRentalsCount, setPendingRentalsCount] = useState<number>(0);

  const refreshQueueAndSync = useCallback(async () => {
    setPendingCount(getOfflineReceiptQueue().length);
    if (userProfile) {
      const synced = await syncPendingOfflineReceipts();
      if (synced > 0) {
        setPendingCount(getOfflineReceiptQueue().length);
      }
    }
  }, [userProfile]);

  useEffect(() => {
    void refreshQueueAndSync();
    const handleOnline = () => {
      void refreshQueueAndSync();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [refreshQueueAndSync]);

  // Écoute des locations de la comptabilité de Groupe pour le badge des locations en attente
  useEffect(() => {
    if (!canAccessRentals) {
      setPendingRentalsCount(0);
      return;
    }

    const groupeCompta =
      authorizedComptas.find((c) => c.role === 'responsable_location') ||
      authorizedComptas.find((c) => c.comptaName.toLowerCase().includes('groupe')) ||
      selectedCompta ||
      authorizedComptas[0] ||
      null;

    const orgId = groupeCompta?.orgId || userProfile?.orgId || 'TDGL';
    const comptaId = groupeCompta?.comptaId || 'default';

    const unsubscribe = subscribeRentals(orgId, comptaId, (list) => {
      const pending = list.filter((r) => r.status === 'PENDING').length;
      setPendingRentalsCount(pending);
    });

    return () => unsubscribe();
  }, [canAccessRentals, authorizedComptas, selectedCompta, userProfile]);

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
        {activeTab === 'scan' && (
          <ScanHomeScreen onUploadCompleted={() => void refreshQueueAndSync()} />
        )}
        {activeTab === 'history' && <HistoryScreen />}
        {activeTab === 'rentals' && <RentalsScreen />}
      </main>

      {/* Barre de navigation basse fixe (Bottom Tabs) */}
      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingCount={pendingCount}
        canAccessRentals={canAccessRentals}
        pendingRentalsCount={pendingRentalsCount}
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
