export const EXTRACTION_TIMEOUT_MS = 8000;
export const MIN_READABLE_PDF_TEXT_LENGTH = 20;

export type ExtractionSource = 'pdf_text' | 'gemini_vision' | 'fallback';
export type ExtractionConfidence = 'high' | 'medium' | 'low';

export interface ReceiptExtractionResult {
  extractedDate: string | null;
  extractedAmount: number | null;
  merchantName: string | null;
  source: ExtractionSource;
  confidence: ExtractionConfidence;
  rawText?: string;
  timedOut?: boolean;
  errorMessage?: string | null;
}

const FRENCH_MONTHS: Record<string, string> = {
  janvier: '01',
  janv: '01',
  jan: '01',
  fevrier: '02',
  février: '02',
  fevr: '02',
  févr: '02',
  fev: '02',
  fév: '02',
  mars: '03',
  mar: '03',
  avril: '04',
  avr: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  juil: '07',
  aout: '08',
  août: '08',
  septembre: '09',
  sept: '09',
  sep: '09',
  octobre: '10',
  oct: '10',
  novembre: '11',
  nov: '11',
  decembre: '12',
  décembre: '12',
  dec: '12',
  déc: '12',
};

const KNOWN_MERCHANTS: readonly string[] = [
  'Migros',
  'Coop',
  'Denner',
  'Aldi',
  'Lidl',
  'Manor',
  'Galaxus',
  'Digitec',
  'CFF',
  'SBB',
  'La Poste',
  'Swisscom',
  'Sunrise',
  'Salt',
  'IKEA',
  'Decathlon',
  'Hornbach',
  'Jumbo',
  'Landi',
  'OBI',
  'Fnac',
  'Interdiscount',
  'Fust',
  'Infomaniak',
  'Adobe',
  'Microsoft',
  'Google',
];

const isValidCalendarDate = (year: number, month: number, day: number): boolean => {
  if (year < 1990 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const daysInMonths = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonths[month - 1];
};

const formatIsoDate = (year: number, month: number, day: number): string => {
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Normalise une date brute (ISO `YYYY-MM-DD`, format suisse `DD.MM.YYYY`, `DD/MM/YYYY`,
 * année sur 2 chiffres `DD.MM.YY` ou date en français `15 octobre 2026`) en `YYYY-MM-DD`.
 */
export const normalizeExtractedDate = (rawDate?: unknown): string | null => {
  if (typeof rawDate !== 'string') return null;
  const clean = rawDate.trim();
  if (!clean) return null;

  // 1. Format ISO YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = clean.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return formatIsoDate(year, month, day);
    }
  }

  // 2. Format européen / suisse DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY (ou YY sur 2 chiffres)
  const euroMatch = clean.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (euroMatch) {
    const day = parseInt(euroMatch[1], 10);
    const month = parseInt(euroMatch[2], 10);
    let year = parseInt(euroMatch[3], 10);
    if (euroMatch[3].length === 2) {
      year = year >= 70 ? 1900 + year : 2000 + year;
    }
    if (isValidCalendarDate(year, month, day)) {
      return formatIsoDate(year, month, day);
    }
  }

  // 3. Format littéral français : "15 octobre 2026" ou "3 janv. 2026"
  const frMatch = clean
    .toLowerCase()
    .match(/\b(\d{1,2})\s+([a-zéû]+)\.?\s+(\d{4})\b/);
  if (frMatch) {
    const day = parseInt(frMatch[1], 10);
    const monthStr = frMatch[2];
    const year = parseInt(frMatch[3], 10);
    const mm = FRENCH_MONTHS[monthStr];
    if (mm) {
      const month = parseInt(mm, 10);
      if (isValidCalendarDate(year, month, day)) {
        return formatIsoDate(year, month, day);
      }
    }
  }

  return null;
};

/**
 * Normalise un montant extrait (nombre ou chaîne type `"CHF 1'240.50"`, `"42,50"`, `"85.-"`)
 * en nombre décimal positif arrondi au centime, ou `null` si invalide.
 */
