import React, { useState, useEffect } from 'react';
import { CodFormBlock, ThemeConfig } from '../../types/landingPage';
import {
  CheckCircle2,
  ShieldCheck,
  Truck,
  PhoneCall,
  MapPin,
  User,
  FileText,
  Sparkles,
  Loader2,
  Globe,
} from 'lucide-react';
import { trackSubmitCodOrder } from '../../utils/analytics';
import { getCountriesSorted, getCitiesForCountry, resolveCanonicalCountryKey } from '../../utils/countriesCities';

interface Props {
  block: CodFormBlock;
  theme: ThemeConfig;
  pageSlug?: string;
  pageTitle?: string;
  onOrderConfirmed?: (data: any) => void;
}

export const CodFormBlockView: React.FC<Props> = ({
  block,
  theme,
  pageSlug,
  pageTitle,
  onOrderConfirmed,
}) => {
  const [selectedBundle, setSelectedBundle] = useState(
    block.bundles.find((b) => b.popular)?.id || block.bundles[0]?.id || ''
  );

  const showCascadingDropdowns =
    block.showCountryCityDropdowns ?? block.fields?.showCountryCityDropdowns ?? true;
  const configuredDefaultCountry = resolveCanonicalCountryKey(
    block.defaultCountry ?? block.fields?.defaultCountry ?? ''
  );

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<string>(configuredDefaultCountry);
  const [city, setCity] = useState<string>('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Sync defaultCountry if merchant updates it in PropertiesSidebar
  useEffect(() => {
    if (configuredDefaultCountry && configuredDefaultCountry !== country) {
      setCountry(configuredDefaultCountry);
      setCity('');
    }
  }, [configuredDefaultCountry]);

  const sortedCountries = getCountriesSorted();
  const availableCities = country ? getCitiesForCountry(country) : [];

  const activeBundle = block.bundles.find((b) => b.id === selectedBundle) || block.bundles[0];
  const totalAmount = (activeBundle ? activeBundle.price : 0) + block.shippingCost;

  const radiusMap: Record<string, string> = {
    none: 'rounded-none',
    sm: 'rounded-md',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-3xl',
  };
  const activeRadiusClass = radiusMap[theme.borderRadius || 'lg'] || 'rounded-2xl';

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    setCity('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    if (block.fields.requireCity && showCascadingDropdowns && (!country || !city)) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageSlug: pageSlug || 'builder-preview',
          pageTitle: pageTitle || block.title,
          productName: pageTitle || activeBundle?.name || block.title,
          customerName: fullName.trim() || 'Customer',
          phone: phone.trim(),
          customerPhone: phone.trim(),
          country: country || 'Morocco',
          customerCountry: country || 'Morocco',
          city: city || 'Casablanca',
          customerCity: city || 'Casablanca',
          address,
          customerAddress: address,
          notes: note,
          customerNotes: note,
          quantity: activeBundle?.quantity || 1,
          price: totalAmount,
          currency: block.currency || 'MAD',
          bundleName: activeBundle?.name,
          bundlePrice: totalAmount,
        }),
      });
      const json = await res.json();
      if (json.success && (json.orderId || json.order?.id)) {
        setOrderId(json.orderId || json.order?.id);
      }
      onOrderConfirmed?.({
        orderId: json.orderId || json.order?.id || `ORD-${Date.now()}`,
        customerName: fullName.trim() || 'Customer',
        customerPhone: phone.trim(),
        customerCountry: country || 'Morocco',
        customerCity: city || 'Casablanca',
        customerAddress: address,
        customerNote: note,
        bundle: activeBundle,
        totalPrice: totalAmount,
      });
      trackSubmitCodOrder(totalAmount, block.currency || 'MAD', activeBundle?.name || block.title);
    } catch {
      // Fallback for offline preview
    } finally {
      setSubmitting(false);
      setOrderSubmitted(true);
    }
  };

  return (
    <section id="cod-checkout-section" className="py-12 md:py-16 px-4 max-w-3xl mx-auto">
      <div
        className={`bg-white border-2 shadow-2xl overflow-hidden transition-all ${activeRadiusClass}`}
        style={{ borderColor: theme.primaryColor }}
      >
        {/* Top Header Banner */}
        <div
          style={{ backgroundColor: theme.primaryColor }}
          className="p-6 text-white text-center relative overflow-hidden"
        >
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cash on Delivery Checkout</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold">{block.title}</h2>
          <p className="text-white/90 text-sm md:text-base mt-1.5 max-w-xl mx-auto">
            {block.subtitle}
          </p>
        </div>

        {orderSubmitted ? (
          <div className="p-8 md:p-12 text-center space-y-4">
            <div
              style={{
                backgroundColor: `${theme.primaryColor}15`,
                color: theme.primaryColor,
              }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            >
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">
              Order Received Successfully!
            </h3>
            {orderId && (
              <div className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold text-xs px-3 py-1.5 rounded-lg">
                Order Reference: {orderId}
              </div>
            )}
            <p className="text-slate-600 max-w-md mx-auto">
              Thank you <span className="font-bold text-slate-800">{fullName}</span>! Our confirmation team will call you shortly on{' '}
              <span className="font-bold text-slate-800" dir="ltr">
                {phone}
              </span>{' '}
              {city ? (
                <>
                  to confirm delivery to{' '}
                  <span className="font-bold text-slate-800">
                    {city}
                    {country ? `, ${country}` : ''}
                  </span>
                  .
                </>
              ) : (
                'to confirm your order.'
              )}
            </p>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-md mx-auto text-sm flex justify-between items-center font-bold text-slate-800">
              <span>Total to pay on delivery:</span>
              <span style={{ color: theme.primaryColor }} className="text-lg">
                {totalAmount} {block.currency}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOrderSubmitted(false)}
              className="text-xs text-slate-400 underline hover:text-slate-600 mt-4 cursor-pointer"
            >
              Reset preview form
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            {/* Step 1: Bundle / Quantity Offers */}
            <div>
              <label className="block text-sm font-extrabold uppercase tracking-wider text-slate-700 mb-3">
                1. Choose Your Offer Bundle:
              </label>
              <div className="space-y-3">
                {block.bundles.map((bundle) => {
                  const isSelected = bundle.id === selectedBundle;
                  const savings = Math.max(0, bundle.originalPrice - bundle.price);
                  return (
                    <div
                      key={bundle.id}
                      onClick={() => setSelectedBundle(bundle.id)}
                      style={{
                        borderColor: isSelected ? theme.primaryColor : '#e2e8f0',
                        backgroundColor: isSelected ? `${theme.primaryColor}08` : '#ffffff',
                      }}
                      className={`relative border-2 p-4 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-4 hover:border-slate-300`}
                    >
                      {bundle.badge && (
                        <span
                          style={{
                            backgroundColor: bundle.popular ? theme.accentColor : theme.primaryColor,
                          }}
                          className="absolute -top-2.5 right-4 text-white text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-sm"
                        >
                          {bundle.badge}
                        </span>
                      )}

                      <div className="flex items-center gap-3.5">
                        <div
                          style={{
                            borderColor: isSelected ? theme.primaryColor : '#cbd5e1',
                            backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                          }}
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-base">{bundle.name}</div>
                          {savings > 0 && (
                            <div className="text-xs font-semibold text-emerald-600">
                              Save {savings} {block.currency} Today
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          style={{ color: isSelected ? theme.primaryColor : '#0f172a' }}
                          className="font-black text-lg md:text-xl"
                        >
                          {bundle.price} {block.currency}
                        </div>
                        {bundle.originalPrice > bundle.price && (
                          <div className="text-xs text-slate-400 line-through font-medium">
                            {bundle.originalPrice} {block.currency}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Customer Shipping Information */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <label className="block text-sm font-extrabold uppercase tracking-wider text-slate-700">
                2. Shipping Information:
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Phone Number (For Confirmation) *
                  </label>
                  <div className="relative">
                    <PhoneCall className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="06 XX XX XX XX"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-medium transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Cascading Country & City Dropdowns */}
              {block.fields.requireCity && (
                <>
                  {showCascadingDropdowns ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Country Select */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          Country (الدولة) *
                        </label>
                        <div className="relative">
                          <Globe className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 pointer-events-none" />
                          <select
                            required
                            aria-label="Country"
                            value={country}
                            onChange={(e) => handleCountryChange(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-medium bg-white transition-all"
                          >
                            <option value="">-- Select Country / اختر الدولة --</option>
                            {sortedCountries.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.flag} {c.nameAr}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* City Select (Disabled until Country is selected, Alphabetically sorted) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">
                          City (المدينة) *
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 pointer-events-none" />
                          <select
                            required
                            aria-label="City"
                            disabled={!country}
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-medium bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
                          >
                            <option value="">
                              {country
                                ? `-- Select City in ${country} (${availableCities.length}) --`
                                : '-- Select Country First / اختر الدولة أولاً --'}
                            </option>
                            {availableCities.map((cityName) => (
                              <option key={cityName} value={cityName}>
                                {cityName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">
                        City *
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 pointer-events-none" />
                        {block.fields.defaultCities.length > 0 ? (
                          <select
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-medium bg-white transition-all"
                          >
                            <option value="">Select your city...</option>
                            {block.fields.defaultCities.map((c, idx) => (
                              <option key={idx} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Enter your city"
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-medium transition-all"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Full Address */}
              {block.fields.requireAddress && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Full Delivery Address *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street, neighborhood, house/building number"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-medium transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Delivery Note */}
              {block.fields.requireNote && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Delivery Notes (Optional)
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute top-3.5 left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Preferred delivery time or landmark"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 outline-none text-sm font-medium transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary Box */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Selected Offer:</span>
                <span className="font-semibold text-slate-900">{activeBundle?.name}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Home Delivery:</span>
                <span className="font-bold text-emerald-600">
                  {block.shippingCost === 0 ? 'FREE' : `${block.shippingCost} ${block.currency}`}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-base font-black text-slate-900">
                <span>Total (Pay on Delivery):</span>
                <span style={{ color: theme.primaryColor }} className="text-xl">
                  {totalAmount} {block.currency}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: theme.primaryColor }}
              className={`w-full py-4 px-6 text-white font-black text-lg shadow-xl hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 ${activeRadiusClass}`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Order...</span>
                </>
              ) : (
                <>
                  <Truck className="w-5 h-5" />
                  <span>{block.buttonText}</span>
                </>
              )}
            </button>

            {/* Guarantee Footer */}
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 text-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{block.guaranteeText}</span>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};
