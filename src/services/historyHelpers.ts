import type { Receipt } from '../types/receipt';

export type HistoryStatusKey =
  | 'PENDING_OFFLINE'
  | 'CARD_TRANSMITTED'
  | 'CARD_LINKED'
  | 'REIMBURSEMENT_PENDING'
  | 'REIMBURSED'
  | 'REJECTED';

export type HistoryFilterTab =
  | 'ALL'
  | 'PENDING_REIMBURSEMENTS'
  | 'REIMBURSED'
  | 'DEBIT_CARD';

export interface RawReceiptWithContext {
  orgId: string;
  orgName: string;
  comptaId: string;
  comptaName: string;
  currency: string;
  syncState?: 'synced' | 'pending_offline';
  receipt: Receipt;
}

export interface UserReceiptHistoryItem {
  id: string;
  orgId: string;
  orgName: string;
  comptaId: string;
  comptaName: string;
  currency: string;
  syncState: 'synced' | 'pending_offline';
  receipt: Receipt;
  statusKey: HistoryStatusKey;
  statusLabel: string;
  isPdf: boolean;
}

export interface HistorySummaryStats {
  totalCount: number;
  pendingReimbursementCount: number;
  pendingReimbursementAmount: number;
  reimbursedAmount: number;
}

/**
 * Détermine si un justificatif est au format PDF à partir de son nom de fichier ou de son URL.
 */
export const isPdfReceipt = (receipt?: Partial<Receipt> | null): boolean => {
  if (!receipt) return false;
  const name = typeof receipt.fileName === 'string' ? receipt.fileName.trim().toLowerCase() : '';
  const url = typeof receipt.url === 'string' ? receipt.url.trim().toLowerCase() : '';
  return (
    name.endsWith('.pdf') ||
    url.includes('.pdf') ||
    url.startsWith('data:application/pdf')
  );
};

/**
 * Calcule le badge de statut d'un justificatif envoyé (Ticket MOB-08 tâche 2) :
 * - `📡 En attente de réseau` (si dans la file hors-ligne)
 * - `⏳ Remboursement en attente` (si `REIMBURSEMENT` non encore remboursé)
 * - `✅ Remboursé` (si `REIMBURSEMENT` avec `reimbursementStatus === 'REIMBURSED'`)
 * - `❌ Refusé` (si `REIMBURSEMENT` avec `reimbursementStatus === 'REJECTED'`)
 * - `✅ Carte rapprochée` (si `DEBIT_CARD` déjà lié à une transaction bancaire)
 * - `💳 Carte transmis` (si `DEBIT_CARD` transmis au caissier)
 */
export const resolveReceiptStatusBadge = (
  receipt: Partial<Receipt>,
  syncState: 'synced' | 'pending_offline' = 'synced'
): { key: HistoryStatusKey; label: string } => {
  if (syncState === 'pending_offline') {
    return {
      key: 'PENDING_OFFLINE',
      label: '📡 En attente de réseau',
    };
  }

  if (receipt?.expenseType === 'REIMBURSEMENT') {
    if (receipt.reimbursementStatus === 'REIMBURSED') {
      return {
        key: 'REIMBURSED',
        label: '✅ Remboursé',
      };
    }
    if (receipt.reimbursementStatus === 'REJECTED') {
      return {
        key: 'REJECTED',
        label: '❌ Refusé',
      };
    }
    return {
      key: 'REIMBURSEMENT_PENDING',
      label: '⏳ Remboursement en attente',
    };
  }

  if (receipt?.linkedTransactionId) {
    return {
      key: 'CARD_LINKED',
      label: '✅ Carte rapprochée',
    };
  }

  return {
    key: 'CARD_TRANSMITTED',
    label: '💳 Carte transmis',
  };
};

/**
 * Vérifie si une pièce justificative a été soumise par l'utilisateur connecté (par UID ou par e-mail).
 */
export const doesReceiptBelongToUser = (
  receipt: Partial<Receipt> | null | undefined,
  uid: string,
  email: string
): boolean => {
  if (!receipt) return false;
  const cleanUid = typeof uid === 'string' ? uid.trim() : '';
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (cleanUid && receipt.submittedByUid === cleanUid) {
    return true;
  }
  if (
    cleanEmail &&
    typeof receipt.submittedByEmail === 'string' &&
    receipt.submittedByEmail.trim().toLowerCase() === cleanEmail
  ) {
    return true;
  }
  return false;
};

/**
 * Extrait un timestamp numérique de tri à partir de `uploadDate`, de l'ID `rcpt-{ts}-...` ou de `extractedDate`.
 */
export const getReceiptSortTimestamp = (receipt: Partial<Receipt>): number => {
  if (typeof receipt.uploadDate === 'string' && receipt.uploadDate.trim()) {
    const parsedUpload = Date.parse(receipt.uploadDate.trim());
    if (!Number.isNaN(parsedUpload)) return parsedUpload;
  }
  if (typeof receipt.id === 'string') {
    const idMatch = receipt.id.match(/^rcpt-(\d{10,15})-/);
    if (idMatch) {
      return parseInt(idMatch[1], 10);
    }
  }
  if (typeof receipt.extractedDate === 'string' && receipt.extractedDate.trim()) {
    const parsedExtracted = Date.parse(receipt.extractedDate.trim());
    if (!Number.isNaN(parsedExtracted)) return parsedExtracted;
  }
  return 0;
};

