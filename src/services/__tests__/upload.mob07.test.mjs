import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveUploadContentTypeAndExtension,
  sanitizeRandomToken,
  generateReceiptIdentifiers,
  buildStorageObjectPath,
  buildFirestoreReceiptPath,
  buildReceiptDocument,
  getOfflineReceiptQueue,
  enqueueOfflineReceipt,
  removeOfflineReceiptFromQueue,
} from '../uploadHelpers.ts';

describe('[MOB-07] uploadHelpers Unit & Integration Tests', () => {
  describe('resolveUploadContentTypeAndExtension()', () => {
    it('returns application/pdf and pdf extension for PDF MIME type or .pdf filename', () => {
      assert.deepStrictEqual(
        resolveUploadContentTypeAndExtension('application/pdf', 'doc.bin'),
        { contentType: 'application/pdf', extension: 'pdf' }
      );
      assert.deepStrictEqual(
        resolveUploadContentTypeAndExtension('', 'Facture_2026.PDF'),
        { contentType: 'application/pdf', extension: 'pdf' }
      );
    });

    it('defaults to image/jpeg and jpg extension for images or empty MIME type', () => {
      assert.deepStrictEqual(
        resolveUploadContentTypeAndExtension('image/jpeg', 'ticket.jpg'),
        { contentType: 'image/jpeg', extension: 'jpg' }
      );
      assert.deepStrictEqual(
        resolveUploadContentTypeAndExtension(null, null),
        { contentType: 'image/jpeg', extension: 'jpg' }
      );
    });
  });

  describe('sanitizeRandomToken() & generateReceiptIdentifiers()', () => {
    it('sanitizes alphanumeric token and builds receiptId and storageBaseName', () => {
      assert.strictEqual(sanitizeRandomToken('AbC-123_!'), 'abc123');
      assert.strictEqual(sanitizeRandomToken(''), 'a1b2c3');

      const ids = generateReceiptIdentifiers(1761640000000, 'XyZ987');
      assert.deepStrictEqual(ids, {
        receiptId: 'rcpt-1761640000000-xyz987',
        storageBaseName: '1761640000000_xyz987',
      });
    });
  });

  describe('buildStorageObjectPath() & buildFirestoreReceiptPath()', () => {
    it('constructs exact Firebase Storage path receipts/{orgId}/{comptaId}/{timestamp}_{random}.{ext}', () => {
      const pdfPath = buildStorageObjectPath('TDGL', 'louveteaux-26-27', 1761640000000, 'k9m2', 'pdf');
      assert.strictEqual(
        pdfPath,
        'receipts/TDGL/louveteaux-26-27/1761640000000_k9m2.pdf'
      );

      const jpgPath = buildStorageObjectPath('TDGL', 'pionniers-26-27', 1761640000000, 'k9m2', 'jpg');
      assert.strictEqual(
        jpgPath,
        'receipts/TDGL/pionniers-26-27/1761640000000_k9m2.jpg'
      );
    });

    it('constructs exact Firestore document path organizations/{orgId}/comptabilites/{comptaId}/receipts/{receiptId}', () => {
      const fsPath = buildFirestoreReceiptPath(
        'TDGL',
        'louveteaux-26-27',
        'rcpt-1761640000000-k9m2'
      );
      assert.strictEqual(
        fsPath,
        'organizations/TDGL/comptabilites/louveteaux-26-27/receipts/rcpt-1761640000000-k9m2'
      );
    });
  });

  describe('buildReceiptDocument()', () => {
    it('builds DEBIT_CARD receipt document without undefined properties or reimbursement fields', () => {
      const doc = buildReceiptDocument({
        receiptId: 'rcpt-100-abc',
        url: 'https://storage.example.com/rcpt.jpg',
        fileName: 'ticket.jpg',
        uploadDateIso: '2026-10-28T09:00:00.000Z',
        extractedDate: '2026-10-27',
        extractedAmount: 42.5,
        expenseType: 'DEBIT_CARD',
        description: '  Achat pain  ',
        merchantName: '  Migros  ',
        submittedByUid: 'uid-1',
        submittedByName: 'Jean Dupont',
        submittedByEmail: 'Jean.Dupont@tdgl.ch',
        reimbursementIban: 'CH93 0076 2011 6238 5295 7',
      });

      assert.deepStrictEqual(doc, {
        id: 'rcpt-100-abc',
        url: 'https://storage.example.com/rcpt.jpg',
        fileName: 'ticket.jpg',
        uploadDate: '2026-10-28T09:00:00.000Z',
        extractedDate: '2026-10-27',
        extractedAmount: 42.5,
        isAnalyzed: true,
        linkedTransactionId: null,
        expenseType: 'DEBIT_CARD',
        description: 'Achat pain',
        merchantName: 'Migros',
        submittedByUid: 'uid-1',
        submittedByName: 'Jean Dupont',
        submittedByEmail: 'jean.dupont@tdgl.ch',
      });
      assert.strictEqual('reimbursementStatus' in doc, false);
      assert.strictEqual('reimbursementIban' in doc, false);
    });

    it('builds REIMBURSEMENT receipt document with reimbursementStatus=PENDING and reimbursementIban', () => {
      const doc = buildReceiptDocument({
        receiptId: 'rcpt-200-def',
        url: 'https://storage.example.com/facture.pdf',
        fileName: 'facture.pdf',
        uploadDateIso: '2026-10-28T09:00:00.000Z',
        extractedDate: '2026-10-25',
        extractedAmount: 128.9,
        expenseType: 'REIMBURSEMENT',
        description: 'Impression flyers',
        merchantName: 'CopyQuick',
        submittedByUid: 'uid-2',
        submittedByName: 'Marie Curie',
        submittedByEmail: 'marie@tdgl.ch',
        reimbursementIban: 'CH93 0076 2011 6238 5295 7',
      });

      assert.strictEqual(doc.expenseType, 'REIMBURSEMENT');
      assert.strictEqual(doc.reimbursementStatus, 'PENDING');
      assert.strictEqual(doc.reimbursementIban, 'CH93 0076 2011 6238 5295 7');
    });
  });

  describe('Offline Queue Storage Helpers', () => {
    function createMockStorage() {
      const map = new Map();
      return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
      };
    }

    it('enqueues, retrieves, deduplicates, and removes offline receipts', () => {
      const storage = createMockStorage();
      assert.deepStrictEqual(getOfflineReceiptQueue(storage), []);

      const sampleItem = {
        queueId: 'rcpt-1',
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'louveteaux-26-27',
        comptaName: 'Louveteaux 26-27',
        currency: 'CHF',
        createdAt: 1761640000000,
        fileDataUrl: 'data:image/jpeg;base64,AAA',
        fileName: 'ticket.jpg',
        mimeType: 'image/jpeg',
        receiptDoc: {
          id: 'rcpt-1',
          url: 'data:image/jpeg;base64,AAA',
          fileName: 'ticket.jpg',
          uploadDate: '2026-10-28',
          extractedDate: '2026-10-28',
          extractedAmount: 15,
          isAnalyzed: true,
        },
      };

      enqueueOfflineReceipt(sampleItem, storage);
      enqueueOfflineReceipt(sampleItem, storage); // deduplicate by queueId
      assert.strictEqual(getOfflineReceiptQueue(storage).length, 1);

      removeOfflineReceiptFromQueue('rcpt-1', storage);
      assert.strictEqual(getOfflineReceiptQueue(storage).length, 0);
    });
  });
});
