import React, { useState, useRef, useEffect } from 'react';
import { CodFormBlock, PageTheme, BundleOption } from '../../types/landingPage';
import { ShieldCheck, Truck, Banknote, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { executeRecaptcha, preloadRecaptchaScript } from '../../utils/recaptcha';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

interface OrderSubmitPayload {
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  customerNote?: string;
  bundle: BundleOption;
  totalPrice: number;
  currency: string;
  recaptchaToken?: string;
  turnstileToken?: string;
}

interface Props {
  block: CodFormBlock;
  theme: PageTheme;
  isRtl?: boolean;
  onOrderSubmit?: (payload: OrderSubmitPayload) => void;
}

export const CodFormBlockView: React.FC<Props> = ({ block, theme, isRtl, onOrderSubmit }) => {
  const initialBundle =
    block.bundles.find((b) => b.popular) || block.bundles[0] || {
      id: 'default',
      name: 'Standard Package',
      quantity: 1,
      price: 49.99,
      originalPrice: 99.99,
    };

  const [selectedBundle, setSelectedBundle] = useState<BundleOption>(initialBundle);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState(block.fields.defaultCities?.[0] || '');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  useEffect(() => {
    void preloadRecaptchaScript();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!customerPhone) {
      setFormError(isRtl ? 'يرجى إدخال رقم هاتفك للتواصل' : 'Please provide your phone number.');
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setFormError(
        isRtl
          ? 'يرجى إتمام التحقق الأمني (CAPTCHA) قبل تأكيد الطلب.'
          : 'Please complete the CAPTCHA verification.'
      );
      return;
    }

    const recaptchaToken = await executeRecaptcha('cod_checkout');

    if (onOrderSubmit) {
      onOrderSubmit({
        customerName: customerName || (isRtl ? 'عميل' : 'Valued Customer'),
        customerPhone,
        customerCity,
        customerAddress,
        customerNote,
        bundle: selectedBundle,
        totalPrice: selectedBundle.price,
        currency: block.currency,
        recaptchaToken,
        turnstileToken: turnstileToken || undefined,
      });
    }

    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  return (
    <section id="cod-checkout-form" className="max-w-3xl mx-auto px-4 py-12 md:py-20" dir={isRtl ? 'rtl' : 'ltr'}>
      <div
        className="bg-white rounded-3xl border-2 p-6 md:p-10 shadow-2xl relative"
        style={{ borderColor: theme.primaryColor || '#059669' }}
      >
        {/* Top Floating Badge */}
        <div
          className="absolute -top-4 start-1/2 -translate-x-1/2 text-white text-xs font-black uppercase tracking-wider px-6 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap"
          style={{ backgroundColor: theme.primaryColor || '#059669' }}
        >
          <Banknote className="w-4 h-4" />
          <span>{isRtl ? 'الدفع نقداً عند الاستلام • بدون بطاقة بنكية' : 'CASH ON DELIVERY • PAY AT DOORSTEP'}</span>
        </div>

        <div className="text-center mt-3 mb-8">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight">
            {block.title}
          </h2>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed">{block.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Bundle */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-extrabold uppercase tracking-wider text-gray-700 flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full text-white text-[11px] font-black flex items-center justify-center"
                  style={{ backgroundColor: theme.primaryColor || '#059669' }}
                >
                  1
                </span>
                <span>{isRtl ? 'اختر باقة العرض المناسبة لك:' : 'Step 1: Choose Your Discounted Package:'}</span>
              </label>
            </div>

            <div className="space-y-3">
              {block.bundles.map((bundle) => {
                const isSelected = selectedBundle.id === bundle.id;
                return (
                  <div
                    key={bundle.id}
                    onClick={() => setSelectedBundle(bundle)}
                    className={`relative border-2 rounded-2xl p-4 cursor-pointer transition-all duration-200 flex items-center justify-between gap-4 ${
                      isSelected
                        ? 'bg-emerald-50/50 shadow-md ring-2 ring-emerald-500/20'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    style={{
                      borderColor: isSelected ? theme.primaryColor || '#059669' : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                          isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-gray-300'
                        }`}
                        style={{
                          borderColor: isSelected ? theme.primaryColor || '#059669' : undefined,
                          backgroundColor: isSelected ? theme.primaryColor || '#059669' : undefined,
                        }}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm md:text-base">
                            {bundle.name}
                          </span>
                          {bundle.badge && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                              {bundle.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Truck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{isRtl ? 'شحن سريع ومجاني متضمن' : 'Free Express Shipping Included'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-end">
                      <div
                        className="text-lg md:text-xl font-black"
                        style={{ color: theme.primaryColor || '#059669' }}
                      >
                        {bundle.price} {block.currency}
                      </div>
                      {bundle.originalPrice > bundle.price && (
                        <div className="text-xs text-gray-400 line-through">
                          {bundle.originalPrice} {block.currency}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Customer Shipping Inputs */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <label className="text-xs font-extrabold uppercase tracking-wider text-gray-700 flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full text-white text-[11px] font-black flex items-center justify-center"
                style={{ backgroundColor: theme.primaryColor || '#059669' }}
              >
                2
              </span>
              <span>{isRtl ? 'معلومات التوصيل (لا نحتاج لبطاقة بنكية):' : 'Step 2: Shipping Details (No Card Required):'}</span>
            </label>

            <div>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={isRtl ? 'الاسم الكامل (مثال: محمد العمري)' : 'Full Name (e.g. John Doe)'}
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition bg-gray-50/50 hover:bg-white"
              />
            </div>

            <div>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={isRtl ? 'رقم الهاتف للتواصل (مثال: 0612345678)' : 'Phone Number (e.g. +1 555 123 4567)'}
                className="w-full px-4 py-3.5 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition font-mono bg-gray-50/50 hover:bg-white"
              />
              <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
                <span>📞</span>
                <span>
                  {isRtl
                    ? 'سيتصل بك مندوبنا هاتفياً لتأكيد العنوان وموعد التسليم'
                    : 'Our confirmation agent will call this number to verify dispatch.'}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  required
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder={isRtl ? 'المدينة (مثال: الدار البيضاء)' : 'City / Province'}
                  className="w-full px-4 py-3.5 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition bg-gray-50/50 hover:bg-white"
                />
              </div>

              <div>
                <input
                  type="text"
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder={isRtl ? 'العنوان / الحي / رقم المنزل' : 'Delivery Address / Apt / Street'}
                  className="w-full px-4 py-3.5 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition bg-gray-50/50 hover:bg-white"
                />
              </div>
            </div>

            <div>
              <textarea
                rows={2}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder={isRtl ? 'ملاحظة خاصة بالتسليم (اختياري: وقت التوصيل المفضل...)' : 'Optional delivery note (e.g. call after 3 PM)'}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition bg-gray-50/50 hover:bg-white"
              />
            </div>
          </div>

          {/* Guarantee Banner */}
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-medium flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <span>{block.guaranteeText}</span>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

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

          {/* Big Order Confirmation Button */}
          <button
            type="submit"
            disabled={Boolean(TURNSTILE_SITE_KEY) && !turnstileToken}
            className="w-full py-4 px-6 text-white font-black text-lg md:text-xl rounded-2xl shadow-xl hover:shadow-2xl active:scale-98 disabled:opacity-60 transition transform flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: theme.primaryColor || '#059669' }}
          >
            <span>{block.buttonText}</span>
            {isRtl ? <ArrowLeft className="w-6 h-6" /> : <ArrowRight className="w-6 h-6" />}
          </button>
        </form>
      </div>
    </section>
  );
};
