import type { ComptaRole, AuthorizedComptabilite } from '../types/receipt';

const normalizeEmailLocal = (email?: string | null): string => {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

export const SUPER_ADMIN_EMAILS: readonly string[] = [
  'jean.francois.knebel@gmail.com',
  'jean-francois@knebel.ch',
];

export interface RawOrganizationDoc {
  id: string;
  name?: string | null;
  createdBy?: string | null;
  adminUid?: string | null;
  adminEmail?: string | null;
}

export interface RawMemberDoc {
  id: string;
  uid?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  comptaAccess?: Record<string, unknown> | null;
}

export interface RawDirectMemberDoc {
  id: string;
  uid?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface RawComptaDoc {
  id: string;
  name?: string | null;
  currency?: string | null;
  isArchived?: boolean | null;
  isSuspended?: boolean | null;
  fiscalYearStart?: string | null;
  fiscalYearEnd?: string | null;
  fiscalPeriod?: string | null;
  directMembers?: RawDirectMemberDoc[];
}

export const stripPeriodFromComptaName = (name: string): string => {
  const trimmed = (name || '').trim();
  const dualYearMatch = trimmed.match(/^(.*?)\s*(\d{2,4})\s*[\/\-]\s*(\d{2,4})$/);
  if (dualYearMatch && dualYearMatch[1].trim()) {
    return dualYearMatch[1].trim();
  }
  return trimmed;
};

export const groupAuthorizedComptas = (
  comptas: AuthorizedComptabilite[]
): AuthorizedComptabilite[] => {
  const byGroup = new Map<string, AuthorizedComptabilite>();
  for (const c of comptas) {
    const base = c.baseName || stripPeriodFromComptaName(c.comptaName);
    const key = `${c.orgId}::${base.toLowerCase()}`;
    const existing = byGroup.get(key);
    if (!existing) {
      byGroup.set(key, { ...c, baseName: base });
      continue;
    }
    const existingStart = existing.fiscalYearStart || '';
    const candidateStart = c.fiscalYearStart || '';
    if (candidateStart > existingStart) {
      byGroup.set(key, { ...c, baseName: base });
    }
  }
  return Array.from(byGroup.values());
};

export const resolveTargetComptaByDate = (
  allComptas: AuthorizedComptabilite[],
  selectedCompta: AuthorizedComptabilite,
  invoiceDateYMD?: string | null
): AuthorizedComptabilite => {
  const dateStr = typeof invoiceDateYMD === 'string' ? invoiceDateYMD.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return selectedCompta;
  }

  const targetBase = (
    selectedCompta.baseName || stripPeriodFromComptaName(selectedCompta.comptaName)
  ).toLowerCase();

  const sameGroup = allComptas.filter((c) => {
    if (c.orgId !== selectedCompta.orgId) return false;
    const cBase = (c.baseName || stripPeriodFromComptaName(c.comptaName)).toLowerCase();
    return cBase === targetBase;
  });

  if (sameGroup.length <= 1) {
    return selectedCompta;
  }

  // 1. Exact bounded match: fiscalYearStart <= date <= fiscalYearEnd
  const boundedMatches = sameGroup.filter((c) => {
    const start = (c.fiscalYearStart || '').trim();
    const end = (c.fiscalYearEnd || '').trim();
    return Boolean(start && end && dateStr >= start && dateStr <= end);
  });
  if (boundedMatches.length > 0) {
    boundedMatches.sort((a, b) => (b.fiscalYearStart || '').localeCompare(a.fiscalYearStart || ''));
    return boundedMatches[0];
  }

  // 2. Open-ended match: start <= date (no end) OR date <= end (no start)
  const openMatches = sameGroup.filter((c) => {
    const start = (c.fiscalYearStart || '').trim();
    const end = (c.fiscalYearEnd || '').trim();
    if (start && !end) return dateStr >= start;
    if (!start && end) return dateStr <= end;
    return false;
  });
  if (openMatches.length > 0) {
    openMatches.sort((a, b) => (b.fiscalYearStart || '').localeCompare(a.fiscalYearStart || ''));
    return openMatches[0];
  }

  return selectedCompta;
};

export interface OrganizationSnapshotInput {
  org: RawOrganizationDoc;
  members: RawMemberDoc[];
  comptabilites: RawComptaDoc[];
}

/**
 * Vérifie si l'adresse e-mail correspond à un super-administrateur global.
 */
export const isSuperAdminEmail = (email?: string | null): boolean => {
  const norm = normalizeEmailLocal(email);
  if (!norm) return false;
  return SUPER_ADMIN_EMAILS.includes(norm);
};

/**
 * Normalise une chaîne de rôle issue de Firestore en `ComptaRole` valide,
 * ou retourne `null` si le rôle est absent, `'none'` ou inconnu.
 */
export const normalizeComptaRole = (rawRole?: unknown): ComptaRole | null => {
  if (typeof rawRole !== 'string') return null;
  const norm = rawRole.trim().toLowerCase();
  switch (norm) {
    case 'admin':
    case 'caissier':
      return 'caissier' as ComptaRole;
    case 'comptable':
      return 'comptable' as ComptaRole;
    case 'verificateur':
      return 'verificateur' as ComptaRole;
    case 'viewer':
      return 'viewer' as ComptaRole;
    case 'uploader':
      return 'uploader' as ComptaRole;
    case 'responsable_location':
    case 'location':
    case 'locations':
      return 'responsable_location' as ComptaRole;
    default:
      return null;
  }
};

/**
 * Retourne le libellé en français d'un rôle sur une comptabilité.
 */
export const getComptaRoleLabel = (role?: ComptaRole | string | null): string => {
  const normalized = normalizeComptaRole(role);
  switch (normalized) {
    case 'caissier':
      return 'Caissier';
    case 'comptable':
      return 'Comptable';
    case 'verificateur':
      return 'Vérificateur';
    case 'viewer':
      return 'Lecteur';
    case 'uploader':
      return 'Déposant de factures';
    case 'responsable_location':
      return 'Responsable Locations';
    default:
      return 'Aucun accès';
  }
};

/**
 * Vérifie si un document membre correspond à l'utilisateur connecté (par UID ou par e-mail).
 */
export const doesMemberMatchUser = (
  member: { id: string; uid?: string | null; email?: string | null },
  uid: string,
  normalizedUserEmail: string
): boolean => {
  const cleanUid = typeof uid === 'string' ? uid.trim() : '';
  if (cleanUid && (member.id === cleanUid || member.uid === cleanUid)) {
    return true;
  }
  if (normalizedUserEmail) {
    const docIdEmail = typeof member.id === 'string' ? member.id.trim().toLowerCase() : '';
    const fieldEmail = normalizeEmailLocal(member.email);
    if (docIdEmail === normalizedUserEmail || fieldEmail === normalizedUserEmail) {
      return true;
    }
  }
  return false;
};

/**
 * Détermine si l'utilisateur est administrateur de l'organisation (ou super-admin).
 */
export const isOrganizationAdmin = (
  org: RawOrganizationDoc,
  members: RawMemberDoc[],
  uid: string,
  normalizedUserEmail: string
): boolean => {
  const cleanUid = typeof uid === 'string' ? uid.trim() : '';
  if (isSuperAdminEmail(normalizedUserEmail)) {
    return true;
  }
  if (cleanUid && (org.createdBy === cleanUid || org.adminUid === cleanUid)) {
    return true;
  }
  if (normalizedUserEmail && normalizeEmailLocal(org.adminEmail) === normalizedUserEmail) {
    return true;
  }
  return members.some((m) => {
    if (m.status === 'rejected') return false;
    if (!doesMemberMatchUser(m, cleanUid, normalizedUserEmail)) return false;
    const roleNorm = typeof m.role === 'string' ? m.role.trim().toLowerCase() : '';
    return roleNorm === 'admin';
  });
};

/**
 * Résout la liste des comptabilités ouvertes (`isArchived !== true`) auxquelles
 * l'utilisateur connecté a accès à partir des données d'organisations.
 */
export const resolveAuthorizedComptabilites = (
  uid: string,
  email: string,
  organizations: OrganizationSnapshotInput[]
): AuthorizedComptabilite[] => {
  const cleanUid = typeof uid === 'string' ? uid.trim() : '';
  const normalizedUserEmail = normalizeEmailLocal(email);

  if (!cleanUid && !normalizedUserEmail) {
    return [];
  }

  const results: AuthorizedComptabilite[] = [];
  const seenKeys = new Set<string>();

  for (const { org, members, comptabilites } of organizations) {
    if (!org || !org.id) continue;

    const orgName =
      typeof org.name === 'string' && org.name.trim() ? org.name.trim() : org.id;

    const isOrgAdmin = isOrganizationAdmin(org, members || [], cleanUid, normalizedUserEmail);

    // Vérifier si l'utilisateur a le rôle global "responsable_location" au niveau du Groupe
    let isOrgRentalManager = false;

    // Collecter les accès explicites depuis organizations/{orgId}/members
    const explicitRolesByComptaId = new Map<string, ComptaRole>();
    for (const memberDoc of members || []) {
      if (memberDoc.status === 'rejected') continue;
      if (!doesMemberMatchUser(memberDoc, cleanUid, normalizedUserEmail)) continue;

      const orgRoleNorm = typeof memberDoc.role === 'string' ? memberDoc.role.trim().toLowerCase() : '';
      if (orgRoleNorm === 'responsable_location' || orgRoleNorm === 'location' || orgRoleNorm === 'locations') {
        isOrgRentalManager = true;
      }

      if (memberDoc.comptaAccess && typeof memberDoc.comptaAccess === 'object') {
        for (const [comptaId, rawRole] of Object.entries(memberDoc.comptaAccess)) {
          const validRole = normalizeComptaRole(rawRole);
          if (validRole && !explicitRolesByComptaId.has(comptaId)) {
            explicitRolesByComptaId.set(comptaId, validRole);
          }
        }
      }
    }

    for (const compta of comptabilites || []) {
      if (!compta || !compta.id) continue;
      // Exclure impérativement les comptabilités archivées ou suspendues (Exigence MOB-03 tâche 3)
      if (compta.isArchived === true || compta.isSuspended === true) continue;

      const uniqueKey = `${org.id}::${compta.id}`;
      if (seenKeys.has(uniqueKey)) continue;

      let resolvedRole: ComptaRole | null = explicitRolesByComptaId.get(compta.id) ?? null;

      // Vérifier aussi la sous-collection directe comptabilites/{comptaId}/members
      if (!resolvedRole && Array.isArray(compta.directMembers)) {
        for (const dm of compta.directMembers) {
          if (doesMemberMatchUser(dm, cleanUid, normalizedUserEmail)) {
            const dmRole = normalizeComptaRole(dm.role);
            if (dmRole) {
              resolvedRole = dmRole;
              break;
            }
          }
        }
      }

      // Si l'utilisateur est admin de l'organisation, il a accès à toutes les comptas actives
      if (!resolvedRole && isOrgAdmin) {
        resolvedRole = 'caissier' as ComptaRole;
      }

      // Si l'utilisateur a le rôle Responsable Locations au niveau Groupe, lui ouvrir la compta de Groupe
      const cNameNorm = typeof compta.name === 'string' ? compta.name.toLowerCase() : '';
      if (!resolvedRole && isOrgRentalManager && cNameNorm.includes('groupe')) {
        resolvedRole = 'responsable_location' as ComptaRole;
      }

      if (!resolvedRole) continue;

      seenKeys.add(uniqueKey);
      const comptaName =
        typeof compta.name === 'string' && compta.name.trim()
          ? compta.name.trim()
          : compta.id;
      const currency =
        typeof compta.currency === 'string' && compta.currency.trim()
          ? compta.currency.trim().toUpperCase()
          : 'CHF';

      const fStart = typeof compta.fiscalYearStart === 'string' ? compta.fiscalYearStart.trim() : '';
      const fEnd = typeof compta.fiscalYearEnd === 'string' ? compta.fiscalYearEnd.trim() : '';
      const fPeriod = typeof compta.fiscalPeriod === 'string' ? compta.fiscalPeriod.trim() : '';

      results.push({
        orgId: org.id,
        orgName,
        comptaId: compta.id,
        comptaName,
        ...(fStart ? { fiscalYearStart: fStart } : {}),
        ...(fEnd ? { fiscalYearEnd: fEnd } : {}),
        ...(fPeriod ? { fiscalPeriod: fPeriod } : {}),
        currency,
        role: resolvedRole,
      });
    }
  }

  return results.sort((a, b) => {
    const orgCmp = a.orgName.localeCompare(b.orgName, 'fr');
    if (orgCmp !== 0) return orgCmp;
    return a.comptaName.localeCompare(b.comptaName, 'fr');
  });
};

/**
 * Sélectionne la comptabilité active par défaut :
 * - Si `preferredComptaId` existe dans la liste autorisée, la retourne.
 * - Sinon retourne la première comptabilité de la liste, ou `null` si la liste est vide.
 */
export const selectDefaultComptabilite = (
  authorizedList: AuthorizedComptabilite[],
  preferredComptaId?: string | null
): AuthorizedComptabilite | null => {
  if (!Array.isArray(authorizedList) || authorizedList.length === 0) {
    return null;
  }
  if (typeof preferredComptaId === 'string' && preferredComptaId.trim()) {
    const found = authorizedList.find((c) => c.comptaId === preferredComptaId.trim());
    if (found) return found;
  }
  return authorizedList[0];
};
