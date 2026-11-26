import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const testPath = path.join(REPO_ROOT, 'src/services/__tests__/feat.invoicePayment.test.mjs');

const FILES = {
  verif: 'src/services/verificationHelpers.ts',
  upload: 'src/services/uploadHelpers.ts',
  history: 'src/services/historyHelpers.ts',
  bearer: 'src/services/bearerAuthHelpers.ts',
  uploadSvc: 'src/services/receiptUploadService.ts',
  preview: 'src/components/ReceiptPreview.tsx',
};

const originals = Object.fromEntries(
  Object.entries(FILES).map(([k, rel]) => [k, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')])
);

const mutants = [
  {
    id: 'I01',
    fileKey: 'verif',
    description: 'verificationHelpers : refuse INVOICE_PAYMENT',
    target: "rawType === 'DEBIT_CARD' || rawType === 'REIMBURSEMENT' || rawType === 'INVOICE_PAYMENT'",
    replacement: "rawType === 'DEBIT_CARD' || rawType === 'REIMBURSEMENT'",
  },
  {
    id: 'I02',
    fileKey: 'upload',
    description: 'uploadHelpers : enregistre INVOICE_PAYMENT comme DEBIT_CARD',
    target: "const isInvoicePayment = params.expenseType === 'INVOICE_PAYMENT';",
    replacement: 'const isInvoicePayment = false;',
  },
  {
    id: 'I03',
    fileKey: 'upload',
    description: 'uploadHelpers : omet reimbursementStatus=PENDING sur INVOICE_PAYMENT',
    target: '} else if (isInvoicePayment) {\n    docObj.reimbursementStatus = \'PENDING\' as ReimbursementStatus;\n  }',
    replacement: '} else if (isInvoicePayment) {}',
  },
  {
    id: 'I04',
    fileKey: 'history',
    description: 'historyHelpers : supprime badge INVOICE_PAYMENT',
    target: "  if (receipt?.expenseType === 'INVOICE_PAYMENT') {",
    replacement: '  if (false) {',
  },
  {
    id: 'I05',
    fileKey: 'history',
    description: 'historyHelpers : mauvais statut badge Facture payée',
    target: "label: '✅ Facture payée',",
    replacement: "label: '⏳ En cours',",
  },
  {
    id: 'I06',
    fileKey: 'bearer',
    description: 'bearerAuthHelpers : omet garde identifiants vides dans requestInvoicePaymentNotification',
    target: '  if (!orgId || !comptaId || !receiptId) {\n    return false;\n  }',
    replacement: '  if (false) {\n    return false;\n  }',
  },
  {
    id: 'I07',
    fileKey: 'bearer',
    description: 'bearerAuthHelpers : appelle /api/notify-invoice-payment sans token Bearer',
    target: '  if (!cleanToken) {\n    return false;\n  }',
    replacement: '  if (false) {\n    return false;\n  }',
  },
  {
    id: 'I08',
    fileKey: 'bearer',
    description: 'bearerAuthHelpers : mauvaise route API pour notification facture',
    target: 'const targetUrl = `${params.backendUrl.replace(/\\/+$/, \'\')}/api/notify-invoice-payment`;',
    replacement: 'const targetUrl = `${params.backendUrl.replace(/\\/+$/, \'\')}/api/wrong-route`;',
  },
  {
    id: 'I09',
    fileKey: 'uploadSvc',
    description: 'receiptUploadService : supprime appel notification immédiate INVOICE_PAYMENT',
    target: "if (receiptDoc.expenseType === 'INVOICE_PAYMENT') {",
    replacement: 'if (false) {',
  },
  {
    id: 'I10',
    fileKey: 'preview',
    description: 'ReceiptPreview : retire bouton Payer la facture',
    target: "onClick={() => setExpenseType('INVOICE_PAYMENT')}",
    replacement: "onClick={() => setExpenseType('DEBIT_CARD')}",
  },
];

let killed = 0;
let invalid = 0;
const survivors = [];

try {
  for (const m of mutants) {
    const absPath = path.join(REPO_ROOT, FILES[m.fileKey]);
    const orig = originals[m.fileKey];
    const normalized = orig.replace(/\r\n/g, '\n');
    if (!normalized.includes(m.target)) {
      console.error(`[INVALID] ${m.id} (${m.description}): target not matched in ${FILES[m.fileKey]}`);
      invalid += 1;
      continue;
    }
    const mutated = normalized.replace(m.target, m.replacement);
    fs.writeFileSync(absPath, mutated, 'utf8');
    const res = spawnSync(
      process.execPath,
      ['--experimental-transform-types', '--test', testPath],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=192' },
      }
    );
    fs.writeFileSync(absPath, orig, 'utf8');

    if (res.status !== 0) {
      killed += 1;
      console.log(`[KILLED] ${m.id}: ${m.description}`);
    } else {
      survivors.push(m.id);
      console.error(`[SURVIVED] ${m.id}: ${m.description}`);
    }
  }
} finally {
  for (const [k, content] of Object.entries(originals)) {
    fs.writeFileSync(path.join(REPO_ROOT, FILES[k]), content, 'utf8');
  }
}

console.log(`\nMobile INVOICE_PAYMENT Mutation Score: ${killed}/${mutants.length} killed, ${invalid} invalid, ${survivors.length} survived`);
if (invalid > 0 || survivors.length > 0) {
  process.exit(1);
}
