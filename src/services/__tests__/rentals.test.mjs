import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  canUserAccessRentals,
  isExemptFromEmailVerification,
} from '../authHelpers.ts';
import {
  RENTAL_ROOMS,
  isValidRentalRoom,
  generateRentalId,
  calculateRentalStats,
  filterRentals,
  validateRentalInput,
  formatRentalDateRange,
} from '../rentalHelpers.ts';

describe('Locations de locaux — Permissions & RBAC', () => {
  test('generateRentalId génère un identifiant préfixé et valide', () => {
    const id = generateRentalId(1731331200000, 'abc12345');
    assert.equal(id, 'rental-1731331200000-abc12345');
  });

  test('canUserAccessRentals autorise immédiatement le compte super-admin', () => {
    const profile = {
      uid: 'admin-1',
      email: 'jean.francois.knebel@gmail.com',
      displayName: 'Jean-François Knebel',
      firstName: 'Jean-François',
      lastName: 'Knebel',
      orgId: 'TDGL',
      orgName: 'Troupe du Grand Lac',
      emailVerified: true,
      emailVerificationRequired: false,
    };
    assert.equal(canUserAccessRentals(profile, profile.email), true);
  });

  test('canUserAccessRentals autorise un compte avec le rôle responsable_location', () => {
    const profile = {
      uid: 'loc-1',
      email: 'location@tdgl.ch',
      displayName: 'Responsable Salles',
      firstName: 'Alain',
      lastName: 'Locaux',
      orgId: 'TDGL',
      orgName: 'Troupe du Grand Lac',
      emailVerified: true,
      emailVerificationRequired: false,
      role: 'responsable_location',
      isRentalManager: true,
    };
    assert.equal(canUserAccessRentals(profile, profile.email), true);
  });

  test('canUserAccessRentals autorise un administrateur d organisation', () => {
    const profile = {
      uid: 'org-admin-1',
      email: 'caissier@tdgl.ch',
      displayName: 'Trésorier TDGL',
      firstName: 'Trésorier',
      lastName: 'TDGL',
      orgId: 'TDGL',
      orgName: 'Troupe du Grand Lac',
      emailVerified: true,
      emailVerificationRequired: false,
      isAdmin: true,
    };
    assert.equal(canUserAccessRentals(profile, profile.email), true);
  });

  test('canUserAccessRentals refuse un membre simple sans rôle location ni admin', () => {
    const profile = {
      uid: 'member-1',
      email: 'jeanne@tdgl.ch',
      displayName: 'Jeanne Membre',
      firstName: 'Jeanne',
      lastName: 'Membre',
      orgId: 'TDGL',
      orgName: 'Troupe du Grand Lac',
      emailVerified: true,
      emailVerificationRequired: false,
    };
    assert.equal(canUserAccessRentals(profile, profile.email), false);
  });

  test('canUserAccessRentals refuse si aucun profil ni email', () => {
    assert.equal(canUserAccessRentals(null, null), false);
  });
});

