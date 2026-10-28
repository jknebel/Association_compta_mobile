import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceFile = path.resolve(__dirname, '../extractionHelpers.ts');
const testFile = path.resolve(__dirname, 'extraction.mob05.test.mjs');

const originalCode = fs.readFileSync(sourceFile, 'utf8');

const mutants = [
  {
    name: 'M1: Invert calendar day bounds check in isValidCalendarDate',
    mutate: (code) =>
      code.replace('return day <= daysInMonths[month - 1];', 'return day > daysInMonths[month - 1];'),
  },
  {
    name: 'M2: Break 2-digit year pivot in normalizeExtractedDate',
    mutate: (code) =>
      code.replace('year = year >= 70 ? 1900 + year : 2000 + year;', 'year = 1900 + year;'),
  },
  {
    name: 'M3: Bypass positive amount check in normalizeExtractedAmount',
    mutate: (code) =>
      code.replace('if (!Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 1_000_000)', 'if (!Number.isFinite(rawAmount))'),
  },
  {
    name: 'M4: Break comma-to-dot decimal conversion in normalizeExtractedAmount',
    mutate: (code) =>
      code.replace("clean = clean.replace(',', '.');", "clean = clean.replace(',', '');"),
  },
  {
    name: 'M5: Invert generic label filter in normalizeMerchantName',
    mutate: (code) =>
      code.replace(
        'if (/^(facture|ticket|reçu|recu|quittance|justificatif|receipt|invoice)$/i.test(clean))',
        'if (!/^(facture|ticket|reçu|recu|quittance|justificatif|receipt|invoice)$/i.test(clean))'
      ),
  },
  {
    name: 'M6: Invert minimum length check in hasReadablePdfTextLayer',
    mutate: (code) =>
      code.replace('if (clean.length < MIN_READABLE_PDF_TEXT_LENGTH) return false;', 'if (clean.length >= MIN_READABLE_PDF_TEXT_LENGTH) return false;'),
  },
  {
    name: 'M7: Take first match instead of last Total TTC match in extractFieldsFromPdfText',
    mutate: (code) =>
      code.replace('const lastMatch = matches[matches.length - 1];', 'const lastMatch = null;'),
  },
  {
    name: 'M8: Disable timeout rejection in withTimeout',
    mutate: (code) =>
      code.replace("reject(new Error('EXTRACTION_TIMEOUT'));", "reject(new Error('OTHER_ERR'));"),
  },
];

console.log(`Starting mutation test run for MOB-05 on ${mutants.length} mutants...`);
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
console.log(`MOB-05 Mutation Score: ${score}% (${killed}/${mutants.length} killed)`);
console.log(`========================================\n`);

if (survived > 0) {
  process.exit(1);
}
