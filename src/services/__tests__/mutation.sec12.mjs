import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const FILES = {
  pkg: 'package.json',
  ci: '.github/workflows/security-ci.yml',
  pdf: 'src/services/pdfTextExtractor.ts',
};

const originals = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);
const testPath = path.join(REPO_ROOT, 'src/services/__tests__/sec12.deps.test.mjs');

const mutants = [
  {
    id: 'D01',
    fileKey: 'pkg',
    description: 'package.json : réintroduit dépendance inutilisée @google/genai',
    target: '    "firebase": "^13.4.0",',
    replacement: '    "@google/genai": "^1.0.0",\n    "firebase": "^13.4.0",',
  },
  {
    id: 'D02',
    fileKey: 'pkg',
    description: 'package.json : rétrograde firebase vers ^11.0.0',
    target: '"firebase": "^13.4.0"',
    replacement: '"firebase": "^11.0.0"',
  },
  {
    id: 'D03',
    fileKey: 'pkg',
    description: 'package.json : supprime override @grpc/grpc-js',
    target: '"@grpc/grpc-js": "^1.14.7"',
    replacement: '"@grpc/grpc-js": "^1.13.5"',
  },
  {
    id: 'D04',
    fileKey: 'pkg',
    description: 'package.json : rétrograde vite vers ^6.0.0',
    target: '"vite": "^6.4.6"',
    replacement: '"vite": "^6.0.0"',
  },
  {
    id: 'D05',
    fileKey: 'pkg',
    description: 'package.json : rétrograde tailwindcss vers ^3.4.15',
    target: '"tailwindcss": "^3.4.19"',
    replacement: '"tailwindcss": "^3.4.15"',
  },
  {
    id: 'D06',
    fileKey: 'ci',
    description: 'security-ci.yml : supprime étape npm audit --omit=dev',
    target: 'npm audit --omit=dev --audit-level=high',
    replacement: 'echo skip-audit',
  },
  {
    id: 'D07',
    fileKey: 'ci',
    description: 'security-ci.yml : affaiblit audit-level=high vers critical',
    target: 'npm audit --omit=dev --audit-level=high',
    replacement: 'npm audit --omit=dev --audit-level=critical',
  },
  {
    id: 'D08',
    fileKey: 'ci',
    description: 'security-ci.yml : ignore échec npm audit via || true',
    target: 'npm audit --omit=dev --audit-level=high',
    replacement: 'npm audit --omit=dev --audit-level=high || true',
  },
  {
    id: 'D09',
    fileKey: 'ci',
    description: 'security-ci.yml : remplace npm ci par npm install',
    target: 'run: npm ci',
    replacement: 'run: npm install',
  },
  {
    id: 'D10',
    fileKey: 'pdf',
    description: 'src : réintroduit un import @google/genai dans le client mobile',
    target: 'export const MAX_PDF_INPUT_BYTES',
    replacement: '// import "@google/genai"\nexport const MAX_PDF_INPUT_BYTES',
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

console.log(`\nMobile SEC-12 Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
