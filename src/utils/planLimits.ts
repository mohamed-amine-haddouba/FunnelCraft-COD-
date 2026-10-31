export const VPS_IP = '217.160.116.237';
export const CNAME_TARGET = 'domains.codworth.me';
export const PLATFORM_OWNER_EMAIL = 'naadianajah2020@gmail.com';

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type PlanFeature =
  | 'create_page'
  | 'custom_domain'
  | 'pixels'
  | 'api_integrations'
  | 'remove_watermark'
  | 'pro_blocks';

export interface PlanCapabilities {
  effectivePlan: PlanTier;
  isAdmin: boolean;
  maxPages: number; // Infinity for unlimited
  canUseCustomDomain: boolean;
  canUsePixels: boolean;
  canUseApiIntegrations: boolean;
  canExportOrders: boolean;
  canRemoveWatermark: boolean;
  canUseProBlocks: boolean;
  prioritySupport: boolean;
}

export interface FeatureAccessResult {
  allowed: boolean;
  statusCode: 200 | 403;
  code: string;
  feature: PlanFeature;
  effectivePlan: PlanTier;
  requiredPlan: 'starter' | 'pro' | 'enterprise';
  maxPages: number;
  currentPagesCount: number;
  message: string;
  messageAr: string;
}

const RESERVED_PLATFORM_DOMAINS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'codworth.me',
  'www.codworth.me',
  'domains.codworth.me',
  'codworth.com',
  'www.codworth.com',
  'cname.codworth.com',
  'funnelcraft.ma',
  'www.funnelcraft.ma',
  'cname.funnelcraft.ma',
  VPS_IP,
]);

export function normalizePlanId(planId?: string | null): PlanTier {
  const clean = (planId || 'free').toString().trim().toLowerCase();
  if (clean === 'starter' || clean === 'pro' || clean === 'enterprise') {
    return clean;
  }
  return 'free';
}

export function isOwnerOrAdminAccount(
  role?: string | null,
  email?: string | null,
  ownerEmail?: string | null
): boolean {
  const normalizedRole = (role || '').toString().trim().toLowerCase();
  if (normalizedRole === 'admin') {
    return true;
  }

  const normalizedEmail = (email || '').toString().trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const normalizedOwner = (ownerEmail || PLATFORM_OWNER_EMAIL).toString().trim().toLowerCase();
  return (
    normalizedEmail === PLATFORM_OWNER_EMAIL ||
    (normalizedOwner.length > 0 && normalizedEmail === normalizedOwner)
  );
}

export function getPlanCapabilities(
  planId?: string | null,
  role?: string | null,
  email?: string | null,
  ownerEmail?: string | null
): PlanCapabilities {
  const isAdmin = isOwnerOrAdminAccount(role, email, ownerEmail);

  if (isAdmin) {
    return {
      effectivePlan: 'enterprise',
      isAdmin: true,
      maxPages: Infinity,
      canUseCustomDomain: true,
      canUsePixels: true,
      canUseApiIntegrations: true,
      canExportOrders: true,
      canRemoveWatermark: true,
      canUseProBlocks: true,
      prioritySupport: true,
    };
  }

  const effectivePlan = normalizePlanId(planId);

  switch (effectivePlan) {
    case 'enterprise':
      return {
        effectivePlan: 'enterprise',
        isAdmin: false,
        maxPages: Infinity,
        canUseCustomDomain: true,
        canUsePixels: true,
        canUseApiIntegrations: true,
        canExportOrders: true,
        canRemoveWatermark: true,
        canUseProBlocks: true,
        prioritySupport: true,
      };
    case 'pro':
      return {
        effectivePlan: 'pro',
        isAdmin: false,
        maxPages: Infinity,
        canUseCustomDomain: true,
        canUsePixels: true,
        canUseApiIntegrations: true,
        canExportOrders: true,
        canRemoveWatermark: true,
        canUseProBlocks: true,
        prioritySupport: false,
      };
    case 'starter':
      return {
        effectivePlan: 'starter',
        isAdmin: false,
        maxPages: 5,
        canUseCustomDomain: false,
        canUsePixels: false,
        canUseApiIntegrations: false,
        canExportOrders: false,
        canRemoveWatermark: true,
        canUseProBlocks: false,
        prioritySupport: false,
      };
    case 'free':
    default:
      return {
        effectivePlan: 'free',
        isAdmin: false,
        maxPages: 2,
        canUseCustomDomain: false,
        canUsePixels: false,
        canUseApiIntegrations: false,
        canExportOrders: false,
        canRemoveWatermark: false,
        canUseProBlocks: false,
        prioritySupport: false,
      };
  }
}

