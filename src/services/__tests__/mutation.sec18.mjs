import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const testPath = path.join(REPO_ROOT, 'src/services/__tests__/sec18.hygiene.test.mjs');

const FILES = {
  adminConfig: 'src/services/adminConfig.ts',
  compta: 'src/services/comptaHelpers.ts',
  auth: 'src/services/authHelpers.ts',
  authCtx: 'src/contexts/AuthContext.tsx',
  gitignore: '.gitignore',
};

const originals = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);

const mutants = [
  {
    id: 'H01',
    fileKey: 'adminConfig',
    description: 'adminConfig : accepte superAdmin truthy non strict (Boolean)',
    target: '  if (params?.claims?.superAdmin === true) {\n    return true;\n  }',
    replacement: '  if (Boolean(params?.claims?.superAdmin)) {\n    return true;\n  }',
  },
  {
    id: 'H02',
    fileKey: 'adminConfig',
    description: 'adminConfig : ignore rawEnv (force fallback même si env=NONE)',
    target: "  if (typeof rawEnv === 'string' && rawEnv.trim().length > 0) {",
    replacement: "  if (false && typeof rawEnv === 'string' && rawEnv.trim().length > 0) {",
  },
  {
    id: 'H03',
    fileKey: 'adminConfig',
    description: 'adminConfig : retourne false dans resolveSuperAdminAccess (fallback email)',
    target: '  return configured.includes(normEmail);',
    replacement: '  return configured.includes(normEmail) && false;',
  },
  {
    id: 'H04',
    fileKey: 'compta',
    description: 'comptaHelpers : ignore rawSuperAdminEmailsEnv',
    target: '  if (typeof raw === \'string\' && raw.trim().length > 0) {',
    replacement: '  if (false && typeof raw === \'string\' && raw.trim().length > 0) {',
  },
  {
    id: 'H05',
    fileKey: 'auth',
    description: 'authHelpers : ignore rawExemptEmailsEnv',
    target: '  if (typeof raw === \'string\' && raw.trim().length > 0) {',
    replacement: '  if (false && typeof raw === \'string\' && raw.trim().length > 0) {',
  },
  {
    id: 'H06',
    fileKey: 'authCtx',
    description: 'AuthContext : supprime support claim superAdmin === true',
    target: '          if (idTokenRes?.claims?.superAdmin === true) {',
    replacement: '          if (false) {',
  },
  {
    id: 'H07',
    fileKey: 'gitignore',
    description: '.gitignore : supprime .firebase/',
    target: '.firebase/\n',
    replacement: '',
  },
  {
    id: 'H08',
    fileKey: 'gitignore',
    description: '.gitignore : supprime __pycache__/',
    target: '__pycache__/\n',
    replacement: '',
  },
  {
    id: 'H09',
    fileKey: 'gitignore',
    description: '.gitignore : supprime *.py[cod]',
    target: '*.py[cod]\n',
    replacement: '',
  },
  {
    id: 'H10',
    fileKey: 'gitignore',
    description: '.gitignore : supprime .env.*',
    target: '.env.*',
    replacement: '',
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

console.log(`\nMobile SEC-18 Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
