import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, isFirebaseConfigured } from '../config/firebase';
import type { AuthorizedComptabilite, Receipt } from '../types/receipt';
import type { MobileUserProfile } from './authHelpers';
import type { PreparedReceiptFile } from './imageService';
import type { VerifiedReceiptPayload } from './verificationHelpers';
import {
  LOCAL_SUBMITTED_RECEIPTS_KEY,
  buildFirestoreReceiptPath,
  buildReceiptDocument,
  buildStorageObjectPath,
  enqueueOfflineReceipt,
  generateReceiptIdentifiers,
  getOfflineReceiptQueue,
  removeOfflineReceiptFromQueue,
  resolveUploadContentTypeAndExtension,
  type QueuedOfflineReceipt,
} from './uploadHelpers';

export {
  buildFirestoreReceiptPath,
  buildReceiptDocument,
  buildStorageObjectPath,
  enqueueOfflineReceipt,
  generateReceiptIdentifiers,
  getOfflineReceiptQueue,
  removeOfflineReceiptFromQueue,
  resolveUploadContentTypeAndExtension,
  type QueuedOfflineReceipt,
};

export interface LocalSubmittedReceiptRecord {
  orgId: string;
  orgName: string;
  comptaId: string;
  comptaName: string;
  currency: string;
  syncState: 'synced' | 'pending_offline';
  receipt: Receipt;
}

export interface UploadReceiptResult {
  status: 'uploaded' | 'queued_offline';
  receipt: Receipt;
  storagePath: string;
  firestorePath: string;
  message: string;
}

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Impossible de sérialiser le fichier hors-ligne.'));
    reader.readAsDataURL(blob);
  });
};

const dataUrlToBlob = async (dataUrl: string, mimeType: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new Blob([blob], { type: mimeType });
};

/**
 * Enregistre une copie locale du justificatif soumis (pour affichage immédiat dans "Mes envois").
 */
