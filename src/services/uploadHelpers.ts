import type { ExpenseType, Receipt, ReimbursementStatus } from '../types/receipt';

export const OFFLINE_QUEUE_STORAGE_KEY = 'asso_compta_offline_receipt_queue_v1';
export const LOCAL_SUBMITTED_RECEIPTS_KEY = 'asso_compta_local_submitted_receipts_v1';

export interface UploadMetadataResolution {
  contentType: 'application/pdf' | 'image/jpeg';
  extension: 'pdf' | 'jpg';
}

export interface BuildReceiptDocumentParams {
  receiptId: string;
  url: string;
  fileName: string;
  uploadDateIso: string;
  extractedDate: string;
  extractedAmount: number;
  expenseType: ExpenseType;
  description?: string | null;
  merchantName?: string | null;
  submittedByUid: string;
  submittedByName: string;
  submittedByEmail: string;
  reimbursementIban?: string | null;
}

export interface QueuedOfflineReceipt {
  queueId: string;
  orgId: string;
  orgName: string;
  comptaId: string;
  comptaName: string;
  currency: string;
  createdAt: number;
  fileDataUrl: string;
  fileName: string;
  mimeType: string;
  receiptDoc: Receipt;
}

/**
 * Détermine le type MIME (`application/pdf` ou `image/jpeg`) et l'extension (`.pdf` ou `.jpg`)
 * pour le téléversement dans Firebase Storage (Ticket MOB-07 tâche 1).
 */
export const resolveUploadContentTypeAndExtension = (
  mimeType?: string | null,
  fileName?: string | null
): UploadMetadataResolution => {
  const normMime = typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';
  const normName = typeof fileName === 'string' ? fileName.trim().toLowerCase() : '';

  if (normMime === 'application/pdf' || normName.endsWith('.pdf')) {
    return {
      contentType: 'application/pdf',
      extension: 'pdf',
    };
  }

  return {
    contentType: 'image/jpeg',
    extension: 'jpg',
  };
};

/**
 * Nettoie un jeton aléatoire pour construire des identifiants sûrs.
 */
export const sanitizeRandomToken = (rawToken?: string | null): string => {
  const cleaned =
    typeof rawToken === 'string'
      ? rawToken.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 12)
      : '';
  return cleaned || 'a1b2c3';
};

/**
 * Génère l'identifiant du document Firestore (`rcpt-{timestamp}-{random}`)
 * et le nom de base du fichier Storage (`{timestamp}_{random}`).
 */
export const generateReceiptIdentifiers = (
  timestampMs: number,
  randomToken?: string | null
): { receiptId: string; storageBaseName: string } => {
  const safeTs =
    typeof timestampMs === 'number' && Number.isFinite(timestampMs) && timestampMs > 0
      ? Math.floor(timestampMs)
      : Date.now();
  const token = sanitizeRandomToken(randomToken);

  return {
    receiptId: `rcpt-${safeTs}-${token}`,
    storageBaseName: `${safeTs}_${token}`,
  };
};

/**
 * Construit le chemin complet dans Firebase Storage :
 * `receipts/{orgId}/{comptaId}/{timestamp}_{random}.{extension}`
 */
export const buildStorageObjectPath = (
  orgId: string,
  comptaId: string,
  timestampMs: number,
  randomToken: string,
  extension: 'pdf' | 'jpg'
): string => {
  const cleanOrg = typeof orgId === 'string' && orgId.trim() ? orgId.trim() : 'TDGL';
  const cleanCompta = typeof comptaId === 'string' && comptaId.trim() ? comptaId.trim() : 'default';
  const { storageBaseName } = generateReceiptIdentifiers(timestampMs, randomToken);
  const ext = extension === 'pdf' ? 'pdf' : 'jpg';

  return `receipts/${cleanOrg}/${cleanCompta}/${storageBaseName}.${ext}`;
};

/**
 * Construit le chemin du document dans Cloud Firestore :
 * `organizations/{orgId}/comptabilites/{comptaId}/receipts/{receiptId}`
 */
export const buildFirestoreReceiptPath = (
  orgId: string,
  comptaId: string,
  receiptId: string
): string => {
  const cleanOrg = typeof orgId === 'string' && orgId.trim() ? orgId.trim() : 'TDGL';
  const cleanCompta = typeof comptaId === 'string' && comptaId.trim() ? comptaId.trim() : 'default';
  const cleanId = typeof receiptId === 'string' && receiptId.trim() ? receiptId.trim() : 'rcpt-0';

  return `organizations/${cleanOrg}/comptabilites/${cleanCompta}/receipts/${cleanId}`;
};

/**
 * Construit l'objet `Receipt` prêt à être enregistré dans Cloud Firestore
 * sans aucune propriété `undefined` (interdite par Firestore `setDoc` par défaut).
 */
export const buildReceiptDocument = (params: BuildReceiptDocumentParams): Receipt => {
  const isReimbursement = params.expenseType === 'REIMBURSEMENT';
  const cleanMerchant =
    typeof params.merchantName === 'string' ? params.merchantName.trim() : '';
  const cleanDescription =
    typeof params.description === 'string' ? params.description.trim() : '';
  const cleanIban =
    typeof params.reimbursementIban === 'string' ? params.reimbursementIban.trim() : '';

  const docObj: Receipt = {
    id: params.receiptId.trim(),
    url: params.url.trim(),
    fileName: params.fileName.trim() || 'justificatif.jpg',
    uploadDate: params.uploadDateIso.trim(),
    extractedDate: params.extractedDate.trim(),
    extractedAmount: Math.round(params.extractedAmount * 100) / 100,
    isAnalyzed: true,
    linkedTransactionId: null,
    expenseType: isReimbursement ? 'REIMBURSEMENT' : 'DEBIT_CARD',
    description: cleanDescription,
    merchantName: cleanMerchant,
    submittedByUid: params.submittedByUid.trim(),
    submittedByName: params.submittedByName.trim() || 'Membre',
    submittedByEmail: params.submittedByEmail.trim().toLowerCase(),
  };

  if (isReimbursement) {
    docObj.reimbursementStatus = 'PENDING' as ReimbursementStatus;
    if (cleanIban) {
      docObj.reimbursementIban = cleanIban;
    }
  }

  return docObj;
};

/**
 * Lit la file d'attente hors-ligne depuis le stockage local.
 */
export const getOfflineReceiptQueue = (storage?: Storage | null): QueuedOfflineReceipt[] => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return [];
    const raw = s.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedOfflineReceipt[]) : [];
  } catch {
    return [];
  }
};

/**
 * Ajoute un justificatif dans la file d'attente hors-ligne (en cas d'absence de réseau).
 */
export const enqueueOfflineReceipt = (
  item: QueuedOfflineReceipt,
  storage?: Storage | null
): QueuedOfflineReceipt[] => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return [];
    const existing = getOfflineReceiptQueue(s).filter((q) => q.queueId !== item.queueId);
    const updated = [item, ...existing].slice(0, 25);
    s.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};

/**
 * Retire un justificatif de la file d'attente hors-ligne une fois synchronisé.
 */
export const removeOfflineReceiptFromQueue = (
  queueId: string,
  storage?: Storage | null
): QueuedOfflineReceipt[] => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return [];
    const updated = getOfflineReceiptQueue(s).filter((q) => q.queueId !== queueId);
    s.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};