export const normalizeExtractedAmount = (rawAmount?: unknown): number | null => {
  if (typeof rawAmount === 'number') {
    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 1_000_000) {
      return null;
    }
    return Math.round(rawAmount * 100) / 100;
  }

  if (typeof rawAmount !== 'string') return null;
  let clean = rawAmount.trim();
  if (!clean) return null;

  // Remplacer la notation suisse "85.-" ou "85.—" par "85.00"
  clean = clean.replace(/[.,][-—–]+$/, '.00').replace(/[-—–]+$/, '');

  // Supprimer les devises et séparateurs de milliers (apostrophes, espaces insécables)
  clean = clean
    .replace(/\b(CHF|EUR|USD|Fr\.?|SFr\.?|TTC|HT)\b/gi, '')
    .replace(/['’`\s\u00A0]/g, '');

  // Si le montant utilise une virgule décimale (ex: "142,50") sans point, convertir en point
  if (clean.includes(',') && !clean.includes('.')) {
    clean = clean.replace(',', '.');
  } else if (clean.includes(',') && clean.includes('.')) {
    // Ex: "1,240.50" -> supprimer la virgule de milliers
    clean = clean.replace(/,/g, '');
  }

  const numMatch = clean.match(/-?\d+(?:\.\d+)?/);
  if (!numMatch) return null;

  const parsed = parseFloat(numMatch[0]);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
};

/**
 * Nettoie et normalise le nom du fournisseur / commerce.
 */
export const normalizeMerchantName = (rawMerchant?: unknown): string | null => {
  if (typeof rawMerchant !== 'string') return null;
  const clean = rawMerchant.replace(/\s+/g, ' ').trim();
  if (!clean || clean.length < 2) return null;
  if (/^(facture|ticket|reçu|recu|quittance|justificatif|receipt|invoice)$/i.test(clean)) {
    return null;
  }
  return clean.slice(0, 80);
};

/**
 * Détermine si le texte extrait d'un fichier PDF correspond à un « joli PDF »
 * doté d'une vraie couche texte lisible (par opposition à un PDF scanné sans texte).
 */
export const hasReadablePdfTextLayer = (extractedText?: string | null): boolean => {
  if (typeof extractedText !== 'string') return false;
  const clean = extractedText.replace(/\s+/g, ' ').trim();
  if (clean.length < MIN_READABLE_PDF_TEXT_LENGTH) return false;
  const words = clean.match(/[a-zA-ZÀ-ÿ0-9]{2,}/g);
  return Array.isArray(words) && words.length >= 3;
};

/**
 * Extrait la date, le montant total TTC et le nom du fournisseur directement depuis
 * le texte natif d'une facture PDF ou d'un ticket numérique.
 */
export const extractFieldsFromPdfText = (
  text: string
): {
  extractedDate: string | null;
  extractedAmount: number | null;
  merchantName: string | null;
} => {
  if (typeof text !== 'string' || !text.trim()) {
    return { extractedDate: null, extractedAmount: null, merchantName: null };
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // 1. Extraction du fournisseur (Merchant)
  let merchantName: string | null = null;
  for (const known of KNOWN_MERCHANTS) {
    const regex = new RegExp(`\\b${known.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(text)) {
      merchantName = known;
      break;
    }
  }
  if (!merchantName) {
    for (const line of lines.slice(0, 8)) {
      if (
        /\b(SA|Sàrl|Sarl|GmbH|AG|Association|S\.A\.)\b/i.test(line) &&
        line.length <= 60
      ) {
        merchantName = normalizeMerchantName(line);
        if (merchantName) break;
      }
    }
  }
  if (!merchantName && lines.length > 0) {
    const candidate = lines.find(
      (l) =>
        l.length >= 3 &&
        l.length <= 50 &&
        !/^(facture|ticket|date|client|page|n°|no|total|montant|tva|iban)\b/i.test(l) &&
        !/^\d+$/.test(l)
    );
    merchantName = normalizeMerchantName(candidate);
  }

  // 2. Extraction de la Date de facture
  let extractedDate: string | null = null;
  const dateContextRegex =
    /(?:date(?:\s+de\s+facture|\s+facture)?|facturé\s+le|émis\s+le|le|du|datum)\s*[:.]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[a-zéû]+\.?\s+\d{4})/i;
  const contextDateMatch = text.match(dateContextRegex);
  if (contextDateMatch) {
    extractedDate = normalizeExtractedDate(contextDateMatch[1]);
  }
  if (!extractedDate) {
    for (const line of lines) {
      const d = normalizeExtractedDate(line);
      if (d) {
        extractedDate = d;
        break;
      }
    }
  }

  // 3. Extraction du Montant Total TTC
  let extractedAmount: number | null = null;
  const amountPattern =
    "(?:CHF|EUR|Fr\\.?|SFr\\.?)?\\s*([0-9]{1,3}(?:['’\\s][0-9]{3})*(?:[.,][0-9]{2}|[.,][-—–])|[0-9]+(?:[.,][0-9]{2}|[.,][-—–]))\\s*(?:CHF|EUR|Fr\\.?|SFr\\.?)?";

  // Priorité A : Total TTC / Montant à payer / Net à payer / Total CHF
  const highPriorityKeywords = [
    new RegExp(
      `(?:total\\s+ttc|montant\\s+total(?:\\s+ttc)?|total\\s+à\\s+payer|montant\\s+à\\s+payer|net\\s+à\\s+payer|total\\s+(?:chf|eur)|endbetrag|gesamtbetrag)\\s*[:.]?\\s*${amountPattern}`,
      'gi'
    ),
    new RegExp(
      `(?:total|montant\\s+dû|somme)\\s*[:.]?\\s*${amountPattern}`,
      'gi'
    ),
  ];

  for (const regex of highPriorityKeywords) {
    const matches = [...text.matchAll(regex)];
    if (matches.length > 0) {
      // Prendre la dernière occurrence de Total (souvent en bas de facture après les sous-totaux)
      const lastMatch = matches[matches.length - 1];
      const candidate = normalizeExtractedAmount(lastMatch[1]);
      if (candidate !== null) {
        extractedAmount = candidate;
        break;
      }
    }
  }

  // Priorité B : Montant précédé ou suivi explicitement de CHF / EUR
  if (extractedAmount === null) {
    const currencyMatches = [
      ...text.matchAll(
        /(?:CHF|EUR)\s*([0-9]{1,3}(?:['’\s][0-9]{3})*(?:[.,][0-9]{2}|[.,][-—–])|[0-9]+(?:[.,][0-9]{2}|[.,][-—–]))/gi
      ),
      ...text.matchAll(
        /([0-9]{1,3}(?:['’\s][0-9]{3})*(?:[.,][0-9]{2}|[.,][-—–])|[0-9]+(?:[.,][0-9]{2}|[.,][-—–]))\s*(?:CHF|EUR)/gi
      ),
    ];
    if (currencyMatches.length > 0) {
      const amounts = currencyMatches
        .map((m) => normalizeExtractedAmount(m[1]))
        .filter((n): n is number => n !== null);
      if (amounts.length > 0) {
        extractedAmount = Math.max(...amounts);
      }
    }
  }

  return {
    extractedDate,
    extractedAmount,
    merchantName,
  };
};

/**
 * Parse la réponse JSON renvoyée par Gemini Vision (avec ou sans balises Markdown ```json).
 */
export const parseGeminiJsonOutput = (
  rawOutput?: string | null
): {
  extractedDate: string | null;
  extractedAmount: number | null;
  merchantName: string | null;
} => {
  if (typeof rawOutput !== 'string' || !rawOutput.trim()) {
    return { extractedDate: null, extractedAmount: null, merchantName: null };
  }

  const cleaned = rawOutput
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const jsonBraceMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidateJson = jsonBraceMatch ? jsonBraceMatch[0] : cleaned;

  try {
    const parsed = JSON.parse(candidateJson) as Record<string, unknown>;
    const rawDate = parsed.extractedDate ?? parsed.date ?? null;
    const rawAmount = parsed.extractedAmount ?? parsed.amount ?? parsed.total ?? null;
    const rawMerchant = parsed.merchantName ?? parsed.merchant ?? parsed.vendor ?? null;

    return {
      extractedDate: normalizeExtractedDate(rawDate),
      extractedAmount: normalizeExtractedAmount(rawAmount),
      merchantName: normalizeMerchantName(rawMerchant),
    };
  } catch {
    // Fallback si le modèle a répondu en texte libre au lieu d'un JSON strict
    return extractFieldsFromPdfText(cleaned);
  }
};

/**
 * Exécute une promesse avec un délai maximum (`EXTRACTION_TIMEOUT_MS` = 8000ms par défaut).
 */
export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = EXTRACTION_TIMEOUT_MS
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('EXTRACTION_TIMEOUT'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};