export const saveSubmittedReceiptLocally = (
  record: LocalSubmittedReceiptRecord,
  storageObj?: Storage | null
): void => {
  try {
    const s =
      storageObj !== undefined
        ? storageObj
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return;
    const existing = getLocalSubmittedReceipts(s).filter(
      (r) => r.receipt.id !== record.receipt.id
    );
    const updated = [record, ...existing].slice(0, 50);
    s.setItem(LOCAL_SUBMITTED_RECEIPTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignorer si quota localStorage atteint
  }
};

/**
 * Lit l'historique local des justificatifs envoyés depuis cet appareil.
 */
export const getLocalSubmittedReceipts = (
  storageObj?: Storage | null
): LocalSubmittedReceiptRecord[] => {
  try {
    const s =
      storageObj !== undefined
        ? storageObj
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return [];
    const raw = s.getItem(LOCAL_SUBMITTED_RECEIPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalSubmittedReceiptRecord[]) : [];
  } catch {
    return [];
  }
};

/**
 * Téléverse le justificatif (Image compressée ou PDF) vers Firebase Storage et crée
 * le document correspondant dans `organizations/{orgId}/comptabilites/{comptaId}/receipts/{receiptId}`.
 * En cas d'absence de réseau, place le justificatif dans la file d'attente hors-ligne.
 */
export const uploadVerifiedReceipt = async (params: {
  preparedFile: PreparedReceiptFile;
  verifiedPayload: VerifiedReceiptPayload;
  targetCompta: AuthorizedComptabilite;
  userProfile: MobileUserProfile;
}): Promise<UploadReceiptResult> => {
  const { preparedFile, verifiedPayload, targetCompta, userProfile } = params;

  const timestampMs = Date.now();
  const randomToken = Math.random().toString(36).slice(2, 8);
  const { receiptId } = generateReceiptIdentifiers(timestampMs, randomToken);

  const { contentType, extension } = resolveUploadContentTypeAndExtension(
    preparedFile.file.type,
    preparedFile.normalizedName
  );

  const storagePath = buildStorageObjectPath(
    targetCompta.orgId,
    targetCompta.comptaId,
    timestampMs,
    randomToken,
    extension
  );

  const firestorePath = buildFirestoreReceiptPath(
    targetCompta.orgId,
    targetCompta.comptaId,
    receiptId
  );

  const uploadDateIso = new Date(timestampMs).toISOString();
  const submitterFullName =
    `${userProfile.firstName} ${userProfile.lastName}`.trim() ||
    userProfile.displayName ||
    userProfile.email;

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;

  // Mode développement local si Firebase n'est pas configuré
  if (!isFirebaseConfigured || !db || !storage) {
    const localDataUrl = await blobToDataUrl(preparedFile.file);
    const localReceipt = buildReceiptDocument({
      receiptId,
      url: localDataUrl || preparedFile.previewUrl,
      fileName: preparedFile.normalizedName,
      uploadDateIso,
      extractedDate: verifiedPayload.extractedDate,
      extractedAmount: verifiedPayload.extractedAmount,
      expenseType: verifiedPayload.expenseType,
      description: verifiedPayload.description,
      merchantName: verifiedPayload.merchantName,
      submittedByUid: userProfile.uid,
      submittedByName: submitterFullName,
      submittedByEmail: userProfile.email,
      reimbursementIban: verifiedPayload.reimbursementIban,
    });

    saveSubmittedReceiptLocally({
      orgId: targetCompta.orgId,
      orgName: targetCompta.orgName,
      comptaId: targetCompta.comptaId,
      comptaName: targetCompta.comptaName,
      currency: targetCompta.currency,
      syncState: 'synced',
      receipt: localReceipt,
    });

    return {
      status: 'uploaded',
      receipt: localReceipt,
      storagePath,
      firestorePath,
      message: `✅ Justificatif transmis avec succès dans « ${targetCompta.comptaName} » !`,
    };
  }

  // Envoi vers Firebase Storage + Cloud Firestore si en ligne
  if (isOnline) {
    try {
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, preparedFile.file, {
        contentType,
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);

      const receiptDoc = buildReceiptDocument({
        receiptId,
        url: downloadUrl,
        fileName: preparedFile.normalizedName,
        uploadDateIso,
        extractedDate: verifiedPayload.extractedDate,
        extractedAmount: verifiedPayload.extractedAmount,
        expenseType: verifiedPayload.expenseType,
        description: verifiedPayload.description,
        merchantName: verifiedPayload.merchantName,
        submittedByUid: userProfile.uid,
        submittedByName: submitterFullName,
        submittedByEmail: userProfile.email,
        reimbursementIban: verifiedPayload.reimbursementIban,
      });

      const receiptRef = doc(
        db,
        'organizations',
        targetCompta.orgId,
        'comptabilites',
        targetCompta.comptaId,
        'receipts',
        receiptId
      );
      await setDoc(receiptRef, receiptDoc);

      saveSubmittedReceiptLocally({
        orgId: targetCompta.orgId,
        orgName: targetCompta.orgName,
        comptaId: targetCompta.comptaId,
        comptaName: targetCompta.comptaName,
        currency: targetCompta.currency,
        syncState: 'synced',
        receipt: receiptDoc,
      });

      return {
        status: 'uploaded',
        receipt: receiptDoc,
        storagePath,
        firestorePath,
        message: `✅ Justificatif transmis avec succès dans « ${targetCompta.comptaName} » !`,
      };
    } catch (uploadErr) {
      // Si l'erreur est due à une coupure réseau passagère, basculer vers la file hors-ligne
      const errCode =
        typeof uploadErr === 'object' && uploadErr !== null && 'code' in uploadErr
          ? String((uploadErr as { code: unknown }).code)
          : '';
      if (
        errCode.includes('permission-denied') ||
        errCode.includes('unauthorized') ||
        errCode.includes('unauthenticated')
      ) {
        throw new Error(
          "Accès refusé par Firebase lors de l'envoi du justificatif. Vérifiez vos droits d'accès sur cette comptabilité."
        );
      }
      console.warn('Échec réseau lors du téléversement, mise en file hors-ligne :', uploadErr);
    }
  }

  // Fallback File d'attente hors-ligne (si hors-ligne ou coupure réseau momentanée)
  const fileDataUrl = await blobToDataUrl(preparedFile.file);
  const queuedReceiptDoc = buildReceiptDocument({
    receiptId,
    url: fileDataUrl || preparedFile.previewUrl,
    fileName: preparedFile.normalizedName,
    uploadDateIso,
    extractedDate: verifiedPayload.extractedDate,
    extractedAmount: verifiedPayload.extractedAmount,
    expenseType: verifiedPayload.expenseType,
    description: verifiedPayload.description,
    merchantName: verifiedPayload.merchantName,
    submittedByUid: userProfile.uid,
    submittedByName: submitterFullName,
    submittedByEmail: userProfile.email,
    reimbursementIban: verifiedPayload.reimbursementIban,
  });

  enqueueOfflineReceipt({
    queueId: receiptId,
    orgId: targetCompta.orgId,
    orgName: targetCompta.orgName,
    comptaId: targetCompta.comptaId,
    comptaName: targetCompta.comptaName,
    currency: targetCompta.currency,
    createdAt: timestampMs,
    fileDataUrl,
    fileName: preparedFile.normalizedName,
    mimeType: contentType,
    receiptDoc: queuedReceiptDoc,
  });

  saveSubmittedReceiptLocally({
    orgId: targetCompta.orgId,
    orgName: targetCompta.orgName,
    comptaId: targetCompta.comptaId,
    comptaName: targetCompta.comptaName,
    currency: targetCompta.currency,
    syncState: 'pending_offline',
    receipt: queuedReceiptDoc,
  });

  return {
    status: 'queued_offline',
    receipt: queuedReceiptDoc,
    storagePath,
    firestorePath,
    message: `📡 Hors-ligne : votre justificatif est enregistré sur l'appareil et sera envoyé automatiquement vers « ${targetCompta.comptaName} » dès le retour du réseau.`,
  };
};

/**
 * Synchronise automatiquement les justificatifs en attente dans la file hors-ligne dès le retour du réseau.
 */
export const syncPendingOfflineReceipts = async (): Promise<number> => {
  if (!isFirebaseConfigured || !db || !storage) return 0;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;

  const firestoreDb = db;
  const firebaseStorage = storage;
  const queue = getOfflineReceiptQueue();
  if (queue.length === 0) return 0;

  let syncedCount = 0;

  for (const item of queue) {
    try {
      const { contentType, extension } = resolveUploadContentTypeAndExtension(
        item.mimeType,
        item.fileName
      );
      const randomToken = item.queueId.split('-').pop() || 'sync';
      const storagePath = buildStorageObjectPath(
        item.orgId,
        item.comptaId,
        item.createdAt,
        randomToken,
        extension
      );

      const blob = await dataUrlToBlob(item.fileDataUrl, contentType);
      const storageRef = ref(firebaseStorage, storagePath);
      const snap = await uploadBytes(storageRef, blob, { contentType });
      const downloadUrl = await getDownloadURL(snap.ref);

      const finalDoc: Receipt = {
        ...item.receiptDoc,
        url: downloadUrl,
      };

      const receiptRef = doc(
        firestoreDb,
        'organizations',
        item.orgId,
        'comptabilites',
        item.comptaId,
        'receipts',
        item.receiptDoc.id
      );
      await setDoc(receiptRef, finalDoc);

      removeOfflineReceiptFromQueue(item.queueId);
      saveSubmittedReceiptLocally({
        orgId: item.orgId,
        orgName: item.orgName,
        comptaId: item.comptaId,
        comptaName: item.comptaName,
        currency: item.currency,
        syncState: 'synced',
        receipt: finalDoc,
      });
      syncedCount++;
    } catch (err) {
      console.warn(`Échec de synchronisation du justificatif hors-ligne ${item.queueId} :`, err);
    }
  }

  return syncedCount;
};
