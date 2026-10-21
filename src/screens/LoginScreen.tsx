import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Sparkles, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { InstallPwaBanner } from '../components/InstallPwaBanner';

export const LoginScreen: React.FC = () => {
  const { login, sendPasswordReset, error: authError, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSentMessage, setResetSentMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const displayedError = localError || authError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSentMessage(null);
    clearError();

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof Error && err.message) {
        setLocalError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setLocalError(null);
    setResetSentMessage(null);
    clearError();

    setResetLoading(true);
    try {
      await sendPasswordReset(email);
      setResetSentMessage(
        `Un e-mail de réinitialisation a été envoyé à ${email.trim().toLowerCase()}. Vérifiez votre boîte de réception (et vos courriers indésirables).`
      );
    } catch (err) {
      if (err instanceof Error && err.message) {
        setLocalError(err.message);
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 text-slate-100 pt-safe pb-safe">
      {/* Top Banner slot (MOB-09 Bouton d'installation PWA) */}
      <div id="pwa-install-banner-slot" className="w-full max-w-sm mx-auto mb-4">
        <InstallPwaBanner />
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-sm mx-auto my-auto">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/10">
            <Sparkles size={28} />
          </div>
          <div className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase mb-1">
            Application Mobile
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            AssoCompta Scan
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dépôt de justificatifs & demandes de remboursement
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {displayedError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{displayedError}</span>
              </div>
            )}

            {resetSentMessage && (
              <div
                role="status"
                className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2"
              >
                <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                <span>{resetSentMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="mobile-login-email"
                className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide"
              >
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="mobile-login-email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  placeholder="exemple@asso.ch"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label
                  htmlFor="mobile-login-password"
                  className="text-xs font-semibold text-slate-300 uppercase tracking-wide"
                >
                  Mot de passe
                </label>
                <button
                  type="button"
                  disabled={resetLoading || loading}
                  onClick={handlePasswordReset}
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50 py-1 px-1"
                >
                  {resetLoading ? 'Envoi…' : 'Mot de passe oublié ?'}
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="mobile-login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || resetLoading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Connexion en cours…</span>
                </>
              ) : (
                <>
                  <span>Se connecter</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-500 max-w-xs mx-auto">
        Utilisez les mêmes identifiants que sur l'application Web AssoCompta.
      </div>
    </div>
  );
};
