/**
 * Mise à jour silencieuse et automatique de la PWA Mobile.
 * Vérifie les nouvelles versions du Service Worker à l'ouverture, au retour au premier plan
 * (visibilitychange), à la reconnexion réseau (online) et périodiquement, puis recharge
 * silencieusement l'application une seule fois dès qu'un nouveau Service Worker prend le contrôle.
 */

export const PWA_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const PWA_RELOAD_COOLDOWN_MS = 10_000;
export const PWA_LAST_RELOAD_STORAGE_KEY = 'asso_compta_pwa_last_reload_v1';

export interface SilentReloadDecisionInput {
  hadInitialController: boolean;
  alreadyReloaded: boolean;
  nowMs: number;
  lastReloadAtMs: number;
  cooldownMs?: number;
}

export const shouldTriggerSilentReload = (input: SilentReloadDecisionInput): boolean => {
  if (!input.hadInitialController) return false;
  if (input.alreadyReloaded) return false;
  const cooldown =
    typeof input.cooldownMs === 'number' && input.cooldownMs >= 0
      ? input.cooldownMs
      : PWA_RELOAD_COOLDOWN_MS;
  if (input.lastReloadAtMs > 0 && input.nowMs - input.lastReloadAtMs < cooldown) {
    return false;
  }
  return true;
};

export interface SwRegistrationLike {
  update: () => Promise<unknown>;
}

export interface SwContainerLike {
  controller?: unknown;
  getRegistrations?: () => Promise<SwRegistrationLike[]>;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export interface SilentPwaUpdateDeps {
  serviceWorker?: SwContainerLike | null;
  doc?: {
    visibilityState?: string;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  } | null;
  win?: {
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
    setInterval: (cb: () => void, ms: number) => unknown;
    clearInterval: (id: unknown) => void;
  } | null;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  reload?: () => void;
  now?: () => number;
  intervalMs?: number;
  cooldownMs?: number;
}

const readLastReloadAt = (storage?: Pick<Storage, 'getItem'> | null): number => {
  if (!storage) return 0;
  try {
    const raw = storage.getItem(PWA_LAST_RELOAD_STORAGE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
};

const writeLastReloadAt = (storage: Pick<Storage, 'setItem'> | null | undefined, ts: number): void => {
  if (!storage) return;
  try {
    storage.setItem(PWA_LAST_RELOAD_STORAGE_KEY, String(ts));
  } catch {
    // ignore storage quota/private mode errors
  }
};

export const setupSilentPwaAutoUpdate = (deps?: SilentPwaUpdateDeps): (() => void) => {
  const sw: SwContainerLike | null | undefined =
    deps?.serviceWorker !== undefined
      ? deps.serviceWorker
      : typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? (navigator.serviceWorker as unknown as SwContainerLike)
      : null;

  if (!sw) {
    return () => {};
  }

  const doc =
    deps?.doc !== undefined
      ? deps.doc
      : typeof document !== 'undefined'
      ? document
      : null;
  const win =
    deps?.win !== undefined
      ? deps.win
      : typeof window !== 'undefined'
      ? (window as unknown as NonNullable<SilentPwaUpdateDeps['win']>)
      : null;
  const storage =
    deps?.storage !== undefined
      ? deps.storage
      : typeof sessionStorage !== 'undefined'
      ? sessionStorage
      : null;
  const reloadFn =
    deps?.reload ??
    (() => {
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    });
  const nowFn = deps?.now ?? (() => Date.now());
  const intervalMs = deps?.intervalMs ?? PWA_UPDATE_CHECK_INTERVAL_MS;
  const cooldownMs = deps?.cooldownMs ?? PWA_RELOAD_COOLDOWN_MS;

  const hadInitialController = Boolean(sw.controller);
  let alreadyReloaded = false;

  const checkForUpdate = (): void => {
    if (typeof sw.getRegistrations !== 'function') return;
    void sw
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((reg) => reg.update().catch(() => {}))))
      .catch(() => {});
  };

  const handleControllerChange = (): void => {
    const nowMs = nowFn();
    const lastReloadAtMs = readLastReloadAt(storage);
    if (
      !shouldTriggerSilentReload({
        hadInitialController,
        alreadyReloaded,
        nowMs,
        lastReloadAtMs,
        cooldownMs,
      })
    ) {
      return;
    }
    alreadyReloaded = true;
    writeLastReloadAt(storage, nowMs);
    reloadFn();
  };

  const handleVisibilityChange = (): void => {
    if (doc?.visibilityState === 'visible') {
      checkForUpdate();
    }
  };

  const handleOnline = (): void => {
    checkForUpdate();
  };

  sw.addEventListener('controllerchange', handleControllerChange);
  doc?.addEventListener('visibilitychange', handleVisibilityChange);
  win?.addEventListener('online', handleOnline);

  // Vérification immédiate au lancement + vérification périodique
  checkForUpdate();
  const timerId = win ? win.setInterval(checkForUpdate, intervalMs) : null;

  return () => {
    sw.removeEventListener?.('controllerchange', handleControllerChange);
    doc?.removeEventListener?.('visibilitychange', handleVisibilityChange);
    win?.removeEventListener?.('online', handleOnline);
    if (win && timerId !== null) {
      win.clearInterval(timerId);
    }
  };
};
