import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isStandaloneMode,
  isIosDevice,
  isAndroidDevice,
  getPwaDisplayState,
  getIosInstallSteps,
  isPwaDismissedInStorage,
  dismissPwaInStorage,
} from '../pwaHelpers.ts';

describe('[MOB-09] pwaHelpers Unit Tests', () => {
  describe('isStandaloneMode()', () => {
    it('returns false for undefined window', () => {
      assert.strictEqual(isStandaloneMode(undefined), false);
    });

    it('returns true when navigator.standalone is true (iOS web app)', () => {
      const win = {
        navigator: { standalone: true },
      };
      assert.strictEqual(isStandaloneMode(win), true);
    });

    it('returns false when navigator.standalone is false and no matchMedia match', () => {
      const win = {
        navigator: { standalone: false },
        matchMedia: () => ({ matches: false }),
      };
      assert.strictEqual(isStandaloneMode(win), false);
    });

    it('returns true when CSS display-mode: standalone matches', () => {
      const win = {
        matchMedia: (query) => ({ matches: query === '(display-mode: standalone)' }),
      };
      assert.strictEqual(isStandaloneMode(win), true);
    });

    it('returns true when CSS display-mode: fullscreen matches', () => {
      const win = {
        matchMedia: (query) => ({ matches: query === '(display-mode: fullscreen)' }),
      };
      assert.strictEqual(isStandaloneMode(win), true);
    });

    it('returns true when document.referrer contains android-app://', () => {
      const win = {
        matchMedia: () => ({ matches: false }),
        document: { referrer: 'android-app://com.example.pwa' },
      };
      assert.strictEqual(isStandaloneMode(win), true);
    });

    it('returns false for ordinary browser window without standalone flags', () => {
      const win = {
        matchMedia: () => ({ matches: false }),
        document: { referrer: 'https://google.com' },
      };
      assert.strictEqual(isStandaloneMode(win), false);
    });
  });

  describe('isIosDevice()', () => {
    it('returns false when userAgent is empty or undefined', () => {
      assert.strictEqual(isIosDevice(''), false);
    });

    it('detects iPhone userAgent', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15';
      assert.strictEqual(isIosDevice(ua), true);
    });

    it('detects iPad userAgent', () => {
      const ua = 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15';
      assert.strictEqual(isIosDevice(ua), true);
    });

    it('detects iPod userAgent', () => {
      const ua = 'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X)';
      assert.strictEqual(isIosDevice(ua), true);
    });

    it('detects modern iPadOS (Macintosh UA + maxTouchPoints > 1)', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
      assert.strictEqual(isIosDevice(ua, 5), true);
    });

    it('returns false for macOS desktop (Macintosh UA + maxTouchPoints <= 1)', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
      assert.strictEqual(isIosDevice(ua, 0), false);
      assert.strictEqual(isIosDevice(ua, 1), false);
    });

    it('returns false for Android userAgent', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile';
      assert.strictEqual(isIosDevice(ua), false);
    });

    it('returns false for Windows userAgent', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      assert.strictEqual(isIosDevice(ua), false);
    });
  });

  describe('isAndroidDevice()', () => {
    it('returns true for Android userAgent', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
      assert.strictEqual(isAndroidDevice(ua), true);
    });

    it('returns false for iPhone', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)';
      assert.strictEqual(isAndroidDevice(ua), false);
    });

    it('returns false for empty userAgent', () => {
      assert.strictEqual(isAndroidDevice(''), false);
    });
  });

  describe('getPwaDisplayState()', () => {
    it('hides banner if already installed (standalone = true)', () => {
      const state = getPwaDisplayState({
        isStandalone: true,
        hasDeferredPrompt: true,
        isIos: true,
      });
      assert.deepStrictEqual(state, {
        show: false,
        mode: 'hidden',
        reason: 'already_installed',
      });
    });

    it('hides banner if temporarily dismissed by user', () => {
      const state = getPwaDisplayState({
        isStandalone: false,
        hasDeferredPrompt: true,
        isIos: false,
        isDismissed: true,
      });
      assert.deepStrictEqual(state, {
        show: false,
        mode: 'hidden',
        reason: 'dismissed',
      });
    });

    it('shows native prompt banner when deferredPrompt is available (Android / Chrome)', () => {
      const state = getPwaDisplayState({
        isStandalone: false,
        hasDeferredPrompt: true,
        isIos: false,
      });
      assert.deepStrictEqual(state, {
        show: true,
        mode: 'android_native',
        reason: 'ready_to_prompt',
      });
    });

    it('shows iOS visual instructions when on iOS Safari', () => {
      const state = getPwaDisplayState({
        isStandalone: false,
        hasDeferredPrompt: false,
        isIos: true,
      });
      assert.deepStrictEqual(state, {
        show: true,
        mode: 'ios_instructions',
        reason: 'ios_safari',
      });
    });

    it('hides banner on desktop or unsupported browser when no prompt is available', () => {
      const state = getPwaDisplayState({
        isStandalone: false,
        hasDeferredPrompt: false,
        isIos: false,
      });
      assert.deepStrictEqual(state, {
        show: false,
        mode: 'hidden',
        reason: 'unsupported',
      });
    });
  });

  describe('getIosInstallSteps()', () => {
    it('returns exactly 3 step objects with expected details', () => {
      const steps = getIosInstallSteps();
      assert.strictEqual(steps.length, 3);
      assert.strictEqual(steps[0].step, 1);
      assert.strictEqual(steps[0].icon, 'share');
      assert.strictEqual(steps[1].step, 2);
      assert.strictEqual(steps[1].icon, 'add');
      assert.strictEqual(steps[2].step, 3);
      assert.strictEqual(steps[2].icon, 'confirm');
    });
  });

  describe('Storage Helpers (dismiss)', () => {
    function createMockStorage() {
      const map = new Map();
      return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
        clear: () => map.clear(),
      };
    }

    it('returns false when nothing has been dismissed', () => {
      const storage = createMockStorage();
      assert.strictEqual(isPwaDismissedInStorage(storage), false);
    });

    it('returns true when dismissed within active window', () => {
      const storage = createMockStorage();
      dismissPwaInStorage(storage, 60000);
      assert.strictEqual(isPwaDismissedInStorage(storage), true);
    });

    it('returns false when dismissal duration has expired', () => {
      const storage = createMockStorage();
      dismissPwaInStorage(storage, -1000); // expired in the past
      assert.strictEqual(isPwaDismissedInStorage(storage), false);
    });

    it('returns false on invalid non-numeric storage item', () => {
      const storage = createMockStorage();
      storage.setItem('assocompta_pwa_dismissed_until', 'not_a_number');
      assert.strictEqual(isPwaDismissedInStorage(storage), false);
    });

    it('handles null storage safely without throwing', () => {
      assert.strictEqual(isPwaDismissedInStorage(null), false);
      assert.doesNotThrow(() => dismissPwaInStorage(null));
    });
  });
});
