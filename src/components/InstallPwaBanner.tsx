import React, { useEffect, useState } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  CheckCircle,
  X,
  Smartphone,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  isStandaloneMode,
  isIosDevice,
  getPwaDisplayState,
  getIosInstallSteps,
  isPwaDismissedInStorage,
  dismissPwaInStorage,
  type BeforeInstallPromptEvent,
} from '../services/pwaHelpers';

interface InstallPwaBannerProps {
  className?: string;
  variant?: 'banner' | 'card';
}

export const InstallPwaBanner: React.FC<InstallPwaBannerProps> = ({
  className = '',
  variant = 'banner',
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());
    setIsIos(isIosDevice());
    setIsDismissed(isPwaDismissedInStorage());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstallSuccess(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const displayState = getPwaDisplayState({
    isStandalone,
    hasDeferredPrompt: !!deferredPrompt,
    isIos,
    isDismissed,
  });

  if (!displayState.show) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallSuccess(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error("Erreur lors du déclenchement de l'installation PWA:", err);
      }
    } else if (isIos) {
      setShowIosModal(true);
    }
  };

  const handleDismiss = () => {
    dismissPwaInStorage();
    setIsDismissed(true);
  };

  const steps = getIosInstallSteps();

  return (
    <>
      {/* Bannière principale */}
      <div
        data-testid="pwa-install-banner"
        className={`relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-900 p-4 shadow-xl shadow-blue-950/30 ${className}`}
      >
        {/* Glow discret */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-blue-600/10">
              <Smartphone size={20} />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                  Accès Rapide
                </span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-1.5 py-0.5 rounded-full border border-blue-500/30">
                  PWA
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                {isIos
                  ? "Installer sur votre iPhone"
                  : "Installer l'application sur l'écran d'accueil"}
              </h3>

              <p className="text-xs text-slate-400 mt-1 leading-snug">
                {isIos
                  ? "Ouvrez AssoCompta en un toucher et en plein écran via le menu Partager de Safari."
                  : "Lancez la saisie en plein écran et retrouvez l'icône directement sur votre bureau mobile."}
              </p>
            </div>
          </div>

          {/* Bouton fermeture */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fermer la suggestion d'installation"
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800/80 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Bouton d'action */}
        <div className="mt-3.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 relative z-10">
          <span className="text-[11px] text-slate-400 hidden xs:inline">
            Sans passer par les stores
          </span>

          <button
            type="button"
            onClick={handleInstallClick}
            data-testid="pwa-install-button"
            className="w-full xs:w-auto ml-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isIos ? (
              <>
                <span>📲 Installer sur mon iPhone</span>
                <ChevronRight size={14} />
              </>
            ) : (
              <>
                <Download size={14} />
                <span>📲 Installer l'application</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modale d'instructions visuelles iOS Safari */}
      {showIosModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowIosModal(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Poignée de glissement sur mobile */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Smartphone size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Installer sur votre iPhone
                  </h3>
                  <p className="text-xs text-slate-400">
                    Guide Safari en 3 étapes simples
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Étapes illustrées */}
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-500/30">
                  1
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>Appuyez sur le bouton Partager</span>
                    <Share size={14} className="text-blue-400 inline" />
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Dans la barre de navigation tout en bas de Safari, touchez le bouton de partage (icône avec une flèche vers le haut).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-500/30">
                  2
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>Choisissez « Sur l'écran d'accueil »</span>
                    <PlusSquare size={14} className="text-emerald-400 inline" />
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Faites défiler le menu des options vers le bas jusqu'à trouver la ligne « Sur l'écran d'accueil » accompagnée d'un carré avec un plus.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <div className="w-8 h-8 rounded-full bg-emerald-600/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/30">
                  3
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>Touchez « Ajouter »</span>
                    <CheckCircle size={14} className="text-emerald-400 inline" />
                  </div>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Confirmez en haut à droite. L'icône <strong className="text-slate-200">AssoCompta</strong> apparaîtra immédiatement sur votre écran d'accueil avec son icône dédiée !
                  </p>
                </div>
              </div>
            </div>

            {/* Note Safari */}
            <div className="mt-4 p-3 rounded-xl bg-blue-950/30 border border-blue-800/30 text-[11px] text-blue-300 leading-relaxed">
              💡 <strong>Astuce :</strong> Une fois ouverte depuis l'écran d'accueil, l'application fonctionnera en véritable plein écran sans la barre d'adresse de Safari.
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowIosModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm py-3 px-4 rounded-xl transition-colors shadow-lg shadow-blue-600/20"
              >
                C'est compris !
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
