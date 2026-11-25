import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_PDF_INPUT_BYTES,
  MAX_SINGLE_STREAM_DECOMPRESSED_BYTES,
  MAX_TOTAL_PDF_DECOMPRESSED_BYTES,
  PDF_DECOMPRESSION_LIMIT_EXCEEDED,
  isPdfDecompressionLimitError,
  inflatePdfStreamBounded,
  extractTextFromPdfBuffer,
  extractTextFromPdfFile,
} from '../pdfTextExtractor.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

function buildFlatePdf(streams) {
  const parts = [Buffer.from('%PDF-1.7\n', 'latin1')];
  streams.forEach((compressedBytes, idx) => {
    const objId = idx + 1;
    const header = Buffer.from(
      `${objId} 0 obj\n<< /Length ${compressedBytes.length} /Filter /FlateDecode >>\nstream\n`,
      'latin1'
    );
    const footer = Buffer.from('\nendstream\nendobj\n', 'latin1');
    parts.push(header, compressedBytes, footer);
  });
  return new Uint8Array(Buffer.concat(parts));
}

test('[SEC-11][Positive] extracts text cleanly from normal FlateDecode PDF stream', async () => {
  const payload = Buffer.from('BT (Coop Lausanne Total CHF 48.90) Tj ET\n', 'latin1');
  const compressed = zlib.deflateSync(payload);
  const pdf = buildFlatePdf([compressed]);

  const text = await extractTextFromPdfBuffer(pdf);
  assert.match(text, /Coop Lausanne Total CHF 48\.90/);
});

test('[SEC-11][Boundary] inflatePdfStreamBounded accepts exact budget and rejects 1 byte over', async () => {
  const payload = Buffer.from('A'.repeat(1024), 'latin1');
  const compressed = zlib.deflateSync(payload);

  const ok = await inflatePdfStreamBounded(new Uint8Array(compressed), 1024);
  assert.ok(ok !== null);
  assert.equal(ok.byteLength, 1024);
  assert.equal(ok.text.length, 1024);

  await assert.rejects(
    () => inflatePdfStreamBounded(new Uint8Array(compressed), 1023),
    (err) => isPdfDecompressionLimitError(err)
  );
});

test('[SEC-11][Positive] multi-chunk compressed stream preserves full decoded content without corruption', async () => {
  const markerA = 'DEBUT_FACTURE_123 ';
  const markerB = ' FIN_TOTAL_999';
  const payload = Buffer.from(markerA + 'X'.repeat(180 * 1024) + markerB, 'latin1');
  const compressed = zlib.deflateSync(payload);

  const res = await inflatePdfStreamBounded(new Uint8Array(compressed), 256 * 1024);
  assert.ok(res !== null);
  assert.equal(res.byteLength, payload.length);
  assert.ok(res.text.startsWith(markerA));
  assert.ok(res.text.endsWith(markerB));
});

test('[SEC-11][Negative] rejects raw PDF buffer exceeding MAX_PDF_INPUT_BYTES', async () => {
  assert.equal(MAX_PDF_INPUT_BYTES, 15 * 1024 * 1024);
  const oversized = new Uint8Array(MAX_PDF_INPUT_BYTES + 1);
  await assert.rejects(
    () => extractTextFromPdfBuffer(oversized),
    (err) => isPdfDecompressionLimitError(err) && err.message.includes(PDF_DECOMPRESSION_LIMIT_EXCEEDED)
  );
});

test('[SEC-11][Negative] rejects single-stream FlateDecode zip bomb > 2 MiB while small on disk', async () => {
  assert.equal(MAX_SINGLE_STREAM_DECOMPRESSED_BYTES, 2 * 1024 * 1024);
  const bombPayload = Buffer.alloc(MAX_SINGLE_STREAM_DECOMPRESSED_BYTES + 4096, 0x41);
  const compressed = zlib.deflateSync(bombPayload);
  assert.ok(compressed.length < 100 * 1024, 'compressed payload must stay compact');

  const pdf = buildFlatePdf([compressed]);
  await assert.rejects(
    () => extractTextFromPdfBuffer(pdf),
    (err) => isPdfDecompressionLimitError(err)
  );

  // Wrapper extractTextFromPdfFile still fails safe with empty string instead of crashing caller
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const safeText = await extractTextFromPdfFile(blob);
  assert.equal(safeText, '');
});

test('[SEC-11][Negative] rejects multi-stream cumulative decompression > 10 MiB across valid <2 MiB streams', async () => {
  assert.equal(MAX_TOTAL_PDF_DECOMPRESSED_BYTES, 10 * 1024 * 1024);
  const perStreamSize = 1900 * 1024; // Each under 2 MiB; 6 streams = 11.4 MiB > 10 MiB
  const chunk = Buffer.alloc(perStreamSize, 0x42);
  const compressedChunk = zlib.deflateSync(chunk);
  const pdf = buildFlatePdf([
    compressedChunk,
    compressedChunk,
    compressedChunk,
    compressedChunk,
    compressedChunk,
    compressedChunk,
  ]);

  await assert.rejects(
    () => extractTextFromPdfBuffer(pdf),
    (err) => isPdfDecompressionLimitError(err)
  );
});

test('[SEC-11][Negative] corrupt non-overflowing FlateDecode stream returns null while preserving direct text', async () => {
  const corruptBytes = Buffer.from([0x78, 0x9c, 0xff, 0xff, 0x00, 0x01, 0x02]);
  const res = await inflatePdfStreamBounded(new Uint8Array(corruptBytes), 1024 * 1024);
  assert.equal(res, null);

  const prefix = Buffer.from('%PDF-1.7\nBT (Direct OK) Tj ET\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n', 'latin1');
  const suffix = Buffer.from('\nendstream\nendobj\n', 'latin1');
  const pdf = new Uint8Array(Buffer.concat([prefix, corruptBytes, suffix]));
  const extracted = await extractTextFromPdfBuffer(pdf);
  assert.equal(extracted, 'Direct OK');
});

test('[SEC-11][Integration] pdfTextExtractor cancels reader on overflow and enforces constants', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/services/pdfTextExtractor.ts'), 'utf8');
  assert.equal((src.match(/await reader\.cancel\(\)\.catch\(/g) || []).length, 2);
  assert.match(src, /void writer\.abort\(limitErr\)\.catch\(/);
});
