import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { ComptaRole, type AuthorizedComptabilite } from '../types/receipt';
import { normalizeEmail } from './authHelpers';
import { canUseUnconfiguredDemoMode } from './sessionSecurity';
import {
  type OrganizationSnapshotInput,
  type RawComptaDoc,
  type RawDirectMemberDoc,
  type RawMemberDoc,
  type RawOrganizationDoc,
  resolveAuthorizedComptabilites,
  selectDefaultComptabilite,
  getComptaRoleLabel,
  normalizeComptaRole,
  doesMemberMatchUser,
  isOrganizationAdmin,
  isSuperAdminEmail,
} from './comptaHelpers';

export {
  resolveAuthorizedComptabilites,
  selectDefaultComptabilite,
  getComptaRoleLabel,
  normalizeComptaRole,
  doesMemberMatchUser,
  isOrganizationAdmin,
  isSuperAdminEmail,
};

const SELECTED_COMPTA_STORAGE_KEY = 'asso_compta_selected_compta_id_v1';

/**
 * Récupère la liste des comptabilités ouvertes (`isArchived !== true`) auxquelles
 * le membre connecté a accès (rôles : `admin`, `caissier`, `comptable`, `verificateur`, `viewer`, `uploader`).
 */
export const getUserAuthorizedComptabilites = async (
  uid: string,
  email: string
): Promise<AuthorizedComptabilite[]> => {
  const cleanUid = typeof uid === 'string' ? uid.trim() : '';
  const normalizedEmail = normalizeEmail(email);

  if (!cleanUid && !normalizedEmail) {
    return [];
  }

  // Mode développement local uniquement si Firebase n'est pas configuré
  if (!isFirebaseConfigured || !db) {
    if (!canUseUnconfiguredDemoMode(isFirebaseConfigured, Boolean(import.meta.env.PROD))) {
      return [];
    }
    if (normalizedEmail.includes('noaccess') || normalizedEmail.includes('sansacces')) {
      return [];
    }
    return [
      {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'louveteaux-26-27',
        comptaName: 'Louveteaux 26-27',
        currency: 'CHF',
        role: ComptaRole.UPLOADER,
      },
      {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'pionniers-26-27',
        comptaName: 'Pionniers 26-27',
        currency: 'CHF',
        role: ComptaRole.UPLOADER,
      },
    ];
  }

  const firestoreDb = db;
  const orgSnapshots: OrganizationSnapshotInput[] = [];

  const orgsSnap = await getDocs(collection(firestoreDb, 'organizations'));

  for (const orgDoc of orgsSnap.docs) {
    const orgData = orgDoc.data() as Record<string, unknown>;
    const rawOrg: RawOrganizationDoc = {
      id: orgDoc.id,
      name: typeof orgData.name === 'string' ? orgData.name : orgDoc.id,
      createdBy: typeof orgData.createdBy === 'string' ? orgData.createdBy : null,
      adminUid: typeof orgData.adminUid === 'string' ? orgData.adminUid : null,
      adminEmail: typeof orgData.adminEmail === 'string' ? orgData.adminEmail : null,
    };

    const candidateIds = Array.from(new Set([cleanUid, normalizedEmail].filter(Boolean)));
    const [memberSnaps, comptasSnap] = await Promise.all([
      Promise.all(
        candidateIds.map(async (memberId) => {
          try {
            return await getDoc(doc(firestoreDb, 'organizations', orgDoc.id, 'members', memberId));
          } catch {
            return null;
          }
        })
      ),
      getDocs(collection(firestoreDb, 'organizations', orgDoc.id, 'comptabilites')).catch(() => null),
    ]);

    const rawMembers: RawMemberDoc[] = memberSnaps
      .filter((mDoc): mDoc is NonNullable<typeof mDoc> => Boolean(mDoc && mDoc.exists()))
      .map((mDoc) => {
        const mData = mDoc.data() as Record<string, unknown>;
        return {
          id: mDoc.id,
          uid: typeof mData.uid === 'string' ? mData.uid : null,
          email: typeof mData.email === 'string' ? mData.email : null,
          role: typeof mData.role === 'string' ? mData.role : null,
          status: typeof mData.status === 'string' ? mData.status : null,
          comptaAccess:
            mData.comptaAccess && typeof mData.comptaAccess === 'object'
              ? (mData.comptaAccess as Record<string, unknown>)
              : null,
        };
      });

    const comptaDocs = comptasSnap ? comptasSnap.docs : [];
    const rawComptas: RawComptaDoc[] = await Promise.all(
      comptaDocs.map(async (cDoc) => {
        const cData = cDoc.data() as Record<string, unknown>;
        const isArchived = cData.isArchived === true;
        const directMembers: RawDirectMemberDoc[] = [];

        // Si la comptabilité est active, vérifier les fiches directes members/{uid|email}
        if (!isArchived && candidateIds.length > 0) {
          const directSnaps = await Promise.all(
            candidateIds.map(async (memberId) => {
              try {
                return await getDoc(
                  doc(firestoreDb, 'organizations', orgDoc.id, 'comptabilites', cDoc.id, 'members', memberId)
                );
              } catch {
                return null;
              }
            })
          );
          for (const directSnap of directSnaps) {
            if (!directSnap || !directSnap.exists()) continue;
            const dmData = directSnap.data() as Record<string, unknown>;
            directMembers.push({
              id: directSnap.id,
              uid: typeof dmData.uid === 'string' ? dmData.uid : cleanUid || null,
              email: typeof dmData.email === 'string' ? dmData.email : null,
              role: typeof dmData.role === 'string' ? dmData.role : null,
            });
          }
        }

        return {
          id: cDoc.id,
          name: typeof cData.name === 'string' ? cData.name : cDoc.id,
          currency: typeof cData.currency === 'string' ? cData.currency : 'CHF',
          isArchived,
          isSuspended: cData.isSuspended === true,
          fiscalYearStart: typeof cData.fiscalYearStart === 'string' ? cData.fiscalYearStart : '',
          fiscalYearEnd: typeof cData.fiscalYearEnd === 'string' ? cData.fiscalYearEnd : '',
          fiscalPeriod: typeof cData.fiscalPeriod === 'string' ? cData.fiscalPeriod : '',
          directMembers,
        };
      })
    );

    orgSnapshots.push({
      org: rawOrg,
      members: rawMembers,
      comptabilites: rawComptas,
    });
  }

  return resolveAuthorizedComptabilites(cleanUid, normalizedEmail, orgSnapshots);
};

export const getSelectedComptaIdFromStorage = (storage?: Storage | null): string | null => {
  try {
    const s = storage !== undefined ? storage : typeof localStorage !== 'undefined' ? localStorage : null;
    if (!s) return null;
    return s.getItem(SELECTED_COMPTA_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const saveSelectedComptaIdToStorage = (comptaId: string, storage?: Storage | null): void => {
  try {
    const s = storage !== undefined ? storage : typeof localStorage !== 'undefined' ? localStorage : null;
    if (!s) return;
    if (comptaId && comptaId.trim()) {
      s.setItem(SELECTED_COMPTA_STORAGE_KEY, comptaId.trim());
    } else {
      s.removeItem(SELECTED_COMPTA_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};
