import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PWA_RELOAD_COOLDOWN_MS,
  PWA_LAST_RELOAD_STORAGE_KEY,
  shouldTriggerSilentReload,
  setupSilentPwaAutoUpdate,
} from '../pwaAutoUpdate.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

test('[PWA-AUTO-UPDATE][Positive] reloads once silently on controllerchange and checks updates on boot/visibility/online', async () => {
  const swListeners = {};
  const docListeners = {};
  const winListeners = {};
  let updateCalls = 0;
  let reloadCalls = 0;
  const mem = new Map();

  const cleanup = setupSilentPwaAutoUpdate({
    serviceWorker: {
      controller: { scriptURL: '/sw.js' },
      getRegistrations: async () => [
        {
          update: async () => {
            updateCalls += 1;
          },
        },
      ],
      addEventListener: (type, fn) => {
        swListeners[type] = fn;
      },
      removeEventListener: (type) => {
        delete swListeners[type];
      },
    },
    doc: {
      visibilityState: 'visible',
      addEventListener: (type, fn) => {
        docListeners[type] = fn;
      },
      removeEventListener: (type) => {
        delete docListeners[type];
      },
    },
    win: {
      addEventListener: (type, fn) => {
        winListeners[type] = fn;
      },
      removeEventListener: (type) => {
        delete winListeners[type];
      },
      setInterval: () => 42,
      clearInterval: () => {},
    },
    storage: {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
    },
    reload: () => {
      reloadCalls += 1;
    },
    now: () => 1_700_000_000_000,
  });

  await new Promise((r) => setImmediate(r));
  assert.equal(updateCalls, 1);

  docListeners.visibilitychange();
  winListeners.online();
  await new Promise((r) => setImmediate(r));
  assert.equal(updateCalls, 3);

  swListeners.controllerchange();
  swListeners.controllerchange(); // second trigger must not double-reload
  assert.equal(reloadCalls, 1);
  assert.equal(mem.get(PWA_LAST_RELOAD_STORAGE_KEY), '1700000000000');

  cleanup();
});

test('[PWA-AUTO-UPDATE][Negative & Boundary] skips reload on first install and respects cooldown anti-loop guard', () => {
  assert.equal(
    shouldTriggerSilentReload({
      hadInitialController: false,
      alreadyReloaded: false,
      nowMs: 50_000,
      lastReloadAtMs: 0,
    }),
    false
  );

  assert.equal(
    shouldTriggerSilentReload({
      hadInitialController: true,
      alreadyReloaded: true,
      nowMs: 50_000,
      lastReloadAtMs: 0,
    }),
    false
  );

  // Within cooldown -> blocked
  assert.equal(
    shouldTriggerSilentReload({
      hadInitialController: true,
      alreadyReloaded: false,
      nowMs: 50_000,
      lastReloadAtMs: 50_000 - (PWA_RELOAD_COOLDOWN_MS - 1),
    }),
    false
  );

  // Exact cooldown boundary -> allowed
  assert.equal(
    shouldTriggerSilentReload({
      hadInitialController: true,
      alreadyReloaded: false,
      nowMs: 50_000,
      lastReloadAtMs: 50_000 - PWA_RELOAD_COOLDOWN_MS,
    }),
    true
  );
});

test('[PWA-AUTO-UPDATE][Integration] firebase.json, vite.config.ts, and main.tsx wire silent auto-update cleanly', () => {
  const fb = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'firebase.json'), 'utf8'));
  const swHeaderBlock = (fb.hosting?.headers || []).find((h) =>
    String(h.source || '').includes('sw.js')
  );
  assert.ok(swHeaderBlock, 'firebase.json missing Cache-Control header block for sw.js/index.html');
  const cc = (swHeaderBlock.headers || []).find((h) => h.key === 'Cache-Control');
  assert.ok(cc && cc.value.includes('no-cache') && cc.value.includes('no-store'));

  const viteCfg = fs.readFileSync(path.join(REPO_ROOT, 'vite.config.ts'), 'utf8');
  assert.match(viteCfg, /cleanupOutdatedCaches:\s*true/);
  assert.match(viteCfg, /clientsClaim:\s*true/);
  assert.match(viteCfg, /skipWaiting:\s*true/);

  const mainTsx = fs.readFileSync(path.join(REPO_ROOT, 'src/main.tsx'), 'utf8');
  assert.match(mainTsx, /setupSilentPwaAutoUpdate\s*\(\s*\)/);
});
