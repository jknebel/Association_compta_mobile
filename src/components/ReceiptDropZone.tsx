import React, { useRef, useState } from 'react';
import {
  Camera,
  FileText,
  Image as ImageIcon,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  prepareReceiptFile,
  formatFileSize,
  type PreparedReceiptFile,
} from '../services/imageService';

interface ReceiptDropZoneProps {
  selectedComptaName?: string;
  onFilePrepared?: (prepared: PreparedReceiptFile) => void;
  onClearFile?: () => void;
  preparedFile?: PreparedReceiptFile | null;
  onContinue?: (prepared: PreparedReceiptFile) => void;
}

export const ReceiptDropZone: React.FC<ReceiptDropZoneProps> = ({
  selectedComptaName,
  onFilePrepared,
  onClearFile,
  preparedFile: externalPreparedFile,
  onContinue,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [internalPrepared, setInternalPrepared] = useState<PreparedReceiptFile | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activePreparedFile =
    externalPreparedFile !== undefined ? externalPreparedFile : internalPrepared;

  const handleSelectedRawFile = async (rawFile?: File | null) => {
    if (!rawFile) return;
    setError(null);
    setIsProcessing(true);

    try {
      const prepared = await prepareReceiptFile(rawFile);
      if (externalPreparedFile === undefined) {
        setInternalPrepared(prepared);
      }
      onFilePrepared?.(prepared);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de la préparation du fichier.';
      setError(msg);
    } finally {
      setIsProcessing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleRemoveFile = () => {
    if (activePreparedFile?.previewUrl) {
      try {
        URL.revokeObjectURL(activePreparedFile.previewUrl);
      } catch {
        // Ignorer
      }
    }
    setError(null);
    if (externalPreparedFile === undefined) {
      setInternalPrepared(null);
    }
    onClearFile?.();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      void handleSelectedRawFile(droppedFile);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Inputs natifs cachés pour les 3 sources : Caméra mobile, PDF et Image galerie/PC */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => void handleSelectedRawFile(e.target.files?.[0])}
        className="hidden"
        aria-label="Prendre le ticket en photo avec la caméra"
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => void handleSelectedRawFile(e.target.files?.[0])}
        className="hidden"
        aria-label="Sélectionner une facture PDF"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handleSelectedRawFile(e.target.files?.[0])}
        className="hidden"
        aria-label="Choisir une photo existante"
      />

      {/* Message d'erreur éventuel (taille dépassée, format non supporté, etc.) */}
      {error && (
        <div
          role="alert"
          className="bg-red-950/60 border border-red-500/40 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-200"
        >
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{error}</div>
        </div>
      )}

      {/* Si un fichier est déjà prêt : afficher la carte d'aperçu */}
      {activePreparedFile ? (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <CheckCircle2 size={16} />
              <span>
                {activePreparedFile.kind === 'pdf'
                  ? 'Facture PDF prête'
                  : 'Photo compressée et prête'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRemoveFile}
              className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Trash2 size={13} />
              <span>Changer</span>
            </button>
          </div>

          {/* Aperçu visuel (Image ou PDF) */}
          <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
            {activePreparedFile.kind === 'image' ? (
              <img
                src={activePreparedFile.previewUrl}
                alt={activePreparedFile.originalName}
                className="max-h-64 w-auto object-contain"
              />
            ) : (
              <div className="w-full">
                <iframe
                  src={activePreparedFile.previewUrl}
                  title={activePreparedFile.originalName}
                  className="w-full h-56 bg-slate-900 border-b border-slate-800"
                />
                <div className="p-3 flex items-center gap-2.5 text-xs text-slate-300 bg-slate-950">
                  <FileText size={18} className="text-blue-400 shrink-0" />
                  <span className="truncate font-medium">{activePreparedFile.originalName}</span>
                </div>
              </div>
            )}
          </div>

          {/* Métadonnées de compression / taille */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 bg-slate-950/70 rounded-xl px-3 py-2 border border-slate-800/80">
            <span className="truncate max-w-[60%] font-mono text-slate-300">
              {activePreparedFile.normalizedName}
            </span>
            <div className="flex items-center gap-2">
              {activePreparedFile.wasCompressed &&
                activePreparedFile.originalSizeBytes > activePreparedFile.finalSizeBytes && (
                  <span className="line-through text-slate-500">
                    {formatFileSize(activePreparedFile.originalSizeBytes)}
                  </span>
                )}
              <span className="font-semibold text-emerald-400">
                {formatFileSize(activePreparedFile.finalSizeBytes)}
              </span>
              {activePreparedFile.width && activePreparedFile.height && (
                <span className="text-slate-500">
                  ({activePreparedFile.width}×{activePreparedFile.height}px)
                </span>
              )}
            </div>
          </div>

          {/* Bouton de poursuite vers l'analyse OCR / Vérification */}
          <button
            type="button"
            onClick={() => onContinue?.(activePreparedFile)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
          >
            <span>Analyser et vérifier ce justificatif</span>
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        /* Zone principale de capture (Mobile) et Drag & Drop (PC) */
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`bg-gradient-to-br from-blue-900/30 via-slate-900 to-slate-900 border-2 rounded-2xl p-5 shadow-lg transition-all ${
            isDraggingOver
              ? 'border-blue-400 bg-blue-950/40 scale-[1.01]'
              : 'border-blue-800/40'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wide mb-1">
            <Sparkles size={14} />
            <span>Capture intelligente (Mobile & PC)</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Nouveau justificatif</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Prenez votre ticket en photo ou importez une facture PDF. Le montant TTC et la date seront extraits pour{' '}
            <span className="text-slate-200 font-semibold">
              {selectedComptaName ?? 'votre comptabilité'}
            </span>
            .
          </p>

          {isProcessing ? (
            <div className="my-6 py-6 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2.5 text-center">
              <Loader2 size={26} className="animate-spin text-blue-400" />
              <p className="text-xs font-medium text-slate-200">
                Optimisation et préparation du document…
              </p>
              <p className="text-[11px] text-slate-400">
                Compression automatique pour un envoi rapide
              </p>
            </div>
          ) : (
            <>
              {/* Boutons d'action principaux */}
              <div className="mt-5 grid grid-cols-1 gap-2.5">
                {/* 1. Caméra arrière directe (prioritaire sur smartphone) */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25"
                >
                  <Camera size={20} />
                  <span>Prendre le ticket en photo</span>
                </button>

                {/* 2. Choix Facture PDF ou Photo existante */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-700/80 text-slate-100 font-medium py-3 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <FileText size={16} className="text-amber-400 shrink-0" />
                    <span>Facture PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-700/80 text-slate-100 font-medium py-3 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <ImageIcon size={16} className="text-emerald-400 shrink-0" />
                    <span>Photo galerie / PC</span>
                  </button>
                </div>
              </div>

              {/* 3. Zone visuelle de Glisser-Déposer (PC Desktop) */}
              <div
                onClick={() => pdfInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pdfInputRef.current?.click();
                  }
                }}
                className={`mt-3.5 border border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-colors flex flex-col items-center gap-1 ${
                  isDraggingOver
                    ? 'border-blue-400 bg-blue-500/15 text-blue-200'
                    : 'border-slate-700/80 bg-slate-950/50 hover:border-slate-600 text-slate-400'
                }`}
              >
                <UploadCloud
                  size={18}
                  className={isDraggingOver ? 'text-blue-400 animate-bounce' : 'text-slate-400'}
                />
                <span className="text-[11px] font-medium text-slate-300">
                  Sur PC : glissez-déposez votre facture PDF ou photo ici
                </span>
                <span className="text-[10px] text-slate-500">
                  Photos compressées automatiquement (&lt; 400 Ko) • PDF jusqu'à 5 Mo
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
