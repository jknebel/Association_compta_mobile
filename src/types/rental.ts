export type RentalStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface Rental {
  id: string;
  orgId: string;
  comptaId?: string;
  comptaName?: string;
  roomName: string;
  renterName: string;
  renterPhone?: string;
  renterEmail?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  amount: number; // Montant en CHF
  status: RentalStatus;
  notes?: string;
  paidAt?: string | null;
  paidByMethod?: 'Virement' | 'Cash' | 'TWINT' | 'Autre' | string | null;
  paidMarkedByUid?: string | null;
  paidMarkedByName?: string | null;
  linkedTransactionId?: string | null;
  createdAt: string; // ISO string
  createdByUid: string;
  createdByName: string;
  createdByEmail?: string;
  reminder5DaysSentAt?: string | null;
  visaNotifiedAt?: string | null;
  visaDate?: string | null;
  visaByUid?: string | null;
  visaByName?: string | null;
}

export interface NewRentalInput {
  roomName: string;
  renterName: string;
  renterPhone?: string;
  renterEmail?: string;
  startDate: string;
  endDate?: string;
  amount: number;
  notes?: string;
}
