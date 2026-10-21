import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXEMPT_VERIFICATION_EMAILS,
  normalizeEmail,
  isValidEmailFormat,
  isExemptFromEmailVerification,
  isEmailVerifiedForAccess,
  validateLoginCredentials,
  validatePasswordResetEmail,
  translateFirebaseAuthError,
  buildMobileUserProfile,
} from '../authHelpers.ts';

describe('MOB-02 — Tests Unitaires : Cas Positifs (Nominal)', () => {
  it('normalizeEmail nettoie les espaces et passe en minuscules', () => {
    assert.equal(normalizeEmail('  Membre.Actif@TDGL.ch  '), 'membre.actif@tdgl.ch');
    assert.equal(normalizeEmail('caissier@asso.ch'), 'caissier@asso.ch');
  });

  it('isValidEmailFormat accepte les adresses e-mail valides', () => {
    assert.equal(isValidEmailFormat('user@asso.ch'), true);
    assert.equal(isValidEmailFormat('jean-francois.knebel+test@sub.domain.org'), true);
  });

  it('isExemptFromEmailVerification reconnaît les comptes exemptés (insensible à la casse)', () => {
    assert.equal(EXEMPT_VERIFICATION_EMAILS.length, 3);
    assert.equal(isExemptFromEmailVerification('JEAN.FRANCOIS.KNEBEL@GMAIL.COM'), true);
    assert.equal(isExemptFromEmailVerification('  jean-francois@knebel.ch '), true);
    assert.equal(isExemptFromEmailVerification('quokka@tdgl.ch'), true);
  });

  it('isEmailVerifiedForAccess autorise un utilisateur vérifié ou sans obligation de vérification', () => {
    assert.equal(
      isEmailVerifiedForAccess(
        { email: 'membre@asso.ch', emailVerified: true },
        { emailVerified: false, emailVerificationRequired: true }
      ),
      true
    );
    assert.equal(
      isEmailVerifiedForAccess(
        { email: 'membre@asso.ch', emailVerified: false },
        { emailVerified: false, emailVerificationRequired: false }
      ),
      true
    );
    assert.equal(
      isEmailVerifiedForAccess(
        { email: 'membre@asso.ch', emailVerified: false },
        { emailVerified: true, emailVerificationRequired: true }
      ),
      true
    );
    assert.equal(
      isEmailVerifiedForAccess({ email: 'membre@asso.ch', emailVerified: false }, null),
      true
    );
  });

  it('validateLoginCredentials valide un couple email / mot de passe correct', () => {
    const res = validateLoginCredentials('  Actif@Asso.ch ', 'MonMotDePasse123!');
    assert.deepEqual(res, {
      valid: true,
      normalizedEmail: 'actif@asso.ch',
      error: null,
    });
  });

  it('validatePasswordResetEmail valide une adresse e-mail correcte', () => {
    const res = validatePasswordResetEmail('  Membre@Asso.ch ');
    assert.deepEqual(res, {
      valid: true,
      normalizedEmail: 'membre@asso.ch',
      error: null,
    });
  });

  it('buildMobileUserProfile construit le profil complet depuis Firestore', () => {
    const profile = buildMobileUserProfile(
      { uid: 'uid-1', email: 'marc@tdgl.ch', displayName: 'Marc Auth', emailVerified: true },
      {
        email: 'Marc@TDGL.ch',
        firstName: 'Marc',
        lastName: 'Dupont',
        displayName: 'Marc Dupont',
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        emailVerified: true,
        emailVerificationRequired: false,
      }
    );
    assert.deepEqual(profile, {
      uid: 'uid-1',
      email: 'marc@tdgl.ch',
      displayName: 'Marc Dupont',
      firstName: 'Marc',
      lastName: 'Dupont',
      orgId: 'TDGL',
      orgName: 'Troupe du Grand Lac',
      emailVerified: true,
      emailVerificationRequired: false,
    });
  });
});

describe('MOB-02 — Tests Unitaires : Cas Négatifs', () => {
  it('isValidEmailFormat rejette les adresses mal formées', () => {
    assert.equal(isValidEmailFormat(''), false);
    assert.equal(isValidEmailFormat('sans-arobase.ch'), false);
    assert.equal(isValidEmailFormat('user@'), false);
    assert.equal(isValidEmailFormat('@domain.ch'), false);
    assert.equal(isValidEmailFormat('user@domain'), false);
    assert.equal(isValidEmailFormat('user name@domain.ch'), false);
  });

  it('isExemptFromEmailVerification retourne false pour un email standard ou vide', () => {
    assert.equal(isExemptFromEmailVerification('autre@tdgl.ch'), false);
    assert.equal(isExemptFromEmailVerification(''), false);
    assert.equal(isExemptFromEmailVerification(null), false);
    assert.equal(isExemptFromEmailVerification(undefined), false);
  });

  it('isEmailVerifiedForAccess refuse un compte non vérifié lorsque emailVerificationRequired est true', () => {
    assert.equal(isEmailVerifiedForAccess(null, null), false);
    assert.equal(isEmailVerifiedForAccess(undefined, null), false);
    assert.equal(
      isEmailVerifiedForAccess(
        { email: 'nouveau@asso.ch', emailVerified: false },
        { emailVerified: false, emailVerificationRequired: true }
      ),
      false
    );
  });

  it('validateLoginCredentials refuse un email vide, invalide ou un mot de passe vide', () => {
    assert.deepEqual(validateLoginCredentials('', 'secret'), {
      valid: false,
      normalizedEmail: '',
      error: 'Veuillez saisir votre adresse e-mail.',
    });
    assert.deepEqual(validateLoginCredentials('invalide', 'secret'), {
      valid: false,
      normalizedEmail: 'invalide',
      error: "Le format de l'adresse e-mail est invalide.",
    });
    assert.deepEqual(validateLoginCredentials('user@asso.ch', ''), {
      valid: false,
      normalizedEmail: 'user@asso.ch',
      error: 'Veuillez saisir votre mot de passe.',
    });
  });

  it('validatePasswordResetEmail refuse un email vide ou mal formé', () => {
    const emptyRes = validatePasswordResetEmail('   ');
    assert.equal(emptyRes.valid, false);
    assert.equal(
      emptyRes.error,
      'Veuillez saisir votre adresse e-mail dans le champ ci-dessus pour réinitialiser votre mot de passe.'
    );

    const badRes = validatePasswordResetEmail('pas-un-email');
    assert.equal(badRes.valid, false);
    assert.equal(badRes.error, "Le format de l'adresse e-mail est invalide.");
  });
});

