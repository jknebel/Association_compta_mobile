import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceFile = path.resolve(__dirname, '../pwaHelpers.ts');
const testFile = path.resolve(__dirname, 'pwa.mob09.test.mjs');

const originalCode = fs.readFileSync(sourceFile, 'utf8');

const mutants = [
  {
    name: 'M1: Invert isStandalone check in getPwaDisplayState',
    mutate: (code) => code.replace('if (isStandalone)', 'if (!isStandalone)'),
  },
  {
    name: 'M2: Invert hasDeferredPrompt condition',
    mutate: (code) => code.replace('if (hasDeferredPrompt)', 'if (!hasDeferredPrompt)'),
  },
  {
    name: 'M3: Invert isIos condition',
    mutate: (code) => code.replace('if (isIos)', 'if (!isIos)'),
  },
  {
    name: 'M4: Invert isDismissed condition',
    mutate: (code) => code.replace('if (isDismissed)', 'if (!isDismissed)'),
  },
  {
    name: 'M5: Alter isIosDevice touchPoints condition',
    mutate: (code) => code.replace('touches > 1', 'touches > 10'),
  },
  {
    name: 'M6: Invert android-app:// referrer check',
    mutate: (code) => code.replace("referrer.includes('android-app://')", "!referrer.includes('android-app://')"),
  },
  {
    name: 'M7: Alter standalone navigator property check',
    mutate: (code) => code.replace('nav.standalone === true', 'nav.standalone === false'),
  },
  {
    name: 'M8: Alter isAndroidDevice regex',
    mutate: (code) => code.replace('/Android/i', '/iOS/i'),
  },
];

console.log(`Starting mutation test run for MOB-09 on ${mutants.length} mutants...`);
let killed = 0;
let survived = 0;

for (const m of mutants) {
  const mutatedCode = m.mutate(originalCode);
  if (mutatedCode === originalCode) {
    console.error(`❌ Mutant failed to apply: ${m.name}`);
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

// Restore original code
fs.writeFileSync(sourceFile, originalCode, 'utf8');

const score = Math.round((killed / mutants.length) * 100);
console.log(`\n========================================`);
console.log(`MOB-09 Mutation Score: ${score}% (${killed}/${mutants.length} killed)`);
console.log(`========================================\n`);

if (survived > 0) {
  process.exit(1);
}
