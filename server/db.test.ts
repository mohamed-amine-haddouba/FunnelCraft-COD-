import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findUserByEmail,
  verifyPassword,
  createUser,
  deleteUser,
  updateUserPlan,
  updateUserAccountStatus,
  getGlobalPlatformStats,
} from './db';

test('Strictly Hardcoded Platform Owner / Super Admin account', () => {
  const admin = findUserByEmail('naadianajah2020@gmail.com');
  assert.ok(admin, 'Super Admin naadianajah2020@gmail.com must exist');
  assert.equal(admin.role, 'admin');
  assert.equal(admin.status, 'active');
  assert.equal(admin.plan_id, 'enterprise');
  assert.equal(admin.subscription_status, 'active');

  // Strict credentials validation
  assert.equal(verifyPassword(admin, 'COD@2027'), true, 'Password COD@2027 must authenticate');
  assert.equal(verifyPassword(admin, 'WrongPass123'), false, 'Wrong password must be rejected');
  assert.equal(verifyPassword(admin, ''), false, 'Empty password must be rejected');
});

test('Any registered user is strictly assigned role merchant, pending status, and free starter plan', () => {
  const testEmail = `new.merchant.${Date.now()}@store.ma`;
  const merchant = createUser(testEmail, 'SecurePass123!', 'Karim Merchant', 'Karim Store', '+212 600-112233');
  try {
    assert.ok(merchant);
    assert.equal(merchant.email, testEmail);
    assert.equal(merchant.role, 'merchant', 'Role must strictly be merchant');
    assert.equal(merchant.status, 'pending', 'New merchant status must default to pending');
    assert.equal(merchant.plan_id, 'free', 'Default plan must be free');
    assert.equal(merchant.subscription_status, 'free');

    // Password verification
    assert.equal(verifyPassword(merchant, 'SecurePass123!'), true);
    assert.equal(verifyPassword(merchant, 'wrong'), false);
  } finally {
    deleteUser(merchant.id);
  }
});

test('Super Admin can manage user plans and account status', () => {
  const testEmail = `manageable.merchant.${Date.now()}@store.ma`;
  const merchant = createUser(testEmail, 'Pass2027!', 'Hassan Deals');
  try {
    const updatedPlan = updateUserPlan(merchant.id, 'starter');
    assert.equal(updatedPlan.plan_id, 'starter');
    assert.equal(updatedPlan.subscription_status, 'active');

    const suspended = updateUserAccountStatus(merchant.id, 'suspended');
    assert.equal(suspended.status, 'suspended');

    const reactivated = updateUserAccountStatus(merchant.id, 'active');
    assert.equal(reactivated.status, 'active');
  } finally {
    deleteUser(merchant.id);
  }
});

test('Global platform overview stats function smoothly', () => {
  const stats = getGlobalPlatformStats();
  assert.ok(stats);
  assert.ok(typeof stats.totalMerchants === 'number');
  assert.ok(typeof stats.totalOrdersCount === 'number');
});

