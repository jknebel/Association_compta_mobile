import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt as ReceiptIcon,
  RefreshCw,
  FileText,
  ExternalLink,
  Calendar,
  FolderKanban,
  Loader2,
  CloudUpload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  computeHistorySummaryStats,
  filterUserReceiptHistory,
  type HistoryFilterTab,
  type HistoryStatusKey,
  type UserReceiptHistoryItem,
} from '../services/historyHelpers';
import {
  fetchUserSubmittedReceipts,
  syncPendingOfflineReceipts,
} from '../services/receiptUploadService';

const getStatusBadgeClasses = (statusKey: HistoryStatusKey): string => {
  switch (statusKey) {
    case 'REIMBURSED':
    case 'CARD_LINKED':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'REIMBURSEMENT_PENDING':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'PENDING_OFFLINE':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case 'REJECTED':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'CARD_TRANSMITTED':
    default:
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  }
};

export const HistoryScreen: React.FC = () => {
  const { userProfile, authorizedComptas } = useAuth();
  const [items, setItems] = useState<UserReceiptHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<HistoryFilterTab>('ALL');
  const [comptaFilter, setComptaFilter] = useState<string>('ALL');

  const loadHistory = useCallback(async () => {
    if (!userProfile) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchUserSubmittedReceipts(
        userProfile.uid,
        userProfile.email,
        authorizedComptas
      );
      setItems(list);
    } catch (err) {
      console.error("Erreur lors du chargement de l'historique des envois :", err);
    } finally {
      setLoading(false);
    }
  }, [userProfile, authorizedComptas]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncPendingOfflineReceipts();
      await loadHistory();
    } finally {
      setSyncing(false);
    }
  };

  const stats = computeHistorySummaryStats(items);
  const filteredItems = filterUserReceiptHistory(items, activeFilter, comptaFilter);
  const hasOfflinePending = items.some((i) => i.syncState === 'pending_offline');

  return (
    <div className="flex flex-col gap-4 p-4 pb-28 max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Mes envois</h2>
          <p className="text-xs text-slate-400">
            Suivi de vos justificatifs et demandes de remboursement
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {stats.totalCount} {stats.totalCount > 1 ? 'pièces' : 'pièce'}
          </span>

          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={loading}
            title="Actualiser l'historique"
            aria-label="Actualiser l'historique"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>
      </div>

      {/* Bannière de synchronisation hors-ligne si des pièces sont en attente */}
      {hasOfflinePending && (
        <div className="bg-purple-950/50 border border-purple-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="text-xs text-purple-200 leading-relaxed">
            <strong>File hors-ligne active :</strong> certains justificatifs attendent une connexion réseau pour être transmis.
          </div>
          <button
            type="button"
            onClick={() => void handleManualSync()}
            disabled={syncing}
            className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <CloudUpload size={14} className={syncing ? 'animate-bounce' : ''} />
            <span>{syncing ? 'Envoi…' : 'Synchroniser'}</span>
          </button>
        </div>
      )}

      {/* Résumé des remboursements (KPIs) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-3.5">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide">
            ⏳ À me rembourser
          </div>
          <div className="text-lg font-bold text-slate-100 mt-1">
            CHF {stats.pendingReimbursementAmount.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {stats.pendingReimbursementCount} demande{stats.pendingReimbursementCount > 1 ? 's' : ''} en attente
          </div>
        </div>

        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-3.5">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide">
            ✅ Déjà remboursé
          </div>
          <div className="text-lg font-bold text-slate-100 mt-1">
            CHF {stats.reimbursedAmount.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Validé par le caissier
          </div>
        </div>
      </div>

      {/* Filtres par statut et par comptabilité */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { id: 'ALL', label: 'Tous' },
              { id: 'PENDING_REIMBURSEMENTS', label: '⏳ En attente' },
              { id: 'REIMBURSED', label: '✅ Remboursés' },
              { id: 'DEBIT_CARD', label: '💳 Carte' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
                activeFilter === tab.id
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {authorizedComptas.length > 1 && (
          <select
            aria-label="Filtrer par comptabilité"
            value={comptaFilter}
            onChange={(e) => setComptaFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Toutes les comptabilités</option>
            {authorizedComptas.map((c) => (
              <option key={`${c.orgId}-${c.comptaId}`} value={c.comptaId}>
                {c.comptaName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Liste des justificatifs ou état vide */}
      {loading && items.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <span className="text-xs">Chargement de vos justificatifs…</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center my-3 flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mb-3">
            <ReceiptIcon size={26} />
          </div>
          <div className="text-sm font-semibold text-slate-300">
            Aucun justificatif dans cette vue
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Vos photos de reçus, factures PDF et le statut de vos demandes de remboursement apparaissent ici dès leur envoi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const amount =
              typeof item.receipt.extractedAmount === 'number'
                ? item.receipt.extractedAmount.toFixed(2)
                : '0.00';
            const title =
              item.receipt.merchantName ||
              item.receipt.description ||
              item.receipt.fileName ||
              'Justificatif';

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 shadow-md transition-colors flex items-center gap-3.5"
              >
                {/* Miniature Photo ou icône Facture PDF */}
                <a
                  href={item.receipt.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Ouvrir le justificatif"
                  className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center group relative"
                >
                  {item.isPdf ? (
                    <div className="flex flex-col items-center justify-center text-amber-400">
                      <FileText size={22} />
                      <span className="text-[9px] font-bold uppercase mt-0.5">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={item.receipt.url}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                </a>

                {/* Informations centrales */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold text-slate-100 truncate">
                      {title}
                    </div>
                    <div className="text-sm font-extrabold text-slate-100 shrink-0">
                      {item.currency} {amount}
                    </div>
                  </div>

                  {item.receipt.description &&
                    item.receipt.merchantName &&
                    item.receipt.description !== item.receipt.merchantName && (
                      <p className="text-xs text-slate-400 truncate">
                        {item.receipt.description}
                      </p>
                    )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                        <FolderKanban size={11} className="text-blue-400" />
                        {item.comptaName}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} />
                        {item.receipt.extractedDate || item.receipt.uploadDate?.slice(0, 10)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadgeClasses(
                          item.statusKey
                        )}`}
                      >
                        {item.statusLabel}
                      </span>

                      <a
                        href={item.receipt.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Voir le document"
                        className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Légende des statuts */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
        <div className="font-semibold text-slate-300 text-[11px] uppercase tracking-wide">
          Légende des statuts
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          <span>
            <strong>💳 Carte transmis :</strong> justificatif enregistré dans la comptabilité
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>
            <strong>⏳ Remboursement en attente :</strong> en attente de virement par le caissier
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>
            <strong>✅ Remboursé :</strong> virement effectué et pointé par le caissier
          </span>
        </div>
      </div>
    </div>
  );
};
