import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShoppingBag,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Star,
  ChevronDown,
  ChevronUp,
  Phone,
  User,
  MapPin,
  Home,
  Sparkles,
  Flame,
  Package,
  Clock,
  Award,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CreditCard,
  Globe,
} from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { executeRecaptcha, preloadRecaptchaScript } from '../utils/recaptcha';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
import {
  DEFAULT_EXCHANGE_RATES,
  SUPPORTED_DISPLAY_CURRENCIES,
  formatConvertedPrice,
  calculatePayPalUsdSettlement,
  normalizeExchangeRates,
} from '../utils/currencyAndBanks';
import type {
  ScrapedProduct,
  ScrapedBundle,
  ScrapedVariant,
  ScrapedSpecification,
  ScrapedReview,
  ScrapedFaq,
} from '../../server/scraper';

export type {
  ScrapedProduct,
  ScrapedBundle,
  ScrapedVariant,
  ScrapedSpecification,
  ScrapedReview,
  ScrapedFaq,
};

export interface CustomerLandingPageProps {
  product: ScrapedProduct;
  pageSlug?: string;
  funnelId?: string;
  userId?: string;
  onBack?: () => void;
}

const MOROCCAN_CITIES: string[] = [
  'الدار البيضاء',
  'الرباط',
  'مراكش',
  'طنجة',
  'فاس',
  'أكادير',
  'مكناس',
  'وجدة',
  'القنيطرة',
  'تطوان',
  'تمارة',
  'سلا',
  'أسفي',
  'المحمدية',
  'خريبكة',
  'بني ملال',
  'الجديدة',
  'تازة',
  'الناظور',
  'سطات',
  'العيون',
  'الداخلة',
];

