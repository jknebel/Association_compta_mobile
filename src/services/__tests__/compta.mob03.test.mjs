import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isSuperAdminEmail,
  normalizeComptaRole,
  getComptaRoleLabel,
  doesMemberMatchUser,
  isOrganizationAdmin,
  resolveAuthorizedComptabilites,
  selectDefaultComptabilite,
} from '../comptaHelpers.ts';

describe('[MOB-03] comptaHelpers Unit & Integration Tests', () => {
  describe('isSuperAdminEmail()', () => {
    it('returns true for configured super-admin emails (case-insensitive & trimmed)', () => {
      assert.strictEqual(isSuperAdminEmail('jean.francois.knebel@gmail.com'), true);
      assert.strictEqual(isSuperAdminEmail('  JEAN-FRANCOIS@KNEBEL.CH '), true);
    });

    it('returns false for regular emails or empty/null values', () => {
      assert.strictEqual(isSuperAdminEmail('membre@scout.ch'), false);
      assert.strictEqual(isSuperAdminEmail(''), false);
      assert.strictEqual(isSuperAdminEmail(null), false);
      assert.strictEqual(isSuperAdminEmail(undefined), false);
    });
  });

  describe('normalizeComptaRole()', () => {
    it('maps valid role strings and admin alias to ComptaRole values', () => {
      assert.strictEqual(normalizeComptaRole('admin'), 'caissier');
      assert.strictEqual(normalizeComptaRole('CAISSIER'), 'caissier');
      assert.strictEqual(normalizeComptaRole(' comptable '), 'comptable');
      assert.strictEqual(normalizeComptaRole('verificateur'), 'verificateur');
      assert.strictEqual(normalizeComptaRole('viewer'), 'viewer');
      assert.strictEqual(normalizeComptaRole('uploader'), 'uploader');
    });

    it('returns null for none, unknown strings, or non-string values', () => {
      assert.strictEqual(normalizeComptaRole('none'), null);
      assert.strictEqual(normalizeComptaRole('unknown_role'), null);
      assert.strictEqual(normalizeComptaRole(''), null);
      assert.strictEqual(normalizeComptaRole(null), null);
      assert.strictEqual(normalizeComptaRole(undefined), null);
      assert.strictEqual(normalizeComptaRole(123), null);
    });
  });

  describe('getComptaRoleLabel()', () => {
    it('returns French label for each valid role', () => {
      assert.strictEqual(getComptaRoleLabel('caissier'), 'Caissier');
      assert.strictEqual(getComptaRoleLabel('admin'), 'Caissier');
      assert.strictEqual(getComptaRoleLabel('comptable'), 'Comptable');
      assert.strictEqual(getComptaRoleLabel('verificateur'), 'Vérificateur');
      assert.strictEqual(getComptaRoleLabel('viewer'), 'Lecteur');
      assert.strictEqual(getComptaRoleLabel('uploader'), 'Déposant de factures');
    });

    it('returns "Aucun accès" for invalid or null roles', () => {
      assert.strictEqual(getComptaRoleLabel('none'), 'Aucun accès');
      assert.strictEqual(getComptaRoleLabel(null), 'Aucun accès');
    });
  });

  describe('doesMemberMatchUser()', () => {
    it('matches when member.id equals uid', () => {
      assert.strictEqual(
        doesMemberMatchUser({ id: 'uid-123', email: 'other@test.ch' }, 'uid-123', 'me@test.ch'),
        true
      );
    });

    it('matches when member.uid equals uid', () => {
      assert.strictEqual(
        doesMemberMatchUser({ id: 'doc-1', uid: 'uid-123' }, 'uid-123', 'me@test.ch'),
        true
      );
    });

    it('matches when member.id equals normalized email (invited member doc keyed by email)', () => {
      assert.strictEqual(
        doesMemberMatchUser({ id: 'Membre@Test.ch' }, 'uid-999', 'membre@test.ch'),
        true
      );
    });

    it('matches when member.email equals normalized email', () => {
      assert.strictEqual(
        doesMemberMatchUser({ id: 'doc-2', email: '  Membre@Test.ch ' }, 'uid-999', 'membre@test.ch'),
        true
      );
    });

    it('returns false when neither uid nor email matches', () => {
      assert.strictEqual(
        doesMemberMatchUser({ id: 'uid-other', uid: 'uid-other', email: 'other@test.ch' }, 'uid-123', 'me@test.ch'),
        false
      );
      assert.strictEqual(
        doesMemberMatchUser({ id: 'uid-other' }, '', ''),
        false
      );
    });
  });

  describe('isOrganizationAdmin()', () => {
    const baseOrg = {
      id: 'TDGL',
      name: 'Troupe du Grand Lac',
      createdBy: 'creator-uid',
      adminUid: 'admin-uid',
      adminEmail: 'chef@tdgl.ch',
    };

    it('returns true for global super-admin email', () => {
      assert.strictEqual(
        isOrganizationAdmin(baseOrg, [], 'any-uid', 'jean.francois.knebel@gmail.com'),
        true
      );
    });

    it('returns true when uid matches org.createdBy or org.adminUid', () => {
      assert.strictEqual(isOrganizationAdmin(baseOrg, [], 'creator-uid', 'user@tdgl.ch'), true);
      assert.strictEqual(isOrganizationAdmin(baseOrg, [], 'admin-uid', 'user@tdgl.ch'), true);
    });

    it('returns true when email matches org.adminEmail', () => {
      assert.strictEqual(isOrganizationAdmin(baseOrg, [], 'random-uid', 'chef@tdgl.ch'), true);
    });

    it('returns true when matching member has role "admin" and is not rejected', () => {
      const members = [{ id: 'u1', uid: 'u1', role: 'admin', status: 'approved' }];
      assert.strictEqual(isOrganizationAdmin(baseOrg, members, 'u1', 'u1@tdgl.ch'), true);
    });

    it('returns false when matching member has role "admin" but status is "rejected"', () => {
      const members = [{ id: 'u1', uid: 'u1', role: 'admin', status: 'rejected' }];
      assert.strictEqual(isOrganizationAdmin(baseOrg, members, 'u1', 'u1@tdgl.ch'), false);
    });

    it('returns false for regular member', () => {
      const members = [{ id: 'u1', uid: 'u1', role: 'member', status: 'approved' }];
      assert.strictEqual(isOrganizationAdmin(baseOrg, members, 'u1', 'u1@tdgl.ch'), false);
    });
  });

  describe('resolveAuthorizedComptabilites()', () => {
    const sampleOrganizations = [
      {
        org: { id: 'TDGL', name: 'Troupe du Grand Lac', createdBy: 'admin-1' },
        members: [
          {
            id: 'user-uploader',
            uid: 'user-uploader',
            email: 'deposant@tdgl.ch',
            role: 'member',
            status: 'approved',
            comptaAccess: {
              'compta-louveteaux': 'uploader',
              'compta-archivee': 'uploader',
              'compta-none': 'none',
            },
          },
          {
            id: 'rejected@tdgl.ch',
            uid: 'user-rejected',
            email: 'rejected@tdgl.ch',
            role: 'member',
            status: 'rejected',
            comptaAccess: {
              'compta-louveteaux': 'caissier',
            },
          },
        ],
        comptabilites: [
          {
            id: 'compta-pionniers',
            name: 'Pionniers 26-27',
            currency: 'chf',
            isArchived: false,
            directMembers: [
              { id: 'user-direct', uid: 'user-direct', role: 'comptable' },
            ],
          },
          {
            id: 'compta-louveteaux',
            name: 'Louveteaux 26-27',
            currency: 'EUR',
            isArchived: false,
          },
          {
            id: 'compta-archivee',
            name: 'Ancienne Compta 24-25',
            currency: 'CHF',
            isArchived: true,
          },
        ],
      },
    ];

    it('returns empty array when both uid and email are empty', () => {
      assert.deepStrictEqual(resolveAuthorizedComptabilites('', '', sampleOrganizations), []);
    });

    it('returns only non-archived comptabilités where member has valid comptaAccess role', () => {
      const result = resolveAuthorizedComptabilites(
        'user-uploader',
        'deposant@tdgl.ch',
        sampleOrganizations
      );
      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'compta-louveteaux',
        comptaName: 'Louveteaux 26-27',
        currency: 'EUR',
        role: 'uploader',
      });
    });

    it('excludes rejected members even if comptaAccess has roles', () => {
      const result = resolveAuthorizedComptabilites(
        'user-rejected',
        'rejected@tdgl.ch',
        sampleOrganizations
      );
      assert.deepStrictEqual(result, []);
    });

    it('grants access via directMembers subcollection on comptabilité', () => {
      const result = resolveAuthorizedComptabilites(
        'user-direct',
        'direct@tdgl.ch',
        sampleOrganizations
      );
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].comptaId, 'compta-pionniers');
      assert.strictEqual(result[0].role, 'comptable');
      assert.strictEqual(result[0].currency, 'CHF');
    });

    it('grants access to all non-archived comptabilités for organization admin (sorted alphabetically)', () => {
      const result = resolveAuthorizedComptabilites(
        'admin-1',
        'admin@tdgl.ch',
        sampleOrganizations
      );
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].comptaName, 'Louveteaux 26-27');
      assert.strictEqual(result[0].role, 'caissier');
      assert.strictEqual(result[1].comptaName, 'Pionniers 26-27');
      assert.strictEqual(result[1].role, 'caissier');
    });

    it('returns empty array for authenticated user with no matching role in any organization', () => {
      const result = resolveAuthorizedComptabilites(
        'stranger-uid',
        'stranger@tdgl.ch',
        sampleOrganizations
      );
      assert.deepStrictEqual(result, []);
    });

    it('falls back to org.id, compta.id, and CHF when name or currency are blank', () => {
      const minimalOrgs = [
        {
          org: { id: 'ORG1', name: '   ' },
          members: [
            {
              id: 'u1',
              uid: 'u1',
              comptaAccess: { c1: 'viewer' },
            },
          ],
          comptabilites: [{ id: 'c1', name: '', currency: '  ', isArchived: false }],
        },
      ];
      const result = resolveAuthorizedComptabilites('u1', 'u1@test.ch', minimalOrgs);
      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        orgId: 'ORG1',
        orgName: 'ORG1',
        comptaId: 'c1',
        comptaName: 'c1',
        currency: 'CHF',
        role: 'viewer',
      });
    });
  });

  describe('selectDefaultComptabilite()', () => {
    const list = [
      {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'c-1',
        comptaName: 'Louveteaux',
        currency: 'CHF',
        role: 'uploader',
      },
      {
        orgId: 'TDGL',
        orgName: 'Troupe du Grand Lac',
        comptaId: 'c-2',
        comptaName: 'Pionniers',
        currency: 'CHF',
        role: 'caissier',
      },
    ];

    it('returns null when authorizedList is empty', () => {
      assert.strictEqual(selectDefaultComptabilite([], 'c-1'), null);
    });

    it('returns matching comptabilité when preferredComptaId is found', () => {
      const selected = selectDefaultComptabilite(list, 'c-2');
      assert.strictEqual(selected?.comptaId, 'c-2');
    });

    it('falls back to first comptabilité when preferredComptaId is not found or null', () => {
      assert.strictEqual(selectDefaultComptabilite(list, 'non-existent')?.comptaId, 'c-1');
      assert.strictEqual(selectDefaultComptabilite(list, null)?.comptaId, 'c-1');
      assert.strictEqual(selectDefaultComptabilite(list)?.comptaId, 'c-1');
    });
  });
});
