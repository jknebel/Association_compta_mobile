import React from 'react';
import { LogOut, Building2, User } from 'lucide-react';

interface HeaderProps {
  userName?: string | null;
  userEmail?: string | null;
  orgName?: string | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userName,
  userEmail,
  orgName,
  onLogout
}) => {
  const displayName = userName || userEmail?.split('@')[0] || 'Membre';

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 pt-safe">
      <div className="flex items-center justify-between">
        {/* User & Org info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
            <User size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-100 truncate">
              {displayName}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 truncate">
              <Building2 size={11} className="shrink-0" />
              <span className="truncate font-medium">{orgName || 'AssoCompta'}</span>
            </div>
          </div>
        </div>

        {/* Logout button */}
        <button
          type="button"
          onClick={onLogout}
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 active:bg-slate-700 transition-colors"
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};
