import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

function collectSourceFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      results.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function parseSemverFloor(spec) {
  const m = String(spec || '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

test('[SEC-12][Positive] mobile package.json pins safe upgraded versions and grpc-js override', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies['@google/genai'], undefined);
  assert.ok(compareSemver(parseSemverFloor(pkg.dependencies.firebase), [13, 4, 0]) >= 0);
  assert.ok(compareSemver(parseSemverFloor(pkg.devDependencies.vite), [6, 4, 6]) >= 0);
  assert.ok(compareSemver(parseSemverFloor(pkg.devDependencies.tailwindcss), [3, 4, 19]) >= 0);
  assert.ok(compareSemver(parseSemverFloor(pkg.overrides?.['@grpc/grpc-js']), [1, 14, 7]) >= 0);
});

test('[SEC-12][Negative] mobile source code does not import @google/genai or xlsx', () => {
  const srcFiles = collectSourceFiles(path.join(REPO_ROOT, 'src'));
  assert.ok(srcFiles.length > 0);
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /['"]@google\/genai['"]/);
    assert.doesNotMatch(content, /['"]xlsx['"]/);
  }
});

test('[SEC-12][Integration & Boundary] package-lock resolves hardened versions and CI enforces strict audit + npm ci', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages?.['node_modules/@google/genai'], undefined);
  const grpcEntry = lock.packages?.['node_modules/@grpc/grpc-js'];
  assert.ok(grpcEntry, '@grpc/grpc-js entry must exist in lockfile');
  assert.ok(compareSemver(parseSemverFloor(grpcEntry.version), [1, 14, 7]) >= 0);

  const ciYaml = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/security-ci.yml'), 'utf8');
  assert.match(ciYaml, /run:\s*npm ci\b/);
  assert.match(ciYaml, /run:\s*npm audit --omit=dev --audit-level=high\s*$/m);
  assert.doesNotMatch(ciYaml, /npm audit[^\r\n]*\|\|/);
});
