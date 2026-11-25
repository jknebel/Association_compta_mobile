import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const testPath = path.resolve(import.meta.dirname, 'sec10.storageAuth.test.mjs');

const FILES = {
  sec: 'src/services/sessionSecurity.ts',
  verif: 'src/services/verificationHelpers.ts',
  auth: 'src/contexts/AuthContext.tsx',
  upload: 'src/services/receiptUploadService.ts',
};

const originals = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);

const mutants = [
  {
    id: 'S01',
    fileKey: 'sec',
    description: 'canUseUnconfiguredDemoMode : autorise démo en PROD',
    target: 'return !isConfigured && !isProd;',
    replacement: 'return !isConfigured;',
  },
  {
    id: 'S02',
    fileKey: 'sec',
    description: 'scopedStorageKey : ignore uid et retourne baseKey partagé',
    target: 'return cleanUid ? `${baseKey}_${cleanUid}` : baseKey;',
    replacement: 'return baseKey;',
  },
  {
    id: 'S03',
    fileKey: 'sec',
    description: 'purgeSensitiveLocalStorage : ne purge pas SENSITIVE_STORAGE_KEYS',
    target: 'const keysToRemove = new Set<string>(SENSITIVE_STORAGE_KEYS);',
    replacement: 'const keysToRemove = new Set<string>();',
  },
  {
    id: 'S04',
    fileKey: 'sec',
    description: 'filterOfflineQueueForUser : désactive filtrage uid',
    target: "return itemUid !== '' && itemUid === cleanUid;",
    replacement: 'return true;',
  },
  {
    id: 'S05',
    fileKey: 'sec',
    description: 'filterOfflineQueueForUser : oublie de trim currentUid',
    target: "const cleanUid = typeof currentUid === 'string' ? currentUid.trim() : '';",
    replacement: "const cleanUid = typeof currentUid === 'string' ? currentUid : '';",
  },
  {
    id: 'S06',
    fileKey: 'verif',
    description: 'getSavedIbanFromStorage : ignore uid',
    target: 'return normalizeIban(s.getItem(scopeStorageKey(SAVED_IBAN_STORAGE_KEY, uid)));',
    replacement: 'return normalizeIban(s.getItem(SAVED_IBAN_STORAGE_KEY));',
  },
  {
    id: 'S07',
    fileKey: 'verif',
    description: 'saveIbanToStorage : ignore uid',
    target: 'const key = scopeStorageKey(SAVED_IBAN_STORAGE_KEY, uid);',
    replacement: 'const key = SAVED_IBAN_STORAGE_KEY;',
  },
  {
    id: 'S08',
    fileKey: 'auth',
    description: 'AuthContext logout : ne purge plus localStorage',
    target: 'purgeSensitiveLocalStorage(',
    replacement: 'void (',
  },
  {
    id: 'S09',
    fileKey: 'auth',
    description: 'AuthContext init : permet session locale en PROD',
    target: 'if (!canUseUnconfiguredDemoMode(isFirebaseConfigured, Boolean(import.meta.env.PROD))) {',
    replacement: 'if (false && !canUseUnconfiguredDemoMode(isFirebaseConfigured, Boolean(import.meta.env.PROD))) {',
  },
  {
    id: 'S10',
    fileKey: 'upload',
    description: 'syncPendingOfflineReceipts : synchronise les reçus d un autre utilisateur',
    target: 'const queue = filterOfflineQueueForUser(getOfflineReceiptQueue(), activeUid);',
    replacement: 'const queue = getOfflineReceiptQueue();',
  },
];

let killed = 0;
let invalid = 0;
const survivors = [];

try {
  for (const m of mutants) {
    const absPath = path.join(REPO_ROOT, FILES[m.fileKey]);
    const orig = originals[m.fileKey];
    const normalized = orig.replace(/\r\n/g, '\n');
    if (!normalized.includes(m.target)) {
      console.error(`[INVALID] ${m.id} (${m.description}): target not matched in ${FILES[m.fileKey]}`);
      invalid += 1;
      continue;
    }
    const mutated = normalized.replace(m.target, m.replacement);
    fs.writeFileSync(absPath, mutated, 'utf8');
    const res = spawnSync(
      process.execPath,
      ['--experimental-transform-types', '--test', testPath],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=192' },
      }
    );
    fs.writeFileSync(absPath, orig, 'utf8');

    if (res.status !== 0) {
      killed += 1;
      console.log(`[KILLED] ${m.id}: ${m.description}`);
    } else {
      survivors.push(m.id);
      console.error(`[SURVIVED] ${m.id}: ${m.description}`);
    }
  }
} finally {
  for (const [k, content] of Object.entries(originals)) {
    fs.writeFileSync(path.join(REPO_ROOT, FILES[k]), content, 'utf8');
  }
}

console.log(`\nMobile SEC-10 Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
