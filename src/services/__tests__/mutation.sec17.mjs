import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const FILES = {
  crypto: 'src/services/cryptoRandom.ts',
  rental: 'src/services/rentalHelpers.ts',
  upload: 'src/services/receiptUploadService.ts',
};

const originals = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);
const testPath = path.join(REPO_ROOT, 'src/services/__tests__/sec17.cryptoRandom.test.mjs');

const mutants = [
  {
    id: 'K01',
    fileKey: 'crypto',
    description: 'cryptoRandom : n appelle pas cryptoObj.getRandomValues(buf)',
    target: '  cryptoObj.getRandomValues(buf);',
    replacement: '  buf.fill(0);',
  },
  {
    id: 'K02',
    fileKey: 'crypto',
    description: 'cryptoRandom : réduit entropie par défaut à 2 octets',
    target: 'export const generateSecureRandomToken = (byteLength: number = 8): string => {',
    replacement: 'export const generateSecureRandomToken = (byteLength: number = 2): string => {',
  },
  {
    id: 'K03',
    fileKey: 'crypto',
    description: 'cryptoRandom : autorise byteLength <= 0 sans garde fallback 8',
    target: "const safeBytes =\n    typeof byteLength === 'number' && Number.isFinite(byteLength) && byteLength >= 1\n      ? Math.min(64, Math.floor(byteLength))\n      : 8;",
    replacement: 'const safeBytes = Math.max(0, Math.floor(byteLength));',
  },
  {
    id: 'K04',
    fileKey: 'crypto',
    description: 'cryptoRandom : retire le plafond Math.min(64, ...)',
    target: '? Math.min(64, Math.floor(byteLength))',
    replacement: '? Math.floor(byteLength)',
  },
  {
    id: 'K05',
    fileKey: 'crypto',
    description: 'cryptoRandom : omet padStart(2, 0) (longueur variable non hex-fixe)',
    target: "hex += buf[i].toString(16).padStart(2, '0');",
    replacement: 'hex += buf[i].toString(16);',
  },
  {
    id: 'K06',
    fileKey: 'rental',
    description: 'rentalHelpers : réintroduit Math.random()',
    target: 'return cleaned || generateSecureRentalToken(4);',
    replacement: 'return cleaned || Math.random().toString(36).substring(2, 8);',
  },
  {
    id: 'K07',
    fileKey: 'rental',
    description: 'rentalHelpers : désactive getRandomValues dans generateSecureRentalToken',
    target: '  cryptoObj.getRandomValues(buf);',
    replacement: '  buf.fill(7);',
  },
  {
    id: 'K08',
    fileKey: 'rental',
    description: 'rentalHelpers : tronque cleaned à 4 chars au lieu de 8',
    target: ".slice(0, 8)",
    replacement: '.slice(0, 4)',
  },
  {
    id: 'K09',
    fileKey: 'upload',
    description: 'receiptUploadService : réintroduit Math.random()',
    target: 'const randomToken = generateSecureRandomToken(8);',
    replacement: 'const randomToken = Math.random().toString(36).slice(2, 8);',
  },
  {
    id: 'K10',
    fileKey: 'upload',
    description: 'receiptUploadService : passe byteLength 0 à generateSecureRandomToken',
    target: 'const randomToken = generateSecureRandomToken(8);',
    replacement: 'const randomToken = generateSecureRandomToken(0);',
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
      survivors.push(m);
      console.error(`[SURVIVED] ${m.id}: ${m.description}`);
    }
  }
} finally {
  for (const [k, orig] of Object.entries(originals)) {
    fs.writeFileSync(path.join(REPO_ROOT, FILES[k]), orig, 'utf8');
  }
}

console.log(`\nMobile SEC-17 Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
