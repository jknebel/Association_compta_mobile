/**
 * SEC-10 local storage isolation, logout cleanup, offline queue user scoping,
 * and production unconfigured-Firebase guardrails for Mobile PWA.
 */

export const SENSITIVE_STORAGE_KEYS: readonly string[] = [
  'asso_compta_saved_iban_v1',
  'asso_compta_saved_npa_v1',
  'asso_compta_saved_city_v1',
  'asso_compta_local_submitted_receipts_v1',
  'asso_compta_offline_receipt_queue_v1',
  'asso_compta_local_rentals_v1',
  'asso_compta_selected_compta_id_v1',
  'asso_compta_mobile_session_v1',
];

export const PROD_FIREBASE_MISSING_ERROR =
  'Configuration Firebase manquante en production. Contactez un administrateur.';

export function scopedStorageKey(baseKey: string, uid?: string | null): string {
  const cleanUid = typeof uid === 'string' ? uid.trim() : '';
  return cleanUid ? `${baseKey}_${cleanUid}` : baseKey;
}

export function purgeSensitiveLocalStorage(
  storage?: Storage | null,
  knownUids: readonly string[] = []
): number {
  const s =
    storage !== undefined
      ? storage
      : typeof localStorage !== 'undefined'
      ? localStorage
      : null;
  if (!s) return 0;

  const keysToRemove = new Set<string>(SENSITIVE_STORAGE_KEYS);
  for (const uid of knownUids) {
    const cleanUid = typeof uid === 'string' ? uid.trim() : '';
    if (!cleanUid) continue;
    for (const baseKey of SENSITIVE_STORAGE_KEYS) {
      keysToRemove.add(`${baseKey}_${cleanUid}`);
    }
  }

  try {
    if (typeof s.length === 'number' && typeof s.key === 'function') {
      for (let i = 0; i < s.length; i += 1) {
        const k = s.key(i);
        if (typeof k === 'string' && k.startsWith('asso_compta_')) {
          keysToRemove.add(k);
        }
      }
    }
  } catch {
    // Ignore enumeration errors on restricted storages
  }

  let removedCount = 0;
  for (const key of keysToRemove) {
    try {
      const hadValue = s.getItem(key) !== null;
      s.removeItem(key);
      if (hadValue) removedCount += 1;
    } catch {
      // Ignore individual key removal errors
    }
  }
  return removedCount;
}

export function filterOfflineQueueForUser<
  T extends { receiptDoc?: { submittedByUid?: string | null } }
>(queue: readonly T[], currentUid?: string | null): T[] {
  const cleanUid = typeof currentUid === 'string' ? currentUid.trim() : '';
  if (!cleanUid || !Array.isArray(queue)) return [];
  return queue.filter((item) => {
    const itemUid =
      typeof item?.receiptDoc?.submittedByUid === 'string'
        ? item.receiptDoc.submittedByUid.trim()
        : '';
    return itemUid !== '' && itemUid === cleanUid;
  });
}

export function canUseUnconfiguredDemoMode(isConfigured: boolean, isProd: boolean): boolean {
  return !isConfigured && !isProd;
}
