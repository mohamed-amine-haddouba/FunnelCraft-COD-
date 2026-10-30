import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPlanCapabilities,
  checkFeatureAccess,
  validateAndNormalizeCustomDomain,
  VPS_IP,
  CNAME_TARGET,
} from './planLimits.ts';

describe('Subscription Plan Capabilities & Limit Enforcement', () => {
  it('enforces Free plan limits: max 2 pages, no custom domain, no pixels, no API integrations', () => {
    const caps = getPlanCapabilities('free', 'user', 'merchant@example.com');
    assert.equal(caps.effectivePlan, 'free');
    assert.equal(caps.maxPages, 2);
    assert.equal(caps.canUseCustomDomain, false);
    assert.equal(caps.canUsePixels, false);
    assert.equal(caps.canUseApiIntegrations, false);

    assert.equal(checkFeatureAccess('create_page', { plan_id: 'free', role: 'user' }, 0).allowed, true);
    assert.equal(checkFeatureAccess('create_page', { plan_id: 'free', role: 'user' }, 1).allowed, true);
    const limitReached = checkFeatureAccess('create_page', { plan_id: 'free', role: 'user' }, 2);
    assert.equal(limitReached.allowed, false);
    assert.equal(limitReached.statusCode, 403);
    assert.equal(limitReached.requiredPlan, 'starter');

    assert.equal(checkFeatureAccess('custom_domain', { plan_id: 'free', role: 'user' }).allowed, false);
    assert.equal(checkFeatureAccess('pixels', { plan_id: 'free', role: 'user' }).allowed, false);
    assert.equal(checkFeatureAccess('api_integrations', { plan_id: 'free', role: 'user' }).allowed, false);
  });

  it('enforces Starter plan limits: max 5 pages, no custom domain, no pixels', () => {
    const caps = getPlanCapabilities('starter', 'user', 'starter@example.com');
    assert.equal(caps.effectivePlan, 'starter');
    assert.equal(caps.maxPages, 5);
    assert.equal(caps.canUseCustomDomain, false);
    assert.equal(caps.canUsePixels, false);
    assert.equal(caps.canRemoveWatermark, true);

    assert.equal(checkFeatureAccess('create_page', { plan_id: 'starter', role: 'user' }, 4).allowed, true);
    const limit5 = checkFeatureAccess('create_page', { plan_id: 'starter', role: 'user' }, 5);
    assert.equal(limit5.allowed, false);
    assert.equal(limit5.statusCode, 403);
    assert.equal(limit5.requiredPlan, 'pro');

    assert.equal(checkFeatureAccess('custom_domain', { plan_id: 'starter', role: 'user' }).allowed, false);
    assert.equal(checkFeatureAccess('pixels', { plan_id: 'starter', role: 'user' }).allowed, false);
  });

  it('enforces Pro plan limits: unlimited pages, custom domain allowed, pixels allowed, API integrations & order export allowed', () => {
    const caps = getPlanCapabilities('pro', 'user', 'pro@example.com');
    assert.equal(caps.effectivePlan, 'pro');
    assert.equal(caps.maxPages, Infinity);
    assert.equal(caps.canUseCustomDomain, true);
    assert.equal(caps.canUsePixels, true);
    assert.equal(caps.canUseApiIntegrations, true);
    assert.equal(caps.canExportOrders, true);

    assert.equal(checkFeatureAccess('create_page', { plan_id: 'pro', role: 'user' }, 100).allowed, true);
    assert.equal(checkFeatureAccess('custom_domain', { plan_id: 'pro', role: 'user' }).allowed, true);
    assert.equal(checkFeatureAccess('pixels', { plan_id: 'pro', role: 'user' }).allowed, true);
    assert.equal(checkFeatureAccess('api_integrations', { plan_id: 'pro', role: 'user' }).allowed, true);
  });

  it('enforces Enterprise plan limits: unlimited access to all features', () => {
    const caps = getPlanCapabilities('enterprise', 'user', 'ent@example.com');
    assert.equal(caps.effectivePlan, 'enterprise');
    assert.equal(caps.maxPages, Infinity);
    assert.equal(caps.canUseCustomDomain, true);
    assert.equal(caps.canUsePixels, true);
    assert.equal(caps.canUseApiIntegrations, true);
    assert.equal(caps.canExportOrders, true);
    assert.equal(caps.prioritySupport, true);
  });

  it('bypasses all limits for Admin/Owner regardless of plan_id', () => {
    const adminCaps = getPlanCapabilities('free', 'admin', 'admin@example.com');
    assert.equal(adminCaps.canUseCustomDomain, true);
    assert.equal(adminCaps.canUsePixels, true);
    assert.equal(adminCaps.canUseApiIntegrations, true);
    assert.equal(adminCaps.canExportOrders, true);

    const adminByRole = checkFeatureAccess('custom_domain', { plan_id: 'free', role: 'admin' }, 50);
    assert.equal(adminByRole.allowed, true);

    const ownerByEmail = checkFeatureAccess(
      'api_integrations',
      { plan_id: 'free', role: 'user', email: 'naadianajah2020@gmail.com' },
      50,
      'naadianajah2020@gmail.com'
    );
    assert.equal(ownerByEmail.allowed, true);
  });
});

describe('Custom Domain FQDN Validation', () => {
  it('normalizes valid root and subdomain FQDNs', () => {
    const r1 = validateAndNormalizeCustomDomain('https://Shop.MyBrand.ma/checkout?ref=1');
    assert.equal(r1.valid, true);
    assert.equal(r1.normalizedDomain, 'shop.mybrand.ma');

    const r2 = validateAndNormalizeCustomDomain('  alouette-store.com. ');
    assert.equal(r2.valid, true);
    assert.equal(r2.normalizedDomain, 'alouette-store.com');
  });

  it('rejects localhost, raw IP addresses, platform domains, and invalid strings', () => {
    assert.equal(validateAndNormalizeCustomDomain('localhost').valid, false);
    assert.equal(validateAndNormalizeCustomDomain(VPS_IP).valid, false);
    assert.equal(validateAndNormalizeCustomDomain('192.168.1.1').valid, false);
    assert.equal(validateAndNormalizeCustomDomain(CNAME_TARGET).valid, false);
    assert.equal(validateAndNormalizeCustomDomain('codworth.me').valid, false);
    assert.equal(validateAndNormalizeCustomDomain('invalid_domain').valid, false);
    assert.equal(validateAndNormalizeCustomDomain('-bad.com').valid, false);
  });
});
