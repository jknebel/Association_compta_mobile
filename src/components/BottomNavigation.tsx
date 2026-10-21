import React from 'react';
import { Camera, Clock } from 'lucide-react';

export type MobileTab = 'scan' | 'history';

interface BottomNavigationProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  pendingCount?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  pendingCount = 0
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-2 h-16">
        {/* Tab 1: Scanner un justificatif */}
        <button
          type="button"
          onClick={() => onTabChange('scan')}
          className={`flex flex-col items-center justify-center gap-1 transition-colors relative ${
            activeTab === 'scan'
              ? 'text-blue-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-full transition-all ${
              activeTab === 'scan'
                ? 'bg-blue-600/20 text-blue-400 scale-110'
                : 'text-slate-400'
            }`}
          >
            <Camera size={20} />
          </div>
          <span className="text-[11px] leading-tight">Nouveau justificatif</span>
          {activeTab === 'scan' && (
            <span className="absolute bottom-1 w-8 h-0.5 bg-blue-500 rounded-full" />
          )}
        </button>

        {/* Tab 2: Historique & Remboursements */}
        <button
          type="button"
          onClick={() => onTabChange('history')}
          className={`flex flex-col items-center justify-center gap-1 transition-colors relative ${
            activeTab === 'history'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-full transition-all relative ${
              activeTab === 'history'
                ? 'bg-emerald-600/20 text-emerald-400 scale-110'
                : 'text-slate-400'
            }`}
          >
            <Clock size={20} />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold text-[9px] rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-tight">Mes envois</span>
          {activeTab === 'history' && (
            <span className="absolute bottom-1 w-8 h-0.5 bg-emerald-500 rounded-full" />
          )}
        </button>
      </div>
    </nav>
  );
};
