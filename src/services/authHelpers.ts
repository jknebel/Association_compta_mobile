export interface MobileUserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  orgId: string;
  orgName: string;
  emailVerified: boolean;
  emailVerificationRequired: boolean;
  role?: string;
  roles?: string[];
  isRentalManager?: boolean;
  isAdmin?: boolean;
}

export const EXEMPT_VERIFICATION_EMAILS: readonly string[] = [
  'jean.francois.knebel@gmail.com',
  'jean-francois@knebel.ch',
  'quokka@tdgl.ch',
];

export const normalizeEmail = (email?: string | null): string => {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

export const isValidEmailFormat = (email?: string | null): boolean => {
  const norm = normalizeEmail(email);
  if (!norm || norm.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm);
};

export const isExemptFromEmailVerification = (email?: string | null): boolean => {
  const norm = normalizeEmail(email);
  if (!norm) return false;
  return EXEMPT_VERIFICATION_EMAILS.includes(norm);
};

/**
 * Vérifie si l'utilisateur est autorisé à accéder à l'application selon l'état
 * de vérification de son adresse e-mail (même règle que sur l'application Web).
 */
export const isEmailVerifiedForAccess = (
  user: { email?: string | null; emailVerified?: boolean } | null | undefined,
  profile?: { emailVerified?: boolean; emailVerificationRequired?: boolean } | null
): boolean => {
  if (!user) return false;
  if (isExemptFromEmailVerification(user.email)) return true;
  if (user.emailVerified === true) return true;
  if (!profile) return true;
  if (profile.emailVerificationRequired !== true) return true;
  return profile.emailVerified === true;
};

export interface CredentialValidationResult {
  valid: boolean;
  normalizedEmail: string;
  error: string | null;
}

export const validateLoginCredentials = (
  email?: string | null,
  password?: string | null
): CredentialValidationResult => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return {
      valid: false,
      normalizedEmail: '',
      error: 'Veuillez saisir votre adresse e-mail.',
    };
  }
  if (!isValidEmailFormat(normalizedEmail)) {
    return {
      valid: false,
      normalizedEmail,
      error: "Le format de l'adresse e-mail est invalide.",
    };
  }
  if (typeof password !== 'string' || password.length === 0) {
    return {
      valid: false,
      normalizedEmail,
      error: 'Veuillez saisir votre mot de passe.',
    };
  }
  return {
    valid: true,
    normalizedEmail,
    error: null,
  };
};

export const validatePasswordResetEmail = (
  email?: string | null
): CredentialValidationResult => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return {
      valid: false,
      normalizedEmail: '',
      error: 'Veuillez saisir votre adresse e-mail dans le champ ci-dessus pour réinitialiser votre mot de passe.',
    };
  }
  if (!isValidEmailFormat(normalizedEmail)) {
    return {
      valid: false,
      normalizedEmail,
      error: "Le format de l'adresse e-mail est invalide.",
    };
  }
  return {
    valid: true,
    normalizedEmail,
    error: null,
  };
};

/**
 * Traduit les erreurs Firebase Auth en messages clairs en français pour l'utilisateur mobile.
 */
export const translateFirebaseAuthError = (error: unknown): string => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe.';
    case 'auth/invalid-email':
      return "Le format de l'adresse e-mail est invalide.";
    case 'auth/user-disabled':
      return "Ce compte utilisateur a été désactivé. Contactez l'administrateur de votre association.";
    case 'auth/too-many-requests':
      return 'Trop de tentatives infructueuses. Veuillez patienter quelques minutes ou réinitialiser votre mot de passe.';
    case 'auth/network-request-failed':
      return 'Erreur de connexion réseau. Vérifiez votre accès Internet et réessayez.';
    case 'auth/unauthorized-domain':
      return "Ce domaine n'est pas encore autorisé dans Firebase Authentication (Authorized domains).";
    default: {
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Une erreur est survenue lors de la connexion. Veuillez réessayer.';
    }
  }
};

/**
 * Construit un profil utilisateur mobile normalisé à partir du document Firestore `users/{uid}`
 * et des informations Firebase Auth.
 */
