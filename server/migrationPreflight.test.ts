import test from 'node:test';
import assert from 'node:assert/strict';
import { preflightLegacyData } from './migrationPreflight';

const fixture = {
  users: [{id:'merchant-1',email:'merchant@example.test'}],
  pages: [{id:'page-1',userId:'merchant-1'}],
  orders: [{id:'order-1',userId:'merchant-1',price:199,createdAt:'2026-11-03T10:00:00Z'}],
  payments: [{id:'payment-1',userId:'merchant-1'}],
};

test('migration preflight finds clean legacy data without exposing records', () => {
  const report = preflightLegacyData(fixture);
  assert.equal(report.hasBlockers,false);
  assert.equal(report.needsManualReview,false);
  assert.deepEqual(report.issues,[]);
  assert.equal(report.counts.users,1);
  assert.equal(JSON.stringify(report).includes('merchant@example.test'),false);
});

test('migration preflight finds duplicate IDs/emails and orphaned pages', () => {
  const report = preflightLegacyData({
    ...fixture,
    users:[...fixture.users,{id:'merchant-1',email:'MERCHANT@example.test'}],
    pages:[...fixture.pages,{id:'page-2',userId:'absent'}],
  });
  assert.deepEqual(report.issues.map(i=>i.code),
    ['PAGE_OWNER_MISSING','DUPLICATE_EMAIL','DUPLICATE_ID']);
  assert.equal(report.hasBlockers,true);
});

test('migration preflight flags invalid order price/date and unassigned legacy orders for review', () => {
  const report = preflightLegacyData({
    ...fixture,
    orders:[{id:'old',userId:undefined,price:-1,createdAt:'not a date'}],
  });
  assert.equal(report.hasBlockers,true);
  assert.equal(report.needsManualReview,true);
  assert.ok(report.issues.some(i=>i.code==='ORDER_OWNER_MISSING'&&i.severity==='review'));
  assert.ok(report.issues.some(i=>i.code==='INVALID_ORDER_AMOUNT'));
  assert.ok(report.issues.some(i=>i.code==='INVALID_ORDER_DATE'));
});

test('migration preflight rejects malformed top-level collections and records without crashing', () => {
  const report = preflightLegacyData({
    users:null,pages:[null,{}],orders:'not-array',payments:[],
  });
  assert.ok(report.hasBlockers);
  assert.equal(report.issues.filter(i=>i.code==='MALFORMED_ROW').length,3);
});
