import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceFile = path.resolve(__dirname, '../historyHelpers.ts');
const testFile = path.resolve(__dirname, 'history.mob08.test.mjs');

const originalCode = fs.readFileSync(sourceFile, 'utf8');

const mutants = [
  {
    name: 'M1: Invert PDF fileName detection in isPdfReceipt',
    mutate: (code) =>
      code.replace("name.endsWith('.pdf')", "name.endsWith('.xyz')"),
  },
  {
    name: 'M2: Invert pending_offline condition in resolveReceiptStatusBadge',
    mutate: (code) =>
      code.replace("if (syncState === 'pending_offline')", "if (syncState !== 'pending_offline')"),
  },
  {
    name: 'M3: Invert REIMBURSED check in resolveReceiptStatusBadge',
    mutate: (code) =>
      code.replace("if (receipt.reimbursementStatus === 'REIMBURSED')", "if (receipt.reimbursementStatus === 'PENDING')"),
  },
  {
    name: 'M4: Invert submittedByUid match in doesReceiptBelongToUser',
    mutate: (code) =>
      code.replace(
        'if (cleanUid && receipt.submittedByUid === cleanUid)',
        'if (cleanUid && receipt.submittedByUid !== cleanUid)'
      ),
  },
  {
    name: 'M5: Bypass deduplication check in mergeAndSortUserReceipts',
    mutate: (code) =>
      code.replace('if (byId.has(rec.receipt.id)) continue;', 'if (false) continue;'),
  },
  {
    name: 'M6: Reverse chronological sort order in mergeAndSortUserReceipts',
    mutate: (code) =>
      code.replace(
        'const tsDiff = getReceiptSortTimestamp(b.receipt) - getReceiptSortTimestamp(a.receipt);',
        'const tsDiff = getReceiptSortTimestamp(a.receipt) - getReceiptSortTimestamp(b.receipt);'
      ),
  },
  {
    name: 'M7: Invert comptaIdFilter match in filterUserReceiptHistory',
    mutate: (code) =>
      code.replace('if (cleanCompta && item.comptaId !== cleanCompta)', 'if (cleanCompta && item.comptaId === cleanCompta)'),
  },
  {
    name: 'M8: Ignore pendingReimbursementAmount accumulation in computeHistorySummaryStats',
    mutate: (code) =>
      code.replace('pendingReimbursementAmount += amount;', 'pendingReimbursementAmount += 0;'),
  },
];

console.log(`Starting mutation test run for MOB-08 on ${mutants.length} mutants...`);
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
console.log(`MOB-08 Mutation Score: ${score}% (${killed}/${mutants.length} killed)`);
console.log(`========================================\n`);

if (survived > 0) {
  process.exit(1);
}