export const buildMobileUserProfile = (
  authUser: { uid: string; email?: string | null; displayName?: string | null; emailVerified?: boolean },
  firestoreData?: Record<string, unknown> | null
): MobileUserProfile => {
  const email = normalizeEmail(
    (typeof firestoreData?.email === 'string' ? firestoreData.email : authUser.email) || ''
  );
  const firstName = typeof firestoreData?.firstName === 'string' ? firestoreData.firstName.trim() : '';
  const lastName = typeof firestoreData?.lastName === 'string' ? firestoreData.lastName.trim() : '';
  const fullName = `${firstName} ${lastName}`.trim();
  const rawDisplayName =
    typeof firestoreData?.displayName === 'string' && firestoreData.displayName.trim()
      ? firestoreData.displayName.trim()
      : fullName || (authUser.displayName ? authUser.displayName.trim() : '') || email.split('@')[0] || 'Membre';

  let orgId = typeof firestoreData?.orgId === 'string' && firestoreData.orgId.trim() ? firestoreData.orgId.trim() : '';
  if (!orgId && firestoreData?.organizations && typeof firestoreData.organizations === 'object') {
    const orgKeys = Object.keys(firestoreData.organizations as Record<string, unknown>);
    if (orgKeys.length > 0) {
      orgId = orgKeys[0];
    }
  }
  if (!orgId) {
    orgId = 'TDGL';
  }

  const orgName =
    typeof firestoreData?.orgName === 'string' && firestoreData.orgName.trim()
      ? firestoreData.orgName.trim()
      : orgId;

  const emailVerificationRequired = firestoreData?.emailVerificationRequired === true;
  const emailVerified =
    authUser.emailVerified === true ||
    firestoreData?.emailVerified === true ||
    isExemptFromEmailVerification(email) ||
    !emailVerificationRequired;

  const rawRole = typeof firestoreData?.role === 'string' ? firestoreData.role.trim().toLowerCase() : '';
  const rawRoles = Array.isArray(firestoreData?.roles)
    ? (firestoreData.roles as unknown[]).filter((r): r is string => typeof r === 'string').map(r => r.trim().toLowerCase())
    : [];

  let orgAdmin = rawRole === 'admin' || rawRoles.includes('admin') || isExemptFromEmailVerification(email);
  if (!orgAdmin && firestoreData?.organizations && typeof firestoreData.organizations === 'object') {
    for (const orgVal of Object.values(firestoreData.organizations as Record<string, unknown>)) {
      if (orgVal && typeof orgVal === 'object' && 'role' in orgVal && (orgVal as { role: unknown }).role === 'admin') {
        orgAdmin = true;
        break;
      }
    }
  }

  const isRentalManager =
    firestoreData?.isRentalManager === true ||
    rawRole === 'responsable_location' ||
    rawRole === 'rental_manager' ||
    rawRoles.includes('responsable_location') ||
    rawRoles.includes('rental_manager') ||
    orgAdmin;

  return {
    uid: authUser.uid,
    email,
    displayName: rawDisplayName,
    firstName,
    lastName,
    orgId,
    orgName,
    emailVerified,
    emailVerificationRequired,
    ...(rawRole ? { role: rawRole } : {}),
    ...(rawRoles.length > 0 ? { roles: rawRoles } : {}),
    ...(isRentalManager ? { isRentalManager: true } : {}),
    ...(orgAdmin ? { isAdmin: true } : {}),
  };
};

/**
 * Détermine si l'utilisateur a accès au module "Locations".
 * Accessible aux administrateurs (ex. test immédiat avec le compte admin)
 * et aux personnes ayant le titre / rôle de responsable location.
 */
export const canUserAccessRentals = (
  profile: MobileUserProfile | null,
  email?: string | null
): boolean => {
  if (!profile && !email) return false;
  const normalized = normalizeEmail(profile?.email || email);
  if (isExemptFromEmailVerification(normalized)) return true;
  if (profile?.isAdmin === true) return true;
  if (profile?.isRentalManager === true) return true;
  if (profile?.role === 'admin' || profile?.role === 'responsable_location') return true;
  if (profile?.roles?.some(r => r === 'admin' || r === 'responsable_location')) return true;
  return false;
};
