import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const targetPath = path.resolve(import.meta.dirname, '../authHelpers.ts');
const testPath = path.resolve(import.meta.dirname, './auth.mob02.test.mjs');
const originalCode = fs.readFileSync(targetPath, 'utf8');

const mutants = [
  {
    id: 'MUT-01',
    description: 'isExemptFromEmailVerification : retourner toujours true',
    target: 'return EXEMPT_VERIFICATION_EMAILS.includes(norm);',
    replacement: 'return true;',
  },
  {
    id: 'MUT-02',
    description: 'isExemptFromEmailVerification : retourner false pour les exemptés',
    target: 'return EXEMPT_VERIFICATION_EMAILS.includes(norm);',
    replacement: 'return false;',
  },
  {
    id: 'MUT-03',
    description: 'isEmailVerifiedForAccess : inversion vérification user.emailVerified',
    target: 'if (user.emailVerified === true) return true;',
    replacement: 'if (user.emailVerified === false) return true;',
  },
  {
    id: 'MUT-04',
    description: 'isEmailVerifiedForAccess : inversion check profile.emailVerificationRequired',
    target: 'if (profile.emailVerificationRequired !== true) return true;',
    replacement: 'if (profile.emailVerificationRequired === true) return true;',
  },
  {
    id: 'MUT-05',
    description: 'validateLoginCredentials : accepter mot de passe vide',
    target: 'if (typeof password !== \'string\' || password.length === 0)',
    replacement: 'if (false)',
  },
  {
    id: 'MUT-06',
    description: 'isValidEmailFormat : supprimer la vérification de longueur max (254)',
    target: 'if (!norm || norm.length > 254) return false;',
    replacement: 'if (!norm) return false;',
  },
  {
    id: 'MUT-07',
    description: 'translateFirebaseAuthError : mauvais mapping invalid-credential',
    target: "case 'auth/invalid-credential':",
    replacement: "case 'auth/disabled-invalid-credential':",
  },
  {
    id: 'MUT-08',
    description: 'buildMobileUserProfile : suppression fallback TDGL',
    target: "orgId = 'TDGL';",
    replacement: "orgId = 'UNKNOWN';",
  },
];

let killed = 0;
let survived = 0;

console.log(`=== Lancement de la campagne de Mutation Testing sur authHelpers.ts (${mutants.length} mutants) ===\n`);

try {
  for (const mutant of mutants) {
    const normalizedOrig = originalCode.replace(/\r\n/g, '\n');
    if (!normalizedOrig.includes(mutant.target)) {
      throw new Error(`Cible introuvable pour ${mutant.id}: ${mutant.target}`);
    }
    const mutatedCode = normalizedOrig.replace(mutant.target, mutant.replacement);
    fs.writeFileSync(targetPath, mutatedCode, 'utf8');

    const res = spawnSync(
      process.execPath,
      ['--experimental-transform-types', '--test', testPath],
      { encoding: 'utf8' }
    );

    if (res.status !== 0) {
      killed++;
      console.log(`✅ [${mutant.id}] KILLED   — ${mutant.description}`);
    } else {
      survived++;
      console.log(`❌ [${mutant.id}] SURVIVED — ${mutant.description}`);
    }
  }
} finally {
  fs.writeFileSync(targetPath, originalCode, 'utf8');
}

const score = ((killed / mutants.length) * 100).toFixed(2);
console.log(`\n=============================================================`);
console.log(`📊 Résultat Mutation Testing MOB-02 : ${killed}/${mutants.length} mutants tués (Score : ${score}%)`);
console.log(`=============================================================`);

if (survived > 0) {
  process.exit(1);
}
