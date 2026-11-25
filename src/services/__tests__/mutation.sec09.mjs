import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const testPath = path.resolve(import.meta.dirname, 'sec09.urlSecurity.test.mjs');

const FILES = {
  url: 'src/services/urlSecurity.ts',
  history: 'src/screens/HistoryScreen.tsx',
  org: 'src/services/mobileOrganizationService.ts',
};

const originals = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);

const mutants = [
  {
    id: 'M01',
    fileKey: 'url',
    description: 'escapeHtml : suppression échappement <',
    target: ".replace(/</g, '&lt;')",
    replacement: '',
  },
  {
    id: 'M02',
    fileKey: 'url',
    description: 'escapeHtml : suppression échappement &',
    target: ".replace(/&/g, '&amp;')",
    replacement: '',
  },
  {
    id: 'M03',
    fileKey: 'url',
    description: 'isSafeReceiptUrl : autoriser http://',
    target: "if (parsed.protocol !== 'https:') return false;",
    replacement: "if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;",
  },
  {
    id: 'M04',
    fileKey: 'url',
    description: 'isSafeReceiptUrl : accepter credentials embedded',
    target: "if (parsed.username !== '' || parsed.password !== '') return false;",
    replacement: "if (false && (parsed.username !== '' || parsed.password !== '')) return false;",
  },
  {
    id: 'M05',
    fileKey: 'url',
    description: 'isSafeReceiptUrl : limite longueur augmentée à 4096',
    target: 'export const MAX_RECEIPT_URL_LENGTH = 2048;',
    replacement: 'export const MAX_RECEIPT_URL_LENGTH = 4096;',
  },
  {
    id: 'M06',
    fileKey: 'url',
    description: 'isSafeReceiptUrl : autoriser sous-domaines multi-niveaux',
    target: 'const FIREBASE_STORAGE_HOST_REGEX = /^[a-z0-9-]+\\.firebasestorage\\.app$/i;',
    replacement: 'const FIREBASE_STORAGE_HOST_REGEX = /\\.firebasestorage\\.app$/i;',
  },
  {
    id: 'M07',
    fileKey: 'history',
    description: 'HistoryScreen : bypass sanitizeReceiptUrl',
    target: 'const safeReceiptUrl = sanitizeReceiptUrl(item.receipt.url);',
    replacement: 'const safeReceiptUrl = item.receipt.url;',
  },
  {
    id: 'M08',
    fileKey: 'history',
    description: 'HistoryScreen : affaiblir noopener noreferrer -> noreferrer',
    target: 'rel="noopener noreferrer"',
    replacement: 'rel="noreferrer"',
  },
  {
    id: 'M09',
    fileKey: 'history',
    description: 'HistoryScreen : retirer referrerPolicy sur image reçu',
    target: 'referrerPolicy="no-referrer"\n                        alt={title}',
    replacement: 'alt={title}',
  },
  {
    id: 'M10',
    fileKey: 'org',
    description: 'mobileOrganizationService : réintroduction getDocs collection members',
    target: 'return await getDoc(doc(firestoreDb, \'organizations\', orgDoc.id, \'members\', memberId));',
    replacement: "return await getDocs(collection(firestoreDb, 'organizations', orgDoc.id, 'members'));",
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

console.log(`\nMobile SEC-09 Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
