import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

function loadFirebaseHeaders() {
  const cfg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'firebase.json'), 'utf8'));
  const block = (cfg.hosting?.headers || []).find((h) => h.source === '**');
  assert.ok(block && Array.isArray(block.headers), 'hosting.headers for "**" must exist');
  const map = new Map();
  for (const h of block.headers) {
    map.set(h.key.toLowerCase(), h.value);
  }
  return map;
}

function parseCspDirectives(csp) {
  const directives = new Map();
  for (const part of String(csp || '').split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...values] = trimmed.split(/\s+/);
    directives.set(name.toLowerCase(), values);
  }
  return directives;
}

test('[SEC-13][Negative] mobile index.html has no importmap or external script CDN', () => {
  const html = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /type=["']importmap["']/i);
  assert.doesNotMatch(html, /aistudiocdn\.com|esm\.sh/i);
  assert.match(html, /<script\s+type="module"\s+src="\/src\/main\.tsx"><\/script>/);
});

test('[SEC-13][Positive & Boundary] mobile firebase.json enforces security headers while keeping camera=(self)', () => {
  const headers = loadFirebaseHeaders();

  const hsts = headers.get('strict-transport-security') || '';
  const maxAgeMatch = hsts.match(/max-age=(\d+)/);
  assert.ok(maxAgeMatch && Number(maxAgeMatch[1]) >= 31536000);
  assert.match(hsts, /includeSubDomains/i);

  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('permissions-policy'), 'camera=(self), microphone=(), geolocation=(), payment=()');

  const coop = (headers.get('cross-origin-opener-policy') || '').toLowerCase();
  assert.notEqual(coop, 'same-origin');
});

test('[SEC-13][Positive & Negative] mobile CSP covers PWA worker/manifest, Firebase Auth and strict isolation', () => {
  const headers = loadFirebaseHeaders();
  const csp = headers.get('content-security-policy');
  assert.ok(csp);

  const d = parseCspDirectives(csp);
  assert.deepEqual(d.get('default-src'), ["'self'"]);
  assert.deepEqual(d.get('object-src'), ["'none'"]);
  assert.deepEqual(d.get('base-uri'), ["'self'"]);
  assert.deepEqual(d.get('form-action'), ["'self'"]);
  assert.deepEqual(d.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(d.get('manifest-src'), ["'self'"]);

  const workerSrc = d.get('worker-src') || [];
  assert.ok(workerSrc.includes("'self'"));
  assert.ok(workerSrc.includes('blob:'));

  const scriptSrc = d.get('script-src') || [];
  assert.ok(scriptSrc.includes("'self'"));
  assert.ok(scriptSrc.includes('https://apis.google.com'));
  assert.ok(!scriptSrc.includes("'unsafe-inline'"));
  assert.ok(!scriptSrc.includes("'unsafe-eval'"));
  assert.ok(!scriptSrc.includes('*'));

  assert.doesNotMatch(csp, /http:\/\//i);
});
