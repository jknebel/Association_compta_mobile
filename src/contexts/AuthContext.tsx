import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import {
  type MobileUserProfile,
  buildMobileUserProfile,
  isEmailVerifiedForAccess,
  validateLoginCredentials,
  validatePasswordResetEmail,
  translateFirebaseAuthError,
} from '../services/authHelpers';

const LOCAL_SESSION_STORAGE_KEY = 'asso_compta_mobile_session_v1';

interface AuthContextValue {
  user: User | null;
  userProfile: MobileUserProfile | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userProfile: null,
  loading: true,
  error: null,
  isConfigured: isFirebaseConfigured,
  login: async () => {},
  sendPasswordReset: async () => {},
  logout: async () => {},
  clearError: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<MobileUserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mode développement local hors-ligne si les variables VITE_FIREBASE_* ne sont pas renseignées
    if (!isFirebaseConfigured || !auth) {
      try {
        const saved = localStorage.getItem(LOCAL_SESSION_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as MobileUserProfile;
          if (parsed && parsed.uid && parsed.email) {
            setUserProfile(parsed);
          }
        }
      } catch (e) {
        console.warn('Impossible de relire la session locale :', e);
      } finally {
        setLoading(false);
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        try {
          await firebaseUser.reload();
        } catch {
          // Ignorer une erreur réseau passagère sur reload() (mode PWA hors-ligne / réseau lent)
        }

        let firestoreData: Record<string, unknown> | null = null;
        if (db) {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            firestoreData = snap.data() as Record<string, unknown>;
          }
        }

        const verified = isEmailVerifiedForAccess(
          { email: firebaseUser.email, emailVerified: firebaseUser.emailVerified },
          firestoreData
            ? {
                emailVerified: firestoreData.emailVerified === true,
                emailVerificationRequired: firestoreData.emailVerificationRequired === true,
              }
            : null
        );

        if (!verified) {
          if (auth) {
            await signOut(auth);
          }
          setUser(null);
          setUserProfile(null);
          setError(
            'Veuillez vérifier votre adresse e-mail en cliquant sur le lien reçu lors de votre inscription avant de vous connecter.'
          );
          setLoading(false);
          return;
        }

        // Synchroniser le flag emailVerified dans Firestore s'il vient d'être validé
        if (
          db &&
          firestoreData &&
          firestoreData.emailVerificationRequired === true &&
          firestoreData.emailVerified === false
        ) {
          try {
            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              emailVerified: true,
              emailVerificationRequired: false,
            });
            firestoreData = {
              ...firestoreData,
              emailVerified: true,
              emailVerificationRequired: false,
            };
          } catch (updateErr) {
            console.warn('Impossible de mettre à jour le statut emailVerified :', updateErr);
          }
        }

        let profile = buildMobileUserProfile(firebaseUser, firestoreData);

        // Si le nom de l'organisation est un simple code (ex. TDGL), tenter de récupérer le nom complet
        if (db && profile.orgId) {
          try {
            const orgSnap = await getDoc(doc(db, 'organizations', profile.orgId));
            if (orgSnap.exists()) {
              const orgData = orgSnap.data() as { name?: string };
              if (orgData?.name && orgData.name.trim()) {
                profile = { ...profile, orgName: orgData.name.trim() };
              }
            }
          } catch {
            // Conserver le nom d'organisation par défaut
          }
        }

        setUser(firebaseUser);
        setUserProfile(profile);
      } catch (err) {
        console.error('Erreur lors du chargement du profil utilisateur :', err);
        setUser(firebaseUser);
        setUserProfile(buildMobileUserProfile(firebaseUser, null));
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const clearError = () => setError(null);

  const login = async (email: string, password: string): Promise<void> => {
    setError(null);
    const validation = validateLoginCredentials(email, password);
    if (!validation.valid) {
      setError(validation.error);
      throw new Error(validation.error || 'Identifiants invalides');
    }

    if (!isFirebaseConfigured || !auth) {
      const fallbackProfile = buildMobileUserProfile(
        {
          uid: `local-${validation.normalizedEmail}`,
          email: validation.normalizedEmail,
          displayName: validation.normalizedEmail.split('@')[0],
          emailVerified: true,
        },
        { orgId: 'TDGL', orgName: 'Troupe du Grand Lac' }
      );
      localStorage.setItem(LOCAL_SESSION_STORAGE_KEY, JSON.stringify(fallbackProfile));
      setUserProfile(fallbackProfile);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, validation.normalizedEmail, password);
    } catch (err) {
      const msg = translateFirebaseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    setError(null);
    const validation = validatePasswordResetEmail(email);
    if (!validation.valid) {
      setError(validation.error);
      throw new Error(validation.error || 'Adresse e-mail invalide');
    }

    if (!isFirebaseConfigured || !auth) {
      return;
    }

    try {
      await sendPasswordResetEmail(auth, validation.normalizedEmail);
    } catch (err) {
      const msg = translateFirebaseAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async (): Promise<void> => {
    setError(null);
    localStorage.removeItem(LOCAL_SESSION_STORAGE_KEY);
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        error,
        isConfigured: isFirebaseConfigured,
        login,
        sendPasswordReset,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
