export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';
type AnalyticsStatus = 'pending' | 'paid' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export interface MetricOrder {
  id: string;
  createdAt: string;
  status: AnalyticsStatus;
  price: number;
  currency?: string;
}

export interface FunnelMetricOrder extends MetricOrder {
  userId?: string;
  funnelId?: string;
  pageSlug?: string;
}
export interface MetricPage {
  id: string;
  userId: string;
  slug?: string | null;
}

/** Match orders to a funnel only within the page owner's tenant. */
export function getOrdersForFunnel<T extends FunnelMetricOrder>(
  orders: T[],
  page: MetricPage
): T[] {
  return orders.filter((order) =>
    order.userId === page.userId &&
    (order.funnelId === page.id ||
      (!order.funnelId && Boolean(page.slug) && order.pageSlug === page.slug))
  );
}

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return value === '7d' || value === '30d' || value === '90d' || value === 'all';
}

export function orderCurrency(order: MetricOrder): string {
  const raw = typeof order.currency === 'string' ? order.currency : 'MAD';
  return raw.trim().toUpperCase() || 'MAD';
}

const ORDER_STATUSES = new Set<AnalyticsStatus>([
  'pending', 'paid', 'confirmed', 'shipped', 'delivered', 'cancelled',
]);
function isAnalyticsStatus(value: unknown): value is AnalyticsStatus {
  return typeof value === 'string' && ORDER_STATUSES.has(value as AnalyticsStatus);
}

function amount(order: MetricOrder): number {
  const n = Number(order.price);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function summarizeOrderMetrics<T extends MetricOrder>(
  orders: T[],
  range: AnalyticsRange,
  now: number = Date.now()
) {
  const days = range === 'all' ? null : parseInt(range, 10);
  const cutoff = days === null ? -Infinity : now - days * 24 * 60 * 60 * 1000;
  const filtered = orders.filter((order) => {
    const date = Date.parse(order.createdAt);
    return isAnalyticsStatus(order.status) && Number.isFinite(date) && date >= cutoff && date <= now;
  });
  const statusCounts: Record<AnalyticsStatus, number> = {
    pending: 0, paid: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0,
  };
  const recordedValueByCurrency: Record<string, number> = {};
  const deliveredValueByCurrency: Record<string, number> = {};
  const recordedCountByCurrency: Record<string, number> = {};
  for (const order of filtered) {
    if (!Object.hasOwn(statusCounts, order.status)) continue;
    statusCounts[order.status] += 1;
    const currency = orderCurrency(order);
    if (order.status !== 'cancelled') {
      recordedValueByCurrency[currency] = (recordedValueByCurrency[currency] || 0) + amount(order);
      recordedCountByCurrency[currency] = (recordedCountByCurrency[currency] || 0) + 1;
    }
    if (order.status === 'delivered') {
      deliveredValueByCurrency[currency] = (deliveredValueByCurrency[currency] || 0) + amount(order);
    }
  }
  const currency = 'MAD';
  const count = recordedCountByCurrency[currency] || 0;
  return {
    orders: filtered,
    range,
    statusCounts,
    totalOrders: filtered.length,
    deliveryRate: filtered.length ? Number((100 * statusCounts.delivered / filtered.length).toFixed(1)) : 0,
    currency,
    recordedValueByCurrency,
    deliveredValueByCurrency,
    recordedCountByCurrency,
    // Backwards-compatible field names. These are *not* confirmed cash collections.
    totalRevenue: deliveredValueByCurrency[currency] || 0,
    avgOrderValue: count ? Math.round((recordedValueByCurrency[currency] || 0) / count) : 0,
  };
}
