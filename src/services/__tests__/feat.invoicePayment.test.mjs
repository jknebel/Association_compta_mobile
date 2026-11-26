import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateVerifiedReceiptForm } from '../verificationHelpers.ts';
import { buildReceiptDocument } from '../uploadHelpers.ts';
import { resolveReceiptStatusBadge } from '../historyHelpers.ts';
import { requestInvoicePaymentNotification } from '../bearerAuthHelpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

test('[INVOICE_PAYMENT][Positive] validates INVOICE_PAYMENT without IBAN/NPA/City and builds PENDING doc', () => {
  const result = validateVerifiedReceiptForm({
    comptaId: 'c1',
    expenseType: 'INVOICE_PAYMENT',
    amountInput: '185.50',
    dateInput: '2026-03-10',
    merchantName: 'Imprimerie Romande',
    description: 'Facture flyers',
    reimbursementIban: '',
    reimbursementNpa: '',
    reimbursementCity: '',
  });
  assert.equal(result.valid, true);
  assert.ok(result.payload);
  assert.equal(result.payload.expenseType, 'INVOICE_PAYMENT');
  assert.equal('reimbursementIban' in result.payload, false);
  assert.equal('reimbursementNpa' in result.payload, false);
  assert.equal('reimbursementCity' in result.payload, false);

  const doc = buildReceiptDocument({
    receiptId: 'rcpt-1710000000000-ab12cd',
    url: 'https://firebasestorage.googleapis.com/v0/b/x/o/inv.pdf',
    fileName: 'facture.pdf',
    uploadDateIso: '2026-03-10T10:00:00.000Z',
    extractedDate: '2026-03-10',
    extractedAmount: 185.5,
    expenseType: 'INVOICE_PAYMENT',
    description: 'Facture flyers',
    merchantName: 'Imprimerie Romande',
    submittedByUid: 'u1',
    submittedByName: 'Alice',
    submittedByEmail: 'alice@asso.ch',
    reimbursementIban: 'CH93 0076 2011 6238 5295 7',
  });
  assert.equal(doc.expenseType, 'INVOICE_PAYMENT');
  assert.equal(doc.reimbursementStatus, 'PENDING');
  assert.equal('reimbursementIban' in doc, false);
  assert.equal('reimbursementNpa' in doc, false);
  assert.equal('reimbursementCity' in doc, false);

  assert.deepEqual(resolveReceiptStatusBadge({ expenseType: 'INVOICE_PAYMENT', reimbursementStatus: 'PENDING' }), {
    key: 'REIMBURSEMENT_PENDING',
    label: '📄 Facture à payer (en attente)',
  });
  assert.deepEqual(resolveReceiptStatusBadge({ expenseType: 'INVOICE_PAYMENT', reimbursementStatus: 'REIMBURSED' }), {
    key: 'REIMBURSED',
    label: '✅ Facture payée',
  });
});

test('[INVOICE_PAYMENT][Negative & Boundary] triggers authenticated instant backend notification & handles errors safely', async () => {
  const calls = [];
  const ok = await requestInvoicePaymentNotification({
    orgId: 'TDGL',
    comptaId: 'c1',
    receiptId: 'rcpt-1',
    backendUrl: 'https://api.example.invalid/',
    getIdToken: async () => 'jwt-abc-123',
    fetchImpl: async (url, opts) => {
      calls.push({ url, opts });
      return { ok: true, status: 200 };
    },
  });
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example.invalid/api/notify-invoice-payment');
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer jwt-abc-123');
  assert.deepEqual(JSON.parse(calls[0].opts.body), {
    orgId: 'TDGL',
    comptaId: 'c1',
    receiptId: 'rcpt-1',
  });

  // Missing token or missing IDs -> returns false without calling fetch
  let fetchCalled = false;
  assert.equal(
    await requestInvoicePaymentNotification({
      orgId: '',
      comptaId: 'c1',
      receiptId: 'rcpt-1',
      backendUrl: 'https://api.example.invalid',
      getIdToken: async () => 'jwt-abc',
      fetchImpl: async () => {
        fetchCalled = true;
        return { ok: true, status: 200 };
      },
    }),
    false
  );
  assert.equal(fetchCalled, false);

  assert.equal(
    await requestInvoicePaymentNotification({
      orgId: 'TDGL',
      comptaId: 'c1',
      receiptId: 'rcpt-1',
      backendUrl: 'https://api.example.invalid',
      getIdToken: async () => null,
      fetchImpl: async () => {
        fetchCalled = true;
        return { ok: true, status: 200 };
      },
    }),
    false
  );
  assert.equal(fetchCalled, false);
  // Network error swallowed safely
  assert.equal(
    await requestInvoicePaymentNotification({
      orgId: 'TDGL',
      comptaId: 'c1',
      receiptId: 'rcpt-1',
      backendUrl: 'https://api.example.invalid',
      getIdToken: async () => 'jwt-abc',
      fetchImpl: async () => {
        throw new Error('network down');
      },
    }),
    false
  );
});

test('[INVOICE_PAYMENT][Integration] ReceiptPreview UI and receiptUploadService wire INVOICE_PAYMENT cleanly', () => {
  const previewSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/components/ReceiptPreview.tsx'), 'utf8');
  assert.match(previewSrc, /setExpenseType\('INVOICE_PAYMENT'\)/);
  assert.match(previewSrc, /Payer la facture/);

  const uploadSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/services/receiptUploadService.ts'), 'utf8');
  assert.match(uploadSrc, /requestInvoicePaymentNotification\(/);
  assert.match(uploadSrc, /if \(receiptDoc\.expenseType === 'INVOICE_PAYMENT'\)/);
  assert.match(uploadSrc, /if \(finalDoc\.expenseType === 'INVOICE_PAYMENT'\)/);
});
