import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  FileText,
  CreditCard,
  Wallet,
  Sparkles,
  Calendar,
  Store,
  AlignLeft,
  Landmark,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  Send,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
} from 'lucide-react';
import type { AuthorizedComptabilite } from '../types/receipt';
import { getComptaRoleLabel } from '../services/comptaHelpers';
import { formatFileSize, type PreparedReceiptFile } from '../services/imageService';
import type { ReceiptExtractionResult } from '../services/receiptExtractionService';
import {
  type ExpenseTypeChoice,
  type VerifiedReceiptPayload,
  getSavedIbanFromStorage,
  saveIbanToStorage,
  normalizeIban,
  validateVerifiedReceiptForm,
} from '../services/verificationHelpers';

interface ReceiptPreviewProps {
  preparedFile: PreparedReceiptFile;
  extractionResult: ReceiptExtractionResult | null;
  authorizedComptas: AuthorizedComptabilite[];
  selectedCompta: AuthorizedComptabilite | null;
  onSelectCompta: (comptaId: string) => void;
  onBack: () => void;
  onSubmitVerified: (payload: VerifiedReceiptPayload, file: PreparedReceiptFile) => void | Promise<void>;
  isSubmitting?: boolean;
  submitError?: string | null;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  preparedFile,
  extractionResult,
  authorizedComptas,
  selectedCompta,
  onSelectCompta,
  onBack,
  onSubmitVerified,
  isSubmitting = false,
  submitError = null,
}) => {
  // États du visualiseur de document (Zoom, Rotation, Pliage sur mobile)
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [mobilePreviewExpanded, setMobilePreviewExpanded] = useState<boolean>(true);

  // États du formulaire de vérification (pré-remplis par l'extraction automatique MOB-05)
  const [expenseType, setExpenseType] = useState<ExpenseTypeChoice>('DEBIT_CARD');
  const [amountInput, setAmountInput] = useState<string>(
    extractionResult?.extractedAmount != null
      ? extractionResult.extractedAmount.toFixed(2)
      : ''
  );
  const [dateInput, setDateInput] = useState<string>(
    extractionResult?.extractedDate || new Date().toISOString().slice(0, 10)
  );
  const [merchantName, setMerchantName] = useState<string>(
    extractionResult?.merchantName || ''
  );
  const [description, setDescription] = useState<string>('');
  const [ibanInput, setIbanInput] = useState<string>(() => getSavedIbanFromStorage());
  const [ibanSavedNotice, setIbanSavedNotice] = useState<boolean>(false);
  const [touchedSubmit, setTouchedSubmit] = useState<boolean>(false);

  // Synchroniser si l'extraction arrive ou change
  useEffect(() => {
    if (extractionResult?.extractedAmount != null) {
      setAmountInput(extractionResult.extractedAmount.toFixed(2));
    }
    if (extractionResult?.extractedDate) {
      setDateInput(extractionResult.extractedDate);
    }
    if (extractionResult?.merchantName) {
      setMerchantName(extractionResult.merchantName);
    }
  }, [extractionResult]);

  const activeComptaId = selectedCompta?.comptaId || authorizedComptas[0]?.comptaId || '';
  const activeCurrency = selectedCompta?.currency || 'CHF';

  const validation = validateVerifiedReceiptForm({
    comptaId: activeComptaId,
    expenseType,
    amountInput,
    dateInput,
    merchantName,
    description,
    reimbursementIban: expenseType === 'REIMBURSEMENT' ? ibanInput : '',
  });

  const handleIbanBlur = () => {
    const formatted = normalizeIban(ibanInput);
    setIbanInput(formatted);
    saveIbanToStorage(formatted);
    if (formatted) {
      setIbanSavedNotice(true);
      setTimeout(() => setIbanSavedNotice(false), 2500);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedSubmit(true);

    if (!validation.valid || !validation.payload) {
      return;
    }

    if (expenseType === 'REIMBURSEMENT' && ibanInput.trim()) {
      saveIbanToStorage(ibanInput);
    }

    onSubmitVerified(validation.payload, preparedFile);
  };

  const extractionBadgeText =
    extractionResult?.source === 'pdf_text'
      ? 'Extrait du PDF natif'
      : extractionResult?.source === 'gemini_vision'
      ? 'Détecté par OCR IA'
      : 'Saisie manuelle';

  return (
    <div className="w-full max-w-5xl mx-auto p-4 pb-28">
      {/* Barre supérieure de retour et statut */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3.5 py-2 rounded-xl transition-colors"
        >
          <ArrowLeft size={15} />
          <span>Changer de fichier</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
            <Sparkles size={12} />
            <span>{extractionBadgeText}</span>
          </span>
        </div>
      </div>

      {/* Grille Responsive : 1 colonne sur Smartphone, 2 colonnes côte-à-côte sur PC (lg:grid-cols-12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLONNE GAUCHE (PC) / HAUT (Mobile) : Visualiseur du justificatif (Photo ou PDF) */}
        <div className="lg:col-span-6 lg:sticky lg:top-20 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* En-tête du visualiseur */}
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Eye size={15} className="text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-slate-200 truncate">
                {preparedFile.originalName}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold shrink-0">
                ({formatFileSize(preparedFile.finalSizeBytes)})
              </span>
            </div>

            <div className="flex items-center gap-1">
              {preparedFile.kind === 'image' && (
                <>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                    disabled={zoomLevel <= 1}
                    title="Zoom arrière"
                    aria-label="Zoom arrière"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-[10px] font-mono text-slate-400 px-1">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                    disabled={zoomLevel >= 2.5}
                    title="Zoom avant"
                    aria-label="Zoom avant"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    title="Pivoter de 90°"
                    aria-label="Pivoter l'image de 90 degrés"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <RotateCw size={14} />
                  </button>
                </>
              )}

              <a
                href={preparedFile.previewUrl}
                target="_blank"
                rel="noreferrer"
                title="Ouvrir en plein écran"
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
              >
                <ExternalLink size={14} />
              </a>

              {/* Bouton plier/déplier uniquement sur mobile */}
              <button
                type="button"
                onClick={() => setMobilePreviewExpanded((v) => !v)}
                className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label={
                  mobilePreviewExpanded ? "Masquer l'aperçu" : "Afficher l'aperçu"
                }
              >
                {mobilePreviewExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {/* Corps du visualiseur */}
          <div
            className={`${
              mobilePreviewExpanded ? 'block' : 'hidden lg:block'
            } bg-slate-950`}
          >
            {preparedFile.kind === 'image' ? (
              <div className="overflow-auto max-h-[340px] lg:max-h-[580px] flex items-center justify-center p-3">
                <img
                  src={preparedFile.previewUrl}
                  alt={preparedFile.originalName}
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                  }}
                  className="max-h-[310px] lg:max-h-[540px] w-auto object-contain rounded-lg transition-transform duration-150"
                />
              </div>
            ) : (
              <div className="flex flex-col">
                <iframe
                  src={preparedFile.previewUrl}
                  title={preparedFile.originalName}
                  className="w-full h-[320px] lg:h-[540px] bg-slate-900 border-b border-slate-800"
                />
                <div className="px-4 py-2.5 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={15} className="text-amber-400 shrink-0" />
                    <span className="truncate">{preparedFile.originalName}</span>
                  </div>
                  <a
                    href={preparedFile.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline font-medium shrink-0 ml-2"
                  >
                    Ouvrir le PDF
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLONNE DROITE (PC) / BAS (Mobile) : Formulaire de vérification obligatoire */}
        <form
          onSubmit={handleFormSubmit}
          noValidate
          className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5"
        >
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Vérification du justificatif
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Vérifiez le montant TTC, la date et précisez s'il s'agit d'un paiement par carte ou d'un remboursement.
            </p>
          </div>

          {/* 1. Sélecteur de Comptabilité cible */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="verify-compta-select"
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300"
              >
                <FolderKanban size={14} className="text-blue-400" />
                <span>1. Comptabilité cible</span>
              </label>
              {selectedCompta && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {getComptaRoleLabel(selectedCompta.role)}
                </span>
              )}
            </div>

            {authorizedComptas.length === 1 && selectedCompta ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-100">
                    {selectedCompta.comptaName}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {selectedCompta.orgName} • Devise {selectedCompta.currency}
                  </div>
                </div>
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              </div>
            ) : (
              <div className="relative">
                <select
                  id="verify-compta-select"
                  value={activeComptaId}
                  onChange={(e) => onSelectCompta(e.target.value)}
                  className="w-full appearance-none bg-slate-950 border border-slate-700 hover:border-blue-500/60 focus:border-blue-500 focus:outline-none rounded-xl px-3.5 py-2.5 pr-9 text-sm font-semibold text-slate-100 transition-colors"
                >
                  {authorizedComptas.map((compta) => (
                    <option key={`${compta.orgId}-${compta.comptaId}`} value={compta.comptaId}>
                      {compta.comptaName} ({compta.orgName} — {compta.currency})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            )}
          </div>

          {/* 2. Choix du Type de dépense (Carte de Débit vs Demande de Remboursement) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              2. Mode de paiement
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExpenseType('DEBIT_CARD')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                  expenseType === 'DEBIT_CARD'
                    ? 'bg-blue-600/20 border-blue-500 text-slate-100 shadow-md shadow-blue-600/15'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      expenseType === 'DEBIT_CARD'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <CreditCard size={17} />
                  </div>
                  {expenseType === 'DEBIT_CARD' && (
                    <CheckCircle2 size={16} className="text-blue-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100">
                    💳 Carte de Débit
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Payé avec la carte bancaire du compte
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExpenseType('REIMBURSEMENT')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                  expenseType === 'REIMBURSEMENT'
                    ? 'bg-emerald-600/20 border-emerald-500 text-slate-100 shadow-md shadow-emerald-600/15'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      expenseType === 'REIMBURSEMENT'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Wallet size={17} />
                  </div>
                  {expenseType === 'REIMBURSEMENT' && (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100">
                    💶 À rembourser
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Avancé avec mon argent personnel
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Montant TTC et Date de la facture */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Montant TTC */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="verify-amount-input"
                  className="text-xs font-bold uppercase tracking-wider text-slate-300"
                >
                  3. Montant TTC ({activeCurrency}) *
                </label>
                {extractionResult?.extractedAmount != null && (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    Auto-détecté
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="verify-amount-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 pr-14 text-base font-bold text-slate-100 focus:outline-none transition-colors ${
                    validation.errors.amount && (touchedSubmit || amountInput !== '')
                      ? 'border-red-500/70 focus:border-red-500'
                      : 'border-slate-700 focus:border-blue-500'
                  }`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {activeCurrency}
                </span>
              </div>
              {validation.errors.amount && (touchedSubmit || amountInput !== '') && (
                <p className="text-[11px] text-red-400">{validation.errors.amount}</p>
              )}
            </div>

            {/* Date de la facture / du ticket */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="verify-date-input"
                  className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-300"
                >
                  <Calendar size={12} className="text-blue-400" />
                  <span>4. Date facture *</span>
                </label>
                <button
                  type="button"
                  onClick={() => setDateInput(new Date().toISOString().slice(0, 10))}
                  className="text-[10px] text-blue-400 hover:underline font-medium"
                >
                  Aujourd'hui
                </button>
              </div>
              <input
                id="verify-date-input"
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-100 focus:outline-none transition-colors ${
                  validation.errors.date && touchedSubmit
                    ? 'border-red-500/70 focus:border-red-500'
                    : 'border-slate-700 focus:border-blue-500'
                }`}
              />
              {validation.errors.date && touchedSubmit && (
                <p className="text-[11px] text-red-400">{validation.errors.date}</p>
              )}
            </div>
          </div>

          {/* 4. Fournisseur & Motif / Description */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="verify-merchant-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"
              >
                <Store size={13} className="text-amber-400" />
                <span>Magasin / Fournisseur</span>
              </label>
              <input
                id="verify-merchant-input"
                type="text"
                placeholder="Ex: Migros, Coop, CFF, Boulangerie…"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-slate-100 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="verify-description-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"
              >
                <AlignLeft size={13} className="text-blue-400" />
                <span>Motif / Commentaire pour le caissier</span>
              </label>
              <input
                id="verify-description-input"
                type="text"
                placeholder="Ex: Achat goûter sortie Louveteaux, Impression flyers…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:outline-none rounded-xl px-3.5 py-2.5 text-sm text-slate-100 transition-colors"
              />
            </div>
          </div>

          {/* 5. Champ IBAN mémorisé (affiché si Demande de Remboursement) */}
          {expenseType === 'REIMBURSEMENT' && (
            <div className="bg-emerald-950/25 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="verify-iban-input"
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-300"
                >
                  <Landmark size={14} className="text-emerald-400" />
                  <span>IBAN pour votre remboursement</span>
                </label>
                {ibanSavedNotice ? (
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    ✓ Mémorisé sur cet appareil
                  </span>
                ) : ibanInput ? (
                  <span className="text-[10px] text-slate-400">
                    Mémorisé automatiquement
                  </span>
                ) : null}
              </div>

              <input
                id="verify-iban-input"
                type="text"
                placeholder="CH93 0076 2011 6238 5295 7"
                value={ibanInput}
                onChange={(e) => setIbanInput(e.target.value)}
                onBlur={handleIbanBlur}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none transition-colors ${
                  validation.errors.iban
                    ? 'border-red-500/70 focus:border-red-500'
                    : 'border-emerald-700/50 focus:border-emerald-500'
                }`}
              />
              {validation.errors.iban ? (
                <p className="text-[11px] text-red-400">{validation.errors.iban}</p>
              ) : (
                <p className="text-[10px] text-slate-400">
                  Votre nom, prénom et e-mail seront joints automatiquement pour que le caissier puisse vous rembourser.
                </p>
              )}
            </div>
          )}

          {/* Message d'erreur global si tentative de soumission invalide ou erreur Firebase */}
          {(submitError || (touchedSubmit && !validation.valid && validation.firstError)) && (
            <div
              role="alert"
              className="bg-red-950/60 border border-red-500/40 rounded-xl p-3 flex items-start gap-2 text-xs text-red-200"
            >
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <span>{submitError || validation.firstError}</span>
            </div>
          )}

          {/* Bouton de validation finale */}
          <button
            type="submit"
            disabled={!validation.valid || isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>Envoi du justificatif en cours…</span>
              </>
            ) : (
              <>
                <Send size={17} />
                <span>
                  Envoyer dans {selectedCompta?.comptaName || 'la comptabilité'}
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
