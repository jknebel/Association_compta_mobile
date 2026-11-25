const scopeStorageKey = (baseKey: string, uid?: string | null): string => {
  const cleanUid = typeof uid === 'string' ? uid.trim() : '';
  return cleanUid ? `${baseKey}_${cleanUid}` : baseKey;
};

export type ExpenseTypeChoice = 'DEBIT_CARD' | 'REIMBURSEMENT';

export const SAVED_IBAN_STORAGE_KEY = 'asso_compta_saved_iban_v1';
export const SAVED_NPA_STORAGE_KEY = 'asso_compta_saved_npa_v1';
export const SAVED_CITY_STORAGE_KEY = 'asso_compta_saved_city_v1';

export interface VerifiedReceiptFormInput {
  comptaId?: string | null;
  expenseType?: ExpenseTypeChoice | string | null;
  amountInput?: string | number | null;
  dateInput?: string | null;
  merchantName?: string | null;
  description?: string | null;
  reimbursementIban?: string | null;
  reimbursementNpa?: string | null;
  reimbursementCity?: string | null;
}

export interface VerifiedReceiptPayload {
  comptaId: string;
  expenseType: ExpenseTypeChoice;
  extractedAmount: number;
  extractedDate: string;
  merchantName: string;
  description: string;
  reimbursementIban?: string;
  reimbursementNpa?: string;
  reimbursementCity?: string;
}

export interface VerificationFieldErrors {
  comptaId?: string;
  expenseType?: string;
  amount?: string;
  date?: string;
  iban?: string;
  npa?: string;
  city?: string;
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
 * Un IBAN vide retourne `true` pour la vérification de format seul (l'obligation en cas de remboursement est vérifiée par `validateVerifiedReceiptForm`).
 */
export const isValidIbanFormat = (rawIban?: string | null): boolean => {
  const compact = typeof rawIban === 'string' ? rawIban.replace(/[\s-]+/g, '').toUpperCase() : '';
  if (!compact) return true;
  if (compact.length < 15 || compact.length > 34) return false;
  return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(compact);
};

/**
 * Normalise un NPA / code postal (suppression des espaces superflus, majuscules).
 */
export const normalizeNpa = (rawNpa?: string | null): string => {
  if (typeof rawNpa !== 'string') return '';
  return rawNpa.trim().replace(/\s+/g, ' ').toUpperCase().slice(0, 12);
};

/**
 * Vérifie qu'un NPA / code postal est valide (ex. 4 chiffres suisses `1000` ou code postal européen de 4 à 10 caractères alphanumériques).
 */
export const isValidNpaFormat = (rawNpa?: string | null): boolean => {
  const clean = normalizeNpa(rawNpa);
  if (!clean) return false;
  const compact = clean.replace(/[\s-]+/g, '');
  if (compact.length < 4 || compact.length > 10) return false;
  return /^[A-Z0-9][A-Z0-9 -]*[A-Z0-9]$/.test(clean);
};

/**
 * Normalise un nom de ville (trim et espaces simples).
 */
export const normalizeCity = (rawCity?: string | null): string => {
  if (typeof rawCity !== 'string') return '';
  return rawCity.trim().replace(/\s+/g, ' ').slice(0, 80);
};

/**
 * Vérifie qu'un nom de ville est renseigné (au moins 2 caractères).
 */
export const isValidCityFormat = (rawCity?: string | null): boolean => {
  const clean = normalizeCity(rawCity);
  return clean.length >= 2;
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
  const formattedNpa = normalizeNpa(input?.reimbursementNpa);
  const formattedCity = normalizeCity(input?.reimbursementCity);

  if (validExpenseType === 'REIMBURSEMENT') {
    if (!formattedIban) {
      errors.iban = "Veuillez saisir votre IBAN (obligatoire pour les paiements bancaires).";
    } else if (!isValidIbanFormat(formattedIban)) {
      errors.iban = "Le format de l'IBAN est invalide (exemple attendu : CH93 0076 2011 6238 5295 7).";
    }

    if (!formattedNpa) {
      errors.npa = 'Veuillez saisir votre NPA (obligatoire pour les paiements bancaires).';
    } else if (!isValidNpaFormat(formattedNpa)) {
      errors.npa = 'Le format du NPA est invalide (exemple attendu : 1000).';
    }

    if (!isValidCityFormat(formattedCity)) {
      errors.city = 'Veuillez saisir votre ville (obligatoire pour les paiements bancaires).';
    }
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
    ...(validExpenseType === 'REIMBURSEMENT' && formattedNpa
      ? { reimbursementNpa: formattedNpa }
      : {}),
    ...(validExpenseType === 'REIMBURSEMENT' && formattedCity
      ? { reimbursementCity: formattedCity }
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
 * Récupère l'IBAN mémorisé localement sur l'appareil (localStorage), isolé par uid si fourni.
 */
export const getSavedIbanFromStorage = (
  storage?: Storage | null,
  uid?: string | null
): string => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return '';
    return normalizeIban(s.getItem(scopeStorageKey(SAVED_IBAN_STORAGE_KEY, uid)));
  } catch {
    return '';
  }
};

/**
 * Mémorise l'IBAN localement sur l'appareil pour éviter la re-saisie lors des prochains remboursements.
 */
export const saveIbanToStorage = (
  iban: string,
  storage?: Storage | null,
  uid?: string | null
): void => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return;
    const key = scopeStorageKey(SAVED_IBAN_STORAGE_KEY, uid);
    const normalized = normalizeIban(iban);
    if (normalized) {
      s.setItem(key, normalized);
    } else {
      s.removeItem(key);
    }
  } catch {
    // Ignorer les erreurs de stockage privé
  }
};

/**
 * Récupère le NPA mémorisé localement sur l'appareil (localStorage), isolé par uid si fourni.
 */
export const getSavedNpaFromStorage = (
  storage?: Storage | null,
  uid?: string | null
): string => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return '';
    return normalizeNpa(s.getItem(scopeStorageKey(SAVED_NPA_STORAGE_KEY, uid)));
  } catch {
    return '';
  }
};

