import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAVED_IBAN_STORAGE_KEY,
  SAVED_NPA_STORAGE_KEY,
  SAVED_CITY_STORAGE_KEY,
  normalizeIban,
  isValidIbanFormat,
  normalizeNpa,
  isValidNpaFormat,
  normalizeCity,
  isValidCityFormat,
  parsePositiveAmountInput,
  isValidIsoDateInput,
  validateVerifiedReceiptForm,
  getSavedIbanFromStorage,
  saveIbanToStorage,
  getSavedNpaFromStorage,
  saveNpaToStorage,
  getSavedCityFromStorage,
  saveCityToStorage,
} from '../verificationHelpers.ts';

describe('[MOB-06] verificationHelpers Unit & Integration Tests', () => {
  describe('normalizeIban()', () => {
    it('formats Swiss and European IBANs into uppercase 4-char blocks', () => {
      assert.strictEqual(
        normalizeIban('ch93-0076-2011-6238-5295-7'),
        'CH93 0076 2011 6238 5295 7'
      );
      assert.strictEqual(
        normalizeIban('  fr7630006000011234567890189 '),
        'FR76 3000 6000 0112 3456 7890 189'
      );
    });

    it('returns empty string for null, undefined, or whitespace', () => {
      assert.strictEqual(normalizeIban('   '), '');
      assert.strictEqual(normalizeIban(null), '');
      assert.strictEqual(normalizeIban(undefined), '');
    });
  });

  describe('isValidIbanFormat()', () => {
    it('accepts empty IBAN (optional field) and valid ISO 13616 IBANs', () => {
      assert.strictEqual(isValidIbanFormat(''), true);
      assert.strictEqual(isValidIbanFormat(null), true);
      assert.strictEqual(isValidIbanFormat('CH93 0076 2011 6238 5295 7'), true);
      assert.strictEqual(isValidIbanFormat('FR7630006000011234567890189'), true);
    });

    it('rejects malformed, too short (<15), or non-alphanumeric IBANs', () => {
      assert.strictEqual(isValidIbanFormat('CH93 123'), false);
      assert.strictEqual(isValidIbanFormat('12345678901234567890'), false);
      assert.strictEqual(isValidIbanFormat('CH93_INVALID_CHARS_12345'), false);
    });
  });

  describe('parsePositiveAmountInput()', () => {
    it('parses positive numbers and decimal strings (dot or comma)', () => {
      assert.strictEqual(parsePositiveAmountInput(42.5), 42.5);
      assert.strictEqual(parsePositiveAmountInput('142,85'), 142.85);
      assert.strictEqual(parsePositiveAmountInput("1'250.40"), 1250.4);
    });

    it('rejects zero, negative, NaN, > 1,000,000 or non-numeric strings', () => {
      assert.strictEqual(parsePositiveAmountInput(0), null);
      assert.strictEqual(parsePositiveAmountInput('0'), null);
      assert.strictEqual(parsePositiveAmountInput('-12.50'), null);
      assert.strictEqual(parsePositiveAmountInput(1_500_000), null);
      assert.strictEqual(parsePositiveAmountInput('abc'), null);
      assert.strictEqual(parsePositiveAmountInput(''), null);
    });
  });

  describe('isValidIsoDateInput()', () => {
    it('accepts valid YYYY-MM-DD dates including leap years', () => {
      assert.strictEqual(isValidIsoDateInput('2026-10-28'), true);
      assert.strictEqual(isValidIsoDateInput('2024-02-29'), true);
    });

    it('rejects invalid calendar dates or non-ISO formats', () => {
      assert.strictEqual(isValidIsoDateInput('2026-02-29'), false);
      assert.strictEqual(isValidIsoDateInput('2026-13-01'), false);
      assert.strictEqual(isValidIsoDateInput('2026-00-10'), false);
      assert.strictEqual(isValidIsoDateInput('28.10.2026'), false);
      assert.strictEqual(isValidIsoDateInput(''), false);
      assert.strictEqual(isValidIsoDateInput(null), false);
    });
  });

  describe('normalizeNpa() & isValidNpaFormat()', () => {
    it('normalizes and accepts valid Swiss and European postal codes', () => {
      assert.strictEqual(normalizeNpa('  1000  '), '1000');
      assert.strictEqual(normalizeNpa('f-74500'), 'F-74500');
      assert.strictEqual(normalizeNpa(null), '');
      assert.strictEqual(isValidNpaFormat('1000'), true);
      assert.strictEqual(isValidNpaFormat('1800'), true);
      assert.strictEqual(isValidNpaFormat('74500'), true);
    });

    it('rejects empty, too short (<4), or invalid NPA values', () => {
      assert.strictEqual(isValidNpaFormat(''), false);
      assert.strictEqual(isValidNpaFormat('123'), false);
      assert.strictEqual(isValidNpaFormat('1000!'), false);
      assert.strictEqual(isValidNpaFormat(null), false);
    });
  });

  describe('normalizeCity() & isValidCityFormat()', () => {
    it('normalizes and accepts valid city names', () => {
      assert.strictEqual(normalizeCity('  Lausanne  '), 'Lausanne');
      assert.strictEqual(normalizeCity('Saint   Sulpice'), 'Saint Sulpice');
      assert.strictEqual(isValidCityFormat('Lausanne'), true);
      assert.strictEqual(isValidCityFormat('Au'), true);
    });

    it('rejects empty or single-character city names', () => {
      assert.strictEqual(isValidCityFormat(''), false);
      assert.strictEqual(isValidCityFormat('   '), false);
      assert.strictEqual(isValidCityFormat('A'), false);
      assert.strictEqual(isValidCityFormat(null), false);
    });
  });

  describe('validateVerifiedReceiptForm()', () => {
    it('validates a complete DEBIT_CARD receipt and omits reimbursement bank fields', () => {
      const result = validateVerifiedReceiptForm({
        comptaId: 'louveteaux-26-27',
        expenseType: 'DEBIT_CARD',
        amountInput: '48.90',
        dateInput: '2026-10-20',
        merchantName: '  Migros  ',
        description: '  Achat goûter  ',
        reimbursementIban: 'CH93 0076 2011 6238 5295 7',
        reimbursementNpa: '1000',
        reimbursementCity: 'Lausanne',
      });
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.firstError, null);
      assert.deepStrictEqual(result.payload, {
        comptaId: 'louveteaux-26-27',
        expenseType: 'DEBIT_CARD',
        extractedAmount: 48.9,
        extractedDate: '2026-10-20',
        merchantName: 'Migros',
        description: 'Achat goûter',
      });
    });

    it('validates a complete REIMBURSEMENT receipt and formats IBAN, NPA and city', () => {
      const result = validateVerifiedReceiptForm({
        comptaId: 'pionniers-26-27',
        expenseType: 'REIMBURSEMENT',
        amountInput: '125,50',
        dateInput: '2026-10-21',
        merchantName: 'CFF',
        description: 'Billets train camp',
        reimbursementIban: 'ch9300762011623852957',
        reimbursementNpa: ' 1004 ',
        reimbursementCity: '  Lausanne ',
      });
      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.payload, {
        comptaId: 'pionniers-26-27',
        expenseType: 'REIMBURSEMENT',
        extractedAmount: 125.5,
        extractedDate: '2026-10-21',
        merchantName: 'CFF',
        description: 'Billets train camp',
        reimbursementIban: 'CH93 0076 2011 6238 5295 7',
        reimbursementNpa: '1004',
        reimbursementCity: 'Lausanne',
      });
    });

    it('rejects form when comptaId, expenseType, amount, date, IBAN, NPA, or city are missing/invalid', () => {
      const resMissingAll = validateVerifiedReceiptForm({
        comptaId: '',
        expenseType: '',
        amountInput: '0',
        dateInput: 'invalid-date',
      });
      assert.strictEqual(resMissingAll.valid, false);
      assert.ok(resMissingAll.errors.comptaId);
      assert.ok(resMissingAll.errors.expenseType);
      assert.ok(resMissingAll.errors.amount);
      assert.ok(resMissingAll.errors.date);
      assert.strictEqual(resMissingAll.payload, null);

      const resBadIban = validateVerifiedReceiptForm({
        comptaId: 'c1',
        expenseType: 'REIMBURSEMENT',
        amountInput: '25.00',
        dateInput: '2026-10-21',
        reimbursementIban: 'BAD_IBAN',
        reimbursementNpa: '1000',
        reimbursementCity: 'Lausanne',
      });
      assert.strictEqual(resBadIban.valid, false);
      assert.ok(resBadIban.errors.iban);

      const resMissingBankDetails = validateVerifiedReceiptForm({
        comptaId: 'c1',
        expenseType: 'REIMBURSEMENT',
        amountInput: '25.00',
        dateInput: '2026-10-21',
        reimbursementIban: '',
        reimbursementNpa: '',
        reimbursementCity: '',
      });
      assert.strictEqual(resMissingBankDetails.valid, false);
      assert.ok(resMissingBankDetails.errors.iban);
      assert.ok(resMissingBankDetails.errors.npa);
      assert.ok(resMissingBankDetails.errors.city);

      const resBadNpa = validateVerifiedReceiptForm({
        comptaId: 'c1',
        expenseType: 'REIMBURSEMENT',
        amountInput: '25.00',
        dateInput: '2026-10-21',
        reimbursementIban: 'CH93 0076 2011 6238 5295 7',
        reimbursementNpa: '12',
        reimbursementCity: 'Lausanne',
      });
      assert.strictEqual(resBadNpa.valid, false);
      assert.ok(resBadNpa.errors.npa);
    });
  });

  describe('IBAN, NPA & City localStorage persistence', () => {
    function createMockStorage() {
      const store = new Map();
      return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      };
    }

    it('saves normalized IBAN, NPA and city and retrieves them from storage', () => {
      const storage = createMockStorage();
      saveIbanToStorage('ch9300762011623852957', storage);
      saveNpaToStorage(' 1004 ', storage);
      saveCityToStorage('  Lausanne  ', storage);

      assert.strictEqual(
        storage.getItem(SAVED_IBAN_STORAGE_KEY),
        'CH93 0076 2011 6238 5295 7'
      );
      assert.strictEqual(
        getSavedIbanFromStorage(storage),
        'CH93 0076 2011 6238 5295 7'
      );
      assert.strictEqual(storage.getItem(SAVED_NPA_STORAGE_KEY), '1004');
      assert.strictEqual(getSavedNpaFromStorage(storage), '1004');
      assert.strictEqual(storage.getItem(SAVED_CITY_STORAGE_KEY), 'Lausanne');
      assert.strictEqual(getSavedCityFromStorage(storage), 'Lausanne');
    });

    it('removes keys when empty values are saved and handles null storage safely', () => {
      const storage = createMockStorage();
      saveIbanToStorage('CH93 0076 2011 6238 5295 7', storage);
      saveIbanToStorage('   ', storage);
      saveNpaToStorage('1000', storage);
      saveNpaToStorage('  ', storage);
      saveCityToStorage('Lausanne', storage);
      saveCityToStorage('  ', storage);

      assert.strictEqual(getSavedIbanFromStorage(storage), '');
      assert.strictEqual(getSavedNpaFromStorage(storage), '');
      assert.strictEqual(getSavedCityFromStorage(storage), '');
      assert.strictEqual(getSavedIbanFromStorage(null), '');
      assert.strictEqual(getSavedNpaFromStorage(null), '');
      assert.strictEqual(getSavedCityFromStorage(null), '');
      assert.doesNotThrow(() => saveIbanToStorage('CH930000', null));
      assert.doesNotThrow(() => saveNpaToStorage('1000', null));
      assert.doesNotThrow(() => saveCityToStorage('Lausanne', null));
    });
  });
});
