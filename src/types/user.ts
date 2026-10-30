export type SubscriptionStatus = 'free' | 'active' | 'past_due' | 'cancelled';
export type SubscriptionTier = 'free_tier' | 'starter_tier' | 'pro_monthly' | 'enterprise_tier';
export type UserRole = 'admin' | 'merchant' | 'user';
export type UserStatus = 'active' | 'pending' | 'suspended';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  store_name?: string;
  phone?: string;
  avatar?: string;
  city?: string;
  custom_domain?: string;
  two_factor_enabled?: boolean;
  role: UserRole;
  status?: UserStatus;
  plan_id?: 'free' | 'starter' | 'pro' | 'enterprise';
  created_at: string;
  pages_created_count: number;
  orders_count?: number;
  subscription_status: SubscriptionStatus;
  subscription_tier: SubscriptionTier;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_end?: string;
}

export type MoroccanPaymentMethod = 'CIH' | 'Attijariwafa' | 'BanquePopulaire' | 'CashPlus' | 'Wafacash';

export interface MoroccanBankAccount {
  id: string;
  methodId: MoroccanPaymentMethod;
  name: string;
  bankName: string;
  subtitle: string;
  badge: string;
  rib?: string;
  beneficiary: string;
  cin?: string;
  phone?: string;
  instructions: string;
  isActive: boolean;
  updatedAt?: string;
}

export interface PlatformSettings {
  bankAccounts: MoroccanBankAccount[];
  updatedAt: string;
}

export interface ManualPaymentRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number; // e.g. 100 MAD
  method: MoroccanPaymentMethod;
  transactionReference: string; // Transaction code or sender phone/name
  proofImageUrl?: string; // Optional image URL or base64
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  notes?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  token?: string;
  error?: string;
  message?: string;
}

export interface UsageCheckResult {
  allowed: boolean;
  pagesCreated: number;
  maxFreePages: number;
  isPro: boolean;
  message?: string;
}

export type CustomDomainStatus = 'not_connected' | 'pending_dns' | 'active' | 'error';

export interface PagePixelsConfig {
  facebookPixelId?: string;
  tiktokPixelId?: string;
  googleAnalyticsId?: string;
  customHeadScript?: string;
}

export interface StoredPage {
  id: string;
  userId: string;
  title: string;
  slug: string;
  customDomain?: string | null;
  domainStatus?: CustomDomainStatus;
  domainError?: string | null;
  domainVerifiedAt?: string | null;
  expectedDnsIp?: string;
  expectedDnsCname?: string;
  pixels?: PagePixelsConfig;
  data: any;
  compiledHtml?: string;
  isPublished?: boolean;
  viewsCount?: number;
  ordersCount?: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PublishedPage = StoredPage & {
  isPublished: true;
  compiledHtml: string;
};

