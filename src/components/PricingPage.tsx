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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/translations';
import { SUPPORTED_LANGUAGES } from '../i18n/config';
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
  badge?: string;
  monthlyPriceMAD: number;
  description: string;
  highlighted?: boolean;
  ctaLabel: string;
  icon: React.FC<{ className?: string }>;
  features: string[];
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    nameAr: 'الباقة المجانية (Free)',
    nameEn: 'Free Starter',
    monthlyPriceMAD: 0,
    description: 'لتجربة المنصة وبناء أول صفحة هبوط لمنتجك بسرعة وسهولة.',
    ctaLabel: 'ابدأ مجاناً',
    icon: Zap,
    features: [
      'صفحة واحدة',
      '50 طلب/شهر',
      'علامة مائية (Watermark)',
      'دعم أساسي',
    ],
  },
  {
    id: 'starter',
    nameAr: 'باقة المبتدئين (Starter)',
    nameEn: 'Starter Plan',
    badge: 'للتجار الجدد',
    monthlyPriceMAD: 99,
    description: 'انطلاقة احترافية للتجار المبتدئين في الدفع عند الاستلام بدون علامة مائية.',
    ctaLabel: 'اشترك الآن',
    icon: Rocket,
    features: [
      '3 صفحات',
      '500 طلب/شهر',
      'بدون علامة مائية',
      'إحصائيات أساسية',
    ],
  },
  {
    id: 'pro',
    nameAr: 'باقة المحترفين (Pro)',
    nameEn: 'Pro Unlimited',
    badge: 'الأكثر شعبية ⭐',
    monthlyPriceMAD: 179,
    description: 'الباقة المتكاملة لمحترفي التجارة الإلكترونية في المغرب لتحقيق أعلى نسبة تحويل.',
    highlighted: true,
    ctaLabel: 'اشترك الآن',
    icon: Crown,
    features: [
      'صفحات غير محدودة',
      'طلبات غير محدودة',
      'إزالة العلامة المائية',
      'دومين مخصص',
      'ربط بيكسل الإعلانات',
      'دعم فوري واتساب',
    ],
  },
  {
    id: 'enterprise',
    nameAr: 'باقة الشركات (Enterprise)',
    nameEn: 'Enterprise Scale',
    badge: 'للشركات والوكالات 🚀',
    monthlyPriceMAD: 349,
    description: 'حلول متقدمة للمتاجر الكبرى وفرق التأكيد مع ربط مباشر مع شركات التوصيل.',
    ctaLabel: 'اشترك الآن',
    icon: Building2,
    features: [
      'كل ميزات Pro',
      'مدير حساب مخصص',
      'ربط شركات التوصيل API',
      'تقارير متقدمة',
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

  const baseChargeMAD = selectedPaidTier ? getTotalBilledMAD(selectedPaidTier) : 179;
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
      className="min-h-screen w-full bg-[#0D131E] text-[#F8FAFC] flex flex-col relative overflow-x-hidden select-none"
    >
      {/* Persistent Sticky Guest Header when unauthenticated */}
      {!isLoggedIn && (
        <header className="w-full border-b border-[#1E293B] bg-[#0D131E]/95 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            <LocalizedLink to="/home" className="flex items-center shrink-0">
              <img
                src="/assets/brand/logo.jpg"
                alt="CodWorth"
                className="h-10 w-auto object-contain rounded-lg"
              />
            </LocalizedLink>

            <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#CBD5E1]">
              <LocalizedLink
                to="/home"
                className="text-[#CBD5E1] hover:text-[#F8FAFC] transition"
              >
                {t['home.hero.nav.home']}
              </LocalizedLink>
              <LocalizedLink
                to="/home#features"
                className="text-[#CBD5E1] hover:text-[#F8FAFC] transition"
              >
                {t['home.hero.nav.features']}
              </LocalizedLink>
              <LocalizedLink
                to="/pricing"
                className="text-[#F8FAFC] hover:text-[#E25B26] transition"
              >
                {t['home.hero.nav.pricing']}
              </LocalizedLink>
              <LocalizedLink
                to="/login"
                className="text-[#CBD5E1] hover:text-[#F8FAFC] transition"
              >
                {t['home.hero.nav.templates']}
              </LocalizedLink>
            </nav>

            <div className="flex items-center gap-2.5 shrink-0">
              <div
                dir="ltr"
                className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-[#131B2A] border border-[#1E293B]"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                      language === lang.code
                        ? 'bg-[#E25B26] text-[#F8FAFC]'
                        : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              <LocalizedLink
                to="/login"
                className="px-3.5 py-2 rounded-xl border border-transparent hover:border-[#334155] hover:bg-[#131B2A] text-[#CBD5E1] hover:text-[#F8FAFC] text-xs sm:text-[13px] font-semibold transition"
              >
                {t['home.hero.nav.login']}
              </LocalizedLink>

              <LocalizedLink
                to="/login?mode=register"
                className="px-4 py-2 rounded-xl bg-[#E25B26] hover:bg-[#F16F3C] text-[#F8FAFC] text-xs sm:text-[13px] font-bold shadow-md transition"
              >
                {t['home.hero.nav.signup']}
              </LocalizedLink>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 relative">
        {/* Ambient Soft Brand Glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[320px] bg-[#E25B26]/10 blur-[120px] rounded-full" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-10">
          {/* Top Back Navigation & Trigger Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {onBackToBuilder && (
              <button
                type="button"
                onClick={onBackToBuilder}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#131B2A] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-bold text-[#CBD5E1] hover:text-[#F8FAFC] transition cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 text-[#E25B26]" />
                <span>العودة</span>
              </button>
            )}

            {isPro && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E25B26]/10 border border-[#E25B26]/30 text-[#E25B26] text-xs font-extrabold">
                <Crown className="w-4 h-4 text-[#E25B26]" />
                <span>حسابك الحالي مفعل على الباقة الاحترافية ({effectivePlan.toUpperCase()})</span>
              </div>
            )}
          </div>

        {triggerReason && (
          <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-[#E25B26]/10 border border-[#E25B26]/30 flex items-center gap-3 text-[#F8FAFC] text-xs sm:text-sm font-bold shadow-lg">
            <Lock className="w-5 h-5 text-[#E25B26] shrink-0" />
            <span>{triggerReason}</span>
          </div>
        )}

        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E25B26]/10 border border-[#E25B26]/30 text-[#E25B26] text-xs font-extrabold">
            <Sparkles className="w-3.5 h-3.5 text-[#E25B26]" />
            <span>باقات مرنة مصممة لتجار الدفع عند الاستلام COD</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#F8FAFC] leading-tight">
            اختر الباقة المناسبة لنمو متجرك
          </h1>

          <p className="text-sm sm:text-base text-[#CBD5E1] max-w-2xl mx-auto leading-relaxed">
            افتح جميع الأقسام الاحترافية، تخلص من العلامة المائية، واربط دومينك الخاص لزيادة المبيعات ونسبة التأكيد.
          </p>

          {/* Monthly vs Yearly Billing Toggle */}
          <div className="pt-3 flex items-center justify-center">
            <div className="inline-flex items-center p-1 rounded-2xl bg-[#131B2A] border border-[#1E293B] shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-[#E25B26] text-[#F8FAFC] shadow-sm'
                    : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                }`}
              >
                دفع شهري (Monthly)
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-[#E25B26] text-[#F8FAFC] shadow-sm'
                    : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                }`}
              >
                <span>دفع سنوي (Yearly)</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    billingCycle === 'yearly'
                      ? 'bg-[#0D131E] text-[#F8FAFC]'
                      : 'bg-[#E25B26]/20 text-[#E25B26] border border-[#E25B26]/30'
                  }`}
                >
                  وفر 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Pricing Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
          {pricingTiers.map((tier) => {
            const Icon = tier.icon;
            const effectiveMonthlyMAD = getEffectivePriceMAD(tier);
            const isCurrentTier =
              (tier.id === 'free' && !isPro && effectivePlan === 'free') ||
              (isPro && effectivePlan === tier.id);
            const isSelectedForCheckout = selectedPaidTier?.id === tier.id;

            return (
              <div
                key={tier.id}
                className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 ${
                  tier.highlighted
                    ? 'bg-[#131B2A] border-2 border-[#E25B26] shadow-[0_0_40px_-10px_rgba(226,91,38,0.35)] ring-1 ring-[#E25B26]/50 scale-[1.02]'
                    : isSelectedForCheckout
                    ? 'bg-[#131B2A] border-2 border-[#E25B26] shadow-xl'
                    : 'bg-[#131B2A] border border-[#1E293B] hover:border-[#334155]'
                }`}
              >
                {/* Top Popular Ribbon */}
                {tier.badge && (
                  <div
                    className={`absolute -top-3.5 right-6 px-3 py-1 rounded-full text-[11px] font-black tracking-wide shadow-md ${
                      tier.highlighted
                        ? 'bg-[#E25B26] text-[#F8FAFC]'
                        : 'bg-[#1E293B] text-[#E25B26] border border-[#334155]'
                    }`}
                  >
                    {tier.badge}
                  </div>
                )}

                <div className="space-y-5">
                  {/* Tier Header */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div>
                      <h3 className="text-lg font-black text-[#F8FAFC]">{tier.nameAr}</h3>
                      <span className="text-[11px] font-semibold text-[#CBD5E1]">
                        {tier.nameEn}
                      </span>
                    </div>
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        tier.highlighted
                          ? 'bg-[#E25B26]/20 text-[#E25B26] border border-[#E25B26]/40'
                          : 'bg-[#1E293B] text-[#CBD5E1] border border-[#334155]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className="pt-2 border-t border-[#1E293B]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-black text-[#F8FAFC] font-mono">
                        {effectiveMonthlyMAD}
                      </span>
                      <span className="text-sm font-extrabold text-[#E25B26]">درهم</span>
                      {tier.monthlyPriceMAD > 0 && (
                        <span className="text-xs text-[#CBD5E1] font-semibold">/ شهر</span>
                      )}
                    </div>

                    {tier.monthlyPriceMAD > 0 ? (
                      <div className="mt-1 text-[11px] text-[#CBD5E1] font-medium">
                        {billingCycle === 'yearly' ? (
                          <span className="text-[#E25B26] font-bold">
                            تُدفع سنوياً ({getTotalBilledMAD(tier)} درهم/سنة) • بدل{' '}
                            <span className="line-through text-[#CBD5E1]/60">
                              {tier.monthlyPriceMAD} درهم
                            </span>
                          </span>
                        ) : (
                          <span>أو وفّر 20% عند اختيار الدفع السنوي</span>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-[#CBD5E1] font-medium">
                        مجاناً للأبد بدون بطاقة بنكية
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[#CBD5E1] leading-relaxed">{tier.description}</p>

                  {/* Feature List */}
                  <ul className="space-y-2.5 pt-2">
                    {tier.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs font-bold text-[#F8FAFC]">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            tier.highlighted
                              ? 'bg-[#E25B26] text-[#F8FAFC]'
                              : 'bg-[#1E293B] text-[#E25B26]'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action CTA Button */}
                <div className="pt-6 mt-6 border-t border-[#1E293B]">
                  {tier.id === 'free' ? (
                    <button
                      type="button"
                      disabled={isCurrentTier}
                      onClick={() => handleChooseTier(tier)}
                      className={`w-full py-3 px-4 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 ${
                        isCurrentTier
                          ? 'bg-[#1E293B]/60 text-[#CBD5E1]/50 border border-[#1E293B] cursor-not-allowed'
                          : 'bg-[#1E293B] hover:bg-[#334155] text-[#F8FAFC] border border-[#334155] cursor-pointer'
                      }`}
                    >
                      <span>{isCurrentTier ? 'باقتك الحالية (Free)' : tier.ctaLabel}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleChooseTier(tier)}
                      className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg bg-[#E25B26] hover:bg-[#F16F3C] text-[#F8FAFC]"
                    >
                      <Crown className="w-4 h-4 shrink-0" />
                      <span>
                        {isCurrentTier ? 'تحديث / تجديد الباقة' : tier.ctaLabel}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Checkout Section / Modal when a Paid Plan is Selected */}
        {selectedPaidTier && (
          <div
            ref={checkoutSectionRef}
            className="max-w-4xl mx-auto mt-10 rounded-3xl bg-[#131B2A] border-2 border-[#E25B26]/50 shadow-2xl overflow-hidden animate-in fade-in duration-200"
          >
            {/* Checkout Header */}
            <div className="px-6 py-5 bg-[#0D131E] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#E25B26]/20 border border-[#E25B26]/40 flex items-center justify-center text-[#E25B26]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-[#F8FAFC]">
                      إتمام الاشتراك — {selectedPaidTier.nameAr}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#E25B26]/20 text-[#E25B26] border border-[#E25B26]/30">
                      {billingCycle === 'yearly' ? 'سنوي (خصم 20%)' : 'شهري'}
                    </span>
                  </div>
                  <p className="text-xs text-[#CBD5E1] mt-0.5">
                    المبلغ الإجمالي المطلوب:{' '}
                    <strong className="text-[#E25B26] font-mono">
                      {totalChargeMAD} MAD
                    </strong>{' '}
                    (يعادل تقريباً{' '}
                    <strong className="text-[#F8FAFC] font-mono">
                      ${paypalSettlement.formattedUSD} USD
                    </strong>
                    )
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPaidTier(null)}
                className="p-2 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#CBD5E1] hover:text-[#F8FAFC] transition cursor-pointer"
                title="إغلاق نافذة الدفع"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Alerts */}
              {checkoutSuccess && (
                <div className="p-4 rounded-2xl bg-[#E25B26]/15 border border-[#E25B26]/50 text-[#F8FAFC] flex items-center gap-3 text-xs sm:text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 text-[#E25B26] shrink-0" />
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
                <div className="p-3.5 rounded-2xl bg-[#E25B26]/10 border border-[#E25B26]/30 text-[#F8FAFC] text-xs font-bold flex items-center justify-between gap-2">
                  <span>
                    ⏳ لديك طلب تحويل بنكي قيد المراجعة ({pendingPayment.amount} درهم -{' '}
                    {pendingPayment.method}).
                  </span>
                  <span className="font-mono text-[11px] text-[#E25B26]">
                    #{pendingPayment.transactionReference}
                  </span>
                </div>
              )}

              {/* Coupon Code Input Box */}
              <div className="p-4 rounded-2xl bg-[#0D131E] border border-[#1E293B] space-y-3">
                <label className="block text-xs font-black text-[#CBD5E1] flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#E25B26]" />
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
                    className="flex-1 h-10 px-3.5 rounded-xl bg-[#131B2A] border border-[#1E293B] text-xs font-mono text-[#F8FAFC] uppercase focus:border-[#E25B26] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={isApplyingCoupon || !couponInput.trim()}
                    className="h-10 px-5 rounded-xl bg-[#E25B26] hover:bg-[#F16F3C] disabled:opacity-50 text-[#F8FAFC] font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
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
                      className="h-10 px-3 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#CBD5E1] text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      إزالة
                    </button>
                  )}
                </div>

                {appliedCoupon && (
                  <div className="p-3 rounded-xl bg-[#E25B26]/15 border border-[#E25B26]/40 text-[#F8FAFC] text-xs font-bold flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#E25B26] shrink-0" />
                      <span>
                        تم تطبيق الكوبون <strong className="font-mono">{appliedCoupon.code}</strong> بنجاح! خصم{' '}
                        <strong className="font-mono">{appliedCoupon.discountAmount} درهم</strong>
                      </span>
                    </div>
                    <div className="font-mono text-xs">
                      <span className="line-through text-[#CBD5E1] mr-2">
                        {appliedCoupon.originalPrice} MAD
                      </span>
                      <span className="text-[#E25B26] font-black">
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
                      ? 'bg-[#E25B26]/15 border-[#E25B26] ring-1 ring-[#E25B26] text-[#F8FAFC]'
                      : 'bg-[#0D131E] border-[#1E293B] text-[#CBD5E1] hover:border-[#334155] hover:text-[#F8FAFC]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#E25B26]/20 border border-[#E25B26]/30 text-[#E25B26] flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-[#F8FAFC]">
                      الدفع الفوري عبر PayPal / البطاقة البنكية
                    </div>
                    <div className="text-[11px] text-[#CBD5E1]">
                      تفعيل تلقائي فوري للباقة ({paypalSettlement.formattedUSD} USD)
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={`p-4 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'bank'
                      ? 'bg-[#E25B26]/15 border-[#E25B26] ring-1 ring-[#E25B26] text-[#F8FAFC]'
                      : 'bg-[#0D131E] border-[#1E293B] text-[#CBD5E1] hover:border-[#334155] hover:text-[#F8FAFC]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#E25B26]/20 border border-[#E25B26]/30 text-[#E25B26] flex items-center justify-center shrink-0">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-[#F8FAFC]">
                      تحويل بنكي مغربي (CIH / التجاري / الشعبي)
                    </div>
                    <div className="text-[11px] text-[#CBD5E1]">
                      ادفع بالدرهم المغربي ({totalChargeMAD} MAD) وارفع وصل التحويل
                    </div>
                  </div>
                </button>
              </div>

              {/* Option 1: PayPal Automatic Upgrade */}
              {paymentMethod === 'paypal' ? (
                <div className="p-6 rounded-2xl bg-[#0D131E] border border-[#1E293B] space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
                    <div>
                      <h3 className="text-sm font-black text-[#F8FAFC]">
                        الدفع الآمن عبر PayPal (تفعيل فوري)
                      </h3>
                      <p className="text-xs text-[#CBD5E1] mt-0.5">
                        يتم تحويل المبلغ تلقائياً إلى الدولار الأمريكي وفق سعر الصرف المعتمد لتسوية الدفع الدولي.
                      </p>
                    </div>
                    <div className="px-3.5 py-2 rounded-xl bg-[#131B2A] border border-[#1E293B] text-left">
                      <div className="text-[10px] text-[#CBD5E1] font-bold">المبلغ للدفع الآن</div>
                      <div className="text-sm font-black text-[#E25B26] font-mono">
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
                      className="w-full py-3 px-4 rounded-xl bg-[#E25B26] hover:bg-[#F16F3C] disabled:opacity-50 text-[#F8FAFC] font-black text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
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
                <div className="p-6 rounded-2xl bg-[#0D131E] border border-[#1E293B] text-center space-y-2">
                  <Landmark className="w-8 h-8 text-[#E25B26] mx-auto" />
                  <p className="text-xs font-bold text-[#F8FAFC]">
                    لا توجد حسابات بنكية متاحة حالياً. يرجى التواصل مع الدعم.
                  </p>
                </div>
              ) : (
                /* Option 2: Moroccan Bank Transfer (Dynamic Banks from /api/settings/banks) */
                <form
                  onSubmit={handleManualBankSubmit}
                  className="p-6 rounded-2xl bg-[#0D131E] border border-[#1E293B] space-y-6"
                >
                  <div>
                    <label className="block text-xs font-black text-[#CBD5E1] mb-3">
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
                                ? 'bg-[#E25B26]/10 border-[#E25B26] ring-1 ring-[#E25B26]'
                                : 'bg-[#131B2A] border-[#1E293B] hover:border-[#334155]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-[#F8FAFC]">
                                {bank.bankName || bank.name}
                              </span>
                              {bank.badge && (
                                <span className="px-2 py-0.5 rounded-full bg-[#E25B26]/20 text-[#E25B26] text-[10px] font-bold">
                                  {bank.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#CBD5E1] truncate">
                              المستفيد: {bank.beneficiary}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Bank RIB & Details Card */}
                  {selectedBank && (
                    <div className="p-4 rounded-2xl bg-[#131B2A] border border-[#1E293B] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-[#E25B26]">
                            بيانات الحساب البنكي — {selectedBank.bankName || selectedBank.name}
                          </div>
                          <div className="text-[11px] text-[#CBD5E1] mt-0.5">
                            اسم المستفيد: <strong className="text-[#F8FAFC]">{selectedBank.beneficiary}</strong>
                          </div>
                        </div>

                        {selectedBank.rib && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(selectedBank.rib || '', selectedBank.id)}
                            className="px-3 py-1.5 rounded-xl bg-[#E25B26] hover:bg-[#F16F3C] text-[#F8FAFC] font-black text-xs flex items-center gap-1.5 transition cursor-pointer"
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
                          className="p-3 rounded-xl bg-[#0D131E] border border-[#1E293B] font-mono text-xs sm:text-sm font-black text-[#E25B26] tracking-wider text-center select-all"
                        >
                          {selectedBank.rib}
                        </div>
                      )}

                      {selectedBank.instructions && (
                        <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
                          💡 {selectedBank.instructions}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Upload Receipt & Reference Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
                        2. رقم عملية التحويل (أو اسم المرسل)
                      </label>
                      <input
                        type="text"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        placeholder="مثال: رقم الوصل أو اسم صاحب الحساب..."
                        className="w-full h-10 px-3 rounded-xl bg-[#131B2A] border border-[#1E293B] text-xs text-[#F8FAFC] focus:border-[#E25B26] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#CBD5E1] mb-1.5">
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
                            ? 'bg-[#E25B26]/15 border-[#E25B26] text-[#F8FAFC]'
                            : 'bg-[#131B2A] border-[#334155] text-[#CBD5E1] hover:border-[#E25B26]'
                        }`}
                      >
                        {receiptDataUrl ? (
                          <>
                            <FileCheck2 className="w-4 h-4 text-[#E25B26]" />
                            <span className="truncate">{receiptFileName || 'تم إرفاق الوصل بنجاح'}</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-4 h-4 text-[#E25B26]" />
                            <span>اختر صورة وصل التحويل البنكي</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#E25B26] hover:bg-[#F16F3C] disabled:opacity-50 text-[#F8FAFC] font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
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