/**
 * Mémorise le NPA localement sur l'appareil pour éviter la re-saisie lors des prochains remboursements.
 */
export const saveNpaToStorage = (
  npa: string,
  storage?: Storage | null,
  uid?: string | null
): void => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return;
    const key = scopeStorageKey(SAVED_NPA_STORAGE_KEY, uid);
    const normalized = normalizeNpa(npa);
    if (normalized) {
      s.setItem(key, normalized);
    } else {
      s.removeItem(key);
    }
  } catch {
    // Ignorer les erreurs de stockage privé
  }
};

/**
 * Récupère la ville mémorisée localement sur l'appareil (localStorage), isolée par uid si fourni.
 */
export const getSavedCityFromStorage = (
  storage?: Storage | null,
  uid?: string | null
): string => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return '';
    return normalizeCity(s.getItem(scopeStorageKey(SAVED_CITY_STORAGE_KEY, uid)));
  } catch {
    return '';
  }
};

/**
 * Mémorise la ville localement sur l'appareil pour éviter la re-saisie lors des prochains remboursements.
 */
export const saveCityToStorage = (
  city: string,
  storage?: Storage | null,
  uid?: string | null
): void => {
  try {
    const s =
      storage !== undefined
        ? storage
        : typeof localStorage !== 'undefined'
        ? localStorage
        : null;
    if (!s) return;
    const key = scopeStorageKey(SAVED_CITY_STORAGE_KEY, uid);
    const normalized = normalizeCity(city);
    if (normalized) {
      s.setItem(key, normalized);
    } else {
      s.removeItem(key);
    }
  } catch {
    // Ignorer les erreurs de stockage privé
  }
};
