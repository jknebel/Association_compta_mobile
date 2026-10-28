import React from 'react';
import {
  Camera,
  FileUp,
  Sparkles,
  CreditCard,
  Wallet,
  FolderKanban,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { InstallPwaBanner } from '../components/InstallPwaBanner';
import { useAuth } from '../contexts/AuthContext';
import { getComptaRoleLabel } from '../services/comptaHelpers';

export const ScanHomeScreen: React.FC = () => {
  const {
    userProfile,
    authorizedComptas,
    selectedCompta,
    comptasLoading,
    selectCompta,
    refreshComptas,
  } = useAuth();

  if (comptasLoading && authorizedComptas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 min-h-[60vh] max-w-md mx-auto text-center">
        <Loader2 size={28} className="animate-spin text-blue-500" />
        <p className="text-xs text-slate-400">
          Récupération de vos comptabilités autorisées…
        </p>
      </div>
    );
  }

  // Exigence MOB-03 (tâche 4) : Écran explicite si le membre n'a accès à aucune comptabilité ouverte
  if (authorizedComptas.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4 pb-24 max-w-md mx-auto">
        <InstallPwaBanner />

        <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-lg flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <ShieldAlert size={24} />
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-100">
              Aucune comptabilité associée
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Vous n'avez pas encore d'accès à une comptabilité. Demandez au caissier ou à l'administrateur de vous attribuer le rôle Déposant de factures.
            </p>
            {userProfile?.email && (
              <p className="text-[11px] text-slate-400 pt-1">
                Compte connecté : <span className="font-mono text-slate-200">{userProfile.email}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void refreshComptas()}
            disabled={comptasLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
          >
            <RefreshCw size={15} className={comptasLoading ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-md mx-auto">
      {/* Top Banner slot MOB-09 */}
      <InstallPwaBanner />

      {/* Sélecteur de comptabilité active (MOB-03) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <FolderKanban size={14} className="text-blue-400" />
            <span>Comptabilité cible</span>
          </div>

          <div className="flex items-center gap-2">
            {selectedCompta && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                {getComptaRoleLabel(selectedCompta.role)}
              </span>
            )}
            <button
              type="button"
              onClick={() => void refreshComptas()}
              disabled={comptasLoading}
              title="Actualiser mes comptabilités"
              aria-label="Actualiser mes comptabilités"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <RefreshCw size={13} className={comptasLoading ? 'animate-spin text-blue-400' : ''} />
            </button>
          </div>
        </div>

        {authorizedComptas.length === 1 && selectedCompta ? (
          <div className="flex items-center justify-between bg-slate-950/70 border border-slate-800/80 rounded-xl px-3.5 py-2.5">
            <div>
              <div className="text-sm font-bold text-slate-100">
                {selectedCompta.comptaName}
              </div>
              <div className="text-[11px] text-slate-400">
                {selectedCompta.orgName} • Devise {selectedCompta.currency}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <select
              aria-label="Sélectionner la comptabilité cible"
              value={selectedCompta?.comptaId || ''}
              onChange={(e) => selectCompta(e.target.value)}
              className="w-full appearance-none bg-slate-950 border border-slate-700 hover:border-blue-500/60 focus:border-blue-500 focus:outline-none rounded-xl px-3.5 py-2.5 pr-9 text-sm font-semibold text-slate-100 transition-colors"
            >
              {authorizedComptas.map((compta) => (
                <option key={`${compta.orgId}-${compta.comptaId}`} value={compta.comptaId}>
                  {compta.comptaName} ({compta.orgName} — {compta.currency})
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        )}
      </div>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-blue-900/30 via-slate-900 to-slate-900 border border-blue-800/40 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wide mb-1">
          <Sparkles size={14} />
          <span>Capture intelligente</span>
        </div>
        <h2 className="text-xl font-bold text-slate-100">
          Nouveau justificatif
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Prenez votre ticket ou reçu en photo (ou importez un PDF). L'IA extraira automatiquement le montant et la date pour{' '}
          <span className="text-slate-200 font-semibold">
            {selectedCompta?.comptaName ?? 'votre comptabilité'}
          </span>
          .
        </p>

        {/* Action Buttons */}
        <div className="mt-5 grid grid-cols-1 gap-2.5">
          <button
            type="button"
            onClick={() => alert("L'ouverture de l'appareil photo sera activée au ticket MOB-04 !")}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25"
          >
            <Camera size={20} />
            <span>Prendre le ticket en photo</span>
          </button>

          <button
            type="button"
            onClick={() => alert("L'import d'une photo ou d'un PDF sera activé au ticket MOB-04 !")}
            className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-700/80 text-slate-200 font-medium py-3 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 border border-slate-700"
          >
            <FileUp size={18} />
            <span>Choisir une photo ou un PDF</span>
          </button>
        </div>
      </div>

      {/* Two Types of Expense info cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center mb-2">
            <CreditCard size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">Carte du compte</div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              Dépense payée avec la carte de l'association
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center mb-2">
            <Wallet size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">Remboursement</div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              Frais avancés avec votre argent personnel
            </p>
          </div>
        </div>
      </div>

      {/* Flow explainer */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400">
        <div className="font-semibold text-slate-300 mb-2">Comment ça fonctionne ?</div>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span>Prenez une photo nette du reçu ou ticket de caisse.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>Vérifiez le montant, la date et choisissez votre comptabilité.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span>Le justificatif est immédiatement disponible pour le caissier !</span>
          </div>
        </div>
      </div>
    </div>
  );
};
