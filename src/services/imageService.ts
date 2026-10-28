import {
  DEFAULT_JPEG_QUALITY,
  MAX_IMAGE_DIMENSION,
  TARGET_MAX_IMAGE_BYTES,
  calculateTargetDimensions,
  detectReceiptFileKind,
  formatFileSize,
  normalizeCompressedFileName,
  validateReceiptFile,
  type ReceiptFileKind,
  type ReceiptFileValidationResult,
  type TargetDimensions,
} from './imageHelpers';

export {
  DEFAULT_JPEG_QUALITY,
  MAX_IMAGE_DIMENSION,
  TARGET_MAX_IMAGE_BYTES,
  calculateTargetDimensions,
  detectReceiptFileKind,
  formatFileSize,
  normalizeCompressedFileName,
  validateReceiptFile,
  type ReceiptFileKind,
  type ReceiptFileValidationResult,
  type TargetDimensions,
};

export interface PreparedReceiptFile {
  file: File;
  kind: 'image' | 'pdf';
  previewUrl: string;
  originalName: string;
  normalizedName: string;
  originalSizeBytes: number;
  finalSizeBytes: number;
  width?: number;
  height?: number;
  wasCompressed: boolean;
}

/**
 * Charge un fichier image dans un élément HTMLImageElement afin de pouvoir le dessiner dans un Canvas.
 */
const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de décoder l'image sélectionnée."));
    };
    img.src = objectUrl;
  });
};

/**
 * Exporte un HTMLCanvasElement en Blob JPEG selon la qualité demandée.
 */
const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Échec de la compression JPEG du justificatif.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
};

/**
 * Compresse automatiquement une photo de ticket côté client :
 * - Redimensionne à max 1600px de largeur/hauteur en préservant le ratio
 * - Encode en JPEG (qualité 0.75 par défaut, ajustée à 0.60 si le résultat dépasse 400 Ko)
 */
export const compressImageFile = async (
  file: File,
  maxDimension: number = MAX_IMAGE_DIMENSION,
  initialQuality: number = DEFAULT_JPEG_QUALITY
): Promise<PreparedReceiptFile> => {
  const img = await loadImageFromFile(file);
  const naturalWidth = img.naturalWidth || img.width || 1200;
  const naturalHeight = img.naturalHeight || img.height || 1600;

  const { width, height } = calculateTargetDimensions(naturalWidth, naturalHeight, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexte graphique 2D indisponible pour la compression.');
  }

  // Fond blanc pour éviter les zones noires sur les PNG transparents convertis en JPEG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let blob = await canvasToJpegBlob(canvas, initialQuality);

  // Si l'image compressée dépasse encore 400 Ko, seconde passe avec qualité réduite (0.58)
  if (blob.size > TARGET_MAX_IMAGE_BYTES && initialQuality > 0.58) {
    blob = await canvasToJpegBlob(canvas, 0.58);
  }

  const normalizedName = normalizeCompressedFileName(file.name, 'image');
  const compressedFile = new File([blob], normalizedName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

  const previewUrl = URL.createObjectURL(compressedFile);

  return {
    file: compressedFile,
    kind: 'image',
    previewUrl,
    originalName: file.name || normalizedName,
    normalizedName,
    originalSizeBytes: file.size,
    finalSizeBytes: compressedFile.size,
    width,
    height,
    wasCompressed: true,
  };
};

/**
 * Valide et prépare un justificatif (Photo ou Facture PDF) :
 * - Si c'est une image : la compresse via Canvas (< 400 Ko, max 1600px, JPEG 0.75)
 * - Si c'est un PDF : vérifie la limite de 5 Mo et génère l'URL de prévisualisation
 */
export const prepareReceiptFile = async (file: File): Promise<PreparedReceiptFile> => {
  const validation = validateReceiptFile({
    name: file?.name,
    type: file?.type,
    size: file?.size,
  });

  if (!validation.valid || validation.kind === 'unsupported') {
    throw new Error(validation.error || 'Fichier justificatif invalide.');
  }

  if (validation.kind === 'pdf') {
    const normalizedName = normalizeCompressedFileName(file.name, 'pdf');
    const previewUrl = URL.createObjectURL(file);
    return {
      file,
      kind: 'pdf',
      previewUrl,
      originalName: file.name || normalizedName,
      normalizedName,
      originalSizeBytes: file.size,
      finalSizeBytes: file.size,
      wasCompressed: false,
    };
  }

  return compressImageFile(file);
};
