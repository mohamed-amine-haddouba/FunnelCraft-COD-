import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatConvertedPrice,
  calculatePayPalUsdSettlement,
  normalizeExchangeRates,
  filterActiveBankAccounts,
  DEFAULT_MOROCCAN_BANK_ACCOUNTS,
  inferMoroccanPaymentMethod,
} from './currencyAndBanks';

test('formatConvertedPrice converts MAD to USD, EUR, GBP, and keeps MAD accurate', () => {
  const rates = { USD: 1, MAD: 10.0, EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.51 };
  assert.equal(formatConvertedPrice(299, 'MAD', rates), '299.00 DH');
  assert.equal(formatConvertedPrice(299, 'USD', rates), '29.90 $');
  assert.equal(formatConvertedPrice(100, 'EUR', rates), '9.20 €');
  assert.equal(formatConvertedPrice(100, 'GBP', rates), '7.90 £');
  assert.equal(formatConvertedPrice(100, 'CAD', rates), '13.60 C$');
  assert.equal(formatConvertedPrice(100, 'AUD', rates), '15.10 A$');
});

test('calculatePayPalUsdSettlement always settles in USD using MAD rate', () => {
  const rates = { USD: 1, MAD: 10.0, EUR: 0.92 };
  const settlement = calculatePayPalUsdSettlement(249, rates);
  assert.equal(settlement.amountUSD, 24.9);
  assert.equal(settlement.formattedUSD, '24.90');
  assert.equal(settlement.currency, 'USD');
});

test('normalizeExchangeRates merges valid rates and falls back when invalid', () => {
  const normalized = normalizeExchangeRates({ MAD: 9.85, EUR: 0.91, GBP: -5 });
  assert.equal(normalized.USD, 1);
  assert.equal(normalized.MAD, 9.85);
  assert.equal(normalized.EUR, 0.91);
  assert.equal(normalized.GBP, 0.79); // fallback used for invalid negative rate
});

test('filterActiveBankAccounts filters out disabled accounts', () => {
  const list = [
    ...DEFAULT_MOROCCAN_BANK_ACCOUNTS,
    {
      ...DEFAULT_MOROCCAN_BANK_ACCOUNTS[0],
      id: 'disabled-bank',
      name: 'Disabled Bank',
      isActive: false,
    },
  ];
  const active = filterActiveBankAccounts(list);
  assert.equal(active.length, DEFAULT_MOROCCAN_BANK_ACCOUNTS.length);
  assert.equal(active.some((b) => b.id === 'disabled-bank'), false);
});

test('inferMoroccanPaymentMethod maps bank names to valid MoroccanPaymentMethod', () => {
  assert.equal(inferMoroccanPaymentMethod('Banque Populaire'), 'BanquePopulaire');
  assert.equal(inferMoroccanPaymentMethod('Attijariwafa Bank'), 'Attijariwafa');
  assert.equal(inferMoroccanPaymentMethod('CIH'), 'CIH');
});