export function checkFeatureAccess(
  feature: PlanFeature,
  user: { plan_id?: string | null; role?: string | null; email?: string | null } | null | undefined,
  currentPagesCount = 0,
  ownerEmail?: string | null
): FeatureAccessResult {
  const isAdmin = isOwnerOrAdminAccount(user?.role, user?.email, ownerEmail);
  const caps = getPlanCapabilities(user?.plan_id, user?.role, user?.email, ownerEmail);

  if (isAdmin || caps.isAdmin) {
    return {
      allowed: true,
      statusCode: 200,
      code: 'OK',
      feature,
      effectivePlan: 'enterprise',
      requiredPlan: 'starter',
      maxPages: Infinity,
      currentPagesCount,
      message: 'Access granted (Admin/Owner)',
      messageAr: 'تم السماح بالوصول (مسؤول النظام)',
    };
  }

  if (feature === 'create_page') {
    if (currentPagesCount >= caps.maxPages) {
      const requiredPlan = caps.effectivePlan === 'free' ? 'starter' : 'pro';
      return {
        allowed: false,
        statusCode: 403,
        code: 'PAGE_LIMIT_REACHED',
        feature,
        effectivePlan: caps.effectivePlan,
        requiredPlan,
        maxPages: caps.maxPages,
        currentPagesCount,
        message:
          caps.effectivePlan === 'free'
            ? `Free plan is limited to ${caps.maxPages} pages. Upgrade to Starter (5 pages) or Pro (Unlimited pages) to create more.`
            : `Starter plan is limited to ${caps.maxPages} pages. Upgrade to Pro for unlimited pages.`,
        messageAr:
          caps.effectivePlan === 'free'
            ? `الباقة المجانية تسمح بحد أقصى ${caps.maxPages} صفحات. قم بالترقية إلى باقة Starter (5 صفحات) أو Pro (غير محدود).`
            : `باقة Starter تسمح بحد أقصى ${caps.maxPages} صفحات. قم بالترقية إلى باقة Pro للحصول على صفحات غير محدودة.`,
      };
    }
    return {
      allowed: true,
      statusCode: 200,
      code: 'OK',
      feature,
      effectivePlan: caps.effectivePlan,
      requiredPlan: 'starter',
      maxPages: caps.maxPages,
      currentPagesCount,
      message: 'Access granted',
      messageAr: 'مسموح',
    };
  }

  if (feature === 'custom_domain') {
    if (!caps.canUseCustomDomain) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'CUSTOM_DOMAIN_FORBIDDEN',
        feature,
        effectivePlan: caps.effectivePlan,
        requiredPlan: 'pro',
        maxPages: caps.maxPages,
        currentPagesCount,
        message: 'Custom domains require the Pro or Enterprise plan. Please upgrade your subscription.',
        messageAr: 'ربط النطاق المخصص (Custom Domain) يتطلب باقة Pro أو Enterprise. يرجى ترقية اشتراكك.',
      };
    }
  }

  if (feature === 'pixels') {
    if (!caps.canUsePixels) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'PIXELS_FORBIDDEN',
        feature,
        effectivePlan: caps.effectivePlan,
        requiredPlan: 'pro',
        maxPages: caps.maxPages,
        currentPagesCount,
        message: 'Facebook & TikTok Pixels require the Pro or Enterprise plan. Please upgrade your subscription.',
        messageAr: 'إضافة بيكسل فيسبوك وتيك توك تتطلب باقة Pro أو Enterprise. يرجى ترقية اشتراكك.',
      };
    }
  }

  if (feature === 'api_integrations') {
    if (!caps.canUseApiIntegrations) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'API_INTEGRATIONS_FORBIDDEN',
        feature,
        effectivePlan: caps.effectivePlan,
        requiredPlan: 'pro',
        maxPages: caps.maxPages,
        currentPagesCount,
        message: 'Order export & delivery carrier API integrations require the Pro or Enterprise plan.',
        messageAr: 'تصدير الطلبات والربط مع شركات التوصيل (API Integrations) يتطلب باقة Pro أو Enterprise.',
      };
    }
  }

  if (feature === 'remove_watermark') {
    if (!caps.canRemoveWatermark) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'WATERMARK_REMOVAL_FORBIDDEN',
        feature,
        effectivePlan: caps.effectivePlan,
        requiredPlan: 'starter',
        maxPages: caps.maxPages,
        currentPagesCount,
        message: 'Removing the platform watermark requires Starter, Pro, or Enterprise plan.',
        messageAr: 'إزالة العلامة المائية تتطلب الترقية إلى باقة مدفوعة.',
      };
    }
  }

  if (feature === 'pro_blocks') {
    if (!caps.canUseProBlocks) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'PRO_BLOCKS_FORBIDDEN',
        feature,
        effectivePlan: caps.effectivePlan,
        requiredPlan: 'pro',
        maxPages: caps.maxPages,
        currentPagesCount,
        message: 'Pro conversion blocks require the Pro or Enterprise plan.',
        messageAr: 'عناصر التحويل المتقدمة تتطلب باقة Pro أو Enterprise.',
      };
    }
  }

  return {
    allowed: true,
    statusCode: 200,
    code: 'OK',
    feature,
    effectivePlan: caps.effectivePlan,
    requiredPlan: 'pro',
    maxPages: caps.maxPages,
    currentPagesCount,
    message: 'Access granted',
    messageAr: 'مسموح',
  };
}

