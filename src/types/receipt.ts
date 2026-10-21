export enum OrgRole {
  ADMIN = 'admin',
  CAISSIER = 'caissier',
  COMPTABLE = 'comptable',
  MEMBER = 'member',
}

export enum ComptaRole {
  CAISSIER = 'caissier',
  COMPTABLE = 'comptable',
  VERIFICATEUR = 'verificateur',
  VIEWER = 'viewer',
  UPLOADER = 'uploader', // Rôle minimal : envoi de pièces justificatives uniquement (Ticket WEB-01 / MOB-03)
}

export type ExpenseType = 'DEBIT_CARD' | 'REIMBURSEMENT';

export type ReimbursementStatus = 'PENDING' | 'REIMBURSED' | 'REJECTED';

export interface ReceiptTransferRequest {
  fromComptaId: string;
  fromComptaName: string;
  toComptaId: string;
  toComptaName: string;
  requestedByUid: string;
  requestedByName: string;
  requestedAt: number;
  note?: string;
  status: 'PENDING_CONFIRMATION';
}

export interface Receipt {
  id: string;
  url: string;
  fileName: string;
  uploadDate: string;
  extractedDate?: string;          // Date vérifiée par l'utilisateur (YYYY-MM-DD)
  extractedAmount?: number;        // Montant vérifié par l'utilisateur (CHF)
  isAnalyzed: boolean;
  linkedTransactionId?: string | null;

  // Champs Mobile & Workflow
  expenseType?: ExpenseType;       // 'DEBIT_CARD' | 'REIMBURSEMENT'
  description?: string;            // Motif / commentaire saisi par le membre
  merchantName?: string;           // Nom du commerce détecté par l'OCR
  submittedByUid?: string;         // UID Firebase du déposant
  submittedByName?: string;        // Nom complet du déposant
  submittedByEmail?: string;       // Email du déposant
  reimbursementIban?: string;      // IBAN pour le remboursement (si expenseType === 'REIMBURSEMENT')
  reimbursementStatus?: ReimbursementStatus;

  // Transfert inter-comptabilités (Ticket WEB-03)
  transferRequest?: ReceiptTransferRequest | null;
}

export interface AuthorizedComptabilite {
  orgId: string;
  orgName: string;
  comptaId: string;
  comptaName: string;
  currency: string;
  role: ComptaRole;
}
