import React from 'react';
import { Camera, FileUp, Sparkles, CreditCard, Wallet, ArrowRight } from 'lucide-react';
import { InstallPwaBanner } from '../components/InstallPwaBanner';

export const ScanHomeScreen: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-md mx-auto">
      {/* Top Banner slot MOB-09 */}
      <InstallPwaBanner />

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
          Prenez votre ticket ou reçu en photo. L'IA extraira automatiquement le montant et la date pour vous.
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
