import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const TARGET_ABS = path.join(REPO_ROOT, 'firebase.json');
const original = fs.readFileSync(TARGET_ABS, 'utf8');
const testPath = path.join(REPO_ROOT, 'src/services/__tests__/sec13.hostingHeaders.test.mjs');

const mutants = [
  {
    id: 'H01',
    description: 'firebase.json : désactive Strict-Transport-Security',
    target: '"key": "Strict-Transport-Security",',
    replacement: '"key": "X-Disabled-HSTS",',
  },
  {
    id: 'H02',
    description: 'firebase.json : affaiblit HSTS max-age sous 1 an',
    target: 'max-age=63072000',
    replacement: 'max-age=60',
  },
  {
    id: 'H03',
    description: 'firebase.json : affaiblit X-Frame-Options DENY -> SAMEORIGIN',
    target: '"value": "DENY"',
    replacement: '"value": "SAMEORIGIN"',
  },
  {
    id: 'H04',
    description: 'firebase.json : désactive X-Content-Type-Options nosniff',
    target: '"value": "nosniff"',
    replacement: '"value": "off"',
  },
  {
    id: 'H05',
    description: 'firebase.json : casse caméra PWA (camera=(self) -> camera=())',
    target: '"value": "camera=(self), microphone=(), geolocation=(), payment=()"',
    replacement: '"value": "camera=(), microphone=(), geolocation=(), payment=()"',
  },
  {
    id: 'H06',
    description: 'firebase.json : autorise unsafe-inline dans script-src',
    target: "script-src 'self' https://apis.google.com",
    replacement: "script-src 'self' 'unsafe-inline' https://apis.google.com",
  },
  {
    id: 'H07',
    description: 'firebase.json : retire worker-src blob pour PWA Service Worker',
    target: "worker-src 'self' blob:; ",
    replacement: '',
  },
  {
    id: 'H08',
    description: 'firebase.json : retire manifest-src self pour PWA',
    target: "manifest-src 'self'; ",
    replacement: '',
  },
  {
    id: 'H09',
    description: 'firebase.json : retire frame-ancestors none',
    target: "; frame-ancestors 'none'",
    replacement: '',
  },
  {
    id: 'H10',
    description: 'firebase.json : casse popup Google Auth via COOP same-origin',
    target: '"key": "X-Frame-Options",',
    replacement: '"key": "Cross-Origin-Opener-Policy", "value": "same-origin" },\n          { "key": "X-Frame-Options",',
  },
];

let killed = 0;
let invalid = 0;
const survivors = [];

try {
  for (const m of mutants) {
    const normalized = original.replace(/\r\n/g, '\n');
    if (!normalized.includes(m.target)) {
      console.error(`[INVALID] ${m.id} (${m.description}): target not matched in firebase.json`);
      invalid += 1;
      continue;
    }
    const mutated = normalized.replace(m.target, m.replacement);
    fs.writeFileSync(TARGET_ABS, mutated, 'utf8');
    const res = spawnSync(
      process.execPath,
      ['--experimental-transform-types', '--test', testPath],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=192' },
      }
    );
    fs.writeFileSync(TARGET_ABS, original, 'utf8');

    if (res.status !== 0) {
      killed += 1;
      console.log(`[KILLED] ${m.id}: ${m.description}`);
    } else {
      survivors.push(m);
      console.error(`[SURVIVED] ${m.id}: ${m.description}`);
    }
  }
} finally {
  fs.writeFileSync(TARGET_ABS, original, 'utf8');
}

console.log(`\nMobile SEC-13 Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
