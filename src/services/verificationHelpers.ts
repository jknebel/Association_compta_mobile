export type ExpenseTypeChoice = 'DEBIT_CARD' | 'REIMBURSEMENT';

export const SAVED_IBAN_STORAGE_KEY = 'asso_compta_saved_iban_v1';

export interface VerifiedReceiptFormInput {
  comptaId?: string | null;
  expenseType?: ExpenseTypeChoice | string | null;
  amountInput?: string | number | null;
  dateInput?: string | null;
  merchantName?: string | null;
  description?: string | null;
  reimbursementIban?: string | null;
}

export interface VerifiedReceiptPayload {
  comptaId: string;
  expenseType: ExpenseTypeChoice;
  extractedAmount: number;
  extractedDate: string;
  merchantName: string;
  description: string;
  reimbursementIban?: string;
}

export interface VerificationFieldErrors {
  comptaId?: string;
  expenseType?: string;
  amount?: string;
  date?: string;
  iban?: string;
}

export interface ReceiptVerificationResult {
  valid: boolean;
  errors: VerificationFieldErrors;
  firstError: string | null;
  payload: VerifiedReceiptPayload | null;
}

/**
 * Formate un IBAN en majuscules par blocs de 4 caractères (ex: `CH93 0076 2011 6238 5295 7`).
 */
export const normalizeIban = (rawIban?: string | null): string => {
  if (typeof rawIban !== 'string') return '';
  const compact = rawIban.replace(/[\s-]+/g, '').toUpperCase();
  if (!compact) return '';
  return compact.replace(/(.{4})/g, '$1 ').trim();
};

/**
 * Vérifie si un IBAN saisi respecte la structure ISO 13616 (code pays 2 lettres + 2 chiffres clé + 11 à 30 caractères alphanumériques).
 * Un IBAN vide retourne `true` (car optionnel si le caissier connaît déjà les coordonnées du membre).
 */
export const isValidIbanFormat = (rawIban?: string | null): boolean => {
  const compact = typeof rawIban === 'string' ? rawIban.replace(/[\s-]+/g, '').toUpperCase() : '';
  if (!compact) return true;
  if (compact.length < 15 || compact.length > 34) return false;
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(compact);
};

/**
 * Analyse une saisie de montant TTC (nombre ou chaîne avec point ou virgule)
 * et retourne un nombre strictement positif arrondi à 2 décimales, ou `null` si invalide.
 */
export const parsePositiveAmountInput = (rawAmount?: string | number | null): number | null => {
  if (typeof rawAmount === 'number') {
    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 1_000_000) {
      return null;
    }
    return Math.round(rawAmount * 100) / 100;
  }

  if (typeof rawAmount !== 'string') return null;
  const cleaned = rawAmount
    .trim()
    .replace(/['’`\s\u00A0]/g, '')
    .replace(',', '.');

  if (!cleaned || !/^\d+(?:\.\d{1,4})?$/.test(cleaned)) {
    return null;
  }

  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
};

/**
 * Vérifie qu'une chaîne correspond à une date calendrier valide au format `YYYY-MM-DD`.
 */
export const isValidIsoDateInput = (rawDate?: string | null): boolean => {
  if (typeof rawDate !== 'string') return false;
  const match = rawDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (year < 1990 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonths = [
    31,
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonths[month - 1];
};

/**
 * Valide l'ensemble du formulaire de vérification utilisateur (Ticket MOB-06)
 * avant d'autoriser l'envoi vers la comptabilité cible.
 */
export const validateVerifiedReceiptForm = (
  input: VerifiedReceiptFormInput
): ReceiptVerificationResult => {
  const errors: VerificationFieldErrors = {};

  const comptaId = typeof input?.comptaId === 'string' ? input.comptaId.trim() : '';
  if (!comptaId) {
    errors.comptaId = 'Veuillez sélectionner une comptabilité cible.';
  }

  const rawType = typeof input?.expenseType === 'string' ? input.expenseType.trim() : '';
  const validExpenseType: ExpenseTypeChoice | null =
    rawType === 'DEBIT_CARD' || rawType === 'REIMBURSEMENT' ? rawType : null;
  if (!validExpenseType) {
    errors.expenseType =
      'Veuillez choisir le type de dépense (Carte de débit ou Demande de remboursement).';
  }

  const parsedAmount = parsePositiveAmountInput(input?.amountInput);
  if (parsedAmount === null) {
    errors.amount = 'Veuillez saisir un montant TTC valide supérieur à 0.';
  }

  const cleanDate = typeof input?.dateInput === 'string' ? input.dateInput.trim() : '';
  if (!isValidIsoDateInput(cleanDate)) {
    errors.date = 'Veuillez vérifier ou saisir une date de facture valide (AAAA-MM-JJ).';
  }

  const formattedIban = normalizeIban(input?.reimbursementIban);
  if (validExpenseType === 'REIMBURSEMENT' && formattedIban && !isValidIbanFormat(formattedIban)) {
    errors.iban = "Le format de l'IBAN est invalide (exemple attendu : CH93 0076 2011 6238 5295 7).";
  }

  const errorList = Object.values(errors).filter((msg): msg is string => Boolean(msg));
  if (errorList.length > 0 || !validExpenseType || parsedAmount === null) {
    return {
      valid: false,
      errors,
      firstError: errorList[0] ?? 'Formulaire incomplet.',
      payload: null,
    };
  }

  const cleanMerchant =
    typeof input?.merchantName === 'string' ? input.merchantName.trim().slice(0, 80) : '';
  const cleanDescription =
    typeof input?.description === 'string' ? input.description.trim().slice(0, 240) : '';

  const payload: VerifiedReceiptPayload = {
    comptaId,
    expenseType: validExpenseType,
    extractedAmount: parsedAmount,
    extractedDate: cleanDate,
    merchantName: cleanMerchant,
    description: cleanDescription,
    ...(validExpenseType === 'REIMBURSEMENT' && formattedIban
      ? { reimbursementIban: formattedIban }
      : {}),
  };

  return {
    valid: true,
    errors: {},
    firstError: null,
    payload,
  };
};

/**
 * Récupère l'IBAN mémorisé localement sur l'appareil (localStorage).
 */
export const getSavedIbanFromStorage = (storage?: Storage | null): string => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return '';
    return normalizeIban(s.getItem(SAVED_IBAN_STORAGE_KEY));
  } catch {
    return '';
  }
};

/**
 * Mémorise l'IBAN localement sur l'appareil pour éviter la re-saisie lors des prochains remboursements.
 */
export const saveIbanToStorage = (iban: string, storage?: Storage | null): void => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return;
    const normalized = normalizeIban(iban);
    if (normalized) {
      s.setItem(SAVED_IBAN_STORAGE_KEY, normalized);
    } else {
      s.removeItem(SAVED_IBAN_STORAGE_KEY);
    }
  } catch {
    // Ignorer les erreurs de stockage privé
  }
};
