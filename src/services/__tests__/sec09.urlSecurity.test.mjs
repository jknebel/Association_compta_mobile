import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  escapeHtml,
  isSafeReceiptUrl,
  sanitizeReceiptUrl,
  MAX_RECEIPT_URL_LENGTH,
} from '../urlSecurity.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

function readMobileFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

test('[SEC-09][Positive] escapeHtml escapes &, <, >, ", and single quotes cleanly', () => {
  assert.equal(escapeHtml('AssoCompta Mobile'), 'AssoCompta Mobile');
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)" & \'test\'>'),
    '&lt;img src=x onerror=&quot;alert(1)&quot; &amp; &#39;test&#39;&gt;'
  );
});

test('[SEC-09][Positive] isSafeReceiptUrl & sanitizeReceiptUrl accept allowlisted Firebase Storage HTTPS URLs', () => {
  const validUrls = [
    'https://firebasestorage.googleapis.com/v0/b/compta-ai.appspot.com/o/receipt.pdf?alt=media',
    'https://storage.googleapis.com/compta-ai.appspot.com/receipt.jpg',
    'https://compta-ai.firebasestorage.app/o/r.png',
    '  https://firebasestorage.googleapis.com/v0/b/x/o/y.png  ',
  ];
  for (const url of validUrls) {
    assert.equal(isSafeReceiptUrl(url), true);
    assert.equal(sanitizeReceiptUrl(url), url.trim());
  }
});

test('[SEC-09][Negative] rejects javascript:, data:, http:, credentials, external domains, and multi-level subdomains', () => {
  const blockedUrls = [
    'javascript:alert(1)',
    'JAVASCRIPT:fetch("//evil")',
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'vbscript:msgbox(1)',
    'http://firebasestorage.googleapis.com/o/x.jpg',
    'https://evil.com/firebasestorage.googleapis.com/x.jpg',
    'https://firebasestorage.googleapis.com.evil.com/x.jpg',
    'https://user:pass@firebasestorage.googleapis.com/o/x.jpg',
    'https://sub.bucket.firebasestorage.app/o/x.jpg',
    '/local/path.pdf',
    '',
    '   ',
    null,
    undefined,
    123,
  ];
  for (const url of blockedUrls) {
    assert.equal(isSafeReceiptUrl(url), false, `Expected blocked: ${String(url)}`);
    assert.equal(sanitizeReceiptUrl(url), null);
  }
});

test('[SEC-09][Boundary] length 2048 vs 2049 and escapeHtml non-string inputs', () => {
  assert.equal(MAX_RECEIPT_URL_LENGTH, 2048);
  const prefix = 'https://firebasestorage.googleapis.com/';
  const exact2048 = prefix + 'a'.repeat(2048 - prefix.length);
  const over2049 = exact2048 + 'b';

  assert.equal(isSafeReceiptUrl(exact2048), true);
  assert.equal(isSafeReceiptUrl(over2049), false);

  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(false), 'false');
});

test('[SEC-09][Integration] HistoryScreen sanitizes receipt URLs and hardens link/image attributes', () => {
  const src = readMobileFile('src/screens/HistoryScreen.tsx');
  assert.match(src, /import\s*\{\s*sanitizeReceiptUrl\s*\}\s*from\s*'\.\.\/services\/urlSecurity'/);
  assert.match(src, /const\s+safeReceiptUrl\s*=\s*sanitizeReceiptUrl\(item\.receipt\.url\)/);
  assert.doesNotMatch(src, /href=\{item\.receipt\.url\}/);
  assert.doesNotMatch(src, /src=\{item\.receipt\.url\}/);
  assert.match(src, /<img[^>]*src=\{safeReceiptUrl\}[^>]*referrerPolicy="no-referrer"/);
  assert.match(src, /rel="noopener noreferrer"/);
  assert.doesNotMatch(src, /rel="noreferrer"/);
});

test('[SEC-09][Integration] mobileOrganizationService uses SEC-06 point getDoc lookups instead of org members list', () => {
  const src = readMobileFile('src/services/mobileOrganizationService.ts');
  assert.doesNotMatch(
    src,
    /getDocs\s*\(\s*collection\s*\(\s*firestoreDb\s*,\s*['"]organizations['"]\s*,\s*orgDoc\.id\s*,\s*['"]members['"]\s*\)\s*\)/
  );
  assert.match(src, /getDoc\s*\(\s*doc\s*\(\s*firestoreDb\s*,\s*['"]organizations['"]\s*,\s*orgDoc\.id\s*,\s*['"]members['"]/);
  assert.match(src, /doc\s*\(\s*firestoreDb\s*,\s*['"]organizations['"]\s*,\s*orgDoc\.id\s*,\s*['"]comptabilites['"]/);
});
