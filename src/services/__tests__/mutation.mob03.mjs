import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceFile = path.resolve(__dirname, '../comptaHelpers.ts');
const testFile = path.resolve(__dirname, 'compta.mob03.test.mjs');

const originalCode = fs.readFileSync(sourceFile, 'utf8');

const mutants = [
  {
    name: 'M1: Bypass archived comptabilités filter (compta.isArchived === true)',
    mutate: (code) =>
      code.replace('if (compta.isArchived === true) continue;', 'if (compta.isArchived === false) continue;'),
  },
  {
    name: 'M2: Bypass rejected member check in resolveAuthorizedComptabilites',
    mutate: (code) =>
      code.replace("if (memberDoc.status === 'rejected') continue;", "if (memberDoc.status === 'approved') continue;"),
  },
  {
    name: 'M3: Invert super-admin email inclusion check',
    mutate: (code) =>
      code.replace('return SUPER_ADMIN_EMAILS.includes(norm);', 'return !SUPER_ADMIN_EMAILS.includes(norm);'),
  },
  {
    name: 'M4: Break UPLOADER role normalization',
    mutate: (code) =>
      code.replace("case 'uploader':\n      return 'uploader' as ComptaRole;", "case 'uploader':\n      return null;"),
  },
  {
    name: 'M5: Disable directMembers subcollection fallback',
    mutate: (code) =>
      code.replace('if (!resolvedRole && Array.isArray(compta.directMembers))', 'if (false && Array.isArray(compta.directMembers))'),
  },
  {
    name: 'M6: Disable Organization Admin full access to active comptabilités',
    mutate: (code) =>
      code.replace('if (!resolvedRole && isOrgAdmin)', 'if (!resolvedRole && !isOrgAdmin)'),
  },
  {
    name: 'M7: Invert UID match in doesMemberMatchUser',
    mutate: (code) =>
      code.replace(
        'if (cleanUid && (member.id === cleanUid || member.uid === cleanUid))',
        'if (cleanUid && (member.id !== cleanUid && member.uid !== cleanUid))'
      ),
  },
  {
    name: 'M8: Ignore preferredComptaId in selectDefaultComptabilite',
    mutate: (code) =>
      code.replace(
        'const found = authorizedList.find((c) => c.comptaId === preferredComptaId.trim());',
        'const found = undefined;'
      ),
  },
];

console.log(`Starting mutation test run for MOB-03 on ${mutants.length} mutants...`);
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
console.log(`MOB-03 Mutation Score: ${score}% (${killed}/${mutants.length} killed)`);
console.log(`========================================\n`);

if (survived > 0) {
  process.exit(1);
}
