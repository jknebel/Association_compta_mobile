import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceFile = path.resolve(__dirname, '../imageHelpers.ts');
const testFile = path.resolve(__dirname, 'image.mob04.test.mjs');

const originalCode = fs.readFileSync(sourceFile, 'utf8');

const mutants = [
  {
    name: 'M1: Break PDF MIME type & extension detection',
    mutate: (code) =>
      code.replace(
        "if (normMime === 'application/pdf' || normName.endsWith('.pdf'))",
        "if (normMime === 'application/pdf' && normName.endsWith('.pdf'))"
      ),
  },
  {
    name: 'M2: Bypass PDF max size check (MAX_PDF_SIZE_BYTES)',
    mutate: (code) =>
      code.replace(
        "if (kind === 'pdf' && file.size > MAX_PDF_SIZE_BYTES)",
        "if (kind === 'pdf' && file.size < 0)"
      ),
  },
  {
    name: 'M3: Bypass raw image max size check (MAX_RAW_IMAGE_SIZE_BYTES)',
    mutate: (code) =>
      code.replace(
        "if (kind === 'image' && file.size > MAX_RAW_IMAGE_SIZE_BYTES)",
        "if (kind === 'image' && file.size < 0)"
      ),
  },
  {
    name: 'M4: Invert empty/zero file size validation',
    mutate: (code) =>
      code.replace('file.size <= 0', 'file.size < -999999'),
  },
  {
    name: 'M5: Invert no-resize condition in calculateTargetDimensions',
    mutate: (code) =>
      code.replace('if (width <= safeMax && height <= safeMax)', 'if (width > safeMax && height > safeMax)'),
  },
  {
    name: 'M6: Invert landscape vs portrait branch in calculateTargetDimensions',
    mutate: (code) =>
      code.replace('if (width >= height)', 'if (width < height)'),
  },
  {
    name: 'M7: Alter formatFileSize KB threshold',
    mutate: (code) =>
      code.replace('if (bytes < 1024)', 'if (bytes > 1024)'),
  },
  {
    name: 'M8: Invert pdf vs jpg extension in normalizeCompressedFileName',
    mutate: (code) =>
      code.replace(
        "return kind === 'pdf' ? `${safeBase}.pdf` : `${safeBase}.jpg`;",
        "return kind === 'pdf' ? `${safeBase}.jpg` : `${safeBase}.pdf`;"
      ),
  },
];

console.log(`Starting mutation test run for MOB-04 on ${mutants.length} mutants...`);
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
console.log(`MOB-04 Mutation Score: ${score}% (${killed}/${mutants.length} killed)`);
console.log(`========================================\n`);

if (survived > 0) {
  process.exit(1);
}
