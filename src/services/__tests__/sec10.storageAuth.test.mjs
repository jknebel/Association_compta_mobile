import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SENSITIVE_STORAGE_KEYS,
  scopedStorageKey,
  purgeSensitiveLocalStorage,
  filterOfflineQueueForUser,
  canUseUnconfiguredDemoMode,
} from '../sessionSecurity.ts';
import {
  SAVED_IBAN_STORAGE_KEY,
  SAVED_NPA_STORAGE_KEY,
  SAVED_CITY_STORAGE_KEY,
  getSavedIbanFromStorage,
  saveIbanToStorage,
  getSavedNpaFromStorage,
  saveNpaToStorage,
  getSavedCityFromStorage,
  saveCityToStorage,
} from '../verificationHelpers.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get length() {
      return store.size;
    },
    key(idx) {
      return Array.from(store.keys())[idx] ?? null;
    },
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(k, String(v));
    },
    removeItem(k) {
      store.delete(k);
    },
  };
}

test('[SEC-10][Positive] scopedStorageKey isolates IBAN/NPA/city per uid without leaking across users', () => {
  const storage = createMockStorage();
  saveIbanToStorage('CH93 0076 2011 6238 5295 7', storage, 'uid-alice');
  saveNpaToStorage('1110', storage, 'uid-alice');
  saveCityToStorage('Morges', storage, 'uid-alice');

  assert.equal(getSavedIbanFromStorage(storage, 'uid-alice'), 'CH93 0076 2011 6238 5295 7');
  assert.equal(getSavedIbanFromStorage(storage, 'uid-bob'), '');
  assert.equal(getSavedNpaFromStorage(storage, 'uid-bob'), '');
  assert.equal(getSavedCityFromStorage(storage, 'uid-bob'), '');
  assert.equal(storage.getItem(SAVED_IBAN_STORAGE_KEY), null);
  assert.equal(scopedStorageKey(SAVED_NPA_STORAGE_KEY, 'uid-alice'), `${SAVED_NPA_STORAGE_KEY}_uid-alice`);
  assert.equal(scopedStorageKey(SAVED_CITY_STORAGE_KEY, undefined), SAVED_CITY_STORAGE_KEY);
});

test('[SEC-10][Positive] purgeSensitiveLocalStorage wipes all sensitive and uid-scoped keys while keeping unrelated app prefs', () => {
  const storage = createMockStorage({
    [SAVED_IBAN_STORAGE_KEY]: 'CH93 0076 2011 6238 5295 7',
    [scopedStorageKey(SAVED_IBAN_STORAGE_KEY, 'u1')]: 'CH93 0076 2011 6238 5295 7',
    asso_compta_offline_receipt_queue_v1: '[{"queueId":"q1"}]',
    asso_compta_local_submitted_receipts_v1: '[{"id":"r1"}]',
    asso_compta_local_rentals_v1: '[{"id":"ren1"}]',
    asso_compta_selected_compta_id_v1: 'compta-1',
    asso_compta_mobile_session_v1: '{"uid":"u1"}',
    unrelated_theme_preference: 'dark',
  });

  const removed = purgeSensitiveLocalStorage(storage, ['u1']);
  assert.ok(removed >= 7);
  for (const key of SENSITIVE_STORAGE_KEYS) {
    assert.equal(storage.getItem(key), null);
  }
  assert.equal(storage.getItem(scopedStorageKey(SAVED_IBAN_STORAGE_KEY, 'u1')), null);
  assert.equal(storage.getItem('unrelated_theme_preference'), 'dark');

  // Minimal restricted storage without .length / .key(i) still purges SENSITIVE_STORAGE_KEYS
  const minimalMap = new Map([
    [SAVED_IBAN_STORAGE_KEY, 'CH93 0076 2011 6238 5295 7'],
    ['asso_compta_offline_receipt_queue_v1', '[{"queueId":"q2"}]'],
  ]);
  const minimalStorage = {
    getItem: (k) => (minimalMap.has(k) ? minimalMap.get(k) : null),
    setItem: (k, v) => minimalMap.set(k, String(v)),
    removeItem: (k) => minimalMap.delete(k),
  };
  const minimalRemoved = purgeSensitiveLocalStorage(minimalStorage);
  assert.equal(minimalRemoved, 2);
  assert.equal(minimalStorage.getItem(SAVED_IBAN_STORAGE_KEY), null);
});

test('[SEC-10][Negative & Boundary] filterOfflineQueueForUser prevents cross-user queue sync and empty uid returns empty', () => {
  const queue = [
    { queueId: 'q-alice', receiptDoc: { submittedByUid: 'uid-alice' } },
    { queueId: 'q-bob', receiptDoc: { submittedByUid: 'uid-bob' } },
    { queueId: 'q-missing', receiptDoc: {} },
    { queueId: 'q-empty', receiptDoc: { submittedByUid: '' } },
    { queueId: 'q-null' },
  ];

  const aliceItems = filterOfflineQueueForUser(queue, ' uid-alice ');
  assert.deepEqual(aliceItems.map((i) => i.queueId), ['q-alice']);
  assert.deepEqual(filterOfflineQueueForUser(queue, ''), []);
  assert.deepEqual(filterOfflineQueueForUser(queue, null), []);
  assert.deepEqual(filterOfflineQueueForUser(queue, undefined), []);
});

test('[SEC-10][Negative] unconfigured Firebase demo mode is blocked in production builds', () => {
  assert.equal(canUseUnconfiguredDemoMode(false, false), true);
  assert.equal(canUseUnconfiguredDemoMode(false, true), false);
  assert.equal(canUseUnconfiguredDemoMode(true, false), false);
  assert.equal(canUseUnconfiguredDemoMode(true, true), false);
});

test('[SEC-10][Integration] AuthContext, ReceiptPreview, and receiptUploadService wire SEC-10 controls', () => {
  const authCtx = fs.readFileSync(path.join(REPO_ROOT, 'src/contexts/AuthContext.tsx'), 'utf8');
  assert.equal(
    (authCtx.match(/if \(!canUseUnconfiguredDemoMode\(isFirebaseConfigured, Boolean\(import\.meta\.env\.PROD\)\)\)/g) || []).length,
    4
  );
  assert.doesNotMatch(authCtx, /false\s*&&/);
  assert.match(authCtx, /purgeSensitiveLocalStorage\(/);
  assert.match(authCtx, /finally\s*\{[\s\S]*purgeSensitiveLocalStorage/);

  const preview = fs.readFileSync(path.join(REPO_ROOT, 'src/components/ReceiptPreview.tsx'), 'utf8');
  assert.match(preview, /getSavedIbanFromStorage\(undefined,\s*storageUid\)/);
  assert.match(preview, /saveIbanToStorage\([^,]+,\s*undefined,\s*storageUid\)/);

  const upload = fs.readFileSync(path.join(REPO_ROOT, 'src/services/receiptUploadService.ts'), 'utf8');
  assert.match(upload, /filterOfflineQueueForUser\(getOfflineReceiptQueue\(\),\s*activeUid\)/);
});