describe('Locations de locaux — Statistiques, Filtres & Validation', () => {
  const sampleRentals = [
    {
      id: 'r-1',
      orgId: 'TDGL',
      roomName: 'Grande salle',
      renterName: 'Famille Dupont',
      renterPhone: '079 111 22 33',
      startDate: '2026-05-10',
      amount: 150,
      status: 'PENDING',
      createdAt: '2026-05-01T10:00:00Z',
      createdByUid: 'uid-1',
      createdByName: 'Admin',
    },
    {
      id: 'r-2',
      orgId: 'TDGL',
      roomName: 'Foyer',
      renterName: 'Club Échecs',
      renterPhone: '079 444 55 66',
      startDate: '2026-05-12',
      amount: 80,
      status: 'PAID',
      paidAt: '2026-05-05T12:00:00Z',
      paidByMethod: 'Virement',
      createdAt: '2026-05-01T11:00:00Z',
      createdByUid: 'uid-1',
      createdByName: 'Admin',
    },
    {
      id: 'r-3',
      orgId: 'TDGL',
      roomName: 'Grande salle',
      renterName: 'Société Musique',
      startDate: '2026-05-20',
      amount: 200,
      status: 'PENDING',
      createdAt: '2026-05-01T12:00:00Z',
      createdByUid: 'uid-1',
      createdByName: 'Admin',
    },
  ];

  test('calculateRentalStats calcule correctement les montants et compteurs', () => {
    const stats = calculateRentalStats(sampleRentals);
    assert.equal(stats.pendingAmount, 350);
    assert.equal(stats.pendingCount, 2);
    assert.equal(stats.paidAmount, 80);
    assert.equal(stats.paidCount, 1);
    assert.equal(stats.totalAmount, 430);
    assert.equal(stats.totalCount, 3);
  });

  test('filterRentals filtre correctement par statut', () => {
    const pending = filterRentals(sampleRentals, '', 'PENDING');
    assert.equal(pending.length, 2);
    assert.equal(pending[0].renterName, 'Famille Dupont');

    const paid = filterRentals(sampleRentals, '', 'PAID');
    assert.equal(paid.length, 1);
    assert.equal(paid[0].renterName, 'Club Échecs');
  });

  test('filterRentals recherche par mot-clé (nom, téléphone, salle)', () => {
    const byName = filterRentals(sampleRentals, 'dupont');
    assert.equal(byName.length, 1);
    assert.equal(byName[0].id, 'r-1');

    const byPhone = filterRentals(sampleRentals, '444');
    assert.equal(byPhone.length, 1);
    assert.equal(byPhone[0].renterName, 'Club Échecs');

    const byRoom = filterRentals(sampleRentals, 'grande salle');
    assert.equal(byRoom.length, 2);
  });

  test('RENTAL_ROOMS propose exactement 2 locaux : avec et sans cuisine', () => {
    assert.deepEqual(RENTAL_ROOMS, ['Local avec cuisine', 'Local sans cuisine']);
    assert.equal(isValidRentalRoom('Local avec cuisine'), true);
    assert.equal(isValidRentalRoom('Local sans cuisine'), true);
    assert.equal(isValidRentalRoom('Grande salle'), false);
    assert.equal(isValidRentalRoom(''), false);
  });

  test('validateRentalInput valide les champs obligatoires et restreint aux 2 locaux autorisés', () => {
    const validWithKitchen = validateRentalInput({
      roomName: 'Local avec cuisine',
      renterName: 'Dupont',
      startDate: '2026-06-01',
      amount: 120,
    });
    assert.equal(validWithKitchen.valid, true);
    assert.equal(validWithKitchen.error, null);

    const validWithoutKitchen = validateRentalInput({
      roomName: 'Local sans cuisine',
      renterName: 'Dupont',
      startDate: '2026-06-01',
      amount: 90,
    });
    assert.equal(validWithoutKitchen.valid, true);
    assert.equal(validWithoutKitchen.error, null);

    const invalidRoom = validateRentalInput({
      roomName: 'Grande salle',
      renterName: 'Dupont',
      startDate: '2026-06-01',
      amount: 120,
    });
    assert.equal(invalidRoom.valid, false);

    const missingName = validateRentalInput({
      roomName: 'Local avec cuisine',
      renterName: '',
      startDate: '2026-06-01',
      amount: 120,
    });
    assert.equal(missingName.valid, false);

    const invalidAmount = validateRentalInput({
      roomName: 'Local sans cuisine',
      renterName: 'Dupont',
      startDate: '2026-06-01',
      amount: 0,
    });
    assert.equal(invalidAmount.valid, false);
  });

  test('formatRentalDateRange gère une date seule ou une plage', () => {
    assert.equal(formatRentalDateRange('2026-05-10'), '2026-05-10');
    assert.equal(formatRentalDateRange('2026-05-10', '2026-05-10'), '2026-05-10');
    assert.equal(formatRentalDateRange('2026-05-10', '2026-05-12'), '2026-05-10 au 2026-05-12');
  });
});
