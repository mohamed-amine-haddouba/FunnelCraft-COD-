import React, { useState } from 'react';
import { LandingPageData, ScrapedProduct } from '../types/landingPage';
import {
  Sparkles,
  X,
  Loader2,
  Wand2,
  Globe,
  Tag,
  Users,
  Link2,
  ShoppingBag,
  CheckCircle2,
  Layers,
  ShieldCheck,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { trackGenerateFunnel } from '../utils/analytics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGenerated?: (data: LandingPageData) => void;
  onApplyGeneratedPage?: (data: LandingPageData) => void | Promise<void>;
  token?: string | null;
  onUpgradeRequired?: (message: string) => void;
  defaultTab?: 'url' | 'prompt';
}

interface ArchitectAnalysisPreview {
  productName: string;
  tagline: string;
  badge: string;
  heroImages?: string[];
  price: {
    originalPrice: string | number;
    sellingPrice: string | number;
    currency: string;
  };
  features: Array<{ title: string; description: string; icon?: string }>;
  specifications: Array<{ label: string; value: string }>;
  faq: Array<{ question: string; answer: string }>;
}

/**
 * Converts a ScrapedProduct (from /api/scrape-product) into a complete LandingPageData object,
 * populating the Hero Block with ALL extracted images, full description, features, and specifications.
 */
