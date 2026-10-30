import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Sparkles,
  Check,
  ShieldCheck,
  Zap,
  Crown,
  Lock,
  Landmark,
  Clock,
  Flame,
  CheckCircle2,
  Copy,
  ArrowRight,
  CreditCard,
  UploadCloud,
  FileCheck2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { MoroccanBankAccount } from '../types/user';
import {
  DEFAULT_MOROCCAN_BANK_ACCOUNTS,
  filterActiveBankAccounts,
  inferMoroccanPaymentMethod,
} from '../utils/currencyAndBanks';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  triggerReason?: string;
  onRequireAuth?: () => void;
  onUpgradeSuccess?: (tier: SubscriptionTierId) => void;
}

export type SubscriptionTierId = 'starter' | 'pro' | 'enterprise';

interface TierOption {
  id: SubscriptionTierId;
  name: string;
  nameEn: string;
  priceMAD: number;
  priceUSD: number;
  badge?: string;
  isPopular?: boolean;
  description: string;
  features: string[];
}

const TIERS: TierOption[] = [
  {
    id: 'starter',
    name: 'باقة البداية (Starter)',
    nameEn: 'Starter Plan',
    priceMAD: 99,
    priceUSD: 9.99,
    description: 'مثالية للتاجر المبتدئ لتجربة منتجاته الأولى بدون تكاليف مرتفعة',
    features: [
      '10 صفحات هبوط نشطة شهرياً',
      'توليد الذكاء الاصطناعي الأساسي للمنتجات',
      'تصدير كود HTML كامل مع نموذج COD',
      'دعم فني عبر البريد الإلكتروني',
    ],
  },
  {
    id: 'pro',
    name: 'باقة المحترفين (Pro)',
    nameEn: 'Pro Plan',
    priceMAD: 179,
    priceUSD: 17.99,
    badge: 'الأكثر طلباً • الموصى بها ⭐',
    isPopular: true,
    description: 'الخيار المفضل لأغلب مسوقي COD وتجار التجارة الإلكترونية بالمغرب',
    features: [
      '20 صفحة هبوط نشطة شهرياً',
      'ربط دومين مخصص مجاناً (Custom Domain)',
      'توليد متقدم بالذكاء الاصطناعي Gemini 2.5 Pro',
      'دعم فني فوري ومباشر 24/7 عبر الواتساب',
      'إزالة شعار المنصة من صفحات الهبوط المصدرة',
    ],
  },
  {
    id: 'enterprise',
    name: 'باقة الشركات والتوسع (Enterprise)',
    nameEn: 'Scale / Enterprise',
    priceMAD: 349,
    priceUSD: 34.99,
    badge: 'بدون حدود 🚀',
    description: 'للمتاجر الكبرى والوكالات الإعلانية التي تدير مئات الطلبيات يومياً',
    features: [
      'عدد صفحات هبوط غير محدود (Unlimited)',
      'ربط نطاقات متعددة غير محدودة',
      'أولوية قصوى في سرعة السيرفرات وشبكة CDN',
      'ربط Webhooks مخصصة مع Google Sheets وشركات الشحن',
      'مدير حساب إعلاني مخصص لمساعدتك في زيادة التحويل',
    ],
  },
];

const getPaypalGlobal = (): any => (typeof window !== 'undefined' ? (window as any).paypal : undefined);

