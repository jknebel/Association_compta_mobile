import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

test('[MOBILE-UX-OCR][Positive] ScanHomeScreen displays all 3 expense mode cards including Payer la facture', () => {
  const homeSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/screens/ScanHomeScreen.tsx'), 'utf8');
  assert.match(homeSrc, /Carte du compte/);
  assert.match(homeSrc, /Remboursement/);
  assert.match(homeSrc, /Payer la facture/);
  assert.match(homeSrc, /grid-cols-3/);
});

test('[MOBILE-UX-OCR][Positive & Boundary] ReceiptDropZone keeps preview mounted during controlled OCR and shows scan animation', () => {
  const dropSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/components/ReceiptDropZone.tsx'), 'utf8');
  assert.match(dropSrc, /const \[pendingPrepared, setPendingPrepared\]/);
  assert.match(dropSrc, /\?\? pendingPrepared;/);
  assert.match(dropSrc, /setPendingPrepared\(prepared\)/);
  assert.match(dropSrc, /animate-ocr-scan/);
  assert.match(dropSrc, /animate-ocr-progress/);
  assert.match(dropSrc, /Analyse OCR en cours/);

  const cssSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/index.css'), 'utf8');
  assert.match(cssSrc, /@keyframes ocr-scan-line/);
  assert.match(cssSrc, /@keyframes ocr-progress-slide/);
  assert.match(cssSrc, /\.animate-ocr-scan/);
  assert.match(cssSrc, /\.animate-ocr-progress/);
});