describe('MOB-02 — Tests aux Valeurs Limites & Cas Particuliers', () => {
  it('isValidEmailFormat accepte 254 caractères et rejette 255 caractères', () => {
    const localPart245 = 'a'.repeat(245);
    const email254 = `${localPart245}@asso.ch`; // 245 + 8 = 253 <= 254
    const localPart246 = 'a'.repeat(246);
    const email254Exact = `${localPart246}@asso.ch`; // 246 + 8 = 254
    const email255 = `${'a'.repeat(247)}@asso.ch`; // 247 + 8 = 255

    assert.equal(email254Exact.length, 254);
    assert.equal(email255.length, 255);
    assert.equal(isValidEmailFormat(email254), true);
    assert.equal(isValidEmailFormat(email254Exact), true);
    assert.equal(isValidEmailFormat(email255), false);
  });

  it('normalizeEmail gère les types non-string sans planter', () => {
    assert.equal(normalizeEmail(null), '');
    assert.equal(normalizeEmail(undefined), '');
    assert.equal(normalizeEmail(12345), '');
  });

  it('isEmailVerifiedForAccess autorise un compte exempté même si emailVerificationRequired=true et emailVerified=false', () => {
    assert.equal(
      isEmailVerifiedForAccess(
        { email: 'quokka@tdgl.ch', emailVerified: false },
        { emailVerified: false, emailVerificationRequired: true }
      ),
      true
    );
  });

  it('translateFirebaseAuthError traduit tous les codes Firebase Auth connus et gère les erreurs inconnues', () => {
    assert.equal(
      translateFirebaseAuthError({ code: 'auth/invalid-credential' }),
      'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.'
    );
    assert.equal(
      translateFirebaseAuthError({ code: 'auth/wrong-password' }),
      'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.'
    );
    assert.equal(
      translateFirebaseAuthError({ code: 'auth/user-not-found' }),
      'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.'
    );
    assert.equal(
      translateFirebaseAuthError({ code: 'auth/invalid-email' }),
      "Le format de l'adresse e-mail est invalide."
    );
    assert.equal(
      translateFirebaseAuthError({ code: 'auth/user-disabled' }),
      "Ce compte utilisateur a été désactivé. Contactez l'administrateur de votre association."
    );
    assert.equal(
      translateFirebaseAuthError({ code: 'auth/too-many-requests' }),
      'Trop de tentatives infructueuses. Veuillez patienter quelques minutes ou réinitialiser votre mot de passe.'
    );
    assert.equal(
      translateFirebaseAuthError({ code: 'auth/network-request-failed' }),
      'Erreur de connexion réseau. Vérifiez votre accès Internet et réessayez.'
    );
    assert.equal(
      translateFirebaseAuthError({ code: 'auth/unauthorized-domain' }),
      "Ce domaine n'est pas encore autorisé dans Firebase Authentication (Authorized domains)."
    );
    assert.equal(translateFirebaseAuthError(new Error('Erreur custom')), 'Erreur custom');
    assert.equal(
      translateFirebaseAuthError(null),
      'Une erreur est survenue lors de la connexion. Veuillez réessayer.'
    );
  });

  it('buildMobileUserProfile applique tous les fallbacks (firstName/lastName, organizations map, TDGL par défaut)', () => {
    const p1 = buildMobileUserProfile(
      { uid: 'u1', email: 'sophie@asso.ch', displayName: null, emailVerified: false },
      {
        firstName: 'Sophie',
        lastName: 'Martin',
        organizations: { ORG_SCOUTS: { role: 'member', status: 'approved' } },
      }
    );
    assert.equal(p1.displayName, 'Sophie Martin');
    assert.equal(p1.orgId, 'ORG_SCOUTS');
    assert.equal(p1.orgName, 'ORG_SCOUTS');
    assert.equal(p1.emailVerified, true);

    const p2 = buildMobileUserProfile({ uid: 'u2', email: 'lucas@asso.ch' }, null);
    assert.equal(p2.displayName, 'lucas');
    assert.equal(p2.orgId, 'TDGL');
    assert.equal(p2.orgName, 'TDGL');
  });
});
