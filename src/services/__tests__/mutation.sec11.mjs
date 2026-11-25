import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const TARGET_REL = 'src/services/pdfTextExtractor.ts';
const TARGET_ABS = path.join(REPO_ROOT, TARGET_REL);
const TEST_ABS = path.join(REPO_ROOT, 'src/services/__tests__/sec11.pdfZipBomb.test.mjs');

const original = fs.readFileSync(TARGET_ABS, 'utf8');

const mutants = [
  {
    id: 'Z01',
    description: 'extractTextFromPdfBuffer : contourne limite MAX_PDF_INPUT_BYTES',
    target: 'if (bytes.byteLength > MAX_PDF_INPUT_BYTES) {',
    replacement: 'if (false && bytes.byteLength > MAX_PDF_INPUT_BYTES) {',
  },
  {
    id: 'Z02',
    description: 'inflatePdfStreamBounded : rejette la borne exacte (>= au lieu de >)',
    target: 'if (totalBytes > maxBytes) {',
    replacement: 'if (totalBytes >= maxBytes) {',
  },
  {
    id: 'Z03',
    description: 'MAX_SINGLE_STREAM_DECOMPRESSED_BYTES : élève limite flux à 20 MiB',
    target: 'export const MAX_SINGLE_STREAM_DECOMPRESSED_BYTES = 2 * 1024 * 1024;',
    replacement: 'export const MAX_SINGLE_STREAM_DECOMPRESSED_BYTES = 20 * 1024 * 1024;',
  },
  {
    id: 'Z04',
    description: 'MAX_TOTAL_PDF_DECOMPRESSED_BYTES : élève budget cumulatif à 50 MiB',
    target: 'export const MAX_TOTAL_PDF_DECOMPRESSED_BYTES = 10 * 1024 * 1024;',
    replacement: 'export const MAX_TOTAL_PDF_DECOMPRESSED_BYTES = 50 * 1024 * 1024;',
  },
  {
    id: 'Z05',
    description: 'inflatePdfStreamBounded : avale PdfDecompressionLimitError dans catch',
    target: '      if (isPdfDecompressionLimitError(err)) {\n        throw err;\n      }',
    replacement: '      if (false && isPdfDecompressionLimitError(err)) {\n        throw err;\n      }',
  },
  {
    id: 'Z06',
    description: 'extractTextFromPdfBuffer : n accumule pas totalDecompressedBytes',
    target: 'totalDecompressedBytes += inflated.byteLength;',
    replacement: 'void inflated.byteLength;',
  },
  {
    id: 'Z07',
    description: 'inflatePdfStreamBounded : omet reader.cancel() au dépassement',
    target: 'await reader.cancel().catch(() => {});',
    replacement: 'await Promise.resolve();',
  },
  {
    id: 'Z08',
    description: 'extractTextFromPdfBuffer : ignore remainingTotal dans streamBudget',
    target: 'const streamBudget = Math.min(MAX_SINGLE_STREAM_DECOMPRESSED_BYTES, remainingTotal);',
    replacement: 'const streamBudget = MAX_SINGLE_STREAM_DECOMPRESSED_BYTES;',
  },
  {
    id: 'Z09',
    description: 'inflatePdfStreamBounded : propage toute erreur corrupt non-limite',
    target: '      if (isPdfDecompressionLimitError(err)) {\n        throw err;\n      }',
    replacement: '      throw err;',
  },
  {
    id: 'Z10',
    description: 'inflatePdfStreamBounded : oublie de pousser chunks pour assemblage complet',
    target: '        chunks.push(value);',
    replacement: '        if (chunks.length === 0) chunks.push(value);',
  },
];

let killed = 0;
let invalid = 0;
const survivors = [];

try {
  for (const m of mutants) {
    const normalized = original.replace(/\r\n/g, '\n');
    if (!normalized.includes(m.target)) {
      console.error(`[INVALID] ${m.id} (${m.description}): target not matched in ${TARGET_REL}`);
      invalid += 1;
      continue;
    }
    const mutated = normalized.replace(m.target, m.replacement);
    fs.writeFileSync(TARGET_ABS, mutated, 'utf8');
    const res = spawnSync(
      process.execPath,
      ['--experimental-transform-types', '--test', TEST_ABS],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: 15000,
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

console.log(`\nMobile SEC-11 Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
