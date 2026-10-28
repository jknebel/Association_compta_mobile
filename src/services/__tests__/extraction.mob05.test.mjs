import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeExtractedDate,
  normalizeExtractedAmount,
  normalizeMerchantName,
  hasReadablePdfTextLayer,
  extractFieldsFromPdfText,
  parseGeminiJsonOutput,
  withTimeout,
} from '../extractionHelpers.ts';

import {
  decodePdfLiteralString,
  extractTextOperatorsFromPdfChunk,
  extractTextFromPdfBuffer,
} from '../pdfTextExtractor.ts';

describe('[MOB-05] extractionHelpers & pdfTextExtractor Unit & Integration Tests', () => {
  describe('normalizeExtractedDate()', () => {
    it('normalizes ISO dates YYYY-MM-DD and YYYY/MM/DD', () => {
      assert.strictEqual(normalizeExtractedDate('2026-10-15'), '2026-10-15');
      assert.strictEqual(normalizeExtractedDate('2026/03/05'), '2026-03-05');
    });

    it('normalizes Swiss and European dates DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY', () => {
      assert.strictEqual(normalizeExtractedDate('15.10.2026'), '2026-10-15');
      assert.strictEqual(normalizeExtractedDate('03/04/2026'), '2026-04-03');
      assert.strictEqual(normalizeExtractedDate('28-02-2026'), '2026-02-28');
    });

    it('normalizes 2-digit year dates DD.MM.YY', () => {
      assert.strictEqual(normalizeExtractedDate('15.10.26'), '2026-10-15');
      assert.strictEqual(normalizeExtractedDate('12.05.98'), '1998-05-12');
    });

    it('normalizes French literal dates ("15 octobre 2026", "3 janv. 2026")', () => {
      assert.strictEqual(normalizeExtractedDate('Facture du 15 octobre 2026'), '2026-10-15');
      assert.strictEqual(normalizeExtractedDate('Le 3 janv. 2026'), '2026-01-03');
      assert.strictEqual(normalizeExtractedDate('12 février 2026'), '2026-02-12');
    });

    it('rejects invalid calendar dates (e.g. Feb 30, month 13, month 0) or non-date strings', () => {
      assert.strictEqual(normalizeExtractedDate('2026-02-30'), null);
      assert.strictEqual(normalizeExtractedDate('2026-13-10'), null);
      assert.strictEqual(normalizeExtractedDate('2026-00-10'), null);
      assert.strictEqual(normalizeExtractedDate('32.01.2026'), null);
      assert.strictEqual(normalizeExtractedDate('texte sans date'), null);
      assert.strictEqual(normalizeExtractedDate(''), null);
      assert.strictEqual(normalizeExtractedDate(null), null);
    });
  });

  describe('normalizeExtractedAmount()', () => {
    it('accepts valid positive numbers and rounds to 2 decimals', () => {
      assert.strictEqual(normalizeExtractedAmount(42.5), 42.5);
      assert.strictEqual(normalizeExtractedAmount(142.567), 142.57);
    });

    it('parses formatted strings with CHF, thousands apostrophes, comma decimals, and Swiss .-', () => {
      assert.strictEqual(normalizeExtractedAmount("CHF 1'240.50"), 1240.5);
      assert.strictEqual(normalizeExtractedAmount('142,80 EUR'), 142.8);
      assert.strictEqual(normalizeExtractedAmount('CHF 85.-'), 85);
      assert.strictEqual(normalizeExtractedAmount('1,250.75'), 1250.75);
    });

    it('rejects zero, negative, NaN, excessive (> 1,000,000) or non-numeric values', () => {
      assert.strictEqual(normalizeExtractedAmount(0), null);
      assert.strictEqual(normalizeExtractedAmount(-15.5), null);
      assert.strictEqual(normalizeExtractedAmount(2_000_000), null);
      assert.strictEqual(normalizeExtractedAmount('aucun montant'), null);
      assert.strictEqual(normalizeExtractedAmount(null), null);
    });
  });

  describe('normalizeMerchantName()', () => {
    it('trims and normalizes valid merchant names', () => {
      assert.strictEqual(normalizeMerchantName('  Migros   Genève  '), 'Migros Genève');
      assert.strictEqual(normalizeMerchantName('Boulangerie de la Gare Sàrl'), 'Boulangerie de la Gare Sàrl');
    });

    it('rejects generic document labels ("Facture", "Ticket", "Reçu") or empty values', () => {
      assert.strictEqual(normalizeMerchantName('Facture'), null);
      assert.strictEqual(normalizeMerchantName('Ticket'), null);
      assert.strictEqual(normalizeMerchantName('Reçu'), null);
      assert.strictEqual(normalizeMerchantName(' '), null);
      assert.strictEqual(normalizeMerchantName(null), null);
    });
  });

  describe('hasReadablePdfTextLayer()', () => {
    it('returns true when extracted PDF text has at least 20 chars and 3 words', () => {
      assert.strictEqual(
        hasReadablePdfTextLayer('Migros Genève - Facture du 15.10.2026 Total TTC CHF 48.90'),
        true
      );
    });

    it('returns false for empty or tiny noise strings from scanned PDFs', () => {
      assert.strictEqual(hasReadablePdfTextLayer(''), false);
      assert.strictEqual(hasReadablePdfTextLayer('   '), false);
      assert.strictEqual(hasReadablePdfTextLayer('abc 12'), false);
      assert.strictEqual(hasReadablePdfTextLayer(null), false);
    });
  });

  describe('extractFieldsFromPdfText()', () => {
    it('extracts date, Total TTC amount, and known merchant from a digital invoice text', () => {
      const invoiceText = `
        FACTURE N° 2026-9941
        Fournisseur : Swisscom (Suisse) SA
        Date de facture : 18.10.2026
        Sous-total HT : CHF 80.00
        TVA 8.1% : CHF 6.48
        Total TTC : CHF 86.48
      `;
      const result = extractFieldsFromPdfText(invoiceText);
      assert.deepStrictEqual(result, {
        extractedDate: '2026-10-18',
        extractedAmount: 86.48,
        merchantName: 'Swisscom',
      });
    });

    it('extracts company with Sàrl/SA and CHF fallback amount when "Total" keyword is absent', () => {
      const receiptText = `
        Imprimerie du Léman Sàrl
        Lausanne, le 5 novembre 2026
        Affiches camp scout : 145.00 CHF
      `;
      const result = extractFieldsFromPdfText(receiptText);
      assert.deepStrictEqual(result, {
        extractedDate: '2026-11-05',
        extractedAmount: 145,
        merchantName: 'Imprimerie du Léman Sàrl',
      });
    });

    it('returns nulls for empty input', () => {
      assert.deepStrictEqual(extractFieldsFromPdfText(''), {
        extractedDate: null,
        extractedAmount: null,
        merchantName: null,
      });
    });
  });

  describe('parseGeminiJsonOutput()', () => {
    it('parses JSON wrapped in ```json markdown code fences', () => {
      const raw = '```json\n{"extractedDate": "2026-10-21", "extractedAmount": 64.90, "merchantName": "Coop"}\n```';
      assert.deepStrictEqual(parseGeminiJsonOutput(raw), {
        extractedDate: '2026-10-21',
        extractedAmount: 64.9,
        merchantName: 'Coop',
      });
    });

    it('supports alternate keys (date, amount, merchant) and normalizes values', () => {
      const raw = '{"date": "21.10.2026", "amount": "CHF 32.40", "merchant": "Denner"}';
      assert.deepStrictEqual(parseGeminiJsonOutput(raw), {
        extractedDate: '2026-10-21',
        extractedAmount: 32.4,
        merchantName: 'Denner',
      });
    });

    it('falls back to text extraction if Gemini returns plain text instead of JSON', () => {
      const raw = 'Magasin: Migros\nDate: 19.10.2026\nTotal TTC: CHF 29.95';
      assert.deepStrictEqual(parseGeminiJsonOutput(raw), {
        extractedDate: '2026-10-19',
        extractedAmount: 29.95,
        merchantName: 'Migros',
      });
    });
  });

  describe('withTimeout()', () => {
    it('resolves when promise completes before timeout', async () => {
      const res = await withTimeout(Promise.resolve('OK'), 500);
      assert.strictEqual(res, 'OK');
    });

    it('rejects with EXTRACTION_TIMEOUT when promise exceeds timeoutMs', async () => {
      const slowPromise = new Promise((resolve) => setTimeout(() => resolve('LATE'), 200));
      await assert.rejects(
        () => withTimeout(slowPromise, 25),
        (err) => err instanceof Error && err.message === 'EXTRACTION_TIMEOUT'
      );
    });
  });

  describe('pdfTextExtractor (decodePdfLiteralString & extractTextFromPdfBuffer)', () => {
    it('decodes PDF literal escapes and octal sequences', () => {
      assert.strictEqual(decodePdfLiteralString('Total\\n\\(TTC\\) \\055 CHF'), 'Total\n(TTC) - CHF');
    });

    it('extracts text from BT...ET blocks with Tj and TJ operators in a PDF buffer', async () => {
      const fakePdfContent = `%PDF-1.7
1 0 obj
<< /Length 120 >>
stream
BT
/F1 12 Tf
(Migros Geneve) Tj
[(Date de facture : ) -10 (22.10.2026)] TJ
(Total TTC : CHF 54.30) Tj
ET
endstream
endobj
%%EOF`;
      const encoder = new TextEncoder();
      const text = await extractTextFromPdfBuffer(encoder.encode(fakePdfContent));
      assert.ok(text.includes('Migros Geneve'));
      assert.ok(text.includes('22.10.2026'));
      assert.ok(text.includes('Total TTC : CHF 54.30'));

      const fields = extractFieldsFromPdfText(text);
      assert.deepStrictEqual(fields, {
        extractedDate: '2026-10-22',
        extractedAmount: 54.3,
        merchantName: 'Migros',
      });
    });
  });
});