export interface DomainValidationResult {
  valid: boolean;
  normalizedDomain: string;
  error?: string;
  errorAr?: string;
}

export function validateAndNormalizeCustomDomain(rawInput: unknown): DomainValidationResult {
  if (typeof rawInput !== 'string') {
    return {
      valid: false,
      normalizedDomain: '',
      error: 'Domain must be a valid string.',
      errorAr: 'يرجى إدخال نطاق صالح.',
    };
  }

  let cleaned = rawInput.trim().toLowerCase();
  if (!cleaned) {
    return {
      valid: false,
      normalizedDomain: '',
      error: 'Please enter a domain name.',
      errorAr: 'يرجى إدخال اسم النطاق.',
    };
  }

  // Strip protocol if user pasted http:// or https://
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  // Strip path, query, hash, or port
  cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  // Strip trailing dot
  cleaned = cleaned.replace(/\.$/, '');

  if (!cleaned || cleaned.length > 253) {
    return {
      valid: false,
      normalizedDomain: cleaned,
      error: 'Invalid domain length.',
      errorAr: 'طول النطاق غير صالح.',
    };
  }

  // Reject IPv4 or IPv6 addresses
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleaned) || cleaned.includes(':')) {
    return {
      valid: false,
      normalizedDomain: cleaned,
      error: 'IP addresses are not allowed. Please provide a valid domain name (FQDN).',
      errorAr: 'لا يُسمح بعناوين IP المباشرة. يرجى إدخال اسم نطاق صالح.',
    };
  }

  // Reject reserved/platform domains
  if (
    RESERVED_PLATFORM_DOMAINS.has(cleaned) ||
    cleaned.endsWith('.codworth.me') ||
    cleaned.endsWith('.codworth.com') ||
    cleaned.endsWith('.funnelcraft.ma') ||
    cleaned.endsWith('.run.app') ||
    cleaned.endsWith('.localhost')
  ) {
    return {
      valid: false,
      normalizedDomain: cleaned,
      error: 'Cannot use a reserved or platform domain as a custom domain.',
      errorAr: 'لا يمكن استخدام نطاق محجوز أو تابع للمنصة كنطاق مخصص.',
    };
  }

  // Strict FQDN regex: at least one dot, valid DNS labels (1-63 chars, alphanumeric & hyphens, not starting/ending with hyphen), TLD at least 2 alpha chars
  const fqdnRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  if (!fqdnRegex.test(cleaned)) {
    return {
      valid: false,
      normalizedDomain: cleaned,
      error: 'Invalid domain format. Use a valid domain like shop.yourdomain.com or yourdomain.com.',
      errorAr: 'صيغة النطاق غير صالحة. يرجى إدخال نطاق صحيح مثل yourdomain.com أو shop.yourdomain.com.',
    };
  }

  return {
    valid: true,
    normalizedDomain: cleaned,
  };
}