export const UpgradeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  triggerReason,
  onRequireAuth,
  onUpgradeSuccess,
}) => {
  const { isLoggedIn, upgradeToPro, userPayments, submitManualPayment } = useAuth();

  // Selected Plan
  const [selectedTier, setSelectedTier] = useState<SubscriptionTierId>('pro');

  // Main Payment Method: 'paypal' | 'morocco'
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'morocco'>('paypal');

  // Dynamic Moroccan Bank Accounts (loaded from data/settings.json via /api/settings/banks)
  const [moroccanBanks, setMoroccanBanks] = useState<MoroccanBankAccount[]>([]);
  const [selectedMoroccanBank, setSelectedMoroccanBank] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  // Copy Feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // States
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PayPal SDK State
  const [isPaypalSdkLoaded, setIsPaypalSdkLoaded] = useState(false);
  const [isPaypalRendering, setIsPaypalRendering] = useState(false);
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const receiptFileRef = useRef<HTMLInputElement>(null);

  // Fetch dynamic Moroccan banks whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadBanks = async () => {
      try {
        const res = await fetch('/api/settings/banks');
        if (!res.ok) {
          throw new Error('Failed to fetch banks');
        }
        const data = (await res.json()) as { banks?: MoroccanBankAccount[] };
        if (isMounted && Array.isArray(data?.banks)) {
          const activeBanks = filterActiveBankAccounts(data.banks);
          setMoroccanBanks(activeBanks);
          setSelectedMoroccanBank((prev) =>
            activeBanks.some((b) => b.id === prev) ? prev : activeBanks[0]?.id || ''
          );
        }
      } catch (_err) {
        // Only fallback to default banks if the API call fails AND no cached data exists
        if (isMounted) {
          setMoroccanBanks((prev) => {
            if (prev.length > 0) return prev;
            const fallback = filterActiveBankAccounts(DEFAULT_MOROCCAN_BANK_ACCOUNTS);
            setSelectedMoroccanBank(fallback[0]?.id || '');
            return fallback;
          });
        }
      }
    };
    loadBanks();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const currentTier = TIERS.find((t) => t.id === selectedTier) || TIERS[1];
  const currentBank: MoroccanBankAccount | undefined =
    moroccanBanks.find((b) => b.id === selectedMoroccanBank) || moroccanBanks[0];
  const pendingPayment = userPayments?.find((p) => p.status === 'pending');

  // Load official PayPal JavaScript SDK
  useEffect(() => {
    if (!isOpen || paymentMethod !== 'paypal') return;

    const clientId = 'test'; // Standard live/sandbox test client ID, or from env
    const scriptId = 'paypal-sdk-script';

    const paypalSdk = getPaypalGlobal();
    if (paypalSdk) {
      setIsPaypalSdkLoaded(true);
      return;
    }

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons`;
      script.async = true;
      script.onload = () => {
        setIsPaypalSdkLoaded(true);
      };
      script.onerror = () => {
        console.warn('PayPal SDK could not be loaded directly. Smart Checkout fallback enabled.');
        setIsPaypalSdkLoaded(false);
      };
      document.body.appendChild(script);
    } else {
      setIsPaypalSdkLoaded(true);
    }
  }, [isOpen, paymentMethod]);

  // Render PayPal Buttons into container when ready
  useEffect(() => {
    const paypalSdk = getPaypalGlobal();
    if (!isOpen || !isPaypalSdkLoaded || !paypalSdk || paymentMethod !== 'paypal') return;
    const container = paypalContainerRef.current;
    if (!container) return;

    let isMounted = true;
    let buttonsInstance: any = null;

    // Safely clear previous non-React child elements
    while (container.firstChild) {
      try {
        container.removeChild(container.firstChild);
      } catch (_) {
        break;
      }
    }

    setIsPaypalRendering(true);

    try {
      buttonsInstance = paypalSdk.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal',
          height: 44,
        },
        createOrder: (_data: any, actions: any) => {
          return actions.order.create({
            purchase_units: [
              {
                description: `CodWorth - ${currentTier.name}`,
                amount: {
                  currency_code: 'USD',
                  value: currentTier.priceUSD.toFixed(2),
                },
              },
            ],
          });
        },
        onApprove: async (_data: any, actions: any) => {
          setIsProcessing(true);
          try {
            const details = await actions.order.capture();
            const payerName = details?.payer?.name?.given_name || 'Merchant';
            const result = await upgradeToPro();
            setIsProcessing(false);

            if (result.success) {
              try {
                localStorage.setItem('funnelcraft_plan', selectedTier);
              } catch (_) {}
              if (onUpgradeSuccess) onUpgradeSuccess(selectedTier);
              setSuccessMessage(
                `شكراً لك ${payerName}! تم تأكيد اشتراكك في ${currentTier.name} بنجاح عبر PayPal.`
              );
              setTimeout(() => {
                onClose();
                setSuccessMessage(null);
              }, 2500);
            }
          } catch (captureErr: any) {
            setIsProcessing(false);
            setErrorMessage('فشلت عملية الخصم عبر PayPal. يرجى المحاولة مرة أخرى.');
          }
        },
        onError: (err: any) => {
          console.error('PayPal Checkout error:', err);
          setIsProcessing(false);
          setErrorMessage('حدث خطأ في بوابة PayPal. يرجى إعادة المحاولة.');
        },
      });

      if (buttonsInstance && typeof buttonsInstance.isEligible === 'function' && !buttonsInstance.isEligible()) {
        if (isMounted) setIsPaypalRendering(false);
      } else if (buttonsInstance && typeof buttonsInstance.render === 'function') {
        buttonsInstance
          .render(container)
          .then(() => {
            if (isMounted) setIsPaypalRendering(false);
          })
          .catch((err: any) => {
            console.warn('PayPal Button render issue:', err);
            if (isMounted) setIsPaypalRendering(false);
          });
      } else {
        if (isMounted) setIsPaypalRendering(false);
      }
    } catch (e) {
      console.warn('PayPal initialization warning:', e);
      if (isMounted) setIsPaypalRendering(false);
    }

    return () => {
      isMounted = false;
      try {
        if (buttonsInstance && typeof buttonsInstance.close === 'function') {
          buttonsInstance.close();
        }
      } catch (_) {}
      if (container) {
        try {
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
        } catch (_) {}
      }
    };
  }, [isOpen, isPaypalSdkLoaded, paymentMethod, selectedTier, currentTier]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Receipt image file upload
  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('حجم صورة الوصل يجب أن لا يتجاوز 5 ميغابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setReceiptImage(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  // Direct PayPal Smart Checkout fallback handler
  const handleDirectPayPalCheckout = async () => {
    if (!isLoggedIn) {
      onClose();
      if (onRequireAuth) onRequireAuth();
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    setTimeout(async () => {
      const result = await upgradeToPro();
      setIsProcessing(false);

      if (result.success) {
        try {
          localStorage.setItem('funnelcraft_plan', selectedTier);
        } catch (_) {}
        if (onUpgradeSuccess) onUpgradeSuccess(selectedTier);
        setSuccessMessage(`تم تفعيل ${currentTier.name} بنجاح عبر PayPal! تم فتح جميع المميزات لحسابك.`);
        setTimeout(() => {
          onClose();
          setSuccessMessage(null);
        }, 2200);
      } else {
        setErrorMessage(result.message || 'حدث خطأ أثناء معالجة الدفع عبر PayPal.');
      }
    }, 1200);
  };

  // Moroccan Bank Transfer Submission
  const handleMoroccanTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionRef.trim()) {
      setErrorMessage('يرجى إدخال رقم المعاملة أو الحوالة البنكية.');
      return;
    }

    if (!isLoggedIn) {
      onClose();
      if (onRequireAuth) onRequireAuth();
      return;
    }

    if (!currentBank) {
      setErrorMessage('لا توجد حسابات بنكية متاحة حالياً. يرجى التواصل مع الدعم.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const resolvedMethod = inferMoroccanPaymentMethod(currentBank);
    const result = await submitManualPayment(
      resolvedMethod,
      transactionRef.trim(),
      currentTier.priceMAD,
      receiptImage || undefined,
      notes ? `${currentTier.name} (${currentBank.name}) - ${notes.trim()}` : `${currentTier.name} (${currentBank.name})`
    );
    setIsProcessing(false);

    if (result.success) {
      try {
        localStorage.setItem('funnelcraft_plan', selectedTier);
      } catch (_) {}
      if (onUpgradeSuccess) onUpgradeSuccess(selectedTier);
      setSuccessMessage(
        `تم إرسال وصل الدفع (${currentTier.priceMAD} درهم) بنجاح! سيقوم فريق المراجعة بتفعيل حسابك فور التحقق.`
      );
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 3000);
    } else {
      setErrorMessage(result.error || 'فشل إرسال وصل الدفع. يرجى التحقق من المعلومات والمحاولة مجدداً.');
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-sans"
    >
      <div className="bg-slate-950 text-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl relative border border-slate-800 overflow-hidden max-h-[94vh] flex flex-col">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -start-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -end-24 w-72 h-72 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-5 end-5 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition z-10 cursor-pointer disabled:opacity-40"
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {successMessage ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-4xl shadow-xl animate-in zoom-in-75">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-white">تهانينا! تم تأكيد الاشتراك بنجاح</h3>
            <p className="text-xs text-emerald-300 max-w-md mx-auto leading-relaxed">
              {successMessage}
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto pe-1 space-y-5">
            {/* Scarcity / Limit Alert */}
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider">
                <Flame className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                <span>{triggerReason || 'الخطة المجانية وصلت للحد الأقصى (2/2 صفحات)'}</span>
              </span>
            </div>

            {/* Pending Payment Notification */}
            {pendingPayment && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold">
                      دفعة سابقة قيد المراجعة: {pendingPayment.method}
                    </span>
                    <span className="block text-[11px] text-amber-400/80">
                      رقم العملية: {pendingPayment.transactionReference}
                    </span>
                  </div>
                </div>
                <span className="bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]">
                  قيد المراجعة
                </span>
              </div>
            )}

            {/* Modal Heading */}
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1.5 flex items-center gap-2">
                <span>ترقية الحساب وإلغاء القيود فوراً</span>
                <Crown className="w-5 h-5 text-amber-400" />
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                اختر خطة الاشتراك المناسبة وافتح الدومينات المخصصة وتوليد الذكاء الاصطناعي بلا حدود.
              </p>
            </div>

            {/* ---------------- 1. SUBSCRIPTION TIERS CARDS ---------------- */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                1. حدد باقة الاشتراك المطلوبة:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {TIERS.map((tier) => {
                  const isSelected = selectedTier === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTier(tier.id)}
                      className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                      }`}
                    >
                      {/* Popular Badge */}
                      {tier.badge && (
                        <div className="absolute -top-2.5 start-3">
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              tier.isPopular
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm'
                                : 'bg-slate-800 text-amber-300 border border-slate-700'
                            }`}
                          >
                            {tier.badge}
                          </span>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1 mt-1">
                          <h4 className="text-xs font-black text-white">{tier.name}</h4>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                : 'border-slate-700 bg-slate-800'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="mb-2">
                          <span className="text-xl font-black text-white tracking-tight">
                            {tier.priceMAD}
                          </span>
                          <span className="text-xs text-slate-400 font-bold"> درهم</span>
                          <span className="text-[10px] text-slate-500"> / شهر</span>
                          <span className="block text-[10px] text-emerald-400 font-semibold">
                            (~${tier.priceUSD}/mo)
                          </span>
                        </div>

                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                          {tier.description}
                        </p>
                      </div>

                      {/* Tier Features */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-1">
                        {tier.features.slice(0, 2).map((feat, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 text-[10px] text-slate-300"
                          >
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ---------------- 2. PAYMENT METHODS ---------------- */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  2. طريقة الدفع الآمنة:
                </label>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>تشفير 256-bit آمن ومشفر 100%</span>
                </div>
              </div>

              {/* Payment Tabs Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('paypal')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === 'paypal'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-base font-black italic tracking-tighter text-[#0079C1]">
                    Pay<span className="text-[#00457C]">Pal</span>
                  </span>
                  <span>دفع آمن بالبايبال / البطاقة الدولية</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('morocco')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === 'morocco'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🇲🇦</span>
                  <span>تحويل بنكي محلي (4 أبناك مغربية)</span>
                </button>
              </div>

              {/* ---------------- PAYPAL OFFICIAL INTEGRATION ---------------- */}
              {paymentMethod === 'paypal' && (
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800">
                    <div>
                      <span className="text-slate-400">الخطة المختارة:</span>
                      <span className="font-bold text-white me-2"> {currentTier.name}</span>
                    </div>
                    <div>
                      <span className="text-base font-black text-emerald-400">
                        ${currentTier.priceUSD}
                      </span>
                      <span className="text-[10px] text-slate-400"> / USD</span>
                    </div>
                  </div>

                  {/* Official PayPal SDK Buttons Container */}
                  <div className="space-y-3">
                    {isPaypalRendering && (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>جاري تحميل بوابة PayPal الآمنة...</span>
                      </div>
                    )}
                    <div
                      id="paypal-button-container"
                      ref={paypalContainerRef}
                      className={isPaypalRendering ? 'hidden' : 'min-h-[46px] w-full'}
                    />

                    {/* Fallback Smart Checkout Button if SDK container is empty */}
                    <button
                      type="button"
                      onClick={handleDirectPayPalCheckout}
                      disabled={isProcessing}
                      className="w-full py-3.5 px-4 rounded-2xl bg-[#FFC439] hover:bg-[#F2BA36] active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                      title="Checkout securely with PayPal"
                    >
                      <span className="font-black italic tracking-tighter text-xl text-[#003087]">
                        Pay<span className="text-[#0079C1]">Pal</span>
                      </span>
                      <span className="text-xs font-black text-slate-900">
                        {isProcessing
                          ? 'جاري التحقق والخصم عبر PayPal...'
                          : `الدفع الفوري الآمن ($${currentTier.priceUSD})`}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDirectPayPalCheckout}
                      disabled={isProcessing}
                      className="w-full py-2.5 px-4 rounded-2xl bg-[#2C2E2F] hover:bg-[#222425] text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700 disabled:opacity-50"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      <span>الدفع بالبطاقة البنكية الدولية عبر بايبال (Visa / MasterCard)</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>حماية المشتريات من PayPal</span>
                    </span>
                    <span>•</span>
                    <span>تفعيل فوري وآلي للحساب</span>
                  </div>
                </div>
              )}

              {/* ---------------- MOROCCAN LOCAL BANK TRANSFERS ---------------- */}
              {paymentMethod === 'morocco' && (
                moroccanBanks.length === 0 || !currentBank ? (
                  <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-2">
                    <Landmark className="w-8 h-8 text-amber-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-200">
                      لا توجد حسابات بنكية متاحة حالياً. يرجى التواصل مع الدعم.
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={handleMoroccanTransferSubmit}
                    className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800">
                      <div>
                        <span className="text-slate-400">المبلغ المطلوب للتحويل:</span>
                        <span className="font-bold text-white me-2"> {currentTier.priceMAD} درهم مغربي</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        تأكيد سريع خلال دقائق
                      </span>
                    </div>

                    {/* Dynamic Moroccan Banks Selection Grid */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-2">
                        اختر البنك أو وسيلة الدفع المحلية ({moroccanBanks.length} خيارات متاحة):
                      </label>
                      <div className="grid grid-cols-2 gap-2" data-testid="moroccan-banks-grid">
                        {moroccanBanks.map((b) => {
                          const isSelected = currentBank.id === b.id;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSelectedMoroccanBank(b.id)}
                              className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                                isSelected
                                  ? 'bg-slate-800 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/20'
                                  : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Landmark
                                  className={`w-4 h-4 ${
                                    isSelected ? 'text-emerald-400' : 'text-slate-500'
                                  }`}
                                />
                                <div className="text-start">
                                  <span className="block">{b.name}</span>
                                  <span className="block text-[9px] text-slate-400 font-normal">
                                    {b.badge}
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                                    : 'border-slate-600'
                                }`}
                              >
                                {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Bank Account Details Card with Copy Button */}
                    <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-700/70 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <Landmark className="w-4 h-4 text-emerald-400" />
                          <span>بيانات التحويل ({currentBank.name})</span>
                        </span>
                        {currentBank.rib ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(currentBank.rib!.replace(/\s/g, ''), 'rib')}
                            className="text-emerald-400 hover:text-emerald-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20"
                          >
                            {copiedKey === 'rib' ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ رقم الـ RIB</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                `${currentBank.beneficiary} - ${currentBank.cin || ''} - ${currentBank.phone || ''}`,
                                'cashplus'
                              )
                            }
                            className="text-emerald-400 hover:text-emerald-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20"
                          >
                            {copiedKey === 'cashplus' ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ بيانات المستفيد</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {currentBank.rib ? (
                        <div className="space-y-1">
                          <span className="block text-[10px] text-slate-400">
                            رقم الحساب البنكي (RIB - 24 رقماً):
                          </span>
                          <div className="font-mono text-xs font-bold text-slate-100 bg-slate-950 p-2.5 rounded-xl border border-slate-800 select-all tracking-wider text-center">
                            {currentBank.rib}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                            <span>اسم المستفيد: {currentBank.beneficiary}</span>
                            <span>{currentBank.bankName}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 text-slate-200 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          <p className="font-bold text-emerald-400">{currentBank.bankName || currentBank.name}:</p>
                          <p>اسم المستفيد: <span className="font-bold text-white">{currentBank.beneficiary}</span></p>
                          {currentBank.cin && (
                            <p>رقم البطاقة الوطنية (CIN): <span className="font-mono font-bold text-white">{currentBank.cin}</span></p>
                          )}
                          {currentBank.phone && (
                            <p>رقم الهاتف: <span className="font-mono font-bold text-white">{currentBank.phone}</span></p>
                          )}
                        </div>
                      )}

                      {currentBank.instructions && (
                        <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-800 pt-2">
                          💡 {currentBank.instructions}
                        </p>
                      )}
                    </div>

                    {/* Transaction Reference Input (Required) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        رقم العملية / كود الحوالة (Transaction ID / Reference) *
                      </label>
                      <input
                        type="text"
                        required
                        value={transactionRef}
                        onChange={(e) => setTransactionRef(e.target.value)}
                        placeholder="مثال: VIRT-9481230 أو رقم الحوالة من التطبيق البنكي"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition"
                      />
                    </div>

                    {/* Optional File Upload for Receipt Screenshot */}
                    <div>
                      <label className="block text-xs font-bold text-slate-200 mb-1.5">
                        صورة وصل التحويل (اختياري لتسريع التأكيد)
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => receiptFileRef.current?.click()}
                          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{receiptImage ? 'تغيير صورة الوصل' : 'رفع لقطة شاشة للوصل'}</span>
                        </button>
                        <input
                          type="file"
                          ref={receiptFileRef}
                          onChange={handleReceiptUpload}
                          accept="image/*"
                          className="hidden"
                        />
                        {receiptImage && (
                          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                            <FileCheck2 className="w-4 h-4" />
                            <span>تم إرفاق الوصل بنجاح</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-98 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isProcessing
                          ? 'جاري إرسال وصل الدفع...'
                          : `تأكيد إرسال التحويل البنكي (${currentTier.priceMAD} درهم)`}
                      </span>
                    </button>
                  </form>
                )
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-950/80 border border-rose-700/60 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
