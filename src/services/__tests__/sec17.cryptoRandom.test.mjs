import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSecureRandomToken } from '../cryptoRandom.ts';
import { sanitizeRentalToken, generateRentalId } from '../rentalHelpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

function collectTsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

test('[SEC-17][Positive] CSPRNG token helpers generate unique high-entropy hex strings', () => {
  const t1 = generateSecureRandomToken();
  const t2 = generateSecureRandomToken();
  assert.equal(t1.length, 16);
  assert.match(t1, /^[0-9a-f]{16}$/);
  assert.notEqual(t1, t2);
  assert.equal(generateSecureRandomToken(32).length, 64);

  const rentalTok = sanitizeRentalToken('');
  const rentalTok2 = sanitizeRentalToken('');
  assert.match(rentalTok, /^[0-9a-f]{8}$/);
  assert.notEqual(rentalTok, rentalTok2);
  assert.match(generateRentalId(1700000000000, null), /^rental-1700000000000-[0-9a-f]{8}$/);
});

test('[SEC-17][Boundary & Negative] handles invalid byteLength safely and preserves explicit rental tokens', () => {
  assert.equal(generateSecureRandomToken(0).length, 16);
  assert.equal(generateSecureRandomToken(-5).length, 16);
  assert.equal(generateSecureRandomToken(128).length, 128); // capped at 64 bytes -> 128 hex chars
  assert.equal(sanitizeRentalToken('AB-CD_123456'), 'abcd1234');
});

test('[SEC-17][Integration] zero Math.random in mobile src/, receiptUploadService & rentalHelpers use Web Crypto CSPRNG', () => {
  const tsFiles = collectTsFiles(path.join(REPO_ROOT, 'src'));
  assert.ok(tsFiles.length > 0);
  for (const f of tsFiles) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /Math\.random\s*\(/, `Math.random found in ${path.relative(REPO_ROOT, f)}`);
  }

  const uploadSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/services/receiptUploadService.ts'), 'utf8');
  assert.match(uploadSrc, /generateSecureRandomToken\(/);
  assert.doesNotMatch(uploadSrc, /generateSecureRandomToken\(0\)/);
});
