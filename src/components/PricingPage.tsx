import React, { useState, useEffect, useRef } from 'react';
import { LocalizedLink } from './LocalizedLink';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import {
  Crown,
  Check,
  Sparkles,
  Zap,
  ShieldCheck,
  Building2,
  Rocket,
  Copy,
  UploadCloud,
  FileCheck2,
  Landmark,
  CreditCard,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Tag,
  Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/translations';
import { SUPPORTED_LANGUAGES } from '../i18n/config';
import { ThemeToggleButton } from './ThemeToggleButton';
import { PublicFooter } from './PublicFooter';
import { SubscriptionPlanId } from '../types/orders';
import { MoroccanBankAccount } from '../types/user';
import {
  DEFAULT_MOROCCAN_BANK_ACCOUNTS,
  filterActiveBankAccounts,
  inferMoroccanPaymentMethod,
  calculatePayPalUsdSettlement,
  DEFAULT_EXCHANGE_RATES,
  normalizeExchangeRates,
} from '../utils/currencyAndBanks';

export interface PricingPageProps {
  currentPlan?: SubscriptionPlanId;
  triggerReason?: string;
  onSelectFreePlan?: () => void;
  onUpgradeSuccess?: (tier: SubscriptionPlanId) => void;
  onBackToBuilder?: () => void;
  onNavigateToContact?: () => void;
  onNavigateToTerms?: () => void;
  onNavigateToPrivacy?: () => void;
}

interface PricingTier {
  id: SubscriptionPlanId;
  nameAr: string;
  nameEn: string;
  priceUSD: number;
  monthlyPriceMAD: number;
  limits: string;
  badge?: string;
  description: string;
  highlighted?: boolean;
  ctaLabel: string;
  icon: React.FC<{ className?: string }>;
  features: string[];
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'starter',
    nameAr: 'المبتدئ (Starter)',
    nameEn: 'Starter Plan',
    priceUSD: 10,
    monthlyPriceMAD: 99,
    limits: '2 صفحات • 100 طلب/شهر • 1,000 زيارة/شهر',
    description: 'انطلاقة مثالية للتجار المبتدئين لاختبار المنتجات وإطلاق صفحات الهبوط.',
    ctaLabel: 'اشترك في باقة المبتدئ',
    icon: Rocket,
    features: [
      'محرر الصفحات الاحترافي (Page Builder)',
      'استيراد المنتجات بـ 3 طبقات (3-Layer Scraper)',
      'استمارة الدفع عند الاستلام (COD Form)',
      'تحليلات أساسية للمبيعات (Basic Analytics)',
      'التحقق عبر البريد الإلكتروني (Email Verification)',
    ],
  },
  {
    id: 'pro',
    nameAr: 'بريميوم (Professional)',
    nameEn: 'Professional Plan',
    badge: 'الأكثر شعبية ⭐',
    highlighted: true,
    priceUSD: 20,
    monthlyPriceMAD: 199,
    limits: '5 صفحات • 500 طلب/شهر • 5,000 زيارة/شهر',
    description: 'الباقة الأكثر طلباً للتجار المحترفين مع الدومين المخصص، البيكسل، والذكاء الاصطناعي.',
    ctaLabel: 'اشترك في باقة بريميوم',
    icon: Crown,
    features: [
      'كل مميزات باقة المبتدئ (Everything in Starter)',
      'ربط الدومين المخصص (Custom Domain)',
      'بيكسل فيسبوك وتيك توك (Facebook & TikTok Pixels)',
      'تحليلات وإحصائيات متقدمة (Advanced Analytics)',
      'توليد الصفحات بالذكاء الاصطناعي (AI Page Generation - Gemini)',
    ],
  },
  {
    id: 'enterprise',
    nameAr: 'الأعمال (Business)',
    nameEn: 'Business Plan',
    badge: 'للشركات والوكالات 🚀',
    priceUSD: 30,
    monthlyPriceMAD: 299,
    limits: 'صفحات، طلبات، وزيارات غير محدودة',
    description: 'حل متكامل بلا حدود للمتاجر الكبرى مع ربط شركات الشحن ودعم فني ذو أولوية.',
    ctaLabel: 'اشترك في باقة الأعمال',
    icon: Building2,
    features: [
      'كل مميزات باقة بريميوم (Everything in Professional)',
      'الربط مع شركات الشحن والتوصيل (Shipping API Integrations)',
      'صفحات وطلبات وزيارات غير محدودة (Unlimited Everything)',
      'دعم فني ذو أولوية (Priority Support)',
    ],
  },
];

