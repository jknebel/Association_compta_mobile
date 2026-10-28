import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceFile = path.resolve(__dirname, '../uploadHelpers.ts');
const testFile = path.resolve(__dirname, 'upload.mob07.test.mjs');

const originalCode = fs.readFileSync(sourceFile, 'utf8');

const mutants = [
  {
    name: 'M1: Break PDF MIME type and extension check in resolveUploadContentTypeAndExtension',
    mutate: (code) =>
      code.replace(
        "if (normMime === 'application/pdf' || normName.endsWith('.pdf'))",
        "if (normMime === 'application/pdf' && normName.endsWith('.pdf'))"
      ),
  },
  {
    name: 'M2: Alter receiptId prefix in generateReceiptIdentifiers',
    mutate: (code) =>
      code.replace('receiptId: `rcpt-${safeTs}-${token}`', 'receiptId: `doc-${safeTs}-${token}`'),
  },
  {
    name: 'M3: Alter Firebase Storage root prefix in buildStorageObjectPath',
    mutate: (code) =>
      code.replace(
        'return `receipts/${cleanOrg}/${cleanCompta}/${storageBaseName}.${ext}`;',
        'return `uploads/${cleanOrg}/${cleanCompta}/${storageBaseName}.${ext}`;'
      ),
  },
  {
    name: 'M4: Alter Firestore collection path in buildFirestoreReceiptPath',
    mutate: (code) =>
      code.replace(
        'return `organizations/${cleanOrg}/comptabilites/${cleanCompta}/receipts/${cleanId}`;',
        'return `organizations/${cleanOrg}/comptas/${cleanCompta}/receipts/${cleanId}`;'
      ),
  },
  {
    name: 'M5: Set isAnalyzed to false in buildReceiptDocument',
    mutate: (code) =>
      code.replace('isAnalyzed: true,', 'isAnalyzed: false,'),
  },
  {
    name: 'M6: Invert isReimbursement condition in buildReceiptDocument',
    mutate: (code) =>
      code.replace(
        "const isReimbursement = params.expenseType === 'REIMBURSEMENT';",
        "const isReimbursement = params.expenseType !== 'REIMBURSEMENT';"
      ),
  },
  {
    name: 'M7: Omit reimbursementIban on REIMBURSEMENT in buildReceiptDocument',
    mutate: (code) =>
      code.replace(
        'if (cleanIban) {\n      docObj.reimbursementIban = cleanIban;\n    }',
        'if (false) {}'
      ),
  },
  {
    name: 'M8: Invert queueId filter in removeOfflineReceiptFromQueue',
    mutate: (code) =>
      code.replace(
        'const updated = getOfflineReceiptQueue(s).filter((q) => q.queueId !== queueId);',
        'const updated = getOfflineReceiptQueue(s).filter((q) => q.queueId === queueId);'
      ),
  },
];

console.log(`Starting mutation test run for MOB-07 on ${mutants.length} mutants...`);
let killed = 0;
let survived = 0;

try {
  for (const m of mutants) {
    const mutatedCode = m.mutate(originalCode);
    if (mutatedCode === originalCode) {
      console.error(`❌ Mutant failed to apply: ${m.name}`);
      fs.writeFileSync(sourceFile, originalCode, 'utf8');
      process.exit(1);
    }

    fs.writeFileSync(sourceFile, mutatedCode, 'utf8');
    let testFailed = false;

    try {
      execSync(`node --experimental-transform-types --test "${testFile}"`, {
        stdio: 'pipe',
        timeout: 10000,
      });
    } catch {
      testFailed = true;
    }

    if (testFailed) {
      console.log(`✅ Killed: ${m.name}`);
      killed++;
    } else {
      console.error(`🚨 SURVIVED: ${m.name}`);
      survived++;
    }
  }
} finally {
  fs.writeFileSync(sourceFile, originalCode, 'utf8');
}

const score = Math.round((killed / mutants.length) * 100);
console.log(`\n========================================`);
console.log(`MOB-07 Mutation Score: ${score}% (${killed}/${mutants.length} killed)`);
console.log(`========================================\n`);

if (survived > 0) {
  process.exit(1);
}
