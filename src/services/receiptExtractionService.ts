import { detectReceiptFileKind } from './imageHelpers';
import {
  EXTRACTION_TIMEOUT_MS,
  extractFieldsFromPdfText,
  hasReadablePdfTextLayer,
  normalizeExtractedAmount,
  normalizeExtractedDate,
  normalizeMerchantName,
  parseGeminiJsonOutput,
  withTimeout,
  type ExtractionConfidence,
  type ExtractionSource,
  type ReceiptExtractionResult,
} from './extractionHelpers';
import { extractTextFromPdfFile } from './pdfTextExtractor';

export {
  EXTRACTION_TIMEOUT_MS,
  extractFieldsFromPdfText,
  hasReadablePdfTextLayer,
  normalizeExtractedAmount,
  normalizeExtractedDate,
  normalizeMerchantName,
  parseGeminiJsonOutput,
  withTimeout,
  type ExtractionConfidence,
  type ExtractionSource,
  type ReceiptExtractionResult,
};

const DEFAULT_BACKEND_API_URL = 'https://assocompta-backend-vkiznjrvtq-ew.a.run.app';

/**
 * Convertit un `Blob` / `File` en chaîne Base64 (sans le préfixe `data:...;base64,`).
 */
const fileToBase64 = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Impossible de lire le fichier pour analyse.'));
    reader.readAsDataURL(file);
  });
};

/**
 * Récupère l'URL du backend AssoCompta configurée dans Vite, avec fallback sur l'URL de production.
 */
const getBackendApiUrl = (): string => {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const configured = (env?.VITE_API_URL || '').trim();
    return (configured || DEFAULT_BACKEND_API_URL).replace(/\/+$/, '');
  } catch {
    return DEFAULT_BACKEND_API_URL;
  }
};

/**
 * Appelle le backend sécurisé (`POST /analyze-receipt`) pour analyser une photo de ticket ou un PDF scanné.
 * Aucune clé API Gemini n'est stockée ni exposée côté client.
 */
