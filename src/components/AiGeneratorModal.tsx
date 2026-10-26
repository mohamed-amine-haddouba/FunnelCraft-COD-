import React, { useState } from 'react';
import { LandingPageData } from '../types/landingPage';
import {
  Sparkles,
  X,
  Wand2,
  AlertCircle,
  Link2,
  Globe,
  ArrowRight,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApplyGeneratedPage: (data: LandingPageData) => void;
}

const PRESET_IDEAS = [
  {
    name: 'AuraGlow 7-Color LED Facial Mask',
    niche: 'Beauty & Skincare',
    lang: 'en' as const,
    hook: '50% OFF + Free Cash on Delivery Nationwide',
  },
  {
    name: 'SpinePro Orthopedic Back Decompressor',
    niche: 'Health & Pain Relief',
    lang: 'fr' as const,
    hook: 'Soulagement immédiat du dos + Paiement au livreur',
  },
  {
    name: 'سيروم الزيوت الملكية الأصلي لإنبات وتكثيف الشعر',
    niche: 'العناية بالشعر والجمال',
    lang: 'ar' as const,
    hook: 'خصم 50% والشحن بالمجان لجميع المدن والدفع عند الاستلام',
  },
  {
    name: 'TurboBlend 360 Portable USB Juicer',
    niche: 'Kitchen Gadgets',
    lang: 'en' as const,
    hook: 'Buy 1 Get 1 50% Off + Free Recipe Guide',
  },
];

const SAMPLE_URLS = [
  {
    label: 'AliExpress (Smart Projector)',
    url: 'https://aliexpress.com/item/1005006321948123-Mini-4K-Smart-Android-Projector.html',
    platform: 'AliExpress',
  },
  {
    label: 'Shopify / YouCan (Beauty Serum)',
    url: 'https://beautystore.com/products/royal-hair-growth-serum',
    platform: 'Shopify / YouCan',
  },
  {
    label: 'Alibaba (Orthopedic Pillow)',
    url: 'https://alibaba.com/product-detail/Memory-Foam-Orthopedic-Cervical-Pillow.html',
    platform: 'Alibaba',
  },
];