export function buildLandingPageFromScrapedProduct(
  product: ScrapedProduct,
  language: string = 'ar-ma'
): LandingPageData {
  const isRtl = language === 'ar' || language === 'ar-ma';
  const isFr = language === 'fr';
  const unitPrice = product.price || 249;
  const origPrice = product.originalPrice || Math.round(unitPrice * 1.45);
  const currency = product.currency || 'MAD';
  const allImages =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80',
        ];

  const featuresList =
    Array.isArray(product.features) && product.features.length > 0
      ? product.features
      : [
          isRtl
            ? 'جودة أصلية ممتازة مضمونة 100% مع شهادة مطابقة المعايير'
            : '100% Certified original commercial-grade build quality',
          isRtl
            ? 'توصيل سريع وآمن خلال 24 إلى 48 ساعة لجميع المدن'
            : 'Fast 24-48h doorstep delivery nationwide',
          isRtl
            ? 'الدفع نقداً عند الاستلام مع إمكانية المعاينة قبل الدفع'
            : 'Pay cash on delivery after inspecting your package',
        ];

  const specsList = Array.isArray(product.specifications) ? product.specifications : [];

  return {
    id: `scraped-funnel-${Date.now()}`,
    title: product.title || 'منتج احترافي عالي الجودة',
    language: isRtl ? 'ar' : isFr ? 'fr' : 'en',
    direction: isRtl ? 'rtl' : 'ltr',
    scrapedData: product,
    theme: {
      primaryColor: '#059669',
      secondaryColor: '#d1fae5',
      accentColor: '#ea580c',
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      fontFamily: isRtl ? 'Cairo' : 'Inter',
      fontSize: 'base',
      borderRadius: 'lg',
      sectionSpacing: 'normal',
    },
    blocks: [
      {
        id: `promo-${Date.now()}`,
        type: 'promo-bar',
        text: isRtl
          ? `🔥 تخفيض حصري على ${product.title.slice(0, 42)} — الشحن مجاني والدفع عند الاستلام!`
          : `🔥 Flash Sale on ${product.title.slice(0, 42)} — Free Cash on Delivery!`,
        countdownMinutes: 15,
        showTimer: true,
        stockWarning: isRtl ? 'الكمية المتبقية في المستودع محدودة!' : 'Limited warehouse stock available!',
        bgColor: '#064e3b',
        textColor: '#ffffff',
        isSticky: true,
      },
      {
        id: `hero-${Date.now()}`,
        type: 'hero',
        badge: isRtl
          ? `⭐ مستورد من ${product.platform || 'المتجر الرسمي'} • الأكثر مبيعاً`
          : `⭐ Imported from ${product.platform || 'Official Store'} • Best Seller`,
        headline: product.title,
        subheadline: product.description,
        description: product.description,
        features: featuresList,
        specifications: specsList,
        priceOriginal: origPrice,
        priceDiscounted: unitPrice,
        currency,
        ctaText: isRtl ? 'اطلب الآن — الدفع نقداً عند الاستلام 🚚' : 'Order Now — Cash on Delivery 🚚',
        ctaSubtext: isRtl
          ? `📦 ${allImages.length} صور عالية الدقة • توصيل مجاني • ضمان سنة كاملة`
          : `📦 ${allImages.length} High-Res Photos • Free Delivery • 1-Year Warranty`,
        images: allImages,
        rating: 4.9,
        reviewCount: 480,
        trustPoints: featuresList.slice(0, 4),
      },
      {
        id: `feat-${Date.now()}`,
        type: 'features',
        title: isRtl ? 'المميزات والمواصفات التقنية الكاملة' : 'Key Features & Technical Specifications',
        subtitle: isRtl
          ? 'تم استخراج كافة المميزات والمواصفات الأصلية للمنتج'
          : 'Full extracted product features and specifications',
        layout: 'grid-3',
        items: [
          ...featuresList.slice(0, 3).map((feat, idx) => ({
            icon: idx === 0 ? 'Zap' : idx === 1 ? 'Shield' : 'Truck',
            title: isRtl ? `ميزة أساسية ${idx + 1}` : `Key Highlight ${idx + 1}`,
            description: feat,
          })),
          ...specsList.slice(0, 3).map((spec) => ({
            icon: 'Award',
            title: spec.label,
            description: spec.value,
          })),
        ].slice(0, 6),
      },
      {
        id: `cod-${Date.now()}`,
        type: 'cod-form',
        title: isRtl
          ? 'استمارة الطلب السريع (الدفع عند الاستلام)'
          : 'Express Cash on Delivery Order Form',
        subtitle: isRtl
          ? 'أدخل اسمك ورقم هاتفك واختر دولتك ومدينتك لإتمام الطلب فوراً'
          : 'Enter your contact details and select your country & city below',
        currency,
        shippingCost: 0,
        guaranteeText: isRtl
          ? 'لا تدفع أي درهم حتى تستلم المنتج وتفحصه بنفسك أمام الموزع'
          : 'Zero risk — inspect your package upon delivery before paying',
        buttonText: isRtl
          ? 'تأكيد الطلب الآن (الدفع عند الاستلام) ➔'
          : 'Confirm COD Order Now ➔',
        showCountryCityDropdowns: true,
        defaultCountry: 'Morocco',
        fields: {
          requireAddress: true,
          requireCity: true,
          requireNote: false,
          showCountryCityDropdowns: true,
          defaultCountry: 'Morocco',
          defaultCities: ['Casablanca', 'Rabat', 'Marrakech', 'Tangier', 'Fes', 'Agadir'],
        },
        bundles: (product.bundles || []).map((b, idx) => ({
          id: `bundle-${idx + 1}`,
          name: b.label,
          quantity: b.quantity,
          price: b.price,
          originalPrice: b.originalPrice,
          badge: b.badge,
          popular: b.quantity === 2,
        })),
      },
      {
        id: `faq-${Date.now()}`,
        type: 'faq',
        title: isRtl ? 'الأسئلة الشائعة حول المنتج والتوصيل' : 'Frequently Asked Questions',
        subtitle: isRtl ? 'إجابات واضحة ومطمئنة قبل تأكيد طلبك' : 'Everything you need to know before ordering',
        items: (product.faqs || []).map((f, idx) => ({
          id: `faq-item-${idx + 1}`,
          question: f.question,
          answer: f.answer,
        })),
      },
    ],
  };
}

