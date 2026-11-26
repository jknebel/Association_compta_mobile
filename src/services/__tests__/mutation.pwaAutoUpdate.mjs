import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const testPath = path.join(REPO_ROOT, 'src/services/__tests__/feat.pwaAutoUpdate.test.mjs');

const FILES = {
  pwa: 'src/services/pwaAutoUpdate.ts',
  main: 'src/main.tsx',
  vite: 'vite.config.ts',
  firebase: 'firebase.json',
};

const originals = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);

const mutants = [
  {
    id: 'U01',
    fileKey: 'pwa',
    description: 'shouldTriggerSilentReload : recharge même lors de la toute première installation SW',
    target: '  if (!input.hadInitialController) return false;',
    replacement: '  if (false) return false;',
  },
  {
    id: 'U02',
    fileKey: 'pwa',
    description: 'shouldTriggerSilentReload : ignore garde alreadyReloaded (double reload)',
    target: '  if (input.alreadyReloaded) return false;',
    replacement: '  if (false) return false;',
  },
  {
    id: 'U03',
    fileKey: 'pwa',
    description: 'shouldTriggerSilentReload : désactive garde cooldown anti-boucle',
    target: '  if (input.lastReloadAtMs > 0 && input.nowMs - input.lastReloadAtMs < cooldown) {',
    replacement: '  if (false) {',
  },
  {
    id: 'U04',
    fileKey: 'pwa',
    description: 'shouldTriggerSilentReload : rejette la borne exacte cooldown (<= au lieu de <)',
    target: '  if (input.lastReloadAtMs > 0 && input.nowMs - input.lastReloadAtMs < cooldown) {',
    replacement: '  if (input.lastReloadAtMs > 0 && input.nowMs - input.lastReloadAtMs <= cooldown) {',
  },
  {
    id: 'U05',
    fileKey: 'pwa',
    description: 'setupSilentPwaAutoUpdate : ne vérifie plus les mises à jour au retour au premier plan',
    target: "    if (doc?.visibilityState === 'visible') {\n      checkForUpdate();\n    }",
    replacement: "    if (false && doc?.visibilityState === 'visible') {\n      checkForUpdate();\n    }",
  },
  {
    id: 'U06',
    fileKey: 'pwa',
    description: 'setupSilentPwaAutoUpdate : ne déclenche plus reloadFn sur controllerchange',
    target: '    reloadFn();',
    replacement: '    // reload disabled',
  },
  {
    id: 'U07',
    fileKey: 'main',
    description: 'main.tsx : supprime appel setupSilentPwaAutoUpdate()',
    target: 'setupSilentPwaAutoUpdate();',
    replacement: '// disabled',
  },
  {
    id: 'U08',
    fileKey: 'vite',
    description: 'vite.config.ts : désactive cleanupOutdatedCaches',
    target: '        cleanupOutdatedCaches: true,',
    replacement: '        cleanupOutdatedCaches: false,',
  },
  {
    id: 'U09',
    fileKey: 'vite',
    description: 'vite.config.ts : désactive skipWaiting',
    target: '        skipWaiting: true,',
    replacement: '        skipWaiting: false,',
  },
  {
    id: 'U10',
    fileKey: 'firebase',
    description: 'firebase.json : retire Cache-Control no-cache sur sw.js/index.html',
    target: '"value": "no-cache, no-store, must-revalidate"',
    replacement: '"value": "public, max-age=3600"',
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

console.log(`\nMobile PWA Auto-Update Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
