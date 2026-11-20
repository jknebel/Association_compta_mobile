import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { Rental, NewRentalInput, RentalStatus } from '../types/rental';
import type { MobileUserProfile } from './authHelpers';

const LOCAL_RENTALS_STORAGE_KEY = 'asso_compta_local_rentals_v1';

export const getCachedRentals = (comptaId?: string | null): Rental[] => {
  try {
    const raw = localStorage.getItem(LOCAL_RENTALS_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Rental[];
    if (!Array.isArray(list)) return [];
    if (comptaId) {
      return list.filter((r) => !r.comptaId || r.comptaId === comptaId);
    }
    return list;
  } catch (e) {
    console.warn('Impossible de lire les locations en cache local :', e);
    return [];
  }
};

export const saveCachedRentals = (rentals: Rental[]): void => {
  try {
    localStorage.setItem(LOCAL_RENTALS_STORAGE_KEY, JSON.stringify(rentals));
  } catch (e) {
    console.warn('Impossible de sauvegarder les locations en cache local :', e);
  }
};

import {
  RENTAL_ROOMS,
  isValidRentalRoom,
  generateRentalId,
  calculateRentalStats,
  filterRentals,
  validateRentalInput,
  formatRentalDateRange,
  type RentalRoomOption,
  type RentalStats,
} from './rentalHelpers';

export {
  RENTAL_ROOMS,
  isValidRentalRoom,
  generateRentalId,
  calculateRentalStats,
  filterRentals,
  validateRentalInput,
  formatRentalDateRange,
  type RentalRoomOption,
  type RentalStats,
};

/**
 * Abonnement temps réel Firestore aux locations pour une organisation et comptabilité données.
 */
export const subscribeRentals = (
  orgId: string,
  comptaId: string,
  onUpdate: (rentals: Rental[]) => void,
  onError?: (err: Error) => void
): Unsubscribe => {
  const cleanOrg = (orgId || 'TDGL').trim();
  const cleanCompta = (comptaId || 'default').trim();

  // Mode hors-ligne / développement local
  if (!isFirebaseConfigured || !db) {
    const cached = getCachedRentals(cleanCompta);
    onUpdate(cached);
    return () => {};
  }

  const rentalsCollectionRef = collection(
    db,
    'organizations',
    cleanOrg,
    'comptabilites',
    cleanCompta,
    'rentals'
  );

  const q = query(rentalsCollectionRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Rental[] = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          orgId: typeof data.orgId === 'string' ? data.orgId : cleanOrg,
          comptaId: typeof data.comptaId === 'string' ? data.comptaId : cleanCompta,
          comptaName: typeof data.comptaName === 'string' ? data.comptaName : undefined,
          roomName: typeof data.roomName === 'string' ? data.roomName : 'Salle principale',
          renterName: typeof data.renterName === 'string' ? data.renterName : 'Locataire',
          renterPhone: typeof data.renterPhone === 'string' ? data.renterPhone : undefined,
          renterEmail: typeof data.renterEmail === 'string' ? data.renterEmail : undefined,
          startDate: typeof data.startDate === 'string' ? data.startDate : '',
          endDate: typeof data.endDate === 'string' ? data.endDate : undefined,
          amount: typeof data.amount === 'number' ? data.amount : Number(data.amount) || 0,
          status: (data.status as RentalStatus) || 'PENDING',
          notes: typeof data.notes === 'string' ? data.notes : undefined,
          paidAt: typeof data.paidAt === 'string' ? data.paidAt : null,
          paidByMethod: typeof data.paidByMethod === 'string' ? data.paidByMethod : null,
          paidMarkedByUid: typeof data.paidMarkedByUid === 'string' ? data.paidMarkedByUid : null,
          paidMarkedByName: typeof data.paidMarkedByName === 'string' ? data.paidMarkedByName : null,
          linkedTransactionId: typeof data.linkedTransactionId === 'string' ? data.linkedTransactionId : null,
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
          createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : '',
          createdByName: typeof data.createdByName === 'string' ? data.createdByName : '',
        };
      });

      saveCachedRentals(items);
      onUpdate(items);
    },
    (error) => {
      console.error('Erreur écoute locations Firestore :', error);
      if (onError) onError(error);
      const fallback = getCachedRentals(cleanCompta);
      onUpdate(fallback);
    }
  );
};

