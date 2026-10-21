import React from 'react';
import { Clock, CheckCircle, Receipt, ArrowRight } from 'lucide-react';

export const HistoryScreen: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 p-4 pb-24 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">
            Mes envois
          </h2>
          <p className="text-xs text-slate-400">
            Suivi des justificatifs et remboursements
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
          0 pièce
        </span>
      </div>

      {/* Empty State */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center my-6 flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mb-3">
          <Receipt size={26} />
        </div>
        <div className="text-sm font-semibold text-slate-300">
          Aucun justificatif envoyé
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          Vos photos de reçus et le statut de vos demandes de remboursement apparaîtront ici dès votre premier dépôt.
        </p>
      </div>

      {/* Legend / Status explainer */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wide">
          Légende des statuts
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          <span><strong>Carte transmis :</strong> justificatif enregistré pour le compte</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span><strong>Remboursement en attente :</strong> en attente de virement</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span><strong>Remboursé :</strong> virement effectué par le caissier</span>
        </div>
      </div>
    </div>
  );
};