const analyzeWithBackendVision = async (
  file: File,
  backendUrl: string
): Promise<{
  extractedDate: string | null;
  extractedAmount: number | null;
  merchantName: string | null;
}> => {
  const base64Data = await fileToBase64(file);
  const mimeType =
    file.type || (detectReceiptFileKind(file.type, file.name) === 'pdf' ? 'application/pdf' : 'image/jpeg');

  const response = await fetch(`${backendUrl}/analyze-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType }),
  });

  if (!response.ok) {
    throw new Error(`Erreur backend (${response.status})`);
  }

  const data = (await response.json()) as {
    date?: string | null;
    amount?: number | string | null;
    merchantName?: string | null;
  };

  return {
    extractedDate: normalizeExtractedDate(data.date),
    extractedAmount: normalizeExtractedAmount(data.amount),
    merchantName: normalizeMerchantName(data.merchantName),
  };
};

/**
 * Calcule le niveau de confiance (`high`, `medium`, `low`) selon les champs extraits.
 */
const computeConfidence = (
  extractedDate: string | null,
  extractedAmount: number | null
): ExtractionConfidence => {
  if (extractedDate && extractedAmount !== null) return 'high';
  if (extractedDate || extractedAmount !== null) return 'medium';
  return 'low';
};

/**
 * Service principal d'extraction automatique (Ticket MOB-05) :
 * 1. Si PDF : tente l'extraction directe du texte natif vectoriel (instantané, < 100ms).
 * 2. Si Photo ou PDF scanné (sans couche texte suffisante) : appelle le backend sécurisé (`/analyze-receipt`) avec timeout de 8s.
 * 3. Résilience : ne bloque jamais l'utilisateur en cas de timeout, d'absence de réseau ou de ticket manuscrit.
 */
export const extractReceiptData = async (
  file: File,
  options?: { timeoutMs?: number; backendUrl?: string }
): Promise<ReceiptExtractionResult> => {
  const timeoutMs = options?.timeoutMs ?? EXTRACTION_TIMEOUT_MS;
  const backendUrl = options?.backendUrl !== undefined ? options.backendUrl : getBackendApiUrl();
  const kind = detectReceiptFileKind(file?.type, file?.name);

  let partialPdfResult = null as {
    extractedDate: string | null;
    extractedAmount: number | null;
    merchantName: string | null;
  } | null;
  let extractedRawText: string | undefined;

  try {
    return await withTimeout(
      (async (): Promise<ReceiptExtractionResult> => {
        // 1. Branche PDF : tentative d'extraction directe du texte natif (« joli PDF »)
        if (kind === 'pdf') {
          const pdfText = await extractTextFromPdfFile(file);
          if (hasReadablePdfTextLayer(pdfText)) {
            extractedRawText = pdfText;
            const parsedFromPdf = extractFieldsFromPdfText(pdfText);
            partialPdfResult = parsedFromPdf;

            // Si le PDF vectoriel fournit déjà la date et le montant TTC, retour immédiat sans OCR lourd !
            if (parsedFromPdf.extractedDate && parsedFromPdf.extractedAmount !== null) {
              return {
                extractedDate: parsedFromPdf.extractedDate,
                extractedAmount: parsedFromPdf.extractedAmount,
                merchantName: parsedFromPdf.merchantName,
                source: 'pdf_text',
                confidence: 'high',
                rawText: pdfText,
                timedOut: false,
                errorMessage: null,
              };
            }
          }
        }

        // 2. Branche IA Multimodale via Backend sécurisé (Photo de ticket ou PDF scanné / incomplet)
        if (backendUrl) {
          const visionResult = await analyzeWithBackendVision(file, backendUrl);
          const mergedDate = visionResult.extractedDate ?? partialPdfResult?.extractedDate ?? null;
          const mergedAmount =
            visionResult.extractedAmount ?? partialPdfResult?.extractedAmount ?? null;
          const mergedMerchant =
            visionResult.merchantName ?? partialPdfResult?.merchantName ?? null;

          return {
            extractedDate: mergedDate,
            extractedAmount: mergedAmount,
            merchantName: mergedMerchant,
            source: 'gemini_vision',
            confidence: computeConfidence(mergedDate, mergedAmount),
            rawText: extractedRawText,
            timedOut: false,
            errorMessage: null,
          };
        }

        // 3. Si pas de backend configuré mais qu'un résultat partiel PDF existe
        if (
          partialPdfResult &&
          (partialPdfResult.extractedDate ||
            partialPdfResult.extractedAmount !== null ||
            partialPdfResult.merchantName)
        ) {
          return {
            extractedDate: partialPdfResult.extractedDate,
            extractedAmount: partialPdfResult.extractedAmount,
            merchantName: partialPdfResult.merchantName,
            source: 'pdf_text',
            confidence: computeConfidence(
              partialPdfResult.extractedDate,
              partialPdfResult.extractedAmount
            ),
            rawText: extractedRawText,
            timedOut: false,
            errorMessage: null,
          };
        }

        // 4. Fallback léger à partir du nom de fichier (ex: "2026-10-15_Migros_42.50.jpg")
        const fromName = extractFieldsFromPdfText(file?.name?.replace(/[_-]+/g, ' ') || '');
        return {
          extractedDate: fromName.extractedDate,
          extractedAmount: fromName.extractedAmount,
          merchantName: fromName.merchantName,
          source: 'fallback',
          confidence: computeConfidence(fromName.extractedDate, fromName.extractedAmount),
          rawText: extractedRawText,
          timedOut: false,
          errorMessage: null,
        };
      })(),
      timeoutMs
    );
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === 'EXTRACTION_TIMEOUT';
    return {
      extractedDate: partialPdfResult?.extractedDate ?? null,
      extractedAmount: partialPdfResult?.extractedAmount ?? null,
      merchantName: partialPdfResult?.merchantName ?? null,
      source: partialPdfResult ? 'pdf_text' : 'fallback',
      confidence: computeConfidence(
        partialPdfResult?.extractedDate ?? null,
        partialPdfResult?.extractedAmount ?? null
      ),
      rawText: extractedRawText,
      timedOut: isTimeout,
      errorMessage: isTimeout
        ? "Le délai d'analyse automatique (8s) a été dépassé. Vous pourrez saisir les informations manuellement."
        : 'Analyse automatique partielle. Vous pourrez compléter les champs manuellement.',
    };
  }
};
