import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAVED_IBAN_STORAGE_KEY,
  normalizeIban,
  isValidIbanFormat,
  parsePositiveAmountInput,
  isValidIsoDateInput,
  validateVerifiedReceiptForm,
  getSavedIbanFromStorage,
  saveIbanToStorage,
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

  describe('validateVerifiedReceiptForm()', () => {
    it('validates a complete DEBIT_CARD receipt and omits reimbursementIban', () => {
      const result = validateVerifiedReceiptForm({
        comptaId: 'louveteaux-26-27',
        expenseType: 'DEBIT_CARD',
        amountInput: '48.90',
        dateInput: '2026-10-20',
        merchantName: '  Migros  ',
        description: '  Achat goûter  ',
        reimbursementIban: 'CH93 0076 2011 6238 5295 7',
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

    it('validates a complete REIMBURSEMENT receipt and formats reimbursementIban', () => {
      const result = validateVerifiedReceiptForm({
        comptaId: 'pionniers-26-27',
        expenseType: 'REIMBURSEMENT',
        amountInput: '125,50',
        dateInput: '2026-10-21',
        merchantName: 'CFF',
        description: 'Billets train camp',
        reimbursementIban: 'ch9300762011623852957',
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
      });
    });

    it('rejects form when comptaId, expenseType, amount, date, or IBAN are invalid', () => {
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
      });
      assert.strictEqual(resBadIban.valid, false);
      assert.ok(resBadIban.errors.iban);
    });
  });

  describe('IBAN localStorage persistence', () => {
    function createMockStorage() {
      const store = new Map();
      return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      };
    }

    it('saves normalized IBAN and retrieves it from storage', () => {
      const storage = createMockStorage();
      saveIbanToStorage('ch9300762011623852957', storage);
      assert.strictEqual(
        storage.getItem(SAVED_IBAN_STORAGE_KEY),
        'CH93 0076 2011 6238 5295 7'
      );
      assert.strictEqual(
        getSavedIbanFromStorage(storage),
        'CH93 0076 2011 6238 5295 7'
      );
    });

    it('removes key when empty IBAN is saved and handles null storage safely', () => {
      const storage = createMockStorage();
      saveIbanToStorage('CH93 0076 2011 6238 5295 7', storage);
      saveIbanToStorage('   ', storage);
      assert.strictEqual(getSavedIbanFromStorage(storage), '');
      assert.strictEqual(getSavedIbanFromStorage(null), '');
      assert.doesNotThrow(() => saveIbanToStorage('CH930000', null));
    });
  });
});