export const CustomerLandingPage: React.FC<CustomerLandingPageProps> = ({
  product,
  pageSlug,
  funnelId,
  userId,
  onBack,
}) => {
  const formRef = useRef<HTMLDivElement>(null);

  const safeImages = useMemo<string[]>(() => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images;
    }
    return [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80',
    ];
  }, [product.images]);

  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  const safeVariants = useMemo<ScrapedVariant[]>(() => {
    return Array.isArray(product.variants)
      ? product.variants.filter((v) => v && v.name && Array.isArray(v.options) && v.options.length > 0)
      : [];
  }, [product.variants]);

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    safeVariants.forEach((v) => {
      if (v.options.length > 0) {
        initial[v.name] = v.options[0];
      }
    });
    return initial;
  });

  const safeBundles = useMemo<ScrapedBundle[]>(() => {
    if (Array.isArray(product.bundles) && product.bundles.length > 0) {
      return product.bundles;
    }
    const basePrice = Math.max(1, Number(product.price) || 249);
    const origPrice = Math.max(basePrice, Number(product.originalPrice) || Math.round(basePrice * 1.4));
    return [
      {
        quantity: 1,
        discountPercent: 0,
        freeShipping: true,
        label: 'قطعة واحدة (1x)',
        price: basePrice,
        originalPrice: origPrice,
      },
      {
        quantity: 2,
        discountPercent: 15,
        freeShipping: true,
        label: 'قطعتين (2x) - توفير 15%',
        badge: 'الأكثر طلباً 🔥',
        price: Math.round(basePrice * 2 * 0.85),
        originalPrice: origPrice * 2,
      },
      {
        quantity: 3,
        discountPercent: 25,
        freeShipping: true,
        label: '3 قطع (3x) - توفير 25%',
        badge: 'أفضل توفير 💎',
        price: Math.round(basePrice * 3 * 0.75),
        originalPrice: origPrice * 3,
      },
    ];
  }, [product.bundles, product.price, product.originalPrice]);

  const [selectedBundleIndex, setSelectedBundleIndex] = useState<number>(() => {
    return safeBundles.length > 1 ? 1 : 0;
  });

  const activeBundle = safeBundles[selectedBundleIndex] || safeBundles[0];

  const [customerName, setCustomerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [address, setAddress] = useState<string>('');

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  useEffect(() => {
    void preloadRecaptchaScript();
  }, []);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderId: string;
    totalPrice: number;
    currency: string;
    quantity: number;
    variantSummary: string;
    paymentMethod?: 'cod' | 'paypal';
    paypalOrderId?: string;
  } | null>(null);

  const [selectedCurrency, setSelectedCurrency] = useState<string>('MAD');
  const [rates, setRates] = useState<Record<string, number>>(() => ({
    ...DEFAULT_EXCHANGE_RATES,
  }));

  useEffect(() => {
    let isMounted = true;
    const fetchRates = async () => {
      try {
        const res = await fetch('/api/exchange-rates');
        if (!res.ok) return;
        const data = (await res.json()) as { rates?: Record<string, unknown> };
        if (isMounted && data?.rates && typeof data.rates === 'object') {
          setRates(normalizeExchangeRates(data.rates));
        }
      } catch (_err) {
        // Keep hardcoded fallback rates on failure
      }
    };
    fetchRates();
    return () => {
      isMounted = false;
    };
  }, []);

  const getConvertedPrice = (basePriceMAD: number, targetCurrency: string = selectedCurrency): string => {
    return formatConvertedPrice(basePriceMAD, targetCurrency, rates);
  };

  const paypalClientId =
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PAYPAL_CLIENT_ID || 'test';

  const paypalCheckoutData = useMemo<{
    amount: number;
    formattedAmount: string;
    currency: string;
    isConverted: boolean;
  }>(() => {
    const rawPrice = Number(activeBundle ? activeBundle.price : product.price) || 0;
    return calculatePayPalUsdSettlement(rawPrice, rates);
  }, [activeBundle, product.price, rates]);

  const discountPercentage = useMemo<number>(() => {
    if (product.originalPrice > product.price && product.originalPrice > 0) {
      return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    }
    return 30;
  }, [product.price, product.originalPrice]);

  const formattedVariantString = useMemo<string>(() => {
    const entries = Object.entries(selectedVariants);
    if (entries.length === 0) return 'النسخة القياسية';
    return entries.map(([group, val]) => `${group}: ${val}`).join(' | ');
  }, [selectedVariants]);

  const handleVariantSelect = (groupName: string, option: string) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [groupName]: option,
    }));
  };

  const scrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev === 0 ? safeImages.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev === safeImages.length - 1 ? 0 : prev + 1));
  };

  const handleSubmitOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = customerName.trim();
    const trimmedPhone = phone.trim();
    const trimmedCity = city.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName || !trimmedPhone || !trimmedCity || !trimmedAddress) {
      setErrorMessage('المرجو ملء جميع الخانات المطلوبة لتأكيد طلبك.');
      return;
    }

    const phoneRegex = /^(05|06|07|\+212|212)[0-9\s-]{8,12}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      setErrorMessage('المرجو إدخال رقم هاتف مغربي صحيح (مثال: 0612345678).');
      return;
    }

    // Ensure every variant group has a selected option
    for (const vGroup of safeVariants) {
      if (!selectedVariants[vGroup.name]) {
        setErrorMessage(`المرجو اختيار ${vGroup.name} قبل إتمام الطلب.`);
        return;
      }
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setErrorMessage('المرجو إتمام التحقق الأمني (CAPTCHA) قبل تأكيد الطلب.');
      return;
    }

    const finalPrice = activeBundle ? activeBundle.price : product.price;
    const finalQuantity = activeBundle ? activeBundle.quantity : 1;

    setIsSubmitting(true);

    try {
      const recaptchaToken = await executeRecaptcha('cod_checkout');

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productName: product.title,
          price: finalPrice,
          quantity: finalQuantity,
          customerName: trimmedName,
          phone: trimmedPhone,
          city: trimmedCity,
          address: trimmedAddress,
          variant: formattedVariantString,
          pageSlug: pageSlug || undefined,
          funnelId: funnelId || undefined,
          userId: userId || undefined,
          notes: `العرض المختار: ${activeBundle.label} | المواصفات: ${formattedVariantString}`,
          recaptchaToken,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        orderId?: string;
        order?: { id?: string };
        error?: string;
      };

      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'حدث خطأ أثناء تسجيل الطلب. المرجو المحاولة مرة أخرى.');
      }

      setOrderSuccess({
        orderId: data.orderId || data.order?.id || `ORD-${Date.now().toString().slice(-6)}`,
        totalPrice: finalPrice,
        currency: product.currency || 'MAD',
        quantity: finalQuantity,
        variantSummary: formattedVariantString,
        paymentMethod: 'cod',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إرسال الطلب حالياً. تحقق من اتصالك بالإنترنت.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    }
  };

  if (orderSuccess) {
    const isPayPalPaid = orderSuccess.paymentMethod === 'paypal';
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 font-sans text-slate-900 py-12 px-4 flex items-center justify-center">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-emerald-100 p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {isPayPalPaid ? 'تم الدفع وتأكيد الطلب بنجاح عبر PayPal' : 'تم تسجيل طلبك بنجاح'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              شكراً لك {customerName || 'عزيزنا الزبون'}! 🎉
            </h1>
            <p className="text-slate-600 text-sm leading-relaxed">
              {isPayPalPaid
                ? 'تم استلام دفعتك بنجاح عبر PayPal وتأكيد طلبك فوراً. سيقوم فريقنا بتجهيز وإرسال طردك في أقرب وقت.'
                : 'لقد توصلنا بطلبك وسيتصل بك فريق خدمة الزبناء قريباً عبر الهاتف لتأكيد العنوان وموعد التوصيل.'}
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-right space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <span className="text-slate-500">رقم الطلب:</span>
              <span className="font-mono font-bold text-slate-800">{orderSuccess.orderId}</span>
            </div>
            {orderSuccess.paypalOrderId && (
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="text-slate-500">معرف معاملة PayPal:</span>
                <span className="font-mono font-bold text-blue-700">{orderSuccess.paypalOrderId}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <span className="text-slate-500">المنتج:</span>
              <span className="font-bold text-slate-800 line-clamp-1 max-w-[220px]">{product.title}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <span className="text-slate-500">الخيارات المختارة:</span>
              <span className="font-semibold text-indigo-700">{orderSuccess.variantSummary}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <span className="text-slate-500">الكمية:</span>
              <span className="font-bold text-slate-800">{orderSuccess.quantity} قطع</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <span className="text-slate-500">حالة الدفع:</span>
              <span className="font-bold text-emerald-700">
                {isPayPalPaid ? 'مدفوع بالكامل (PayPal)' : 'الدفع عند الاستلام (COD)'}
              </span>
            </div>
            {city && (
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="text-slate-500">المدينة:</span>
                <span className="font-bold text-slate-800">{city}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-700 font-bold">
                {isPayPalPaid ? 'المبلغ المدفوع:' : 'المبلغ الإجمالي عند الاستلام:'}
              </span>
              <span className="text-xl font-black text-emerald-600">
                {isPayPalPaid
                  ? `${orderSuccess.totalPrice.toFixed(2)} ${orderSuccess.currency}`
                  : `${orderSuccess.totalPrice} ${orderSuccess.currency}`}
              </span>
            </div>
          </div>

          {phone && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-center gap-3 text-right">
              <Phone className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                المرجو إبقاء هاتفك <strong>({phone})</strong> مشغلاً، سنتصل بك خلال ساعات العمل لتأكيد الإرسال السريع.
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setOrderSuccess(null);
                setCustomerName('');
                setPhone('');
                setAddress('');
              }}
              className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              العودة إلى صفحة المنتج
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="py-3.5 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-28">
      {/* Top Announcement Bar */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white py-2 px-4 text-center text-xs sm:text-sm font-bold shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 mx-auto sm:mx-0">
            <Truck className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">
              توصيل سريع لجميع المدن المغربية 🇲🇦 • الدفع نقداً عند الاستلام • تخفيض حصري {discountPercentage}% اليوم!
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Multi-Currency Selector */}
            <div className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg border border-white/20 text-xs">
              <Globe className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <select
                aria-label="تغيير العملة"
                data-testid="currency-selector-top"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
              >
                {SUPPORTED_DISPLAY_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} className="text-slate-900 font-bold">
                    {c.flag} {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="hidden sm:inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                رجوع
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6 sm:pt-10 space-y-12">
        {/* HERO SECTION & COD FORM GRID */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Product Image Gallery (Right column in RTL) */}
          <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-16">
            <div className="relative aspect-square w-full bg-white rounded-3xl overflow-hidden shadow-md border border-slate-200 group">
              <img
                src={safeImages[activeImageIndex] || safeImages[0]}
                alt={product.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />

              {/* Discount Pill Badge */}
              {discountPercentage > 0 && (
                <div className="absolute top-4 right-4 bg-rose-600 text-white px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-black shadow-lg flex items-center gap-1">
                  <Flame className="w-4 h-4 fill-current" />
                  <span>تخفيض -{discountPercentage}%</span>
                </div>
              )}

              {/* Free Shipping Badge */}
              <div className="absolute top-4 left-4 bg-emerald-600/95 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                <span>شحن مجاني</span>
              </div>

              {/* Navigation Arrows */}
              {safeImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    aria-label="الصورة السابقة"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center transition cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    aria-label="الصورة التالية"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {safeImages.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {safeImages.map((imgUrl, index) => (
                  <button
                    key={`${imgUrl}-${index}`}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                      activeImageIndex === index
                        ? 'border-emerald-600 ring-2 ring-emerald-500/30 scale-105'
                        : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={imgUrl} alt={`${product.title} - ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Trust Badges Strip under gallery */}
            <div className="grid grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
              <div className="flex flex-col items-center gap-1">
                <Truck className="w-6 h-6 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">توصيل سريع</span>
                <span className="text-[11px] text-slate-500">24 إلى 48 ساعة</span>
              </div>
              <div className="flex flex-col items-center gap-1 border-x border-slate-100 px-2">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">ضمان الجودة</span>
                <span className="text-[11px] text-slate-500">منتج أصلي 100%</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Package className="w-6 h-6 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">الدفع عند الاستلام</span>
                <span className="text-[11px] text-slate-500">معاينة قبل الدفع</span>
              </div>
            </div>
          </div>

          {/* Product Details + Variants + Bundles + COD Form (Left column in RTL) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Title, Rating & Price Header */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">
                  <div className="flex items-center text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <span>4.9/5 ({product.reviews?.length || 4} تقييمات موثقة)</span>
                </div>

                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  متوفر في المخزون
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">
                {product.title}
              </h1>

              {/* Price Display + Quick Currency Switcher */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span
                    data-testid="hero-converted-price"
                    className="text-3xl sm:text-4xl font-black text-emerald-600"
                    dir="ltr"
                  >
                    {getConvertedPrice(product.price)}
                  </span>
                  {product.originalPrice > product.price && (
                    <span className="text-lg sm:text-xl text-slate-400 line-through font-bold" dir="ltr">
                      {getConvertedPrice(product.originalPrice)}
                    </span>
                  )}
                  {product.originalPrice > product.price && (
                    <span className="bg-rose-100 text-rose-700 text-xs font-black px-2.5 py-1 rounded-lg">
                      وفر {getConvertedPrice(product.originalPrice - product.price)}
                    </span>
                  )}
                </div>

                <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  <span>العملة:</span>
                  <select
                    aria-label="عملة العرض"
                    data-testid="currency-selector-hero"
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="bg-transparent font-black text-emerald-700 outline-none cursor-pointer"
                  >
                    {SUPPORTED_DISPLAY_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                {product.description}
              </p>

              {/* Key Features List */}
              {Array.isArray(product.features) && product.features.length > 0 && (
                <ul className="space-y-2 pt-2 border-t border-slate-100">
                  {product.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Interactive Checkout Card: Variants + Bundles + COD Inputs */}
            <div
              ref={formRef}
              className="bg-white rounded-3xl p-6 sm:p-7 shadow-lg border-2 border-emerald-500/80 space-y-6 relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    <span>اطلب الآن — الدفع عند الاستلام</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    اختر العرض المناسب واملأ معلوماتك للتوصيل السريع لباب منزلك
                  </p>
                </div>
                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  شحن فوري
                </span>
              </div>

              <form onSubmit={handleSubmitOrder} className="space-y-6">
                {/* 1. Variants Selection (Pills) */}
                {safeVariants.length > 0 && (
                  <div className="space-y-4">
                    {safeVariants.map((variantGroup) => {
                      const currentSelection = selectedVariants[variantGroup.name];
                      return (
                        <div key={variantGroup.name} className="space-y-2">
                          <label className="block text-sm font-bold text-slate-800">
                            اختر {variantGroup.name}:{' '}
                            <span className="text-emerald-600 font-black">{currentSelection}</span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {variantGroup.options.map((option) => {
                              const isSelected = currentSelection === option;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => handleVariantSelect(variantGroup.name, option)}
                                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer border ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20'
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-white'
                                  }`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Bundles Selection (Cards) */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>اختر العرض ووفر أكثر:</span>
                  </label>

                  <div className="space-y-3">
                    {safeBundles.map((bundle, idx) => {
                      const isSelected = selectedBundleIndex === idx;
                      const savings = Math.max(0, bundle.originalPrice - bundle.price);
                      return (
                        <div
                          key={`${bundle.quantity}-${idx}`}
                          onClick={() => setSelectedBundleIndex(idx)}
                          className={`relative rounded-2xl p-4 border-2 transition cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          {bundle.badge && (
                            <span className="absolute -top-2.5 left-4 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[11px] font-black px-3 py-0.5 rounded-full shadow-xs">
                              {bundle.badge}
                            </span>
                          )}

                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                            </div>

                            <div>
                              <div className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                                <span>{bundle.label}</span>
                                {bundle.discountPercent > 0 && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md">
                                    ناقص {bundle.discountPercent}%
                                  </span>
                                )}
                              </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                  {bundle.freeShipping && (
                                    <span className="text-emerald-700 font-semibold">✓ توصيل مجاني</span>
                                  )}
                                  {savings > 0 && <span>• وفر {getConvertedPrice(savings)}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="text-left shrink-0" dir="ltr">
                              <div className="text-lg sm:text-xl font-black text-emerald-700">
                                {getConvertedPrice(bundle.price)}
                              </div>
                              {bundle.originalPrice > bundle.price && (
                                <div className="text-xs text-slate-400 line-through font-semibold">
                                  {getConvertedPrice(bundle.originalPrice)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* 3. Customer COD Inputs */}
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">معلومات التوصيل السريع:</h3>

                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      الاسم الكامل <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="أدخل اسمك الكامل"
                        className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-medium transition"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      رقم الهاتف (للاتصال وتأكيد الطلب) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="06 12 34 56 78"
                        className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-mono text-right transition"
                      />
                    </div>
                  </div>

                  {/* City & Address */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        المدينة <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          required
                          list="moroccan-cities-list"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="اختر أو اكتب مدينتك"
                          className="w-full pr-10 pl-3 py-3 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-medium transition"
                        />
                        <datalist id="moroccan-cities-list">
                          {MOROCCAN_CITIES.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        العنوان الكامل / الحي <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Home className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="الحي، الشارع، رقم المنزل..."
                          className="w-full pr-10 pl-3 py-3 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-medium transition"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Total Summary Box */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>العرض المختار ({activeBundle.quantity} قطع):</span>
                    <span className="font-bold text-slate-800">{activeBundle.label}</span>
                  </div>
                  {safeVariants.length > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>المواصفات المختارة:</span>
                      <span className="font-bold text-indigo-700">{formattedVariantString}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-600">
                    <span>مصاريف التوصيل:</span>
                    <span className="font-bold text-emerald-600">مجاني (0 درهم)</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-base font-black text-slate-900">
                    <span>المجموع النهائي عند الاستلام:</span>
                    <span className="text-xl text-emerald-600" dir="ltr">
                      {getConvertedPrice(activeBundle.price)}
                    </span>
                  </div>
                </div>

                {/* Cloudflare Turnstile CAPTCHA */}
                {TURNSTILE_SITE_KEY && (
                  <div className="flex justify-center py-1" dir="ltr">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token) => setTurnstileToken(token)}
                      onExpire={() => setTurnstileToken(null)}
                      onError={() => setTurnstileToken(null)}
                      options={{ theme: 'light', size: 'normal' }}
                    />
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-black text-base sm:text-lg shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2.5 transition transform active:scale-[0.99] cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>جاري تسجيل طلبك...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      <span>
                        تأكيد الطلب الآن — {getConvertedPrice(activeBundle.price)}
                      </span>
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-slate-500 font-medium">
                  🔒 معلوماتك محمية 100% • لن تدفع أي سنتيم حتى تتوصل بالمنتج وتتحقق منه
                </p>
              </form>

              {/* Divider between COD Form and PayPal Checkout */}
              <div className="px-5 sm:px-6 pb-6 space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-4 text-xs font-bold text-slate-400 whitespace-nowrap flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    أو ادفع الآن إلكترونياً عبر PayPal
                  </span>
                  <div className="border-t border-slate-200 w-full" />
                </div>

                <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
                    <span className="font-bold text-slate-800">الدفع الفوري الآمن (PayPal Checkout)</span>
                    <span data-testid="paypal-settlement-summary" className="font-black text-blue-700">
                      المبلغ للدفع الآن: {getConvertedPrice(activeBundle.price)}
                      {selectedCurrency !== 'USD'
                        ? ` (تتم التسوية بـ $${paypalCheckoutData.formattedAmount} USD)`
                        : ''}
                    </span>
                  </div>

                  <div dir="ltr" className="w-full relative z-10">
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
                          height: 45,
                        }}
                        disabled={isSubmitting}
                        createOrder={async () => {
                          setErrorMessage(null);
                          const response = await fetch('/api/paypal/create-order', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              identifier: pageSlug || funnelId,
                              pageSlug: pageSlug || undefined,
                              funnelId: funnelId || undefined,
                              bundleIndex: selectedBundleIndex,
                              bundleQuantity: activeBundle ? activeBundle.quantity : 1,
                            }),
                          });

                          const orderData = (await response.json()) as {
                            id?: string;
                            error?: string;
                          };

                          if (!response.ok || !orderData.id) {
                            const errMsg =
                              orderData.error || 'تعذر إنشاء طلب الدفع عبر PayPal. حاول مرة أخرى.';
                            setErrorMessage(errMsg);
                            throw new Error(errMsg);
                          }

                          return orderData.id;
                        }}
                        onApprove={async (data) => {
                          setErrorMessage(null);
                          setIsSubmitting(true);
                          try {
                            const captureResponse = await fetch(
                              `/api/paypal/capture-order/${encodeURIComponent(data.orderID)}`,
                              {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  identifier: pageSlug || funnelId,
                                  pageSlug: pageSlug || undefined,
                                  funnelId: funnelId || undefined,
                                  bundleIndex: selectedBundleIndex,
                                  bundleQuantity: activeBundle ? activeBundle.quantity : 1,
                                }),
                              }
                            );

                            const captureData = (await captureResponse.json()) as {
                              success?: boolean;
                              id?: string;
                              status?: string;
                              capturedAmount?: number;
                              capturedCurrency?: string;
                              error?: string;
                              payer?: {
                                name?: { givenName?: string; surname?: string };
                                emailAddress?: string;
                              };
                            };

                            if (
                              !captureResponse.ok ||
                              !captureData.success ||
                              captureData.status !== 'COMPLETED'
                            ) {
                              throw new Error(
                                captureData.error || 'لم تكتمل عملية الدفع عبر PayPal.'
                              );
                            }

                            const verifiedAmount =
                              typeof captureData.capturedAmount === 'number' &&
                              captureData.capturedAmount > 0
                                ? captureData.capturedAmount
                                : paypalCheckoutData.amount;
                            const verifiedCurrency =
                              captureData.capturedCurrency || paypalCheckoutData.currency;

                            const finalQuantity = activeBundle ? activeBundle.quantity : 1;
                            const payerFullName = [
                              captureData.payer?.name?.givenName,
                              captureData.payer?.name?.surname,
                            ]
                              .filter(Boolean)
                              .join(' ')
                              .trim();

                            const resolvedName =
                              customerName.trim() || payerFullName || 'زبون PayPal';
                            const resolvedPhone =
                              phone.trim() || captureData.payer?.emailAddress || 'PayPal';
                            const resolvedCity = city.trim() || 'الدار البيضاء';
                            const resolvedAddress = address.trim() || 'تم الدفع عبر PayPal';

                            const orderResponse = await fetch('/api/orders', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                productName: product.title,
                                price: verifiedAmount,
                                quantity: finalQuantity,
                                customerName: resolvedName,
                                phone: resolvedPhone,
                                city: resolvedCity,
                                address: resolvedAddress,
                                variant: formattedVariantString,
                                pageSlug: pageSlug || undefined,
                                funnelId: funnelId || undefined,
                                userId: userId || undefined,
                                paymentMethod: 'paypal',
                                status: 'paid',
                                currency: verifiedCurrency,
                                paypalOrderId: data.orderID,
                                notes: `مدفوع عبر PayPal (${data.orderID}) — ${verifiedAmount.toFixed(2)} ${verifiedCurrency} | العرض: ${activeBundle.label} | المواصفات: ${formattedVariantString}`,
                              }),
                            });

                            const recordedOrder = (await orderResponse.json()) as {
                              success?: boolean;
                              orderId?: string;
                              order?: { id?: string };
                              error?: string;
                            };

                            if (!orderResponse.ok || recordedOrder.success === false) {
                              throw new Error(
                                recordedOrder.error || 'تم الدفع ولكن تعذر حفظ الطلب في السجل.'
                              );
                            }

                            if (!customerName.trim() && payerFullName) {
                              setCustomerName(payerFullName);
                            }

                            setOrderSuccess({
                              orderId:
                                recordedOrder.orderId ||
                                recordedOrder.order?.id ||
                                `#PP-${Date.now().toString().slice(-5)}`,
                              totalPrice: verifiedAmount,
                              currency: verifiedCurrency,
                              quantity: finalQuantity,
                              variantSummary: formattedVariantString,
                              paymentMethod: 'paypal',
                              paypalOrderId: data.orderID,
                            });
                          } catch (err: unknown) {
                            const msg =
                              err instanceof Error
                                ? err.message
                                : 'حدث خطأ أثناء تأكيد الدفع عبر PayPal.';
                            setErrorMessage(msg);
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        onError={(err) => {
                          console.error('PayPal Checkout Error:', err);
                          setErrorMessage(
                            'تعذر إتمام الدفع عبر PayPal. يرجى التحقق من إعدادات حساب PayPal أو الدفع عند الاستلام.'
                          );
                        }}
                      />
                    </PayPalScriptProvider>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TECHNICAL SPECIFICATIONS SECTION */}
        {Array.isArray(product.specifications) && product.specifications.length > 0 && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">المواصفات التقنية والتفاصيل</h2>
                <p className="text-xs text-slate-500">جودة عالية ومعايير مضمونة</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-right text-sm">
                <tbody className="divide-y divide-slate-200">
                  {product.specifications.map((spec, index) => (
                    <tr
                      key={`${spec.label}-${index}`}
                      className={index % 2 === 0 ? 'bg-slate-50/70' : 'bg-white'}
                    >
                      <th className="py-3.5 px-4 font-bold text-slate-700 w-1/3 border-l border-slate-200">
                        {spec.label}
                      </th>
                      <td className="py-3.5 px-4 text-slate-800 font-medium">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* CUSTOMER REVIEWS SECTION */}
        {Array.isArray(product.reviews) && product.reviews.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  آراء وتجارب زبنائنا في المغرب 🇲🇦
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  تقييمات حقيقية من زبناء توصلوا بالمنتج وجربوه
                </p>
              </div>
              <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
                <div className="flex text-amber-500">
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                  <Star className="w-4 h-4 fill-current" />
                </div>
                <span className="font-black text-slate-900 text-sm">4.9 / 5</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {product.reviews.map((rev, index) => (
                <div
                  key={`${rev.author}-${index}`}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: Math.min(5, Math.max(1, rev.rating || 5)) }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        مشترٍ موثق
                      </span>
                    </div>

                    <p className="text-slate-700 text-sm leading-relaxed">"{rev.comment}"</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <span className="font-bold text-slate-900">{rev.author}</span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      {rev.city}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQ ACCORDION SECTION */}
        {Array.isArray(product.faqs) && product.faqs.length > 0 && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">الأسئلة الشائعة</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                كل ما تحتاج معرفته حول المنتج، التوصيل، والضمان
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-3">
              {product.faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={`${faq.question}-${idx}`}
                    className="rounded-2xl border border-slate-200 overflow-hidden transition"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between p-4 sm:p-5 text-right bg-slate-50/60 hover:bg-slate-100/70 transition cursor-pointer"
                    >
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {faq.question}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="p-4 sm:p-5 bg-white text-slate-600 text-sm leading-relaxed border-t border-slate-100">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Sticky Mobile & Desktop Bottom CTA Bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={safeImages[0]}
              alt={product.title}
              className="w-12 h-12 rounded-xl object-cover border border-slate-200 hidden sm:block"
            />
            <div>
              <p className="text-xs font-bold text-slate-900 line-clamp-1 max-w-[200px] sm:max-w-xs">
                {product.title}
              </p>
              <div className="flex items-baseline gap-2" dir="ltr">
                <span className="text-base sm:text-lg font-black text-emerald-600">
                  {getConvertedPrice(activeBundle.price)}
                </span>
                {activeBundle.originalPrice > activeBundle.price && (
                  <span className="text-xs text-slate-400 line-through">
                    {getConvertedPrice(activeBundle.originalPrice)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={scrollToForm}
            className="flex-1 sm:flex-initial sm:min-w-[240px] py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>اطلب الآن — الدفع عند الاستلام</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerLandingPage;