/**
 * Fusionne les pièces justificatives issues de Firestore (prioritaires pour le statut à jour)
 * et celles enregistrées localement (file hors-ligne ou envoi immédiat), les filtre pour
 * l'utilisateur connecté et les trie de la plus récente à la plus ancienne.
 */
export const mergeAndSortUserReceipts = (
  firestoreRecords: RawReceiptWithContext[],
  localRecords: RawReceiptWithContext[],
  uid: string,
  email: string
): UserReceiptHistoryItem[] => {
  const byId = new Map<string, UserReceiptHistoryItem>();

  // 1. Insérer d'abord les enregistrements Firestore (source de vérité sur le statut de remboursement)
  for (const rec of firestoreRecords || []) {
    if (!rec?.receipt?.id) continue;
    if (!doesReceiptBelongToUser(rec.receipt, uid, email)) continue;

    const syncState = rec.syncState ?? 'synced';
    const badge = resolveReceiptStatusBadge(rec.receipt, syncState);

    byId.set(rec.receipt.id, {
      id: rec.receipt.id,
      orgId: rec.orgId,
      orgName: rec.orgName,
      comptaId: rec.comptaId,
      comptaName: rec.comptaName,
      currency: rec.currency || 'CHF',
      syncState,
      receipt: rec.receipt,
      statusKey: badge.key,
      statusLabel: badge.label,
      isPdf: isPdfReceipt(rec.receipt),
    });
  }

  // 2. Compléter avec les enregistrements locaux non encore présents dans Firestore
  for (const rec of localRecords || []) {
    if (!rec?.receipt?.id) continue;
    if (byId.has(rec.receipt.id)) continue;
    if (!doesReceiptBelongToUser(rec.receipt, uid, email)) continue;

    const syncState = rec.syncState ?? 'synced';
    const badge = resolveReceiptStatusBadge(rec.receipt, syncState);

    byId.set(rec.receipt.id, {
      id: rec.receipt.id,
      orgId: rec.orgId,
      orgName: rec.orgName,
      comptaId: rec.comptaId,
      comptaName: rec.comptaName,
      currency: rec.currency || 'CHF',
      syncState,
      receipt: rec.receipt,
      statusKey: badge.key,
      statusLabel: badge.label,
      isPdf: isPdfReceipt(rec.receipt),
    });
  }

  // 3. Trier du plus récent au plus ancien
  return Array.from(byId.values()).sort((a, b) => {
    const tsDiff = getReceiptSortTimestamp(b.receipt) - getReceiptSortTimestamp(a.receipt);
    if (tsDiff !== 0) return tsDiff;
    return b.id.localeCompare(a.id);
  });
};

/**
 * Filtre la liste de l'historique selon l'onglet de statut et éventuellement une comptabilité.
 */
export const filterUserReceiptHistory = (
  items: UserReceiptHistoryItem[],
  filter: HistoryFilterTab = 'ALL',
  comptaIdFilter?: string | null
): UserReceiptHistoryItem[] => {
  if (!Array.isArray(items)) return [];

  const cleanCompta =
    typeof comptaIdFilter === 'string' && comptaIdFilter.trim() && comptaIdFilter !== 'ALL'
      ? comptaIdFilter.trim()
      : null;

  return items.filter((item) => {
    if (cleanCompta && item.comptaId !== cleanCompta) {
      return false;
    }

    switch (filter) {
      case 'PENDING_REIMBURSEMENTS':
        return item.statusKey === 'REIMBURSEMENT_PENDING';
      case 'REIMBURSED':
        return item.statusKey === 'REIMBURSED';
      case 'DEBIT_CARD':
        return item.statusKey === 'CARD_TRANSMITTED' || item.statusKey === 'CARD_LINKED';
      case 'ALL':
      default:
        return true;
    }
  });
};

/**
 * Calcule les indicateurs récapitulatifs pour l'utilisateur connecté (nombre total d'envois,
 * remboursements en attente et total déjà remboursé).
 */
export const computeHistorySummaryStats = (
  items: UserReceiptHistoryItem[]
): HistorySummaryStats => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      totalCount: 0,
      pendingReimbursementCount: 0,
      pendingReimbursementAmount: 0,
      reimbursedAmount: 0,
    };
  }

  let pendingReimbursementCount = 0;
  let pendingReimbursementAmount = 0;
  let reimbursedAmount = 0;

  for (const item of items) {
    const amount =
      typeof item.receipt.extractedAmount === 'number' &&
      Number.isFinite(item.receipt.extractedAmount)
        ? item.receipt.extractedAmount
        : 0;

    if (item.statusKey === 'REIMBURSEMENT_PENDING') {
      pendingReimbursementCount++;
      pendingReimbursementAmount += amount;
    } else if (item.statusKey === 'REIMBURSED') {
      reimbursedAmount += amount;
    }
  }

  return {
    totalCount: items.length,
    pendingReimbursementCount,
    pendingReimbursementAmount: Math.round(pendingReimbursementAmount * 100) / 100,
    reimbursedAmount: Math.round(reimbursedAmount * 100) / 100,
  };
};
