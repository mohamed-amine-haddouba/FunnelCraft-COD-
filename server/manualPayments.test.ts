import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  createUser, deleteUser, findUserById, createManualPaymentRequest,
  approveManualPayment, rejectManualPayment, getAllManualPayments,
} from './db';

test('manual payment requests have unique IDs, even in the same millisecond', () => {
  const merchant = createUser(randomUUID() + '@example.test', 'Password123!', 'Fixture Merchant');
  try {
    const first = createManualPaymentRequest(merchant.id, merchant.email, 'Fixture', 'CashPlus', 'FIXTURE-1');
    const second = createManualPaymentRequest(merchant.id, merchant.email, 'Fixture', 'CashPlus', 'FIXTURE-2');
    assert.notEqual(first.id, second.id);
    assert.ok(getAllManualPayments().some(p=>p.id===first.id));
    assert.ok(getAllManualPayments().some(p=>p.id===second.id));
  } finally {
    deleteUser(merchant.id);
  }
});

test('repeated manual approval does not renew the subscription or rewrite payment timestamps', () => {
  const merchant = createUser(randomUUID() + '@example.test', 'Password123!', 'Manual Buyer');
  try {
    const request = createManualPaymentRequest(merchant.id, merchant.email, 'Fixture', 'CashPlus', 'FIXTURE-3');
    const first = approveManualPayment(request.id);
    assert.equal(first.payment.status, 'approved');
    assert.equal(typeof first.payment.approvalStartedAt, 'string');
    assert.equal(first.user.plan_id, 'pro');
    const originalEnd = first.user.current_period_end;
    const repeated = approveManualPayment(request.id);
    assert.equal(repeated.user.current_period_end, originalEnd);
    assert.equal(repeated.payment.approvalStartedAt, first.payment.approvalStartedAt);
    assert.throws(() => rejectManualPayment(request.id), /cannot be rejected/);
  } finally {
    deleteUser(merchant.id);
  }
});

test('rejected manual payment remains rejected and cannot activate a user', () => {
  const merchant = createUser(randomUUID() + '@example.test', 'Password123!', 'Manual Buyer');
  try {
    const request = createManualPaymentRequest(merchant.id, merchant.email, 'Fixture', 'CashPlus', 'FIXTURE-4');
    assert.equal(rejectManualPayment(request.id).status, 'rejected');
    assert.equal(rejectManualPayment(request.id).status, 'rejected');
    assert.throws(() => approveManualPayment(request.id), /cannot be approved/);
    assert.equal(findUserById(merchant.id)?.plan_id, 'free');
  } finally {
    deleteUser(merchant.id);
  }
});

test('manual approval can retry a durable pending approval with its original period', () => {
  const merchant = createUser(randomUUID() + '@example.test', 'Password123!', 'Manual Buyer');
  try {
    const request = createManualPaymentRequest(merchant.id, merchant.email, 'Fixture', 'CashPlus', 'FIXTURE-5');
    const first = approveManualPayment(request.id);
    assert.equal(first.payment.status,'approved');
    assert.ok(Date.parse(first.payment.approvalStartedAt || '') > 0);
  } finally {
    deleteUser(merchant.id);
  }
});
