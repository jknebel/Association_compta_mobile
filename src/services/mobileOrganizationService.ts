import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import { ComptaRole, type AuthorizedComptabilite } from '../types/receipt';
import { normalizeEmail } from './authHelpers';
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

  // Mode développement local si Firebase n'est pas configuré
  if (!isFirebaseConfigured || !db) {
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

    const [membersSnap, comptasSnap] = await Promise.all([
      getDocs(collection(firestoreDb, 'organizations', orgDoc.id, 'members')),
      getDocs(collection(firestoreDb, 'organizations', orgDoc.id, 'comptabilites')),
    ]);

    const rawMembers: RawMemberDoc[] = membersSnap.docs.map((mDoc) => {
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

    const rawComptas: RawComptaDoc[] = await Promise.all(
      comptasSnap.docs.map(async (cDoc) => {
        const cData = cDoc.data() as Record<string, unknown>;
        const isArchived = cData.isArchived === true;
        const directMembers: RawDirectMemberDoc[] = [];

        // Si la comptabilité est active et qu'on a un UID, vérifier aussi la sous-collection directe members/{uid}
        if (!isArchived && cleanUid) {
          try {
            const directSnap = await getDoc(
              doc(firestoreDb, 'organizations', orgDoc.id, 'comptabilites', cDoc.id, 'members', cleanUid)
            );
            if (directSnap.exists()) {
              const dmData = directSnap.data() as Record<string, unknown>;
              directMembers.push({
                id: directSnap.id,
                uid: typeof dmData.uid === 'string' ? dmData.uid : cleanUid,
                email: typeof dmData.email === 'string' ? dmData.email : null,
                role: typeof dmData.role === 'string' ? dmData.role : null,
              });
            }
          } catch {
            // Ignorer en cas de restriction de lecture sur une sous-collection non autorisée
          }
        }

        return {
          id: cDoc.id,
          name: typeof cData.name === 'string' ? cData.name : cDoc.id,
          currency: typeof cData.currency === 'string' ? cData.currency : 'CHF',
          isArchived,
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
