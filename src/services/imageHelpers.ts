export type ReceiptFileKind = 'image' | 'pdf' | 'unsupported';

export const MAX_IMAGE_DIMENSION = 1600;
export const DEFAULT_JPEG_QUALITY = 0.75;
export const TARGET_MAX_IMAGE_BYTES = 400 * 1024; // 400 Ko cible après compression
export const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo max pour un PDF
export const MAX_RAW_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20 Mo max avant compression

export const SUPPORTED_IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export const SUPPORTED_IMAGE_EXTENSIONS: readonly string[] = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
];

export interface FileLikeMetadata {
  name?: string | null;
  type?: string | null;
  size?: number | null;
}

export interface ReceiptFileValidationResult {
  valid: boolean;
  kind: ReceiptFileKind;
  error: string | null;
}

export interface TargetDimensions {
  width: number;
  height: number;
  resized: boolean;
}

/**
 * Détecte la nature du fichier justificatif (`'image'`, `'pdf'` ou `'unsupported'`)
 * à partir de son type MIME et/ou de l'extension de son nom de fichier.
 */
export const detectReceiptFileKind = (
  mimeType?: string | null,
  fileName?: string | null
): ReceiptFileKind => {
  const normMime = typeof mimeType === 'string' ? mimeType.trim().toLowerCase() : '';
  const normName = typeof fileName === 'string' ? fileName.trim().toLowerCase() : '';

  if (normMime === 'application/pdf' || normName.endsWith('.pdf')) {
    return 'pdf';
  }

  if (SUPPORTED_IMAGE_MIME_TYPES.includes(normMime)) {
    return 'image';
  }

  if (SUPPORTED_IMAGE_EXTENSIONS.some((ext) => normName.endsWith(ext))) {
    return 'image';
  }

  return 'unsupported';
};

/**
 * Valide un fichier sélectionné ou glissé-déposé (Photo ou Facture PDF).
 */
export const validateReceiptFile = (
  file?: FileLikeMetadata | null
): ReceiptFileValidationResult => {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    return {
      valid: false,
      kind: 'unsupported',
      error: 'Le fichier sélectionné est vide ou invalide.',
    };
  }

  const kind = detectReceiptFileKind(file.type, file.name);

  if (kind === 'unsupported') {
    return {
      valid: false,
      kind: 'unsupported',
      error:
        'Format de fichier non supporté. Veuillez choisir une photo (JPG, PNG, WebP) ou une facture PDF.',
    };
  }

  if (kind === 'pdf' && file.size > MAX_PDF_SIZE_BYTES) {
    return {
      valid: false,
      kind: 'pdf',
      error: 'La facture PDF dépasse la taille maximale autorisée de 5 Mo.',
    };
  }

  if (kind === 'image' && file.size > MAX_RAW_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      kind: 'image',
      error: "L'image sélectionnée dépasse la taille maximale autorisée de 20 Mo.",
    };
  }

  return {
    valid: true,
    kind,
    error: null,
  };
};

/**
 * Calcule les dimensions cibles (largeur / hauteur) en conservant le ratio d'aspect
 * pour qu'aucun côté ne dépasse `maxDimension` (1600px par défaut).
 */
export const calculateTargetDimensions = (
  width: number,
  height: number,
  maxDimension: number = MAX_IMAGE_DIMENSION
): TargetDimensions => {
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return { width: 1, height: 1, resized: false };
  }

  const safeMax = maxDimension > 0 ? maxDimension : MAX_IMAGE_DIMENSION;

  if (width <= safeMax && height <= safeMax) {
    return {
      width: Math.round(width),
      height: Math.round(height),
      resized: false,
    };
  }

  if (width >= height) {
    const ratio = safeMax / width;
    return {
      width: safeMax,
      height: Math.max(1, Math.round(height * ratio)),
      resized: true,
    };
  }

  const ratio = safeMax / height;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: safeMax,
    resized: true,
  };
};

/**
 * Formate une taille en octets en chaîne lisible en français (ex: "245 Ko", "1.4 Mo").
 */
export const formatFileSize = (bytes: number): string => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return '0 o';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} o`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} Ko`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} Mo`;
};

/**
 * Normalise le nom du fichier pour le stockage (extension `.jpg` pour une image compressée,
 * `.pdf` pour une facture PDF).
 */
export const normalizeCompressedFileName = (
  originalName?: string | null,
  kind: 'image' | 'pdf' = 'image'
): string => {
  const raw = typeof originalName === 'string' ? originalName.trim() : '';
  const baseWithoutExt = raw
    ? raw.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
    : '';
  const safeBase = baseWithoutExt || (kind === 'pdf' ? 'facture' : 'ticket');
  return kind === 'pdf' ? `${safeBase}.pdf` : `${safeBase}.jpg`;
};
