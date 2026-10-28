import React, { useState } from 'react';
import {
  CreditCard,
  Wallet,
  FolderKanban,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { InstallPwaBanner } from '../components/InstallPwaBanner';
import { ReceiptDropZone } from '../components/ReceiptDropZone';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { useAuth } from '../contexts/AuthContext';
import { getComptaRoleLabel } from '../services/comptaHelpers';
import type { PreparedReceiptFile } from '../services/imageService';
import type { ReceiptExtractionResult } from '../services/receiptExtractionService';
import type { VerifiedReceiptPayload } from '../services/verificationHelpers';

export const ScanHomeScreen: React.FC = () => {
  const {
    userProfile,
    authorizedComptas,
    selectedCompta,
    comptasLoading,
    selectCompta,
    refreshComptas,
  } = useAuth();
  const [preparedFile, setPreparedFile] = useState<PreparedReceiptFile | null>(null);
  const [extractionResult, setExtractionResult] = useState<ReceiptExtractionResult | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [lastVerifiedSummary, setLastVerifiedSummary] = useState<string | null>(null);

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

  // Écran de vérification responsive (Mobile & PC 2 colonnes) — MOB-06
  if (isVerifying && preparedFile) {
    return (
      <ReceiptPreview
        preparedFile={preparedFile}
        extractionResult={extractionResult}
        authorizedComptas={authorizedComptas}
        selectedCompta={selectedCompta}
        onSelectCompta={selectCompta}
        onBack={() => setIsVerifying(false)}
        onSubmitVerified={(payload) => {
          const targetCompta =
            authorizedComptas.find((c) => c.comptaId === payload.comptaId) || selectedCompta;
          const typeLabel =
            payload.expenseType === 'REIMBURSEMENT' ? 'À rembourser' : 'Carte de débit';
          setLastVerifiedSummary(
            `Justificatif vérifié (${targetCompta?.currency || 'CHF'} ${payload.extractedAmount.toFixed(
              2
            )} du ${payload.extractedDate} — ${typeLabel}) prêt pour « ${
              targetCompta?.comptaName || payload.comptaId
            } ». L'envoi cloud et la file hors-ligne seront activés au ticket MOB-07.`
          );
          setIsVerifying(false);
          setPreparedFile(null);
          setExtractionResult(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-md mx-auto">
      {/* Top Banner slot MOB-09 */}
      <InstallPwaBanner />

      {lastVerifiedSummary && (
        <div
          role="status"
          className="bg-emerald-950/70 border border-emerald-500/40 rounded-2xl p-4 flex items-start gap-2.5 text-xs text-emerald-100 shadow-md"
        >
          <CheckCircle2 size={17} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{lastVerifiedSummary}</div>
        </div>
      )}

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

      {/* Zone de capture Photo (Mobile), sélection PDF/Image et Glisser-Déposer (PC) — MOB-04, MOB-05 & MOB-06 */}
      <ReceiptDropZone
        selectedComptaName={selectedCompta?.comptaName}
        currency={selectedCompta?.currency || 'CHF'}
        preparedFile={preparedFile}
        extractionResult={extractionResult}
        onFilePrepared={(prepared, extraction) => {
          setLastVerifiedSummary(null);
          setPreparedFile(prepared);
          setExtractionResult(extraction);
        }}
        onClearFile={() => {
          setPreparedFile(null);
          setExtractionResult(null);
          setIsVerifying(false);
        }}
        onContinue={() => {
          setIsVerifying(true);
        }}
      />

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
