/**
 * pwaHelpers.ts — Utilitaires de détection et d'installation PWA (Android & iOS Safari)
 * Couvre l'issue [06] [MOB-09]
 */

export interface NavigatorLike {
  userAgent?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}

export interface WindowLike {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: NavigatorLike;
  document?: {
    referrer?: string;
  };
}

export type PwaPlatform = 'ios' | 'android' | 'other';

export type PwaBannerDisplayMode = 'hidden' | 'android_native' | 'ios_instructions' | 'generic';

export interface PwaDisplayState {
  show: boolean;
  mode: PwaBannerDisplayMode;
  reason?: 'already_installed' | 'dismissed' | 'ready_to_prompt' | 'ios_safari' | 'unsupported';
}

export interface PwaDisplayStateParams {
  isStandalone: boolean;
  hasDeferredPrompt: boolean;
  isIos: boolean;
  isDismissed?: boolean;
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Détecte si l'application est exécutée en mode standalone / plein écran (déjà installée sur l'écran d'accueil)
 */
export function isStandaloneMode(win?: WindowLike): boolean {
  const currentWin = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!currentWin) return false;

  // 1. iOS Safari standalone flag
  const nav = currentWin.navigator as (NavigatorLike & { standalone?: boolean }) | undefined;
  if (nav && nav.standalone === true) {
    return true;
  }

  // 2. Standard CSS display-mode
  if (typeof currentWin.matchMedia === 'function') {
    if (currentWin.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    if (currentWin.matchMedia('(display-mode: fullscreen)').matches) {
      return true;
    }
  }

  // 3. Android TWA / PWA shortcut referrer
  if (currentWin.document?.referrer && currentWin.document.referrer.includes('android-app://')) {
    return true;
  }

  return false;
}

/**
 * Détecte si le périphérique est un appareil iOS (iPhone, iPad, iPod)
 * Inclut le cas iPadOS 13+ rapportant Macintosh avec multi-touch
 */
export function isIosDevice(userAgent?: string, maxTouchPoints?: number): boolean {
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const touches =
    maxTouchPoints !== undefined
      ? maxTouchPoints
      : typeof navigator !== 'undefined'
      ? navigator.maxTouchPoints || 0
      : 0;

  if (!ua) return false;

  const isClassicIos = /iPad|iPhone|iPod/i.test(ua);
  const isModernIpad = /Macintosh/i.test(ua) && touches > 1;

  return isClassicIos || isModernIpad;
}

/**
 * Détecte si le périphérique est un appareil Android
 */
export function isAndroidDevice(userAgent?: string): boolean {
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return false;
  return /Android/i.test(ua);
}

/**
 * Calcule l'état d'affichage de la bannière ou du bouton d'installation
 */
export function getPwaDisplayState(params: PwaDisplayStateParams): PwaDisplayState {
  const { isStandalone, hasDeferredPrompt, isIos, isDismissed = false } = params;

  // Si l'application est déjà installée et ouverte depuis l'écran d'accueil : aucune bannière
  if (isStandalone) {
    return {
      show: false,
      mode: 'hidden',
      reason: 'already_installed',
    };
  }

  // Si l'utilisateur l'a temporairement masquée
  if (isDismissed) {
    return {
      show: false,
      mode: 'hidden',
      reason: 'dismissed',
    };
  }

  // Cas 1 : Android / Chrome avec prompt différé disponible
  if (hasDeferredPrompt) {
    return {
      show: true,
      mode: 'android_native',
      reason: 'ready_to_prompt',
    };
  }

  // Cas 2 : iPhone / iPad Safari sans prompt natif
  if (isIos) {
    return {
      show: true,
      mode: 'ios_instructions',
      reason: 'ios_safari',
    };
  }

  // Autre navigateur (bureau ou navigateur sans prompt capturé)
  return {
    show: false,
    mode: 'hidden',
    reason: 'unsupported',
  };
}

export interface InstallStep {
  step: number;
  title: string;
  description: string;
  icon: 'share' | 'add' | 'confirm';
}

/**
 * Retourne le guide pas-à-pas d'installation pour iOS Safari
 */
export function getIosInstallSteps(): InstallStep[] {
  return [
    {
      step: 1,
      title: 'Appuyez sur Partager',
      description: "Dans la barre Safari en bas de votre écran, touchez le bouton Partager ⬆️.",
      icon: 'share',
    },
    {
      step: 2,
      title: 'Sur l\'écran d\'accueil',
      description: "Faites défiler les options et choisissez « Sur l'écran d'accueil » ➕.",
      icon: 'add',
    },
    {
      step: 3,
      title: 'Touchez « Ajouter »',
      description: "Confirmez en haut à droite. L'icône AssoCompta apparaîtra sur votre écran !",
      icon: 'confirm',
    },
  ];
}

const DISMISS_KEY = 'assocompta_pwa_dismissed_until';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 heures

export function isPwaDismissedInStorage(storage?: Storage): boolean {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!s) return false;
    const item = s.getItem(DISMISS_KEY);
    if (!item) return false;
    const expiresAt = parseInt(item, 10);
    if (isNaN(expiresAt)) return false;
    return Date.now() < expiresAt;
  } catch {
    return false;
  }
}

export function dismissPwaInStorage(storage?: Storage, durationMs = DISMISS_DURATION_MS): void {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!s) return;
    s.setItem(DISMISS_KEY, (Date.now() + durationMs).toString());
  } catch {
    // Ignore storage errors in restricted contexts
  }
}