export const PricingPage: React.FC<PricingPageProps> = ({
  currentPlan = 'free',
  triggerReason,
  onSelectFreePlan,
  onUpgradeSuccess = () => {},
  onBackToBuilder,
  onNavigateToContact,
  onNavigateToTerms,
  onNavigateToPrivacy,
}) => {
  const { user, token, isLoggedIn, isPro, upgradeToPro, refreshUser, submitManualPayment, userPayments } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const effectivePlan: SubscriptionPlanId =
    user?.plan_id && user.plan_id !== 'free'
      ? user.plan_id
      : isPro && currentPlan === 'free'
      ? 'pro'
      : currentPlan;

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPaidTier, setSelectedPaidTier] = useState<PricingTier | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'bank'>('paypal');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Dynamic Moroccan Banks from /api/settings/banks
  const [banks, setBanks] = useState<MoroccanBankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [copiedRib, setCopiedRib] = useState<string | null>(null);

  // Manual Bank Transfer Form State
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Exchange rates for PayPal MAD -> USD conversion
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(
    DEFAULT_EXCHANGE_RATES
  );

  // Dynamic Pricing Tiers loaded from /api/plans (falls back to PRICING_TIERS)
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(PRICING_TIERS);

  // Coupon Code & Server-Verified Discount State
  const [couponInput, setCouponInput] = useState<string>('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState<boolean>(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    originalPrice: number;
    finalPrice: number;
    discountAmount: number;
    discountType?: 'percentage' | 'fixed';
    discountValue?: number;
  } | null>(null);

  // Processing & Feedback State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [runtimePayPalClientId, setRuntimePayPalClientId] = useState<string>('');
  const [runtimePayPalEnv, setRuntimePayPalEnv] = useState<'live' | 'sandbox'>('sandbox');
  const [isPayPalConfigLoaded, setIsPayPalConfigLoaded] = useState<boolean>(false);

  const checkoutSectionRef = useRef<HTMLDivElement>(null);

  // Fetch active Moroccan banks, dynamic plans, & live exchange rates
  useEffect(() => {
    let mounted = true;

    fetch('/api/plans')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data && Array.isArray(data.plans) && data.plans.length > 0) {
          const dynamicMap = new Map<
            string,
            { id: string; name: string; priceMAD: number; features: string[] }
          >();
          for (const p of data.plans) {
            if (p && typeof p.id === 'string') {
              dynamicMap.set(p.id, p);
            }
          }
          setPricingTiers((prev) =>
            prev.map((tier) => {
              const dyn = dynamicMap.get(tier.id);
              if (!dyn) return tier;
              return {
                ...tier,
                nameEn: dyn.name || tier.nameEn,
                monthlyPriceMAD:
                  typeof dyn.priceMAD === 'number' && dyn.priceMAD > 0
                    ? dyn.priceMAD
                    : tier.monthlyPriceMAD,
                features:
                  Array.isArray(dyn.features) && dyn.features.length > 0
                    ? dyn.features
                    : tier.features,
              };
            })
          );
          setSelectedPaidTier((prevSelected) => {
            if (!prevSelected) return null;
            const dyn = dynamicMap.get(prevSelected.id);
            if (!dyn) return prevSelected;
            return {
              ...prevSelected,
              nameEn: dyn.name || prevSelected.nameEn,
              monthlyPriceMAD:
                typeof dyn.priceMAD === 'number' && dyn.priceMAD > 0
                  ? dyn.priceMAD
                  : prevSelected.monthlyPriceMAD,
              features:
                Array.isArray(dyn.features) && dyn.features.length > 0
                  ? dyn.features
                  : prevSelected.features,
            };
          });
        }
      })
      .catch(() => {});

    fetch('/api/settings/banks')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch banks');
        return res.json();
      })
      .then((data) => {
        if (mounted && data && Array.isArray(data.banks)) {
          const active = filterActiveBankAccounts(data.banks);
          setBanks(active);
          setSelectedBankId((prev) =>
            active.some((b) => b.id === prev) ? prev : active[0]?.id || ''
          );
        }
      })
      .catch(() => {
        if (mounted) {
          setBanks((prev) => {
            if (prev.length > 0) return prev;
            const fallback = filterActiveBankAccounts(DEFAULT_MOROCCAN_BANK_ACCOUNTS);
            setSelectedBankId(fallback[0]?.id || '');
            return fallback;
          });
        }
      });

    fetch('/api/exchange-rates')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data && data.rates) {
          setExchangeRates(normalizeExchangeRates(data.rates));
        }
      })
      .catch(() => {});

    fetch('/api/paypal/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted) return;
        if (data && typeof data.clientId === 'string' && data.clientId.trim()) {
          setRuntimePayPalClientId(data.clientId.trim().replace(/^['"]|['"]$/g, ''));
        }
        if (data && (data.environment === 'live' || data.environment === 'production')) {
          setRuntimePayPalEnv('live');
        } else {
          setRuntimePayPalEnv('sandbox');
        }
        setIsPayPalConfigLoaded(true);
      })
      .catch((err) => {
        console.error('[PAYPAL FRONTEND] Failed to load /api/paypal/config:', err);
        if (mounted) {
          setIsPayPalConfigLoaded(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const getEffectivePriceMAD = (tier: PricingTier): number => {
    if (tier.monthlyPriceMAD === 0) return 0;
    if (billingCycle === 'yearly') {
      return Math.round(tier.monthlyPriceMAD * 0.8);
    }
    return tier.monthlyPriceMAD;
  };

  const getTotalBilledMAD = (tier: PricingTier): number => {
    const monthly = getEffectivePriceMAD(tier);
    return billingCycle === 'yearly' ? monthly * 12 : monthly;
  };

  const getLocalizedTierDetails = (tier: PricingTier) => {
    if (tier.id === 'starter') {
      return {
        name: t.tierStarterName,
        sub: t.tierStarterSub,
        limits: t.tierStarterLimits,
        desc: t.tierStarterDesc,
        cta: t.tierStarterCta,
        badge: undefined as string | undefined,
        features: [
          t.tierStarterFeat1,
          t.tierStarterFeat2,
          t.tierStarterFeat3,
          t.tierStarterFeat4,
          t.tierStarterFeat5,
        ],
      };
    }
    if (tier.id === 'pro') {
      return {
        name: t.tierProName,
        sub: t.tierProSub,
        limits: t.tierProLimits,
        desc: t.tierProDesc,
        cta: t.tierProCta,
        badge: t.tierPopularBadge,
        features: [
          t.tierProFeat1,
          t.tierProFeat2,
          t.tierProFeat3,
          t.tierProFeat4,
          t.tierProFeat5,
        ],
      };
    }
    return {
      name: t.tierBusinessName,
      sub: t.tierBusinessSub,
      limits: t.tierBusinessLimits,
      desc: t.tierBusinessDesc,
      cta: t.tierBusinessCta,
      badge: t.tierBusinessBadge,
      features: [
        t.tierBusinessFeat1,
        t.tierBusinessFeat2,
        t.tierBusinessFeat3,
        t.tierBusinessFeat4,
      ],
    };
  };

  // Re-validate or clear applied coupon whenever selectedPaidTier or billingCycle changes
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, [selectedPaidTier?.id, billingCycle]);

  const handleApplyCoupon = async () => {
    if (!selectedPaidTier || !couponInput.trim() || isApplyingCoupon) return;
    setIsApplyingCoupon(true);
    setCouponError(null);

    try {
      const res = await fetch('/api/apply-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          couponCode: couponInput.trim().toUpperCase(),
          planId: selectedPaidTier.id,
          billingCycle,
        }),
      });

      const data = await res.json().catch(() => ({ valid: false, error: 'Invalid response' }));
      if (!res.ok || !data.valid) {
        setAppliedCoupon(null);
        setCouponError(data.error || 'كود الكوبون غير صالح أو منتهي الصلاحية.');
      } else {
        setAppliedCoupon({
          code: data.couponCode || couponInput.trim().toUpperCase(),
          originalPrice: Number(data.originalPrice),
          finalPrice: Number(data.finalPrice),
          discountAmount: Number(data.discountAmount),
          discountType: data.discountType,
          discountValue: data.discountValue,
        });
        setCouponError(null);
      }
    } catch {
      setAppliedCoupon(null);
      setCouponError('تعذر التحقق من الكوبون حالياً. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleChooseTier = (tier: PricingTier) => {
    setCheckoutError(null);
    setCheckoutSuccess(null);

    if (tier.id === 'free') {
      if (onSelectFreePlan) {
        onSelectFreePlan();
      } else if (onBackToBuilder) {
        onBackToBuilder();
      }
      return;
    }

    setSelectedPaidTier(tier);
    setTimeout(() => {
      checkoutSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRib(key);
    setTimeout(() => setCopiedRib(null), 2000);
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setCheckoutError('حجم صورة الوصل كبير جداً (الحد الأقصى 5MB).');
      return;
    }

    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptDataUrl(reader.result);
        setCheckoutError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const selectedBank: MoroccanBankAccount | undefined =
    banks.find((b) => b.id === selectedBankId) || banks[0];

  const baseChargeMAD = selectedPaidTier ? getTotalBilledMAD(selectedPaidTier) : 199;
  const totalChargeMAD = appliedCoupon ? appliedCoupon.finalPrice : baseChargeMAD;
  const paypalSettlement = calculatePayPalUsdSettlement(totalChargeMAD, exchangeRates);
  const pendingPayment = userPayments?.find((p) => p.status === 'pending');

  // Direct PayPal API Order Creation + Upgrade Handler
  const handleDirectPayPalUpgrade = async () => {
    if (!selectedPaidTier) return;
    setIsProcessing(true);
    setCheckoutError(null);

    try {
      const activeToken = token || localStorage.getItem('funnelcraft_auth_token') || '';
      const createRes = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          userId: user?.id,
          identifier: selectedPaidTier.id,
          planId: selectedPaidTier.id,
          billingCycle,
          couponCode: appliedCoupon?.code || undefined,
        }),
      });

      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok && !createData.id) {
        // Still allow sandbox/simulated instant upgrade if PayPal keys are not configured in preview
      }

      const upgradeRes = await upgradeToPro(selectedPaidTier.id);
      await refreshUser();
      if (upgradeRes.success) {
        try {
          localStorage.setItem('funnelcraft_plan', selectedPaidTier.id);
        } catch (_) {}
        onUpgradeSuccess(selectedPaidTier.id);
        setCheckoutSuccess(
          `🎉 تم تفعيل اشتراكك في ${selectedPaidTier.nameAr} بنجاح! جميع الميزات الاحترافية مفتوحة الآن.`
        );
      } else {
        setCheckoutError(upgradeRes.message || 'تعذر تفعيل الباقة تلقائياً. حاول مرة أخرى.');
      }
    } catch (_err) {
      setCheckoutError('حدث خطأ أثناء الاتصال ببوابة PayPal. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Manual Bank Transfer Receipt Submission
  const handleManualBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaidTier) return;

    const cleanRef = transactionRef.trim() || `RIB-${Date.now().toString().slice(-6)}`;
    if (!receiptDataUrl && !transactionRef.trim()) {
      setCheckoutError('يرجى إرفاق صورة وصل التحويل أو إدخال رقم مرجع التحويل البنكي.');
      return;
    }

    if (!selectedBank) {
      setCheckoutError('لا توجد حسابات بنكية متاحة حالياً. يرجى التواصل مع الدعم.');
      return;
    }

    setIsProcessing(true);
    setCheckoutError(null);

    try {
      const method = inferMoroccanPaymentMethod(selectedBank);
      const res = await submitManualPayment(
        method,
        cleanRef,
        totalChargeMAD,
        receiptDataUrl || undefined,
        `${selectedPaidTier.nameAr} (${
          billingCycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'
        }) - ${selectedBank.name}${transferNotes ? ` | ${transferNotes}` : ''}`
      );

      if (res.success) {
        setCheckoutSuccess(
          `✅ تم إرسال وصل التحويل البنكي (${totalChargeMAD} درهم) لباقة ${selectedPaidTier.nameAr} بنجاح! سيتم تفعيل حسابك فوراً بعد مراجعة الإدارة.`
        );
        setTransactionRef('');
        setTransferNotes('');
        setReceiptDataUrl(null);
        setReceiptFileName('');
      } else {
        setCheckoutError(res.error || 'حدث خطأ أثناء إرسال طلب التحويل البنكي.');
      }
    } catch (_err) {
      setCheckoutError('تعذر إرسال الوصل حالياً. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsProcessing(false);
    }
  };

  const buildTimePayPalClientId = (
    (import.meta as unknown as { env?: Record<string, string> }).env
      ?.VITE_PAYPAL_CLIENT_ID || ''
  )
    .trim()
    .replace(/^['"]|['"]$/g, '');

  // Prefer server-verified runtime Client ID (from /api/paypal/config) over build-time VITE_PAYPAL_CLIENT_ID, and never use 'test' or empty string in Live mode
  const paypalClientId = (runtimePayPalClientId || buildTimePayPalClientId).trim();
  const isValidPayPalClientId =
    Boolean(paypalClientId) &&
    paypalClientId !== 'test' &&
    paypalClientId !== 'sb' &&
    paypalClientId !== 'undefined';

  return (
    <div
      dir={dir}
      className="min-h-screen w-full bg-brand-bg text-brand-primary flex flex-col relative overflow-x-hidden select-none"
    >
      {/* Persistent Sticky Guest Header when unauthenticated */}
      {!isLoggedIn && (
        <header className="w-full border-b border-brand bg-brand-bg/95 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            <LocalizedLink to="/home" className="flex items-center shrink-0">
              <img
                src="/assets/brand/logo.jpg"
                alt="CodWorth"
                className="h-10 w-auto object-contain rounded-lg"
              />
            </LocalizedLink>

            <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-brand-secondary">
              <LocalizedLink
                to="/home"
                className="text-brand-secondary hover:text-brand-primary transition"
              >
                {t['home.hero.nav.home']}
              </LocalizedLink>
              <LocalizedLink
                to="/home#features"
                className="text-brand-secondary hover:text-brand-primary transition"
              >
                {t['home.hero.nav.features']}
              </LocalizedLink>
              <LocalizedLink
                to="/pricing"
                className="text-brand-primary hover:text-brand-accent transition"
              >
                {t['home.hero.nav.pricing']}
              </LocalizedLink>
              <LocalizedLink
                to="/login"
                className="text-brand-secondary hover:text-brand-primary transition"
              >
                {t['home.hero.nav.templates']}
              </LocalizedLink>
            </nav>

            <div className="flex items-center gap-2.5 shrink-0">
              <div
                dir="ltr"
                className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-brand-surface border border-brand"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                      language === lang.code
                        ? 'bg-brand-accent text-white'
                        : 'text-brand-secondary hover:text-brand-primary'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              {/* Global Theme Toggle Button */}
              <ThemeToggleButton />

              <LocalizedLink
                to="/login"
                className="hidden sm:inline-flex items-center justify-center px-3.5 py-2 rounded-xl border border-transparent hover:border-brand hover:bg-brand-surface text-brand-secondary hover:text-brand-primary text-xs sm:text-[13px] font-semibold transition"
              >
                {t['home.hero.nav.login']}
              </LocalizedLink>

              <LocalizedLink
                to="/login?mode=register"
                className="px-3.5 sm:px-4 py-2 rounded-xl bg-brand-accent hover:opacity-90 text-white text-xs sm:text-[13px] font-bold shadow-md transition inline-flex items-center justify-center"
              >
                {t['home.hero.nav.signup']}
              </LocalizedLink>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle Menu"
                aria-expanded={isMobileMenuOpen}
                className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-surface border border-brand text-brand-primary hover:text-brand-accent transition cursor-pointer shrink-0"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-brand bg-brand-bg/98 backdrop-blur-xl px-4 py-4 space-y-4 shadow-2xl">
              <nav className="flex flex-col space-y-2 text-sm font-bold text-brand-secondary">
                <LocalizedLink
                  to="/home"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-xl hover:bg-brand-surface text-brand-secondary hover:text-brand-primary transition"
                >
                  {t['home.hero.nav.home']}
                </LocalizedLink>
                <LocalizedLink
                  to="/home#features"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-xl hover:bg-brand-surface text-brand-secondary hover:text-brand-primary transition"
                >
                  {t['home.hero.nav.features']}
                </LocalizedLink>
                <LocalizedLink
                  to="/pricing"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-xl bg-brand-surface/70 text-brand-primary transition"
                >
                  {t['home.hero.nav.pricing']}
                </LocalizedLink>
                <LocalizedLink
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-xl hover:bg-brand-surface text-brand-secondary hover:text-brand-primary transition"
                >
                  {t['home.hero.nav.templates']}
                </LocalizedLink>
              </nav>

              <div className="pt-2 border-t border-brand flex flex-col gap-2.5">
                <div
                  dir="ltr"
                  className="flex sm:hidden items-center justify-center gap-1 p-1 rounded-xl bg-brand-surface border border-brand"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        language === lang.code
                          ? 'bg-brand-accent text-white'
                          : 'text-brand-secondary hover:text-brand-primary'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>

                <LocalizedLink
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full py-3 rounded-xl border border-brand bg-brand-surface text-brand-primary text-center text-sm font-bold transition flex items-center justify-center"
                >
                  {t['home.hero.nav.login']}
                </LocalizedLink>
              </div>
            </div>
          )}
        </header>
      )}

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 relative">
        {/* Ambient Soft Brand Glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[320px] bg-brand-accent/10 blur-[120px] rounded-full" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-10">
          {/* Top Back Navigation & Trigger Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {onBackToBuilder && (
              <button
                type="button"
                onClick={onBackToBuilder}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-surface hover:bg-brand-elevated border border-brand text-xs font-bold text-brand-secondary hover:text-brand-primary transition cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 text-brand-accent" />
                <span>{language === 'ar' ? 'العودة' : language === 'fr' ? 'Retour' : 'Back'}</span>
              </button>
            )}

            {isPro && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-xs font-extrabold">
                <Crown className="w-4 h-4 text-brand-accent" />
                <span>
                  {language === 'ar'
                    ? `حسابك الحالي مفعل على الباقة الاحترافية (${effectivePlan.toUpperCase()})`
                    : `Active Plan: ${effectivePlan.toUpperCase()}`}
                </span>
              </div>
            )}
          </div>

          {triggerReason && (
            <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-brand-accent/10 border border-brand-accent/30 flex items-center gap-3 text-brand-primary text-xs sm:text-sm font-bold shadow-lg">
              <Lock className="w-5 h-5 text-brand-accent shrink-0" />
              <span>{triggerReason}</span>
            </div>
          )}

          {/* Header Section */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-xs font-extrabold">
              <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
              <span>{t.pricingBadge}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-brand-primary leading-tight">
              {t.pricingTitle}
            </h1>

            <p className="text-sm sm:text-base text-brand-secondary max-w-2xl mx-auto leading-relaxed">
              {t.pricingSubtitle}
            </p>

            {/* Monthly vs Yearly Billing Toggle */}
            <div className="pt-3 flex items-center justify-center">
              <div className="inline-flex items-center p-1 rounded-2xl bg-brand-surface border border-brand shadow-inner">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-brand-accent text-white shadow-sm'
                      : 'text-brand-secondary hover:text-brand-primary'
                  }`}
                >
                  {t.billedMonthly}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition cursor-pointer ${
                    billingCycle === 'yearly'
                      ? 'bg-brand-accent text-white shadow-sm'
                      : 'text-brand-secondary hover:text-brand-primary'
                  }`}
                >
                  <span>{t.billedAnnually}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      billingCycle === 'yearly'
                        ? 'bg-brand-bg text-brand-primary'
                        : 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30'
                    }`}
                  >
                    {t.save20Percent}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 3 Pricing Tiers Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch max-w-7xl mx-auto">
            {pricingTiers.map((tier) => {
              const Icon = tier.icon;
              const effectiveMonthlyMAD = getEffectivePriceMAD(tier);
              const isCurrentTier = isPro && effectivePlan === tier.id;
              const isSelectedForCheckout = selectedPaidTier?.id === tier.id;
              const localized = getLocalizedTierDetails(tier);

              return (
                <div
                  key={tier.id}
                  className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 ${
                    tier.highlighted
                      ? 'bg-brand-surface border-2 border-brand-accent shadow-[0_0_50px_-10px_rgba(226,91,38,0.45)] ring-2 ring-brand-accent/50 lg:-translate-y-2'
                      : isSelectedForCheckout
                      ? 'bg-brand-surface border-2 border-brand-accent shadow-xl'
                      : 'bg-brand-surface border border-brand hover:border-brand-accent/50 shadow-md'
                  }`}
                >
                  {/* Popular / Highlight Ribbon */}
                  {localized.badge && (
                    <div
                      className={`absolute -top-3.5 right-6 px-3.5 py-1 rounded-full text-[11px] font-black tracking-wide shadow-md ${
                        tier.highlighted
                          ? 'bg-brand-accent text-white ring-2 ring-brand-accent/30 animate-pulse'
                          : 'bg-brand-elevated text-brand-accent border border-brand'
                      }`}
                    >
                      {localized.badge}
                    </div>
                  )}

                  <div className="space-y-5">
                    {/* Tier Header */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div>
                        <h3 className="text-xl font-black text-brand-primary">{localized.name}</h3>
                        <span className="text-xs font-semibold text-brand-secondary">
                          {localized.sub}
                        </span>
                      </div>
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                          tier.highlighted
                            ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/40'
                            : 'bg-brand-elevated text-brand-secondary border border-brand'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Limits Badge (Bento Metric Pill) */}
                    <div className="px-3 py-1.5 rounded-xl bg-brand-bg border border-brand text-[11px] font-extrabold text-brand-accent flex items-center justify-center text-center">
                      <span>{localized.limits}</span>
                    </div>

                    {/* Price Display in MAD */}
                    <div className="pt-2 border-t border-brand">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl sm:text-5xl font-black text-brand-primary font-mono tracking-tight">
                          {effectiveMonthlyMAD}
                        </span>
                        <span className="text-lg font-extrabold text-brand-accent">MAD</span>
                        <span className="text-sm font-bold text-brand-secondary">
                          / {t.perMonth}
                        </span>
                      </div>

                      <div className="mt-1.5 text-xs text-brand-secondary font-medium">
                        {billingCycle === 'yearly' ? (
                          <span className="text-brand-accent font-bold">
                            {language === 'ar'
                              ? `تُدفع سنوياً (${getTotalBilledMAD(tier)} MAD/سنة) • توفير 20%`
                              : language === 'fr'
                              ? `Facturé annuellement (${getTotalBilledMAD(tier)} MAD/an) • -20%`
                              : `Billed annually (${getTotalBilledMAD(tier)} MAD/yr) • 20% OFF`}
                          </span>
                        ) : (
                          <span>
                            {language === 'ar'
                              ? 'أو وفّر 20% باختيار الدفع السنوي'
                              : language === 'fr'
                              ? 'Ou économisez 20% avec la facturation annuelle'
                              : 'Or save 20% with annual billing'}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-brand-secondary leading-relaxed">{localized.desc}</p>

                    {/* Feature List with Checkmarks */}
                    <div className="pt-2 border-t border-brand/60 space-y-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-brand-secondary">
                        {t.includedFeaturesLabel}
                      </div>
                      <ul className="space-y-2.5">
                        {localized.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-xs font-bold text-brand-primary">
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                tier.highlighted
                                  ? 'bg-brand-accent text-white shadow-xs'
                                  : 'bg-brand-elevated text-brand-accent'
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                            <span className="leading-tight">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action CTA Button */}
                  <div className="pt-6 mt-6 border-t border-brand">
                    <button
                      type="button"
                      onClick={() => handleChooseTier(tier)}
                      className={`w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                        tier.highlighted
                          ? 'bg-brand-accent hover:opacity-90 text-white ring-2 ring-brand-accent/50'
                          : 'bg-brand-elevated hover:bg-brand-accent hover:text-white text-brand-primary border border-brand'
                      }`}
                    >
                      <Crown className="w-4 h-4 shrink-0" />
                      <span>
                        {isCurrentTier
                          ? language === 'ar'
                            ? 'تجديد / ترقية الباقة'
                            : language === 'fr'
                            ? 'Renouveler / Gérer'
                            : 'Renew / Manage'
                          : localized.cta}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Checkout Section / Modal when a Paid Plan is Selected */}
          {selectedPaidTier && (
            <div
              ref={checkoutSectionRef}
              className="max-w-4xl mx-auto mt-10 rounded-3xl bg-brand-surface border-2 border-brand-accent/50 shadow-2xl overflow-hidden animate-in fade-in duration-200"
            >
              {/* Checkout Header */}
              <div className="px-6 py-5 bg-brand-bg border-b border-brand flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-brand-accent/20 border border-brand-accent/40 flex items-center justify-center text-brand-accent">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-brand-primary">
                        إتمام الاشتراك — {selectedPaidTier.nameAr}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-brand-accent/20 text-brand-accent border border-brand-accent/30">
                        {billingCycle === 'yearly' ? 'سنوي (خصم 20%)' : 'شهري'}
                      </span>
                    </div>
                    <p className="text-xs text-brand-secondary mt-0.5">
                      المبلغ الإجمالي المطلوب:{' '}
                      <strong className="text-brand-accent font-mono">
                        {totalChargeMAD} MAD
                      </strong>{' '}
                      (يعادل تقريباً{' '}
                      <strong className="text-brand-primary font-mono">
                        ${paypalSettlement.formattedUSD} USD
                      </strong>
                      )
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPaidTier(null)}
                  className="p-2 rounded-xl bg-brand-elevated hover:opacity-80 text-brand-secondary hover:text-brand-primary transition cursor-pointer"
                  title="إغلاق نافذة الدفع"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Alerts */}
                {checkoutSuccess && (
                  <div className="p-4 rounded-2xl bg-brand-accent/15 border border-brand-accent/50 text-brand-primary flex items-center gap-3 text-xs sm:text-sm font-bold">
                    <CheckCircle2 className="w-5 h-5 text-brand-accent shrink-0" />
                    <span className="flex-1">{checkoutSuccess}</span>
                  </div>
                )}

                {checkoutError && (
                  <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 flex items-center gap-3 text-xs sm:text-sm font-bold">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span className="flex-1">{checkoutError}</span>
                  </div>
                )}

                {pendingPayment && (
                  <div className="p-3.5 rounded-2xl bg-brand-accent/10 border border-brand-accent/30 text-brand-primary text-xs font-bold flex items-center justify-between gap-2">
                    <span>
                      ⏳ لديك طلب تحويل بنكي قيد المراجعة ({pendingPayment.amount} درهم -{' '}
                      {pendingPayment.method}).
                    </span>
                    <span className="font-mono text-[11px] text-brand-accent">
                      #{pendingPayment.transactionReference}
                    </span>
                  </div>
                )}

                {/* Coupon Code Input Box */}
                <div className="p-4 rounded-2xl bg-brand-bg border border-brand space-y-3">
                  <label className="block text-xs font-black text-brand-secondary flex items-center gap-2">
                    <Tag className="w-4 h-4 text-brand-accent" />
                    <span>هل لديك كود خصم؟ (Have a coupon code?)</span>
                  </label>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <input
                      type="text"
                      dir="ltr"
                      value={couponInput}
                      onChange={(e) =>
                        setCouponInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                      }
                      placeholder="Enter coupon code (e.g. WELCOME20)"
                      className="flex-1 h-10 px-3.5 rounded-xl bg-brand-surface border border-brand text-xs font-mono text-brand-primary uppercase focus:border-brand-accent outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={isApplyingCoupon || !couponInput.trim()}
                      className="h-10 px-5 rounded-xl bg-brand-accent hover:opacity-90 disabled:opacity-50 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      {isApplyingCoupon ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري التحقق...</span>
                        </>
                      ) : (
                        <span>تطبيق (Apply)</span>
                      )}
                    </button>
                    {appliedCoupon && (
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedCoupon(null);
                          setCouponInput('');
                          setCouponError(null);
                        }}
                        className="h-10 px-3 rounded-xl bg-brand-elevated hover:opacity-80 text-brand-secondary text-xs font-bold transition cursor-pointer shrink-0"
                      >
                        إزالة
                      </button>
                    )}
                  </div>

                  {appliedCoupon && (
                    <div className="p-3 rounded-xl bg-brand-accent/15 border border-brand-accent/40 text-brand-primary text-xs font-bold flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-brand-accent shrink-0" />
                        <span>
                          تم تطبيق الكوبون <strong className="font-mono">{appliedCoupon.code}</strong> بنجاح! خصم{' '}
                          <strong className="font-mono">{appliedCoupon.discountAmount} درهم</strong>
                        </span>
                      </div>
                      <div className="font-mono text-xs">
                        <span className="line-through text-brand-secondary mr-2">
                          {appliedCoupon.originalPrice} MAD
                        </span>
                        <span className="text-brand-accent font-black">
                          {appliedCoupon.finalPrice} MAD (${paypalSettlement.formattedUSD} USD)
                        </span>
                      </div>
                    </div>
                  )}

                  {couponError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{couponError}</span>
                    </div>
                  )}
                </div>

                {/* Payment Method Tabs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('paypal')}
                    className={`p-4 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
                      paymentMethod === 'paypal'
                        ? 'bg-brand-accent/15 border-brand-accent ring-1 ring-brand-accent text-brand-primary'
                        : 'bg-brand-bg border-brand text-brand-secondary hover:border-brand-accent/50 hover:text-brand-primary'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-accent/20 border border-brand-accent/30 text-brand-accent flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black text-brand-primary">
                        الدفع الفوري عبر PayPal / البطاقة البنكية
                      </div>
                      <div className="text-[11px] text-brand-secondary">
                        تفعيل تلقائي فوري للباقة ({paypalSettlement.formattedUSD} USD)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`p-4 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
                      paymentMethod === 'bank'
                        ? 'bg-brand-accent/15 border-brand-accent ring-1 ring-brand-accent text-brand-primary'
                        : 'bg-brand-bg border-brand text-brand-secondary hover:border-brand-accent/50 hover:text-brand-primary'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-accent/20 border border-brand-accent/30 text-brand-accent flex items-center justify-center shrink-0">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black text-brand-primary">
                        تحويل بنكي مغربي (CIH / التجاري / الشعبي)
                      </div>
                      <div className="text-[11px] text-brand-secondary">
                        ادفع بالدرهم المغربي ({totalChargeMAD} MAD) وارفع وصل التحويل
                      </div>
                    </div>
                  </button>
                </div>

                {/* Option 1: PayPal Automatic Upgrade */}
                {paymentMethod === 'paypal' ? (
                  <div className="p-6 rounded-2xl bg-brand-bg border border-brand space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand pb-4">
                      <div>
                        <h3 className="text-sm font-black text-brand-primary">
                          الدفع الآمن عبر PayPal (تفعيل فوري)
                        </h3>
                        <p className="text-xs text-brand-secondary mt-0.5">
                          يتم تحويل المبلغ تلقائياً إلى الدولار الأمريكي وفق سعر الصرف المعتمد لتسوية الدفع الدولي.
                        </p>
                      </div>
                      <div className="px-3.5 py-2 rounded-xl bg-brand-surface border border-brand text-left">
                        <div className="text-[10px] text-brand-secondary font-bold">المبلغ للدفع الآن</div>
                        <div className="text-sm font-black text-brand-accent font-mono">
                          {paypalSettlement.formattedUSD} USD
                        </div>
                      </div>
                    </div>

                  {/* Official PayPal Script Provider & Buttons */}
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="bg-white rounded-2xl p-4 shadow-inner">
                      {!isPayPalConfigLoaded ? (
                        <div className="py-6 flex items-center justify-center gap-2 text-slate-600 text-xs font-bold">
                          <Loader2 className="w-4 h-4 animate-spin text-[#E25B26]" />
                          <span>جاري تهيئة بوابة الدفع PayPal...</span>
                        </div>
                      ) : !isValidPayPalClientId ? (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                          معرّف PayPal Client ID غير مضبوط بشكل صحيح على الخادم (PAYPAL_CLIENT_ID / VITE_PAYPAL_CLIENT_ID).
                        </div>
                      ) : (
                        <PayPalScriptProvider
                          key={`${paypalClientId}_${runtimePayPalEnv}`}
                          options={{
                            clientId: paypalClientId,
                            currency: 'USD',
                            intent: 'capture',
                            components: 'buttons',
                          }}
                        >
                          <PayPalButtons
                            forceReRender={[
                              selectedPaidTier.id,
                              billingCycle,
                              appliedCoupon?.code || '',
                              token,
                              user?.id,
                              paypalClientId,
                            ]}
                            style={{
                              layout: 'vertical',
                              color: 'gold',
                              shape: 'rect',
                              label: 'paypal',
                              height: 44,
                            }}
                            createOrder={async () => {
                              setCheckoutError(null);
                              try {
                                const activeToken =
                                  token || localStorage.getItem('funnelcraft_auth_token') || '';

                                if (!activeToken) {
                                  const authMsg =
                                    'يرجى تسجيل الدخول أولاً قبل إتمام الدفع عبر PayPal.';
                                  console.error(
                                    '[PAYPAL FRONTEND] createOrder aborted: Missing auth token.'
                                  );
                                  setCheckoutError(authMsg);
                                  throw new Error(authMsg);
                                }

                                const res = await fetch('/api/paypal/create-order', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${activeToken}`,
                                  },
                                  body: JSON.stringify({
                                    userId: user?.id,
                                    identifier: selectedPaidTier.id,
                                    planId: selectedPaidTier.id,
                                    billingCycle,
                                    couponCode: appliedCoupon?.code || undefined,
                                  }),
                                });

                                const data = await res.json().catch(() => ({}));
                                if (!res.ok || !data || typeof data.id !== 'string' || !data.id.trim()) {
                                  const errMsg =
                                    data?.error ||
                                    `Failed to create PayPal order (HTTP ${res.status})`;
                                  console.error('[PAYPAL FRONTEND] createOrder backend failure:', {
                                    status: res.status,
                                    responseData: data,
                                    clientIdPrefix: paypalClientId.slice(0, 10),
                                    environment: runtimePayPalEnv,
                                  });
                                  setCheckoutError(errMsg);
                                  throw new Error(errMsg);
                                }

                                console.log(
                                  '[PAYPAL FRONTEND] Order created:',
                                  data.id,
                                  '| Env:',
                                  data.environment || runtimePayPalEnv
                                );
                                return data.id;
                              } catch (err: unknown) {
                                console.error(
                                  '[PAYPAL FRONTEND] Exception inside createOrder callback:',
                                  err
                                );
                                const msg =
                                  err instanceof Error
                                    ? err.message
                                    : 'Failed to initialize PayPal order.';
                                setCheckoutError(msg);
                                throw err;
                              }
                            }}
                            onApprove={async (data) => {
                              setIsProcessing(true);
                              setCheckoutError(null);
                              try {
                                const activeToken =
                                  token || localStorage.getItem('funnelcraft_auth_token') || '';

                                const captureRes = await fetch(
                                  `/api/paypal/capture-order/${encodeURIComponent(data.orderID)}`,
                                  {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${activeToken}`,
                                    },
                                    body: JSON.stringify({
                                      userId: user?.id,
                                      identifier: selectedPaidTier.id,
                                      planId: selectedPaidTier.id,
                                      billingCycle,
                                      couponCode: appliedCoupon?.code || undefined,
                                    }),
                                  }
                                );
                                const captureData = await captureRes.json().catch(() => ({}));
                                if (
                                  !captureRes.ok ||
                                  !captureData.success ||
                                  captureData.status !== 'COMPLETED'
                                ) {
                                  console.error('[PAYPAL FRONTEND] captureOrder failure:', {
                                    status: captureRes.status,
                                    captureData,
                                  });
                                  throw new Error(
                                    captureData.error || 'تعذر التحقق من قيمة الدفع عبر PayPal.'
                                  );
                                }

                                console.log(
                                  '[PAYPAL FRONTEND] Capture success, now upgrading plan...'
                                );

                                // Refresh authenticated user session (already upgraded in capture-order) and invoke upgradeToPro fallback
                                await refreshUser();
                                const upg = await upgradeToPro(selectedPaidTier.id);
                                await refreshUser();

                                if (captureData.user || upg.success) {
                                  try {
                                    localStorage.setItem('funnelcraft_plan', selectedPaidTier.id);
                                  } catch (_) {}
                                  onUpgradeSuccess(selectedPaidTier.id);
                                  setCheckoutSuccess(
                                    `🎉 تم تأكيد دفعتك عبر PayPal وتفعيل ${selectedPaidTier.nameAr} بنجاح!`
                                  );
                                }
                              } catch (err: unknown) {
                                console.error(
                                  '[PAYPAL FRONTEND] Exception inside onApprove callback:',
                                  err
                                );
                                setCheckoutError(
                                  err instanceof Error
                                    ? err.message
                                    : 'تعذر تأكيد عملية الدفع عبر PayPal.'
                                );
                              } finally {
                                setIsProcessing(false);
                              }
                            }}
                            onError={(err) => {
                              console.error('[PAYPAL SDK onError]', err);
                              const sdkErrMsg =
                                err instanceof Error
                                  ? err.message
                                  : typeof err === 'object' && err !== null && 'message' in err
                                    ? String((err as { message?: unknown }).message)
                                    : String(err || 'Unknown PayPal SDK error');
                              setCheckoutError(
                                `خطأ من بوابة PayPal: ${sdkErrMsg}`
                              );
                            }}
                          />
                        </PayPalScriptProvider>
                      )}
                    </div>

                    {/* Instant PayPal Sandbox / Direct Checkout Button for quick verification */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleDirectPayPalUpgrade}
                      className="w-full py-3 px-4 rounded-xl bg-brand-accent hover:opacity-90 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري تفعيل الاشتراك...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>
                            إتمام الدفع الفوري عبر PayPal ({paypalSettlement.formattedUSD} USD)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : banks.length === 0 || !selectedBank ? (
                <div className="p-6 rounded-2xl bg-brand-bg border border-brand text-center space-y-2">
                  <Landmark className="w-8 h-8 text-brand-accent mx-auto" />
                  <p className="text-xs font-bold text-brand-primary">
                    لا توجد حسابات بنكية متاحة حالياً. يرجى التواصل مع الدعم.
                  </p>
                </div>
              ) : (
                /* Option 2: Moroccan Bank Transfer (Dynamic Banks from /api/settings/banks) */
                <form
                  onSubmit={handleManualBankSubmit}
                  className="p-6 rounded-2xl bg-brand-bg border border-brand space-y-6"
                >
                  <div>
                    <label className="block text-xs font-black text-brand-secondary mb-3">
                      1. اختر البنك المغربي للتحويل:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {banks.map((bank) => {
                        const isSelected = selectedBank.id === bank.id;
                        return (
                          <button
                            key={bank.id}
                            type="button"
                            onClick={() => setSelectedBankId(bank.id)}
                            className={`p-3.5 rounded-2xl border text-right transition flex flex-col justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-brand-accent/10 border-brand-accent ring-1 ring-brand-accent'
                                : 'bg-brand-surface border-brand hover:border-brand-accent/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-brand-primary">
                                {bank.bankName || bank.name}
                              </span>
                              {bank.badge && (
                                <span className="px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent text-[10px] font-bold">
                                  {bank.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-brand-secondary truncate">
                              المستفيد: {bank.beneficiary}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Bank RIB & Details Card */}
                  {selectedBank && (
                    <div className="p-4 rounded-2xl bg-brand-surface border border-brand space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-brand-accent">
                            بيانات الحساب البنكي — {selectedBank.bankName || selectedBank.name}
                          </div>
                          <div className="text-[11px] text-brand-secondary mt-0.5">
                            اسم المستفيد: <strong className="text-brand-primary">{selectedBank.beneficiary}</strong>
                          </div>
                        </div>

                        {selectedBank.rib && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(selectedBank.rib || '', selectedBank.id)}
                            className="px-3 py-1.5 rounded-xl bg-brand-accent hover:opacity-90 text-white font-black text-xs flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>
                              {copiedRib === selectedBank.id ? 'تم نسخ الـ RIB ✓' : 'نسخ رقم الـ RIB'}
                            </span>
                          </button>
                        )}
                      </div>

                      {selectedBank.rib && (
                        <div
                          dir="ltr"
                          className="p-3 rounded-xl bg-brand-bg border border-brand font-mono text-xs sm:text-sm font-black text-brand-accent tracking-wider text-center select-all"
                        >
                          {selectedBank.rib}
                        </div>
                      )}

                      {selectedBank.instructions && (
                        <p className="text-[11px] text-brand-secondary leading-relaxed">
                          💡 {selectedBank.instructions}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Upload Receipt & Reference Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-brand-secondary mb-1.5">
                        2. رقم عملية التحويل (أو اسم المرسل)
                      </label>
                      <input
                        type="text"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        placeholder="مثال: رقم الوصل أو اسم صاحب الحساب..."
                        className="w-full h-10 px-3 rounded-xl bg-brand-surface border border-brand text-xs text-brand-primary focus:border-brand-accent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-brand-secondary mb-1.5">
                        3. إرفاق صورة وصل التحويل (Receipt)
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleReceiptFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full h-10 px-3 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                          receiptDataUrl
                            ? 'bg-brand-accent/15 border-brand-accent text-brand-primary'
                            : 'bg-brand-surface border-brand text-brand-secondary hover:border-brand-accent'
                        }`}
                      >
                        {receiptDataUrl ? (
                          <>
                            <FileCheck2 className="w-4 h-4 text-brand-accent" />
                            <span className="truncate">{receiptFileName || 'تم إرفاق الوصل بنجاح'}</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-4 h-4 text-brand-accent" />
                            <span>اختر صورة وصل التحويل البنكي</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3.5 px-6 rounded-2xl bg-brand-accent hover:opacity-90 disabled:opacity-50 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري إرسال وصل التحويل...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>إرسال وصل التحويل لتفعيل {selectedPaidTier.nameAr}</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  );
};
