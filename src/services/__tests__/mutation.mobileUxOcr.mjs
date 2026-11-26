import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const testPath = path.join(REPO_ROOT, 'src/services/__tests__/feat.mobileUxOcr.test.mjs');

const FILES = {
  home: 'src/screens/ScanHomeScreen.tsx',
  drop: 'src/components/ReceiptDropZone.tsx',
  css: 'src/index.css',
};

const originals = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);

const mutants = [
  {
    id: 'X01',
    fileKey: 'home',
    description: 'ScanHomeScreen : retire carte Payer la facture',
    target: '<div className="text-xs font-bold text-slate-200">Payer la facture</div>',
    replacement: '<div className="text-xs font-bold text-slate-200">Autre</div>',
  },
  {
    id: 'X02',
    fileKey: 'home',
    description: 'ScanHomeScreen : revient à grid-cols-2',
    target: '<div className="grid grid-cols-3 gap-2.5">',
    replacement: '<div className="grid grid-cols-2 gap-2.5">',
  },
  {
    id: 'X03',
    fileKey: 'drop',
    description: 'ReceiptDropZone : ignore pendingPrepared (cache aperçu pendant OCR contrôlé)',
    target: '(externalPreparedFile !== undefined ? externalPreparedFile : internalPrepared) ?? pendingPrepared;',
    replacement: 'externalPreparedFile !== undefined ? externalPreparedFile : internalPrepared;',
  },
  {
    id: 'X04',
    fileKey: 'drop',
    description: 'ReceiptDropZone : retire classe animate-ocr-scan sur overlay OCR',
    target: 'animate-ocr-scan',
    replacement: 'opacity-0',
  },
  {
    id: 'X05',
    fileKey: 'drop',
    description: 'ReceiptDropZone : retire barre animée animate-ocr-progress',
    target: 'animate-ocr-progress',
    replacement: 'opacity-0',
  },
  {
    id: 'X06',
    fileKey: 'css',
    description: 'index.css : supprime @keyframes ocr-scan-line',
    target: '@keyframes ocr-scan-line',
    replacement: '@keyframes disabled-scan',
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

console.log(`\nMobile UX/OCR Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