/**
 * Crée une nouvelle location enregistrée par le responsable des locations ou un admin.
 */
export const createRental = async (
  orgId: string,
  comptaId: string,
  input: NewRentalInput,
  user: MobileUserProfile
): Promise<Rental> => {
  const cleanOrg = (orgId || user.orgId || 'TDGL').trim();
  const cleanCompta = (comptaId || 'default').trim();
  const rentalId = generateRentalId();

  const newRental: Rental = {
    id: rentalId,
    orgId: cleanOrg,
    comptaId: cleanCompta,
    roomName: input.roomName.trim(),
    renterName: input.renterName.trim(),
    renterPhone: input.renterPhone?.trim() || '',
    renterEmail: input.renterEmail?.trim() || '',
    startDate: input.startDate,
    endDate: input.endDate || input.startDate,
    amount: Number(input.amount) || 0,
    status: 'PENDING',
    notes: input.notes?.trim() || '',
    paidAt: null,
    paidByMethod: null,
    paidMarkedByUid: null,
    paidMarkedByName: null,
    linkedTransactionId: null,
    createdAt: new Date().toISOString(),
    createdByUid: user.uid,
    createdByName: user.displayName || user.email,
    createdByEmail: user.email,
  };

  if (!isFirebaseConfigured || !db) {
    const list = getCachedRentals();
    const updated = [newRental, ...list];
    saveCachedRentals(updated);
    return newRental;
  }

  // Nettoyer toute valeur undefined pour Firestore
  const firestoreData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(newRental)) {
    if (v !== undefined) {
      firestoreData[k] = v;
    }
  }

  const docRef = doc(db, 'organizations', cleanOrg, 'comptabilites', cleanCompta, 'rentals', rentalId);
  await setDoc(docRef, firestoreData);

  const cached = getCachedRentals();
  saveCachedRentals([newRental, ...cached]);

  return newRental;
};

/**
 * Marque une location comme payée (avec méthode de paiement et horodatage).
 */
export const markRentalAsPaid = async (
  orgId: string,
  comptaId: string,
  rentalId: string,
  paymentMethod: string = 'Virement',
  user: MobileUserProfile
): Promise<void> => {
  const cleanOrg = (orgId || user.orgId || 'TDGL').trim();
  const cleanCompta = (comptaId || 'default').trim();
  const paidAt = new Date().toISOString();

  const patch = {
    status: 'PAID' as RentalStatus,
    paidAt,
    paidByMethod: paymentMethod,
    paidMarkedByUid: user.uid,
    paidMarkedByName: user.displayName || user.email,
  };

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'organizations', cleanOrg, 'comptabilites', cleanCompta, 'rentals', rentalId);
    await updateDoc(docRef, patch);
  }

  const cached = getCachedRentals();
  const updated = cached.map((r) => (r.id === rentalId ? { ...r, ...patch } : r));
  saveCachedRentals(updated);
};

/**
 * Met à jour le statut d'une location (ex. annulation ou remise en attente).
 */
export const updateRentalStatus = async (
  orgId: string,
  comptaId: string,
  rentalId: string,
  status: RentalStatus,
  user?: MobileUserProfile
): Promise<void> => {
  const cleanOrg = (orgId || user?.orgId || 'TDGL').trim();
  const cleanCompta = (comptaId || 'default').trim();

  const patch: Partial<Rental> = {
    status,
    ...(status === 'PENDING'
      ? { paidAt: null, paidByMethod: null, paidMarkedByUid: null, paidMarkedByName: null }
      : {}),
  };

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'organizations', cleanOrg, 'comptabilites', cleanCompta, 'rentals', rentalId);
    await updateDoc(docRef, patch);
  }

  const cached = getCachedRentals();
  const updated = cached.map((r) => (r.id === rentalId ? { ...r, ...patch } : r));
  saveCachedRentals(updated);
};

/**
 * Supprime une location.
 */
export const deleteRental = async (
  orgId: string,
  comptaId: string,
  rentalId: string
): Promise<void> => {
  const cleanOrg = (orgId || 'TDGL').trim();
  const cleanCompta = (comptaId || 'default').trim();

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, 'organizations', cleanOrg, 'comptabilites', cleanCompta, 'rentals', rentalId);
    await deleteDoc(docRef);
  }

  const cached = getCachedRentals();
  const updated = cached.filter((r) => r.id !== rentalId);
  saveCachedRentals(updated);
};
