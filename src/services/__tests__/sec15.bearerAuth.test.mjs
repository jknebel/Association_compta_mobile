import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  sanitizeBearerToken,
  buildAnalyzeReceiptHeaders,
  normalizeBackendBaseUrl,
  blobToBase64Pure,
  requestBackendReceiptAnalysis,
} from '../bearerAuthHelpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

test('[SEC-15][Positive] sends Authorization: Bearer <token> header and parses backend OCR JSON', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ date: '2026-04-12', amount: 42.5, merchantName: 'Migros' }),
    };
  };

  const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
  const result = await requestBackendReceiptAnalysis({
    file: blob,
    mimeType: 'image/png',
    backendUrl: 'https://backend.example.run.app///',
    getIdToken: async () => '  firebase-jwt-token-123  ',
    fetchImpl: fakeFetch,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://backend.example.run.app/analyze-receipt');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(calls[0].init.headers, {
    'Content-Type': 'application/json',
    Authorization: 'Bearer firebase-jwt-token-123',
  });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.mimeType, 'image/png');
  assert.equal(body.base64Data, await blobToBase64Pure(blob));
  assert.deepEqual(result, { date: '2026-04-12', amount: 42.5, merchantName: 'Migros' });
});

test('[SEC-15][Negative] handles 401/error status, rejected getIdToken, and omits Authorization when unauthenticated', async () => {
  const seenHeaders = [];
  const res401Fetch = async (_url, init) => {
    seenHeaders.push(init.headers);
    return { ok: false, status: 401, json: async () => ({}) };
  };

  const blob = new Blob(['receipt'], { type: 'image/jpeg' });
  await assert.rejects(
    () =>
      requestBackendReceiptAnalysis({
        file: blob,
        mimeType: 'image/jpeg',
        backendUrl: 'https://backend.example.run.app',
        getIdToken: async () => {
          throw new Error('token refresh failed');
        },
        fetchImpl: res401Fetch,
      }),
    /Erreur backend \(401\)/
  );

  assert.equal(seenHeaders[0].Authorization, undefined);
  assert.equal(seenHeaders[0]['Content-Type'], 'application/json');
});

test('[SEC-15][Boundary] rejects CRLF/null-byte tokens, trims whitespace, and strips trailing URL slashes', () => {
  assert.equal(sanitizeBearerToken('  abc.def.ghi  '), 'abc.def.ghi');
  assert.equal(sanitizeBearerToken('   '), null);
  assert.equal(sanitizeBearerToken(null), null);
  assert.equal(sanitizeBearerToken('bad\r\nX-Injected: 1'), null);
  assert.equal(sanitizeBearerToken('bad\x00token'), null);

  assert.deepEqual(buildAnalyzeReceiptHeaders('tok\nnewline'), {
    'Content-Type': 'application/json',
  });
  assert.equal(
    normalizeBackendBaseUrl('  https://api.example.com/// ', 'https://default.invalid'),
    'https://api.example.com'
  );
  assert.equal(
    normalizeBackendBaseUrl(undefined, 'https://default.invalid/'),
    'https://default.invalid'
  );
});

test('[SEC-15][Integration] receiptExtractionService wires auth.currentUser.getIdToken() into requestBackendReceiptAnalysis', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/services/receiptExtractionService.ts'), 'utf8');
  assert.match(src, /auth\?\.currentUser\s*\?\s*await auth\.currentUser\.getIdToken\(\)\s*:\s*null/);
  assert.match(src, /const data = await requestBackendReceiptAnalysis\(/);
  assert.doesNotMatch(src, /if\s*\(\s*false\s*\)/);
});
