import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_SUPER_ADMIN_EMAILS,
  DEFAULT_EXEMPT_VERIFICATION_EMAILS,
  parseConfiguredEmails,
  resolveSuperAdminAccess,
  isEmailExemptFromVerification,
} from '../adminConfig.ts';
import { isSuperAdminEmail } from '../comptaHelpers.ts';
import { isExemptFromEmailVerification } from '../authHelpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

test('[SEC-18][Positive] configurable super-admin, claims, and exemption helpers work cleanly', () => {
  assert.deepEqual(
    parseConfiguredEmails(' Admin@Asso.ch ; treasurer@asso.ch '),
    ['admin@asso.ch', 'treasurer@asso.ch']
  );

  // Token custom claim superAdmin === true grants admin access even if email fallbacks disabled
  assert.equal(
    resolveSuperAdminAccess({
      claims: { superAdmin: true },
      email: 'member@asso.ch',
      rawSuperAdminEmailsEnv: 'NONE',
    }),
    true
  );

  assert.equal(isSuperAdminEmail('ADMIN@ASSO.CH', 'admin@asso.ch'), true);
  assert.equal(isSuperAdminEmail(DEFAULT_SUPER_ADMIN_EMAILS[0], ''), true);
  assert.equal(
    resolveSuperAdminAccess({
      claims: {},
      email: 'ADMIN@ASSO.CH',
      rawSuperAdminEmailsEnv: 'admin@asso.ch',
    }),
    true
  );
  assert.equal(
    resolveSuperAdminAccess({
      claims: {},
      email: DEFAULT_SUPER_ADMIN_EMAILS[0],
      rawSuperAdminEmailsEnv: '',
    }),
    true
  );
  assert.equal(isExemptFromEmailVerification('EXEMPT@ASSO.CH', 'exempt@asso.ch'), true);
  assert.equal(isExemptFromEmailVerification(DEFAULT_EXEMPT_VERIFICATION_EMAILS[2], ''), true);
  assert.equal(isEmailExemptFromVerification(DEFAULT_EXEMPT_VERIFICATION_EMAILS[2], ''), true);
});

test('[SEC-18][Negative] NONE disables hardcoded email fallbacks & rejects string/false claims', () => {
  assert.deepEqual(parseConfiguredEmails('NONE'), []);
  assert.equal(
    resolveSuperAdminAccess({
      claims: { superAdmin: false },
      email: DEFAULT_SUPER_ADMIN_EMAILS[0],
      rawSuperAdminEmailsEnv: 'NONE',
    }),
    false
  );
  assert.equal(resolveSuperAdminAccess({ claims: { superAdmin: 'true' }, email: 'user@asso.ch', rawSuperAdminEmailsEnv: 'NONE' }), false);
  assert.equal(isSuperAdminEmail(DEFAULT_SUPER_ADMIN_EMAILS[0], 'NONE'), false);
  assert.equal(isExemptFromEmailVerification(DEFAULT_EXEMPT_VERIFICATION_EMAILS[0], 'NONE'), false);
  assert.equal(isEmailExemptFromVerification(DEFAULT_EXEMPT_VERIFICATION_EMAILS[0], 'NONE'), false);
});

test('[SEC-18][Boundary & Hygiene] .firebaserc preserved, .firebase cache removed, .gitignore & AuthContext wired', () => {
  assert.equal(fs.existsSync(path.join(REPO_ROOT, '.firebase/hosting.ZGlzdA.cache')), false);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, '.firebaserc')), true);

  const lines = new Set(
    fs
      .readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
  );
  for (const pattern of ['.firebase/', '__pycache__/', '*.py[cod]', '* - Copie*', '.env.*']) {
    assert.ok(lines.has(pattern), `.gitignore missing ${pattern}`);
  }

  const authCtxSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/contexts/AuthContext.tsx'), 'utf8');
  assert.match(authCtxSrc, /getIdTokenResult\s*\(/);
  assert.match(authCtxSrc, /claims\?\.superAdmin\s*===\s*true/);
});