export const AiGeneratorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onGenerated,
  onApplyGeneratedPage,
  token,
  onUpgradeRequired,
  defaultTab = 'url',
}) => {
  const emitGeneratedPage = (data: LandingPageData) => {
    if (onGenerated) onGenerated(data);
    if (onApplyGeneratedPage) void onApplyGeneratedPage(data);
  };
  const [activeTab, setActiveTab] = useState<'url' | 'prompt'>(defaultTab);

  // Tab 1: Import from URL / Raw Data
  const [productUrl, setProductUrl] = useState('https://www.aliexpress.com/item/10050062148920.html');
  const [rawProductData, setRawProductData] = useState('');
  const [useRawData, setUseRawData] = useState(false);
  const [urlLanguage, setUrlLanguage] = useState<'ar-ma' | 'ar' | 'fr' | 'en'>('ar-ma');
  const [urlOfferAngle, setUrlOfferAngle] = useState('تخفيض 50% اليوم فقط + توصيل مجاني والدفع عند الاستلام');
  const [lastAnalysis, setLastAnalysis] = useState<ArchitectAnalysisPreview | null>(null);
  const [scrapedPreview, setScrapedPreview] = useState<ScrapedProduct | null>(null);

  // Tab 2: Manual AI Prompt
  const [productName, setProductName] = useState('جهاز مساج الرقبة والظهر الذكي');
  const [niche, setNiche] = useState('الصحة والعناية الشخصية');
  const [language, setLanguage] = useState<'ar' | 'fr' | 'en'>('ar');
  const [targetAudience, setTargetAudience] = useState('الموظفون، السائقون، ومن يعانون من آلام الظهر والرقبة');
  const [offerAngle, setOfferAngle] = useState('تخفيض 50% + شحن مجاني والدفع عند الاستلام');

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleImportFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!useRawData && !productUrl.trim()) {
      setError('يرجى إدخال رابط المنتج (AliExpress, Shopify, YouCan, Amazon).');
      return;
    }
    if (useRawData && !rawProductData.trim()) {
      setError('يرجى لصق نص أو تفاصيل المنتج الخام.');
      return;
    }

    setLoading(true);
    setError('');
    setLastAnalysis(null);
    setScrapedPreview(null);
    setLoadingStage(
      useRawData
        ? 'جاري تحليل النص الخام واستخراج المواصفات والصور...'
        : 'جاري فحص الرابط عبر 3 طبقات (JSON-LD + معرض الصور DOM + Gemini AI)...'
    );

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const stageTimer = setTimeout(() => {
        setLoadingStage('جاري بناء Hero Block بمعرض الصور الكامل والوصف والمواصفات...');
      }, 1500);

      // First run deep 3-layer scraper if a URL is provided
      let deepScraped: ScrapedProduct | null = null;
      if (!useRawData && productUrl.trim()) {
        try {
          const scrapeRes = await fetch('/api/scrape-product', {
            method: 'POST',
            headers,
            body: JSON.stringify({ url: productUrl.trim() }),
          });
          if (scrapeRes.ok) {
            const scrapeJson = await scrapeRes.json();
            if (scrapeJson && (scrapeJson.product || scrapeJson.title)) {
              deepScraped = (scrapeJson.product || scrapeJson) as ScrapedProduct;
              setScrapedPreview(deepScraped);
            }
          }
        } catch {
          // Continue to /api/ai/import-from-url fallback
        }
      }

      const res = await fetch('/api/ai/import-from-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productUrl: useRawData ? undefined : productUrl.trim(),
          rawProductData: useRawData ? rawProductData.trim() : undefined,
          language: urlLanguage,
          offerAngle: urlOfferAngle,
        }),
      });

      clearTimeout(stageTimer);
      const json = await res.json();

      if (res.status === 403 && json.error === 'LIMIT_REACHED') {
        onClose();
        if (onUpgradeRequired) onUpgradeRequired(json.message);
        return;
      }

      if (json.success && json.data) {
        const pageData = json.data as LandingPageData;
        const extractedMeta = (deepScraped || json.extractedMeta) as ScrapedProduct | undefined;

        // Guarantee Hero Block receives ALL extracted images, full description, features, and specifications
        if (extractedMeta) {
          pageData.scrapedData = extractedMeta;
          const allUniqueImages = Array.from(
            new Set([
              ...(extractedMeta.images || []),
              ...(json.architectAnalysis?.heroImages || []),
            ])
          ).filter(Boolean);

          pageData.blocks = pageData.blocks.map((block) => {
            if (block.type === 'hero') {
              return {
                ...block,
                images: allUniqueImages.length > 0 ? allUniqueImages : block.images,
                description: extractedMeta.description || block.description || block.subheadline,
                subheadline: extractedMeta.description || block.subheadline,
                features:
                  extractedMeta.features && extractedMeta.features.length > 0
                    ? extractedMeta.features
                    : block.features,
                specifications:
                  extractedMeta.specifications && extractedMeta.specifications.length > 0
                    ? extractedMeta.specifications
                    : block.specifications,
              };
            }
            if (block.type === 'cod-form') {
              return {
                ...block,
                showCountryCityDropdowns: true,
                defaultCountry: 'Morocco',
                fields: {
                  ...block.fields,
                  showCountryCityDropdowns: true,
                  defaultCountry: 'Morocco',
                },
              };
            }
            return block;
          });
        }

        if (json.architectAnalysis) {
          setLastAnalysis(json.architectAnalysis);
        }
        trackGenerateFunnel(urlLanguage, 'url_import');
        emitGeneratedPage(pageData);
        onClose();
      } else if (deepScraped) {
        // Fallback to direct 3-layer scraped product builder
        const builtPage = buildLandingPageFromScrapedProduct(deepScraped, urlLanguage);
        trackGenerateFunnel(urlLanguage, 'url_import_direct');
        emitGeneratedPage(builtPage);
        onClose();
      } else {
        setError(json.error || 'فشل استيراد بيانات المنتج. تأكد من صحة الرابط.');
      }
    } catch {
      setError('حدث خطأ في الاتصال بالخادم أثناء تحليل المنتج.');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleManualGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError('يرجى إدخال اسم المنتج');
      return;
    }

    setLoading(true);
    setError('');
    setLoadingStage('جاري كتابة النصوص التسويقية وتصميم البلوكات...');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/generate-page', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productName,
          niche,
          language,
          targetAudience,
          offerAngle,
        }),
      });

      const json = await res.json();

      if (res.status === 403 && json.error === 'LIMIT_REACHED') {
        onClose();
        if (onUpgradeRequired) onUpgradeRequired(json.message);
        return;
      }

      if (json.success && json.data) {
        trackGenerateFunnel(language, niche);
        emitGeneratedPage(json.data);
        onClose();
      } else {
        setError('تعذر توليد الصفحة، يرجى المحاولة مرة أخرى.');
      }
    } catch {
      setError('حدث خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div
        dir="rtl"
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-6"
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-900 via-teal-900 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 left-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 block">
                3-Layer Deep Product Scraper & COD Funnel Architect
              </span>
              <h2 className="text-xl font-black">استيراد ذكي للمنتج وبناء صفحة الهبوط</h2>
            </div>
          </div>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            استخرج جميع صور المعرض عالية الدقة (JSON-LD + DOM Gallery + Gemini AI) والوصف الكامل والمواصفات بضغطة زر.
          </p>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 mt-5 bg-slate-950/40 p-1.5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab('url');
                setError('');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'url'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Link2 className="w-4 h-4" />
              <span>استيراد من رابط منتج (URL)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('prompt');
                setError('');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'prompt'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>توليد بوصف المنتج</span>
            </button>
          </div>
        </div>

        {/* Body */}
        {activeTab === 'url' ? (
          <form onSubmit={handleImportFromUrl} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Supported Platforms Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 rounded-xl text-xs">
              <span className="font-bold text-slate-600 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                استخراج متعدد الطبقات (JSON-LD + معرض الصور + Gemini):
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {['AliExpress', 'Shopify', 'YouCan', 'Amazon', 'WooCommerce'].map((plat) => (
                  <span
                    key={plat}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-bold text-slate-700 text-[11px]"
                  >
                    {plat}
                  </span>
                ))}
              </div>
            </div>

            {/* Toggle between URL or Raw Product Text */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-emerald-600" />
                  {useRawData ? 'بيانات أو نص المنتج الخام (Raw Text / HTML)' : 'رابط صفحة المنتج (Product URL)'}
                </label>
                <button
                  type="button"
                  onClick={() => setUseRawData(!useRawData)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                >
                  {useRawData ? 'استخدام رابط URL بدلاً من ذلك' : 'أو الصق نص/مواصفات المنتج يدوياً'}
                </button>
              </div>

              {!useRawData ? (
                <div className="space-y-2">
                  <input
                    type="url"
                    dir="ltr"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    placeholder="https://www.aliexpress.com/item/... or https://store.myshopify.com/products/..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-mono text-left bg-slate-50/50"
                  />
                  {/* Quick Demo Preset Links */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400 font-semibold">روابط تجريبية سريعة:</span>
                    {[
                      {
                        label: 'ساعة ذكية (AliExpress)',
                        url: 'https://www.aliexpress.com/item/smart-watch-ultra-amoled.html',
                      },
                      {
                        label: 'سيروم العناية (Shopify)',
                        url: 'https://glowbeauty.myshopify.com/products/vitamin-c-hyaluronic-serum',
                      },
                      {
                        label: 'حزام الظهر الطبي (YouCan)',
                        url: 'https://medicare.youcan.shop/products/orthopedic-posture-corrector-belt',
                      },
                      {
                        label: 'خلاط محمول (Amazon)',
                        url: 'https://www.amazon.com/dp/portable-usb-juicer-blender',
                      },
                    ].map((sample) => (
                      <button
                        key={sample.label}
                        type="button"
                        onClick={() => setProductUrl(sample.url)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer"
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <textarea
                  rows={4}
                  value={rawProductData}
                  onChange={(e) => setRawProductData(e.target.value)}
                  placeholder="الصق هنا عنوان المنتج، السعر، المميزات، والمواصفات التقنية أو كود HTML..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                />
              )}
            </div>

            {/* Language Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-600" />
                لغة الصياغة التسويقية المستهدفة
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'ar-ma', label: '🇲🇦 الدارجة المغربية' },
                  { id: 'ar', label: '🇸🇦 العربية الفصحى' },
                  { id: 'fr', label: '🇫🇷 Français (COD)' },
                  { id: 'en', label: '🇺🇸 English (Global)' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setUrlLanguage(lang.id as 'ar-ma' | 'ar' | 'fr' | 'en')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                      urlLanguage === lang.id
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Offer Angle */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                زاوية العرض الترويجي (Offer Angle)
              </label>
              <input
                type="text"
                value={urlOfferAngle}
                onChange={(e) => setUrlOfferAngle(e.target.value)}
                placeholder="مثال: تخفيض 50% + توصيل مجاني والدفع عند الاستلام"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
              />
            </div>

            {/* Extracted Gallery Preview if available */}
            {scrapedPreview && scrapedPreview.images.length > 0 && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    تم استخراج {scrapedPreview.images.length} صور عالية الدقة للمعرض
                  </span>
                  <span>{scrapedPreview.price} MAD</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {scrapedPreview.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover border border-emerald-300 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* What the 3-Layer Scraper builds */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
              <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                ماذا سيقوم المستخرج الذكي ببنائه تلقائياً؟
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-emerald-800 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>استخراج جميع صور المعرض (JSON-LD + DOM + Gemini)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>تعبئة Hero Block بالصور والوصف والمواصفات كاملة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>قوائم الدول والمدن المتسلسلة (Country/City COD)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>قسم الأسئلة الشائعة (FAQ) لكسر اعتراضات المشتري</span>
                </div>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 text-sm cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{loadingStage || 'جاري استيراد المنتج...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>استيراد المنتج وبناء الصفحة (AI)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleManualGenerate} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                اسم المنتج (Product Name) *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="مثال: خلاط محمول قابل للشحن، سيروم فيتامين سي..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  التصنيف / النيش
                </label>
                <select
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 outline-none text-sm bg-white"
                >
                  <option value="الصحة والعناية الشخصية">الصحة والعناية الشخصية</option>
                  <option value="إلكترونيات وأدوات ذكية">إلكترونيات وأدوات ذكية</option>
                  <option value="مستلزمات المنزل والمطبخ">مستلزمات المنزل والمطبخ</option>
                  <option value="التجميل والعناية بالبشرة">التجميل والعناية بالبشرة</option>
                  <option value="ملابس وأكسسوارات">ملابس وأكسسوارات</option>
                  <option value="مستلزمات السيارات">مستلزمات السيارات</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  لغة صفحة الهبوط
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ar', label: 'العربية' },
                    { id: 'fr', label: 'Français' },
                    { id: 'en', label: 'English' },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => setLanguage(lang.id as 'ar' | 'fr' | 'en')}
                      className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        language === lang.id
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                الجمهور المستهدف
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="مثال: النساء المهتمات بالعناية بالبشرة في المغرب والخليج"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                العرض الترويجي (Offer Angle)
              </label>
              <input
                type="text"
                value={offerAngle}
                onChange={(e) => setOfferAngle(e.target.value)}
                placeholder="مثال: اشتري 1 واحصل على الثاني بنصف السعر + شحن مجاني"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 text-sm cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl font-bold text-white bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2 text-sm disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{loadingStage || 'جاري بناء الصفحة...'}</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>توليد صفحة الهبوط الآن</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer Security / Speed Note */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>JSON-LD + DOM Gallery Heuristics + Gemini AI Fallback</span>
          </span>
          {lastAnalysis && (
            <span className="text-emerald-700 font-bold">
              آخر تحليل: {lastAnalysis.productName.slice(0, 28)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
