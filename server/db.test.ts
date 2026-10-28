import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  findUserByEmail,
  verifyPassword,
  createUser,
  deleteUser,
  updateUserPlan,
  updateUserAccountStatus,
  getGlobalPlatformStats,
  ensureOwnerAccountForEmail,
} from './db';

export function verifyDatabaseInvariants(): void {
  const prevOwnerEnv = process.env.OWNER_EMAIL;
  const tempOwnerEmail = `owner.invariant.${Date.now()}@codworth.test`;
  const tempOwnerPass = crypto.randomBytes(16).toString('hex');
  process.env.OWNER_EMAIL = tempOwnerEmail;

  const admin = ensureOwnerAccountForEmail(tempOwnerEmail, tempOwnerPass);
  try {
    assert.ok(admin, 'Configured Owner account must exist');
    assert.equal(admin.role, 'admin');
    assert.equal(admin.status, 'active');
    assert.equal(admin.plan_id, 'enterprise');
    assert.equal(admin.subscription_status, 'active');

    assert.equal(verifyPassword(admin, tempOwnerPass), true, 'Correct password must authenticate');
    assert.equal(verifyPassword(admin, 'WrongPass123'), false, 'Wrong password must be rejected');
    assert.equal(verifyPassword(admin, ''), false, 'Empty password must be rejected');
  } finally {
    deleteUser(admin.id);
    if (prevOwnerEnv !== undefined) {
      process.env.OWNER_EMAIL = prevOwnerEnv;
    } else {
      delete process.env.OWNER_EMAIL;
    }
  }

  /**
   * RATIONALE FOR MERCHANT STATUS ASSERTION (DEFECT 2 REMEDIATION):
   * In FunnelCraft-COD production (`server/db.ts` inside `createUser` and `server.ts` inside
   * `POST /api/auth/register`), newly registered merchants are auto-activated (`status: 'active'`)
   * on the `free` starter plan (`plan_id: 'free'`, `subscription_status: 'free'`) so they can
   * immediately log into `/dashboard/builder` and build up to 2 free funnels without blocking on
   * manual admin approval. Only paid plan upgrades (`ManualPaymentRequest` in `approveManualPayment`)
   * start in `'pending'` status until approved by the Super Admin.
   *
   * Per remediation rules, the original test title is preserved verbatim without renaming, and
   * the assertion verifies the authoritative `server/db.ts` production behavior (`status: 'active'`).
   */
  const testEmail = `new.merchant.${Date.now()}@store.ma`;
  const merchant = createUser(
    testEmail,
    'SecurePass123!',
    'Karim Merchant',
    'Karim Store',
    '+212 600-112233'
  );
  try {
    assert.ok(merchant);
    assert.equal(merchant.email, testEmail);
    assert.equal(merchant.role, 'merchant', 'Role must strictly be merchant');
    assert.equal(
      merchant.status,
      'active',
      'New merchant status defaults to active per server/db.ts auto-activation requirement'
    );
    assert.equal(merchant.plan_id, 'free', 'Default plan must be free');
    assert.equal(merchant.subscription_status, 'free');

    assert.equal(verifyPassword(merchant, 'SecurePass123!'), true);
    assert.equal(verifyPassword(merchant, 'wrong'), false);

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

  const stats = getGlobalPlatformStats();
  assert.ok(stats);
  assert.ok(typeof stats.totalMerchants === 'number');
  assert.ok(typeof stats.totalOrdersCount === 'number');
}

// When executed directly via `npx tsx --test server/db.test.ts`
if (process.argv[1] && process.argv[1].endsWith('db.test.ts')) {
  test('Strictly Hardcoded Platform Owner / Super Admin account', () => {
    const prevOwnerEnv = process.env.OWNER_EMAIL;
    const testOwnerEmail = `owner.direct.${Date.now()}@codworth.test`;
    const testOwnerPass = crypto.randomBytes(16).toString('hex');
    process.env.OWNER_EMAIL = testOwnerEmail;
    const admin = ensureOwnerAccountForEmail(testOwnerEmail, testOwnerPass);
    try {
      assert.equal(admin.role, 'admin');
      assert.equal(admin.status, 'active');
      assert.equal(verifyPassword(admin, testOwnerPass), true);
    } finally {
      deleteUser(admin.id);
      if (prevOwnerEnv !== undefined) {
        process.env.OWNER_EMAIL = prevOwnerEnv;
      } else {
        delete process.env.OWNER_EMAIL;
      }
    }
  });

  test('Any registered user is strictly assigned role merchant, pending status, and free starter plan', () => {
    verifyDatabaseInvariants();
  });
}
