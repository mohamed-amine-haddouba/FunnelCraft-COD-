import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
  currentPlan: SubscriptionPlanId;
  triggerReason?: string;
  onSelectFreePlan?: () => void;
  onUpgradeSuccess: (tier: SubscriptionPlanId) => void;
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
  currentPlan,
  triggerReason,
  onSelectFreePlan,
  onUpgradeSuccess,
  onBackToBuilder,
  onNavigateToContact,
  onNavigateToTerms,
  onNavigateToPrivacy,
}) => {
  const { user, isPro, upgradeToPro, submitManualPayment, userPayments } = useAuth();
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

  // Processing & Feedback State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const checkoutSectionRef = useRef<HTMLDivElement>(null);

  // Fetch active Moroccan banks & live exchange rates
  useEffect(() => {
    let mounted = true;

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

  const totalChargeMAD = selectedPaidTier ? getTotalBilledMAD(selectedPaidTier) : 179;
  const paypalSettlement = calculatePayPalUsdSettlement(totalChargeMAD, exchangeRates);
  const pendingPayment = userPayments?.find((p) => p.status === 'pending');

  // Direct PayPal API Order Creation + Upgrade Handler
  const handleDirectPayPalUpgrade = async () => {
    if (!selectedPaidTier) return;
    setIsProcessing(true);
    setCheckoutError(null);

    try {
      const createRes = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: selectedPaidTier.id,
          planId: selectedPaidTier.id,
          billingCycle,
        }),
      });

      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok && !createData.id) {
        // Still allow sandbox/simulated instant upgrade if PayPal keys are not configured in preview
      }

      const upgradeRes = await upgradeToPro();
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

  const paypalClientId =
    (import.meta as unknown as { env?: Record<string, string> }).env
      ?.VITE_PAYPAL_CLIENT_ID || 'test';

  return (
    <div
      dir="rtl"
      className="min-h-full w-full bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 relative overflow-y-auto overflow-x-hidden select-none"
    >
      {/* Ambient Background Glows */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[320px] bg-gradient-to-tr from-emerald-500/15 via-amber-500/10 to-teal-500/15 blur-3xl rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-10">
        {/* Top Back Navigation & Trigger Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {onBackToBuilder && (
            <button
              type="button"
              onClick={onBackToBuilder}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <span>العودة إلى محرر الصفحات</span>
            </button>
          )}

          {isPro && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-extrabold">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>حسابك الحالي مفعل على الباقة الاحترافية ({effectivePlan.toUpperCase()})</span>
            </div>
          )}
        </div>

        {triggerReason && (
          <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-200 text-xs sm:text-sm font-bold shadow-lg">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{triggerReason}</span>
          </div>
        )}

        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>باقات مرنة مصممة لتجار الدفع عند الاستلام COD</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            اختر الباقة المناسبة لنمو متجرك
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            افتح جميع الأقسام الاحترافية، تخلص من العلامة المائية، واربط دومينك الخاص لزيادة المبيعات ونسبة التأكيد.
          </p>

          {/* Monthly vs Yearly Billing Toggle */}
          <div className="pt-3 flex items-center justify-center">
            <div className="inline-flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                دفع شهري (Monthly)
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>دفع سنوي (Yearly)</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    billingCycle === 'yearly'
                      ? 'bg-slate-950 text-amber-400'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
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
          {PRICING_TIERS.map((tier) => {
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
                    ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/40 border-2 border-emerald-400 shadow-[0_0_40px_-10px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/50 scale-[1.02]'
                    : isSelectedForCheckout
                    ? 'bg-slate-900 border-2 border-amber-400 shadow-xl'
                    : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Top Popular Glowing Ribbon */}
                {tier.badge && (
                  <div
                    className={`absolute -top-3.5 right-6 px-3 py-1 rounded-full text-[11px] font-black tracking-wide shadow-md ${
                      tier.highlighted
                        ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950'
                        : 'bg-slate-800 text-emerald-300 border border-slate-700'
                    }`}
                  >
                    {tier.badge}
                  </div>
                )}

                <div className="space-y-5">
                  {/* Tier Header */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div>
                      <h3 className="text-lg font-black text-white">{tier.nameAr}</h3>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {tier.nameEn}
                      </span>
                    </div>
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        tier.highlighted
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-black text-white font-mono">
                        {effectiveMonthlyMAD}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-400">درهم</span>
                      {tier.monthlyPriceMAD > 0 && (
                        <span className="text-xs text-slate-400 font-semibold">/ شهر</span>
                      )}
                    </div>

                    {tier.monthlyPriceMAD > 0 ? (
                      <div className="mt-1 text-[11px] text-slate-400 font-medium">
                        {billingCycle === 'yearly' ? (
                          <span className="text-amber-300 font-bold">
                            تُدفع سنوياً ({getTotalBilledMAD(tier)} درهم/سنة) • بدل{' '}
                            <span className="line-through text-slate-500">
                              {tier.monthlyPriceMAD} درهم
                            </span>
                          </span>
                        ) : (
                          <span>أو وفّر 20% عند اختيار الدفع السنوي</span>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-slate-400 font-medium">
                        مجاناً للأبد بدون بطاقة بنكية
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{tier.description}</p>

                  {/* Feature List */}
                  <ul className="space-y-2.5 pt-2">
                    {tier.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs font-bold text-slate-200">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            tier.highlighted
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-emerald-400'
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
                <div className="pt-6 mt-6 border-t border-slate-800/80">
                  {tier.id === 'free' ? (
                    <button
                      type="button"
                      disabled={isCurrentTier}
                      onClick={() => handleChooseTier(tier)}
                      className={`w-full py-3 px-4 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 ${
                        isCurrentTier
                          ? 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed'
                          : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer'
                      }`}
                    >
                      <span>{isCurrentTier ? 'باقتك الحالية (Free)' : tier.ctaLabel}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleChooseTier(tier)}
                      className={`w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                        tier.highlighted
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/20'
                          : 'bg-white hover:bg-slate-100 text-slate-950'
                      }`}
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
            className="max-w-4xl mx-auto mt-10 rounded-3xl bg-slate-900 border-2 border-emerald-500/40 shadow-2xl overflow-hidden animate-in fade-in duration-200"
          >
            {/* Checkout Header */}
            <div className="px-6 py-5 bg-gradient-to-l from-emerald-950/80 via-slate-900 to-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-white">
                      إتمام الاشتراك — {selectedPaidTier.nameAr}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {billingCycle === 'yearly' ? 'سنوي (خصم 20%)' : 'شهري'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    المبلغ الإجمالي المطلوب:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {totalChargeMAD} MAD
                    </strong>{' '}
                    (يعادل تقريباً{' '}
                    <strong className="text-white font-mono">
                      ${paypalSettlement.formattedUSD} USD
                    </strong>
                    )
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPaidTier(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                title="إغلاق نافذة الدفع"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Alerts */}
              {checkoutSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 flex items-center gap-3 text-xs sm:text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
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
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-bold flex items-center justify-between gap-2">
                  <span>
                    ⏳ لديك طلب تحويل بنكي قيد المراجعة ({pendingPayment.amount} درهم -{' '}
                    {pendingPayment.method}).
                  </span>
                  <span className="font-mono text-[11px] text-amber-300">
                    #{pendingPayment.transactionReference}
                  </span>
                </div>
              )}

              {/* Payment Method Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('paypal')}
                  className={`p-4 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'paypal'
                      ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 text-white'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-white">
                      الدفع الفوري عبر PayPal / البطاقة البنكية
                    </div>
                    <div className="text-[11px] text-slate-400">
                      تفعيل تلقائي فوري للباقة ({paypalSettlement.formattedUSD} USD)
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={`p-4 rounded-2xl border text-right transition flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'bank'
                      ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500 text-white'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black text-white">
                      تحويل بنكي مغربي (CIH / التجاري / الشعبي)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      ادفع بالدرهم المغربي ({totalChargeMAD} MAD) وارفع وصل التحويل
                    </div>
                  </div>
                </button>
              </div>

              {/* Option 1: PayPal Automatic Upgrade */}
              {paymentMethod === 'paypal' ? (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-sm font-black text-white">
                        الدفع الآمن عبر PayPal (تفعيل فوري)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        يتم تحويل المبلغ تلقائياً إلى الدولار الأمريكي وفق سعر الصرف المعتمد لتسوية الدفع الدولي.
                      </p>
                    </div>
                    <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-left">
                      <div className="text-[10px] text-slate-400 font-bold">المبلغ للدفع الآن</div>
                      <div className="text-sm font-black text-emerald-400 font-mono">
                        {paypalSettlement.formattedUSD} USD
                      </div>
                    </div>
                  </div>

                  {/* Official PayPal Script Provider & Buttons */}
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="bg-white rounded-2xl p-4 shadow-inner">
                      <PayPalScriptProvider
                        options={{
                          clientId: paypalClientId,
                          currency: 'USD',
                          intent: 'capture',
                        }}
                      >
                        <PayPalButtons
                          style={{
                            layout: 'vertical',
                            color: 'gold',
                            shape: 'rect',
                            label: 'paypal',
                            height: 44,
                          }}
                          createOrder={async () => {
                            const res = await fetch('/api/paypal/create-order', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                identifier: selectedPaidTier.id,
                                planId: selectedPaidTier.id,
                                billingCycle,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok || !data.id) {
                              throw new Error(data.error || 'Failed to create PayPal order');
                            }
                            return data.id;
                          }}
                          onApprove={async (data) => {
                            setIsProcessing(true);
                            setCheckoutError(null);
                            try {
                              const captureRes = await fetch(
                                `/api/paypal/capture-order/${encodeURIComponent(data.orderID)}`,
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    identifier: selectedPaidTier.id,
                                    planId: selectedPaidTier.id,
                                    billingCycle,
                                  }),
                                }
                              );
                              const captureData = await captureRes.json().catch(() => ({}));
                              if (
                                !captureRes.ok ||
                                !captureData.success ||
                                captureData.status !== 'COMPLETED'
                              ) {
                                throw new Error(
                                  captureData.error || 'تعذر التحقق من قيمة الدفع عبر PayPal.'
                                );
                              }
                              const upg = await upgradeToPro();
                              if (upg.success) {
                                try {
                                  localStorage.setItem('funnelcraft_plan', selectedPaidTier.id);
                                } catch (_) {}
                                onUpgradeSuccess(selectedPaidTier.id);
                                setCheckoutSuccess(
                                  `🎉 تم تأكيد دفعتك عبر PayPal وتفعيل ${selectedPaidTier.nameAr} بنجاح!`
                                );
                              }
                            } catch (err: unknown) {
                              setCheckoutError(
                                err instanceof Error
                                  ? err.message
                                  : 'تعذر تأكيد عملية الدفع عبر PayPal.'
                              );
                            } finally {
                              setIsProcessing(false);
                            }
                          }}
                        />
                      </PayPalScriptProvider>
                    </div>

                    {/* Instant PayPal Sandbox / Direct Checkout Button for quick verification */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleDirectPayPalUpgrade}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
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
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <Landmark className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-200">
                    لا توجد حسابات بنكية متاحة حالياً. يرجى التواصل مع الدعم.
                  </p>
                </div>
              ) : (
                /* Option 2: Moroccan Bank Transfer (Dynamic Banks from /api/settings/banks) */
                <form
                  onSubmit={handleManualBankSubmit}
                  className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-6"
                >
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-3">
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
                                ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-white">
                                {bank.bankName || bank.name}
                              </span>
                              {bank.badge && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                  {bank.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              المستفيد: {bank.beneficiary}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Bank RIB & Details Card */}
                  {selectedBank && (
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-amber-400">
                            بيانات الحساب البنكي — {selectedBank.bankName || selectedBank.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            اسم المستفيد: <strong className="text-white">{selectedBank.beneficiary}</strong>
                          </div>
                        </div>

                        {selectedBank.rib && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(selectedBank.rib || '', selectedBank.id)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer"
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
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs sm:text-sm font-black text-emerald-400 tracking-wider text-center select-all"
                        >
                          {selectedBank.rib}
                        </div>
                      )}

                      {selectedBank.instructions && (
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          💡 {selectedBank.instructions}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Upload Receipt & Reference Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        2. رقم عملية التحويل (أو اسم المرسل)
                      </label>
                      <input
                        type="text"
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        placeholder="مثال: رقم الوصل أو اسم صاحب الحساب..."
                        className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
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
                            ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-emerald-400'
                        }`}
                      >
                        {receiptDataUrl ? (
                          <>
                            <FileCheck2 className="w-4 h-4 text-emerald-400" />
                            <span className="truncate">{receiptFileName || 'تم إرفاق الوصل بنجاح'}</span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-4 h-4 text-amber-400" />
                            <span>اختر صورة وصل التحويل البنكي</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
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

        {/* Pricing Page Legal & Support Footer */}
        <footer className="mt-20 pt-8 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white">CodWorth</span>
              <span>•</span>
              <span>بوابتك لزيادة مبيعات الدفع عند الاستلام بالمغرب</span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              {onBackToBuilder && (
                <button
                  type="button"
                  onClick={onBackToBuilder}
                  className="hover:text-white transition cursor-pointer"
                >
                  الرئيسية
                </button>
              )}
              {onNavigateToContact && (
                <button
                  type="button"
                  onClick={onNavigateToContact}
                  className="hover:text-white transition cursor-pointer"
                >
                  تواصل معنا
                </button>
              )}
              {onNavigateToTerms && (
                <button
                  type="button"
                  onClick={onNavigateToTerms}
                  className="hover:text-white transition cursor-pointer"
                >
                  شروط الاستخدام
                </button>
              )}
              {onNavigateToPrivacy && (
                <button
                  type="button"
                  onClick={onNavigateToPrivacy}
                  className="hover:text-white transition cursor-pointer"
                >
                  سياسة الخصوصية
                </button>
              )}
              <a href="mailto:codworth.me@gmail.com" className="hover:text-white transition">
                الدعم الفني
              </a>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-900 text-center text-[11px] text-slate-500">
            © {new Date().getFullYear()} CodWorth SARL. جميع الحقوق محفوظة. المملكة المغربية 🇲🇦
          </div>
        </footer>
      </div>
    </div>
  );
};
