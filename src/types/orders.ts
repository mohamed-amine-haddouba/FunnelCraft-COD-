export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

export interface CustomerOrder {
  id: string; // e.g. #COD-10492
  userId?: string;
  userEmail?: string;
  storeName?: string;
  pageSlug?: string;
  pageTitle?: string;
  funnelId?: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress?: string;
  customerNotes?: string;
  productName: string;
  price: number;
  quantity: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
}

export type SubscriptionPlanId = 'free' | 'starter' | 'pro' | 'enterprise';

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  confirmationRate: number;
  todayOrdersCount: number;
  deliveredRevenue: number;
}