export const AiGeneratorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onApplyGeneratedPage,
}) => {
  // Mode: manual prompt vs. URL import
  const [activeTab, setActiveTab] = useState<'url' | 'manual'>('url');

  // URL Import State
  const [productUrl, setProductUrl] = useState('');
  const [urlLanguage, setUrlLanguage] = useState<'ar' | 'fr' | 'en'>('ar');
  const [urlOfferAngle, setUrlOfferAngle] = useState('خصم 50% حصري + شحن مجاني والدفع عند الاستلام');

  // Manual Mode State
  const [productName, setProductName] = useState('');
  const [niche, setNiche] = useState('Beauty & Skincare');
  const [language, setLanguage] = useState<'en' | 'fr' | 'ar'>('ar');
  const [targetAudience, setTargetAudience] = useState('');
  const [offerAngle, setOfferAngle] = useState('50% OFF Flash Sale + Free Cash on Delivery');

  // Execution states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Derive platform name from entered URL
  const getDetectedPlatform = (raw: string) => {
    const lower = (raw || '').toLowerCase();
    if (lower.includes('aliexpress.')) return 'AliExpress';
    if (lower.includes('alibaba.')) return 'Alibaba';
    if (lower.includes('youcan.')) return 'YouCan';
    if (lower.includes('shopify') || lower.includes('/products/')) return 'Shopify / E-Commerce';
    if (lower.includes('amazon.')) return 'Amazon';
    if (raw.trim().length > 8) return 'متجر إلكتروني عام (E-Commerce)';
    return null;
  };

  const detectedPlatform = getDetectedPlatform(productUrl);

  const handleApplyPreset = (idea: typeof PRESET_IDEAS[0]) => {
    setProductName(idea.name);
    setNiche(idea.niche);
    setLanguage(idea.lang);
    setOfferAngle(idea.hook);
  };

  const handleApplySampleUrl = (sample: typeof SAMPLE_URLS[0]) => {
    setProductUrl(sample.url);
  };

  // Submit manual prompt generation
  const handleManualGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setErrorMessage('Please enter your product name.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((s) => (s < 3 ? s + 1 : s));
    }, 900);

    try {
      const response = await fetch('/api/generate-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          niche,
          language,
          targetAudience,
          offerAngle,
        }),
      });

      const json = await response.json();
      clearInterval(stepInterval);

      if (json.success && json.data) {
        onApplyGeneratedPage(json.data);
        onClose();
      } else {
        throw new Error(json.error || 'Failed to generate page.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setErrorMessage(err.message || 'Error communicating with AI engine. Check server logs.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit URL import generation
  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productUrl.trim()) {
      setErrorMessage('يرجى لصق رابط المنتج أولاً (AliExpress / Alibaba / متجر شوبيفاي أو يوكان).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((s) => (s < 3 ? s + 1 : s));
    }, 1100);

    try {
      const response = await fetch('/api/ai/import-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUrl: productUrl.trim(),
          language: urlLanguage,
          offerAngle: urlOfferAngle,
        }),
      });

      const json = await response.json();
      clearInterval(stepInterval);

      if (json.success && json.data) {
        onApplyGeneratedPage(json.data);
        onClose();
      } else {
        throw new Error(json.error || json.message || 'فشل استيراد المنتج من الرابط. تأكد من صحة الرابط.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة الرابط عبر الذكاء الاصطناعي.');
    } finally {
      setIsLoading(false);
    }
  };

  const manualStepLabels = [
    'Analyzing product niche & psychological buying triggers...',
    'Generating high-converting copywriting & hook headline...',
    'Structuring COD bundles, pricing discount, and reviews...',
    'Compiling responsive block schema...',
  ];

  const urlStepLabels = [
    'جاري الاتصال بالرابط وفحص صفحة المنتج والميتا-داتا...',
    'جاري استخراج الصور عالية الدقة والأسعار والمواصفات...',
    'صياغة نصوص الدفع عند الاستلام بالدارجة المغربية والعربية...',
    'بناء شجرة الكتل التفاعلية وتجهيز صفحة الهبوط الكاملة...',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 text-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -start-24 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -end-24 w-60 h-60 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 end-5 w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition disabled:opacity-30 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Sparkles className="w-5 h-5 text-amber-200" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <span>CodWorth AI Studio</span>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase">
                Gemini 2.5 Pro
              </span>
            </h3>
            <p className="text-xs text-gray-400">
              توليد صفحات هبوط مخصصة للدفع عند الاستلام (COD) بنقرة واحدة من أي رابط أو وصف.
            </p>
          </div>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-gray-800/90 border border-gray-700/80 rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            disabled={isLoading}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'url'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Link2 className="w-4 h-4 text-emerald-300" />
            <span>🔗 استيراد من رابط (AliExpress / Shopify)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            disabled={isLoading}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4 text-emerald-300" />
            <span>✍️ إنشاء يدوي (وصف المنتج)</span>
          </button>
        </div>

        {/* TAB 1: IMPORT FROM URL */}
        {activeTab === 'url' && (
          <form onSubmit={handleUrlImport} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-200">
                  رابط المنتج (Product URL) *
                </label>
                {detectedPlatform && (
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span>تم التعرف: {detectedPlatform}</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="url"
                  required
                  disabled={isLoading}
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://aliexpress.com/item/... أو رابط متجر Shopify / YouCan"
                  className="w-full px-4 py-3 pe-10 rounded-xl bg-gray-800/90 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition"
                />
                <div className="absolute end-3 top-3 text-gray-500">
                  <Link2 className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Quick Demo URLs */}
            <div>
              <span className="block text-[11px] text-gray-400 mb-1.5 font-medium">
                أو جرب روابط تجريبية سريعة:
              </span>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_URLS.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplySampleUrl(sample)}
                    disabled={isLoading}
                    className="text-[11px] font-semibold bg-gray-800 hover:bg-gray-700/80 border border-gray-700 px-2.5 py-1 rounded-lg text-gray-300 hover:text-emerald-300 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⚡ {sample.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language & Offer Angle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  لغة صفحة الهبوط المستهدفة
                </label>
                <select
                  value={urlLanguage}
                  disabled={isLoading}
                  onChange={(e) => setUrlLanguage(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800/90 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition font-semibold"
                >
                  <option value="ar">🇲🇦 الدارجة المغربية / العربية (RTL)</option>
                  <option value="fr">🇫🇷 الفرنسية (Français - LTR)</option>
                  <option value="en">🇺🇸 الإنجليزية (English - LTR)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  زاوية العرض والتخفيض
                </label>
                <input
                  type="text"
                  disabled={isLoading}
                  value={urlOfferAngle}
                  onChange={(e) => setUrlOfferAngle(e.target.value)}
                  placeholder="مثال: خصم 50% + شحن مجاني والدفع عند الاستلام"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800/90 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition"
                />
              </div>
            </div>

            {/* Live extraction feature perks */}
            <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-2xl flex items-center gap-3 text-xs text-emerald-300">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-[11px] leading-relaxed">
                يقوم المحرك آلياً بسحب صور المنتج الأصلية، توليد باقات الأسعار (Bundle Offers)، وصياغة نصوص إقناعية تحفز الزبون على الطلب الفوري.
              </p>
            </div>

            {/* Loading Step Animation */}
            {isLoading && (
              <div className="p-4 bg-gray-800/90 border border-emerald-500/30 rounded-2xl space-y-3">
                <div className="flex items-center gap-3" dir="rtl">
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
                  <span className="text-xs font-bold text-emerald-300">
                    {urlStepLabels[loadingStep] || 'جاري تحليل المنتج، سحب الصور، وتوليد صفحة الهبوط...'}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${((loadingStep + 1) / urlStepLabels.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-900/40 border border-red-700 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-600 to-teal-700 hover:from-emerald-600 hover:to-teal-800 active:scale-98 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isLoading
                    ? 'جاري سحب المنتج وتوليد الصفحة بالذكاء الاصطناعي...'
                    : 'تحليل الرابط وتوليد صفحة الهبوط الآن 🚀'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: MANUAL PROMPT */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualGenerate} className="space-y-4">
            {/* Quick Suggestion Chips */}
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                منتجات مقترحة سريعة:
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_IDEAS.map((idea, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(idea)}
                    disabled={isLoading}
                    dir={idea.lang === 'ar' ? 'rtl' : 'ltr'}
                    className="text-[11px] font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-xl transition text-gray-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{idea.lang === 'ar' ? '🇲🇦' : idea.lang === 'fr' ? '🇫🇷' : '🇺🇸'}</span>
                    <span className="max-w-[150px] truncate">{idea.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                اسم المنتج (Product Name) *
              </label>
              <input
                type="text"
                required
                disabled={isLoading}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="مثال: سيروم الزيوت الملكية لإنبات الشعر، خلاط محمول..."
                className="w-full px-4 py-3 rounded-xl bg-gray-800/90 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  المجال / التصنيف (Niche)
                </label>
                <select
                  value={niche}
                  disabled={isLoading}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800/90 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition"
                >
                  <option value="Beauty & Skincare">الجمال والعناية بالبشرة (Beauty)</option>
                  <option value="Health & Pain Relief">الصحة والراحة البدنية (Health)</option>
                  <option value="Kitchen & Home Gadgets">المطبخ والمنزل (Kitchen & Home)</option>
                  <option value="Smart Gadgets & Electronics">إلكترونيات ذكية (Gadgets)</option>
                  <option value="Fitness & Weight Loss">الرياضة والرشاقة (Fitness)</option>
                  <option value="Car & Tools">السيارات والأدوات (Car & Tools)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  اللغة المستهدفة
                </label>
                <select
                  value={language}
                  disabled={isLoading}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800/90 border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition font-semibold"
                >
                  <option value="ar">العربية / الدارجة (RTL) - المغرب والخليج</option>
                  <option value="fr">Français (FR/EU) - LTR</option>
                  <option value="en">English (US/UK) - LTR</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                زاوية العرض والندرة (Offer Angle)
              </label>
              <input
                type="text"
                disabled={isLoading}
                value={offerAngle}
                onChange={(e) => setOfferAngle(e.target.value)}
                placeholder="e.g. 50% OFF Flash Sale + Free Cash on Delivery"
                className="w-full px-4 py-2.5 rounded-xl bg-gray-800/90 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs transition"
              />
            </div>

            {/* Loading States Animation */}
            {isLoading && (
              <div className="p-4 bg-gray-800/80 border border-gray-700 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />
                  <span className="text-xs font-bold text-emerald-300">
                    {manualStepLabels[loadingStep] || 'Generating your landing page...'}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${((loadingStep + 1) / manualStepLabels.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-900/40 border border-red-700 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 hover:from-emerald-600 hover:to-indigo-700 active:scale-98 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                <span>{isLoading ? 'جاري بناء صفحة الهبوط...' : 'توليد صفحة الهبوط بالكامل'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
