import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isPdfReceipt,
  resolveReceiptStatusBadge,
  doesReceiptBelongToUser,
  getReceiptSortTimestamp,
  mergeAndSortUserReceipts,
  filterUserReceiptHistory,
  computeHistorySummaryStats,
} from '../historyHelpers.ts';

describe('[MOB-08] historyHelpers Unit & Integration Tests', () => {
  describe('isPdfReceipt()', () => {
    it('returns true for .pdf fileName, .pdf url, or data:application/pdf', () => {
      assert.strictEqual(isPdfReceipt({ fileName: 'facture.PDF', url: '' }), true);
      assert.strictEqual(isPdfReceipt({ fileName: 'doc', url: 'https://x.ch/a.pdf?token=1' }), true);
      assert.strictEqual(isPdfReceipt({ fileName: 'doc', url: 'data:application/pdf;base64,JVBER' }), true);
    });

    it('returns false for image receipts or null', () => {
      assert.strictEqual(isPdfReceipt({ fileName: 'ticket.jpg', url: 'https://x.ch/a.jpg' }), false);
      assert.strictEqual(isPdfReceipt(null), false);
    });
  });

  describe('resolveReceiptStatusBadge()', () => {
    it('returns PENDING_OFFLINE when syncState is pending_offline', () => {
      assert.deepStrictEqual(
        resolveReceiptStatusBadge({ expenseType: 'DEBIT_CARD' }, 'pending_offline'),
        { key: 'PENDING_OFFLINE', label: '📡 En attente de réseau' }
      );
    });

    it('returns REIMBURSEMENT_PENDING, REIMBURSED, and REJECTED for REIMBURSEMENT receipts', () => {
      assert.deepStrictEqual(
        resolveReceiptStatusBadge({ expenseType: 'REIMBURSEMENT', reimbursementStatus: 'PENDING' }),
        { key: 'REIMBURSEMENT_PENDING', label: '⏳ Remboursement en attente' }
      );
      assert.deepStrictEqual(
        resolveReceiptStatusBadge({ expenseType: 'REIMBURSEMENT', reimbursementStatus: 'REIMBURSED' }),
        { key: 'REIMBURSED', label: '✅ Remboursé' }
      );
      assert.deepStrictEqual(
        resolveReceiptStatusBadge({ expenseType: 'REIMBURSEMENT', reimbursementStatus: 'REJECTED' }),
        { key: 'REJECTED', label: '❌ Refusé' }
      );
    });

    it('returns CARD_TRANSMITTED and CARD_LINKED for DEBIT_CARD receipts', () => {
      assert.deepStrictEqual(
        resolveReceiptStatusBadge({ expenseType: 'DEBIT_CARD' }),
        { key: 'CARD_TRANSMITTED', label: '💳 Carte transmis' }
      );
      assert.deepStrictEqual(
        resolveReceiptStatusBadge({ expenseType: 'DEBIT_CARD', linkedTransactionId: 'tx-123' }),
        { key: 'CARD_LINKED', label: '✅ Carte rapprochée' }
      );
    });
  });

  describe('doesReceiptBelongToUser()', () => {
    it('matches by submittedByUid or case-insensitive submittedByEmail', () => {
      assert.strictEqual(
        doesReceiptBelongToUser({ submittedByUid: 'u-1' }, 'u-1', 'me@tdgl.ch'),
        true
      );
      assert.strictEqual(
        doesReceiptBelongToUser({ submittedByEmail: '  Me@TDGL.ch ' }, 'u-99', 'me@tdgl.ch'),
        true
      );
      assert.strictEqual(
        doesReceiptBelongToUser({ submittedByUid: 'other', submittedByEmail: 'other@tdgl.ch' }, 'u-1', 'me@tdgl.ch'),
        false
      );
    });
  });

  describe('mergeAndSortUserReceipts(), filterUserReceiptHistory(), & computeHistorySummaryStats()', () => {
    const firestoreRecords = [
      {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'louveteaux',
        comptaName: 'Louveteaux 26-27',
        currency: 'CHF',
        receipt: {
          id: 'rcpt-1761640000000-aaa',
          url: 'https://x.ch/1.jpg',
          fileName: '1.jpg',
          uploadDate: '2026-10-20T10:00:00.000Z',
          extractedDate: '2026-10-20',
          extractedAmount: 50,
          isAnalyzed: true,
          expenseType: 'REIMBURSEMENT',
          reimbursementStatus: 'REIMBURSED',
          submittedByUid: 'u-1',
        },
      },
      {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'louveteaux',
        comptaName: 'Louveteaux 26-27',
        currency: 'CHF',
        receipt: {
          id: 'rcpt-1761650000000-bbb',
          url: 'https://x.ch/other.jpg',
          fileName: 'other.jpg',
          uploadDate: '2026-10-25T10:00:00.000Z',
          extractedDate: '2026-10-25',
          extractedAmount: 99,
          isAnalyzed: true,
          expenseType: 'DEBIT_CARD',
          submittedByUid: 'someone-else',
        },
      },
    ];

    const localRecords = [
      // Duplicate of rcpt-1761640000000-aaa that was still PENDING locally before caissier marked REIMBURSED in Firestore
      {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'louveteaux',
        comptaName: 'Louveteaux 26-27',
        currency: 'CHF',
        syncState: 'synced',
        receipt: {
          id: 'rcpt-1761640000000-aaa',
          url: 'https://x.ch/1.jpg',
          fileName: '1.jpg',
          uploadDate: '2026-10-20T10:00:00.000Z',
          extractedDate: '2026-10-20',
          extractedAmount: 50,
          isAnalyzed: true,
          expenseType: 'REIMBURSEMENT',
          reimbursementStatus: 'PENDING',
          submittedByUid: 'u-1',
        },
      },
      // Newer local receipt awaiting reimbursement
      {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'pionniers',
        comptaName: 'Pionniers 26-27',
        currency: 'CHF',
        syncState: 'synced',
        receipt: {
          id: 'rcpt-1761660000000-ccc',
          url: 'https://x.ch/2.pdf',
          fileName: 'facture.pdf',
          uploadDate: '2026-10-28T10:00:00.000Z',
          extractedDate: '2026-10-28',
          extractedAmount: 120.4,
          isAnalyzed: true,
          expenseType: 'REIMBURSEMENT',
          reimbursementStatus: 'PENDING',
          submittedByUid: 'u-1',
        },
      },
      // Card receipt
      {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'louveteaux',
        comptaName: 'Louveteaux 26-27',
        currency: 'CHF',
        syncState: 'synced',
        receipt: {
          id: 'rcpt-1761655000000-ddd',
          url: 'https://x.ch/3.jpg',
          fileName: 'ticket.jpg',
          uploadDate: '2026-10-27T10:00:00.000Z',
          extractedDate: '2026-10-27',
          extractedAmount: 30,
          isAnalyzed: true,
          expenseType: 'DEBIT_CARD',
          submittedByUid: 'u-1',
        },
      },
    ];

    it('merges Firestore and local receipts for user, prioritizing Firestore status and sorting newest first', () => {
      const merged = mergeAndSortUserReceipts(firestoreRecords, localRecords, 'u-1', 'me@tdgl.ch');
      assert.strictEqual(merged.length, 3);
      assert.strictEqual(merged[0].id, 'rcpt-1761660000000-ccc');
      assert.strictEqual(merged[0].isPdf, true);
      assert.strictEqual(merged[0].statusKey, 'REIMBURSEMENT_PENDING');

      assert.strictEqual(merged[1].id, 'rcpt-1761655000000-ddd');
      assert.strictEqual(merged[1].statusKey, 'CARD_TRANSMITTED');

      // Firestore REIMBURSED status wins over local PENDING status
      assert.strictEqual(merged[2].id, 'rcpt-1761640000000-aaa');
      assert.strictEqual(merged[2].statusKey, 'REIMBURSED');
    });

    it('filters history by tab and comptaId', () => {
      const merged = mergeAndSortUserReceipts(firestoreRecords, localRecords, 'u-1', 'me@tdgl.ch');
      assert.strictEqual(filterUserReceiptHistory(merged, 'PENDING_REIMBURSEMENTS').length, 1);
      assert.strictEqual(filterUserReceiptHistory(merged, 'REIMBURSED').length, 1);
      assert.strictEqual(filterUserReceiptHistory(merged, 'DEBIT_CARD').length, 1);
      assert.strictEqual(filterUserReceiptHistory(merged, 'ALL', 'pionniers').length, 1);
    });

    it('computes summary stats accurately', () => {
      const merged = mergeAndSortUserReceipts(firestoreRecords, localRecords, 'u-1', 'me@tdgl.ch');
      const stats = computeHistorySummaryStats(merged);
      assert.deepStrictEqual(stats, {
        totalCount: 3,
        pendingReimbursementCount: 1,
        pendingReimbursementAmount: 120.4,
        reimbursedAmount: 50,
      });
    });

    it('extracts sort timestamp from id fallback when uploadDate is absent', () => {
      assert.strictEqual(
        getReceiptSortTimestamp({ id: 'rcpt-1761640000000-xyz' }),
        1761640000000
      );
    });
  });
});
