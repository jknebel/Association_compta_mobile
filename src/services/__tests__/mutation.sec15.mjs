import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const FILES = {
  helpers: 'src/services/bearerAuthHelpers.ts',
  service: 'src/services/receiptExtractionService.ts',
};

const originals = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);
const testPath = path.join(REPO_ROOT, 'src/services/__tests__/sec15.bearerAuth.test.mjs');

const mutants = [
  {
    id: 'B01',
    fileKey: 'helpers',
    description: 'buildAnalyzeReceiptHeaders : omet header Authorization Bearer',
    target: "...(cleanToken ? { Authorization: `Bearer ${cleanToken}` } : {}),",
    replacement: '// dropped Authorization header',
  },
  {
    id: 'B02',
    fileKey: 'helpers',
    description: 'buildAnalyzeReceiptHeaders : omet préfixe Bearer',
    target: 'Authorization: `Bearer ${cleanToken}`',
    replacement: 'Authorization: cleanToken',
  },
  {
    id: 'B03',
    fileKey: 'helpers',
    description: 'sanitizeBearerToken : autorise caractères CRLF / octet nul',
    target: 'if (!trimmed || /[\\r\\n\\0]/.test(trimmed)) {',
    replacement: 'if (!trimmed) {',
  },
  {
    id: 'B04',
    fileKey: 'helpers',
    description: 'sanitizeBearerToken : oublie trim sur jeton',
    target: 'const trimmed = token.trim();',
    replacement: 'const trimmed = token;',
  },
  {
    id: 'B05',
    fileKey: 'helpers',
    description: 'normalizeBackendBaseUrl : conserve slash final (double //)',
    target: "return raw.replace(/\\/+$/, '');",
    replacement: 'return raw;',
  },
  {
    id: 'B06',
    fileKey: 'helpers',
    description: 'requestBackendReceiptAnalysis : ne passe plus headers au fetch',
    target: 'headers,',
    replacement: "headers: { 'Content-Type': 'application/json' },",
  },
  {
    id: 'B07',
    fileKey: 'helpers',
    description: 'requestBackendReceiptAnalysis : ignore erreur HTTP 401 (!response.ok)',
    target: 'if (!response.ok) {',
    replacement: 'if (false && !response.ok) {',
  },
  {
    id: 'B08',
    fileKey: 'helpers',
    description: 'requestBackendReceiptAnalysis : crashe si getIdToken rejette',
    target: '    try {\n      idToken = await params.getIdToken();\n    } catch {\n      idToken = null;\n    }',
    replacement: '    idToken = await params.getIdToken();',
  },
  {
    id: 'B09',
    fileKey: 'service',
    description: 'receiptExtractionService : supprime appel auth.currentUser.getIdToken()',
    target: 'getIdToken: async () => (auth?.currentUser ? await auth.currentUser.getIdToken() : null),',
    replacement: 'getIdToken: async () => null,',
  },
  {
    id: 'B10',
    fileKey: 'service',
    description: 'receiptExtractionService : appelle /analyze-receipt sans passer par requestBackendReceiptAnalysis',
    target: 'const data = await requestBackendReceiptAnalysis({',
    replacement: 'const data = await Promise.resolve({} as any); if (false) await requestBackendReceiptAnalysis({',
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

console.log(`\nMobile SEC-15 Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
