import test from 'node:test';
import assert from 'node:assert/strict';
import { isAnalyticsRange, summarizeOrderMetrics } from './analyticsMetrics';

test('analytics respects time range, order status, and separates currencies', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');
  const orders = [
    { id: 'pending', createdAt: '2026-11-02T10:00:00Z', price: 100, currency: 'MAD', status: 'pending' as const },
    { id: 'delivered', createdAt: '2026-11-02T11:00:00Z', price: 200, currency: 'MAD', status: 'delivered' as const },
    { id: 'cancelled', createdAt: '2026-11-01T11:00:00Z', price: 900, currency: 'MAD', status: 'cancelled' as const },
    { id: 'usd', createdAt: '2026-11-02T10:00:00Z', price: 50, currency: 'USD', status: 'delivered' as const },
    { id: 'old', createdAt: '2026-10-20T11:00:00Z', price: 1000, currency: 'MAD', status: 'delivered' as const },
    { id: 'invalid', createdAt: 'not-a-date', price: 999, currency: 'MAD', status: 'paid' as const },
  ];
  const week = summarizeOrderMetrics(orders, '7d', now);
  assert.equal(week.totalOrders, 4);
  assert.equal(week.totalRevenue, 200);
  assert.equal(week.avgOrderValue, 150);
  assert.equal(week.recordedValueByCurrency.MAD, 300);
  assert.equal(week.deliveredValueByCurrency.USD, 50);
  assert.equal(week.statusCounts.cancelled, 1);
  assert.equal(week.deliveryRate, 50);
  const month = summarizeOrderMetrics(orders, '30d', now);
  assert.equal(month.totalOrders, 5);
  assert.equal(month.deliveredValueByCurrency.MAD, 1200);
});

test('analytics rejects unknown range values', () => {
  assert.equal(isAnalyticsRange('7d'), true);
  assert.equal(isAnalyticsRange('90d'), true);
  assert.equal(isAnalyticsRange('all'), true);
  assert.equal(isAnalyticsRange('7days'), false);
  assert.equal(isAnalyticsRange(null), false);
});
