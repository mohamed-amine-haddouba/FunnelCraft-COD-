import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedCorsOrigin } from './corsOrigins';

test('credentialed CORS denies arbitrary origins in production', () => {
  const config = { production: true, appOrigin: 'https://staging.codworth.me', extraOrigins: 'https://merchant.example.test' };
  assert.equal(isAllowedCorsOrigin(undefined, config), true);
  assert.equal(isAllowedCorsOrigin('https://staging.codworth.me', config), true);
  assert.equal(isAllowedCorsOrigin('https://merchant.example.test', config), true);
  assert.equal(isAllowedCorsOrigin('https://attacker.example.test', config), false);
  assert.equal(isAllowedCorsOrigin('https://staging.codworth.me.evil.test', config), false);
  assert.equal(isAllowedCorsOrigin('http://localhost:5173', config), false);
  assert.equal(isAllowedCorsOrigin('null', config), false);
  assert.equal(isAllowedCorsOrigin('https://staging.codworth.me/path', config), false);
});

test('local development origins allowed without changing production policy', () => {
  assert.equal(isAllowedCorsOrigin('http://localhost:5173', { production: false }), true);
  assert.equal(isAllowedCorsOrigin('https://untrusted.example.test', { production: false }), false);
});

test('production CORS rejects HTTP even when an HTTP origin is mistakenly configured', () => {
  assert.equal(isAllowedCorsOrigin('http://staging.codworth.me', {
    production: true,
    appOrigin: 'http://staging.codworth.me',
  }), false);
  assert.equal(isAllowedCorsOrigin('https://staging.codworth.me', {
    production: true,
    appOrigin: 'https://staging.codworth.me',
  }), true);
});
