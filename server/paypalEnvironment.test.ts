import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePayPalEnvironment } from './paypalEnvironment';

test('PayPal stays in sandbox unless live is explicitly selected', () => {
  assert.equal(resolvePayPalEnvironment(undefined), 'sandbox');
  assert.equal(resolvePayPalEnvironment(''), 'sandbox');
  assert.equal(resolvePayPalEnvironment(' sandbox '), 'sandbox');
  assert.equal(resolvePayPalEnvironment('live'), 'live');
  assert.equal(resolvePayPalEnvironment('production'), 'live');
  assert.equal(resolvePayPalEnvironment('prod'), 'live');
  assert.throws(() => resolvePayPalEnvironment('liv'), /Invalid PAYPAL_ENVIRONMENT/);
});
