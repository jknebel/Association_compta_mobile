import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceFile = path.resolve(__dirname, '../verificationHelpers.ts');
const testFile = path.resolve(__dirname, 'verification.mob06.test.mjs');

const originalCode = fs.readFileSync(sourceFile, 'utf8');

const mutants = [
  {
    name: 'M1: Invert IBAN length validation in isValidIbanFormat',
    mutate: (code) =>
      code.replace(
        'if (compact.length < 15 || compact.length > 34) return false;',
        'if (compact.length >= 15 && compact.length <= 34) return false;'
      ),
  },
  {
    name: 'M2: Bypass positive amount check in parsePositiveAmountInput',
    mutate: (code) =>
      code.replace(
        'if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000)',
        'if (!Number.isFinite(parsed))'
      ),
  },
  {
    name: 'M3: Invert calendar day check in isValidIsoDateInput',
    mutate: (code) =>
      code.replace('return day <= daysInMonths[month - 1];', 'return day > daysInMonths[month - 1];'),
  },
  {
    name: 'M4: Ignore missing comptaId in validateVerifiedReceiptForm',
    mutate: (code) =>
      code.replace("if (!comptaId) {\n    errors.comptaId = 'Veuillez sélectionner une comptabilité cible.';\n  }", 'if (false) {}'),
  },
  {
    name: 'M5: Ignore missing expenseType in validateVerifiedReceiptForm',
    mutate: (code) =>
      code.replace("rawType === 'DEBIT_CARD' || rawType === 'REIMBURSEMENT' ? rawType : null;", "'DEBIT_CARD';"),
  },
  {
    name: 'M6: Bypass IBAN validation for REIMBURSEMENT in validateVerifiedReceiptForm',
    mutate: (code) =>
      code.replace(
        "if (validExpenseType === 'REIMBURSEMENT' && formattedIban && !isValidIbanFormat(formattedIban))",
        'if (false)'
      ),
  },
  {
    name: 'M7: Attach reimbursementIban even on DEBIT_CARD',
    mutate: (code) =>
      code.replace(
        "...(validExpenseType === 'REIMBURSEMENT' && formattedIban",
        "...(validExpenseType === 'DEBIT_CARD' && formattedIban"
      ),
  },
  {
    name: 'M8: Invert saveIbanToStorage non-empty condition',
    mutate: (code) =>
      code.replace(
        'if (normalized) {\n      s.setItem(SAVED_IBAN_STORAGE_KEY, normalized);',
        'if (!normalized) {\n      s.setItem(SAVED_IBAN_STORAGE_KEY, normalized);'
      ),
  },
];

console.log(`Starting mutation test run for MOB-06 on ${mutants.length} mutants...`);
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
console.log(`MOB-06 Mutation Score: ${score}% (${killed}/${mutants.length} killed)`);
console.log(`========================================\n`);

if (survived > 0) {
  process.exit(1);
}
