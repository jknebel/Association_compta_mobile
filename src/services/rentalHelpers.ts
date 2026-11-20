import type { Rental, NewRentalInput } from '../types/rental';

export const RENTAL_ROOMS = ['Local avec cuisine', 'Local sans cuisine'] as const;
export type RentalRoomOption = (typeof RENTAL_ROOMS)[number];

export const isValidRentalRoom = (roomName?: string | null): roomName is RentalRoomOption => {
  if (typeof roomName !== 'string') return false;
  return (RENTAL_ROOMS as readonly string[]).includes(roomName.trim());
};

export interface RentalStats {
  pendingAmount: number;
  pendingCount: number;
  paidAmount: number;
  paidCount: number;
  totalAmount: number;
  totalCount: number;
}

export const sanitizeRentalToken = (rawToken?: string | null): string => {
  const cleaned =
    typeof rawToken === 'string'
      ? rawToken.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8)
      : '';
  return cleaned || Math.random().toString(36).substring(2, 8);
};

export const generateRentalId = (
  timestampMs?: number,
  randomToken?: string | null
): string => {
  const safeTs =
    typeof timestampMs === 'number' && Number.isFinite(timestampMs) && timestampMs > 0
      ? Math.floor(timestampMs)
      : Date.now();
  const token = sanitizeRentalToken(randomToken);
  return `rental-${safeTs}-${token}`;
};

export const calculateRentalStats = (rentals: Rental[]): RentalStats => {
  let pendingAmount = 0;
  let pendingCount = 0;
  let paidAmount = 0;
  let paidCount = 0;

  for (const r of rentals) {
    const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : 0;
    if (r.status === 'PENDING') {
      pendingAmount += amount;
      pendingCount++;
    } else if (r.status === 'PAID') {
      paidAmount += amount;
      paidCount++;
    }
  }

  return {
    pendingAmount,
    pendingCount,
    paidAmount,
    paidCount,
    totalAmount: pendingAmount + paidAmount,
    totalCount: rentals.length,
  };
};

export const filterRentals = (
  rentals: Rental[],
  searchQuery: string = '',
  statusFilter: 'ALL' | 'PENDING' | 'PAID' = 'ALL'
): Rental[] => {
  const q = typeof searchQuery === 'string' ? searchQuery.trim().toLowerCase() : '';

  return rentals.filter((r) => {
    if (statusFilter === 'PENDING' && r.status !== 'PENDING') return false;
    if (statusFilter === 'PAID' && r.status !== 'PAID') return false;
    if (!q) return true;

    const name = (r.renterName || '').toLowerCase();
    const room = (r.roomName || '').toLowerCase();
    const phone = (r.renterPhone || '').toLowerCase();
    const email = (r.renterEmail || '').toLowerCase();
    const notes = (r.notes || '').toLowerCase();

    return (
      name.includes(q) ||
      room.includes(q) ||
      phone.includes(q) ||
      email.includes(q) ||
      notes.includes(q)
    );
  });
};

export interface RentalValidationResult {
  valid: boolean;
  error: string | null;
}

export const validateRentalInput = (input: NewRentalInput): RentalValidationResult => {
  if (!input.renterName || !input.renterName.trim()) {
    return { valid: false, error: 'Veuillez renseigner le nom du locataire.' };
  }
  if (!isValidRentalRoom(input.roomName)) {
    return {
      valid: false,
      error: 'Veuillez choisir entre « Local avec cuisine » et « Local sans cuisine ».',
    };
  }
  if (typeof input.amount !== 'number' || isNaN(input.amount) || input.amount <= 0) {
    return { valid: false, error: 'Le montant en CHF doit être supérieur à zéro.' };
  }
  if (!input.startDate || !input.startDate.trim()) {
    return { valid: false, error: 'Veuillez sélectionner la date de location.' };
  }
  return { valid: true, error: null };
};

export const formatRentalDateRange = (startDate: string, endDate?: string): string => {
  if (!startDate) return '';
  if (!endDate || endDate === startDate) return startDate;
  return `${startDate} au ${endDate}`;
};
