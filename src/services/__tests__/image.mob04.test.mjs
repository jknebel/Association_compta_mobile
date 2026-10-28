import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_IMAGE_DIMENSION,
  MAX_PDF_SIZE_BYTES,
  MAX_RAW_IMAGE_SIZE_BYTES,
  detectReceiptFileKind,
  validateReceiptFile,
  calculateTargetDimensions,
  formatFileSize,
  normalizeCompressedFileName,
} from '../imageHelpers.ts';

describe('[MOB-04] imageHelpers Unit & Integration Tests', () => {
  describe('detectReceiptFileKind()', () => {
    it('detects PDF from MIME type or .pdf extension (case-insensitive)', () => {
      assert.strictEqual(detectReceiptFileKind('application/pdf', 'document.bin'), 'pdf');
      assert.strictEqual(detectReceiptFileKind('  APPLICATION/PDF ', ''), 'pdf');
      assert.strictEqual(detectReceiptFileKind('', 'Facture_Migros.PDF'), 'pdf');
    });

    it('detects image from supported MIME types', () => {
      assert.strictEqual(detectReceiptFileKind('image/jpeg', 'file'), 'image');
      assert.strictEqual(detectReceiptFileKind('image/png', 'file'), 'image');
      assert.strictEqual(detectReceiptFileKind('image/webp', 'file'), 'image');
      assert.strictEqual(detectReceiptFileKind('image/heic', 'file'), 'image');
      assert.strictEqual(detectReceiptFileKind('image/heif', 'file'), 'image');
    });

    it('detects image from file extension when MIME type is empty', () => {
      assert.strictEqual(detectReceiptFileKind('', 'ticket.jpg'), 'image');
      assert.strictEqual(detectReceiptFileKind('', 'ticket.JPEG'), 'image');
      assert.strictEqual(detectReceiptFileKind('', 'ticket.png'), 'image');
      assert.strictEqual(detectReceiptFileKind('', 'ticket.webp'), 'image');
      assert.strictEqual(detectReceiptFileKind('', 'photo.HEIC'), 'image');
    });

    it('returns unsupported for unknown MIME types and extensions', () => {
      assert.strictEqual(detectReceiptFileKind('application/msword', 'doc.docx'), 'unsupported');
      assert.strictEqual(detectReceiptFileKind('text/plain', 'notes.txt'), 'unsupported');
      assert.strictEqual(detectReceiptFileKind('', ''), 'unsupported');
      assert.strictEqual(detectReceiptFileKind(null, null), 'unsupported');
    });
  });

  describe('validateReceiptFile()', () => {
    it('accepts valid image within size limit', () => {
      const res = validateReceiptFile({
        name: 'ticket.jpg',
        type: 'image/jpeg',
        size: 2 * 1024 * 1024,
      });
      assert.deepStrictEqual(res, {
        valid: true,
        kind: 'image',
        error: null,
      });
    });

    it('accepts valid PDF up to 5 MB (MAX_PDF_SIZE_BYTES)', () => {
      const res = validateReceiptFile({
        name: 'facture.pdf',
        type: 'application/pdf',
        size: MAX_PDF_SIZE_BYTES,
      });
      assert.deepStrictEqual(res, {
        valid: true,
        kind: 'pdf',
        error: null,
      });
    });

    it('rejects PDF exceeding 5 MB', () => {
      const res = validateReceiptFile({
        name: 'grosse-facture.pdf',
        type: 'application/pdf',
        size: MAX_PDF_SIZE_BYTES + 1,
      });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.kind, 'pdf');
      assert.ok(res.error?.includes('5 Mo'));
    });

    it('rejects raw image exceeding 20 MB', () => {
      const res = validateReceiptFile({
        name: 'raw-photo.png',
        type: 'image/png',
        size: MAX_RAW_IMAGE_SIZE_BYTES + 1,
      });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.kind, 'image');
      assert.ok(res.error?.includes('20 Mo'));
    });

    it('rejects empty or null file', () => {
      assert.strictEqual(validateReceiptFile(null).valid, false);
      assert.strictEqual(validateReceiptFile({ name: 'a.jpg', type: 'image/jpeg', size: 0 }).valid, false);
      assert.strictEqual(validateReceiptFile({ name: 'a.jpg', type: 'image/jpeg', size: -10 }).valid, false);
    });

    it('rejects unsupported file format with explicit French message', () => {
      const res = validateReceiptFile({
        name: 'tableau.xlsx',
        type: 'application/vnd.ms-excel',
        size: 10240,
      });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.kind, 'unsupported');
      assert.ok(res.error?.includes('Format de fichier non supporté'));
    });
  });

  describe('calculateTargetDimensions()', () => {
    it('keeps original dimensions when both width and height are <= maxDimension (1600)', () => {
      const res = calculateTargetDimensions(1200, 900, MAX_IMAGE_DIMENSION);
      assert.deepStrictEqual(res, {
        width: 1200,
        height: 900,
        resized: false,
      });
    });

    it('scales down landscape image proportionally when width > maxDimension', () => {
      const res = calculateTargetDimensions(3200, 2400, 1600);
      assert.deepStrictEqual(res, {
        width: 1600,
        height: 1200,
        resized: true,
      });
    });

    it('scales down portrait receipt image proportionally when height > maxDimension', () => {
      const res = calculateTargetDimensions(1500, 3000, 1600);
      assert.deepStrictEqual(res, {
        width: 800,
        height: 1600,
        resized: true,
      });
    });

    it('handles invalid or zero dimensions gracefully', () => {
      assert.deepStrictEqual(calculateTargetDimensions(0, 100), {
        width: 1,
        height: 1,
        resized: false,
      });
      assert.deepStrictEqual(calculateTargetDimensions(-50, 200), {
        width: 1,
        height: 1,
        resized: false,
      });
    });
  });

  describe('formatFileSize()', () => {
    it('formats bytes, kilobytes, and megabytes in French units', () => {
      assert.strictEqual(formatFileSize(512), '512 o');
      assert.strictEqual(formatFileSize(250 * 1024), '250 Ko');
      assert.strictEqual(formatFileSize(1.5 * 1024 * 1024), '1.5 Mo');
    });

    it('returns "0 o" for negative or NaN values', () => {
      assert.strictEqual(formatFileSize(-1), '0 o');
      assert.strictEqual(formatFileSize(NaN), '0 o');
    });
  });

  describe('normalizeCompressedFileName()', () => {
    it('converts image extensions to .jpg and sanitizes special characters', () => {
      assert.strictEqual(
        normalizeCompressedFileName('Ticket Coop 2026 (1).PNG', 'image'),
        'Ticket_Coop_2026_1.jpg'
      );
    });

    it('preserves .pdf extension for PDF invoices', () => {
      assert.strictEqual(
        normalizeCompressedFileName('Facture Swisscom #42.pdf', 'pdf'),
        'Facture_Swisscom_42.pdf'
      );
    });

    it('provides fallback base names when originalName is empty', () => {
      assert.strictEqual(normalizeCompressedFileName('', 'image'), 'ticket.jpg');
      assert.strictEqual(normalizeCompressedFileName(null, 'pdf'), 'facture.pdf');
    });
  });
});
