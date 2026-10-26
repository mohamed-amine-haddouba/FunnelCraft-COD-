import dotenv from 'dotenv';

dotenv.config();

export type SupportedPlatform =
  | 'Shopify'
  | 'YouCan'
  | 'AliExpress'
  | 'Amazon'
  | 'Jumia'
  | 'Noon'
  | 'E-Commerce Store';

export interface ScrapedVariant {
  name: string;
  options: string[];
}

export interface ScrapedBundle {
  quantity: number;
  discountPercent: number;
  freeShipping: boolean;
  label: string;
  badge?: string;
  price: number;
  originalPrice: number;
}

export interface ScrapedSpecification {
  label: string;
  value: string;
}

export interface ScrapedReview {
  author: string;
  city: string;
  rating: number;
  comment: string;
}

export interface ScrapedFaq {
  question: string;
  answer: string;
}

export interface ScrapedProduct {
  platform: SupportedPlatform;
  title: string;
  description: string;
  price: number;
  originalPrice: number;
  currency: 'MAD';
  images: string[];
  features: string[];
  variants: ScrapedVariant[];
  bundles: ScrapedBundle[];
  specifications: ScrapedSpecification[];
  reviews: ScrapedReview[];
  faqs: ScrapedFaq[];
  niche: string;
  rawUrl: string;
}

interface ShopifyVariantRaw {
  title?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  price?: number | string;
  compare_at_price?: number | string | null;
  featured_image?: { src?: string } | null;
}

interface ShopifyOptionRaw {
  name?: string;
  values?: string[];
}

interface ShopifyImageRaw {
  src?: string;
}

interface ShopifyProductJsonRaw {
  title?: string;
  body_html?: string;
  description?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[] | string;
  price?: number;
  compare_at_price?: number | null;
  images?: (string | ShopifyImageRaw)[];
  variants?: ShopifyVariantRaw[];
  options?: ShopifyOptionRaw[];
}

interface AiEnrichmentResult {
  title?: string;
  description?: string;
  features?: string[];
  specifications?: ScrapedSpecification[];
  reviews?: ScrapedReview[];
  faqs?: ScrapedFaq[];
}

interface OpenAiCompatResponse {
  choices?: {
    message?: {
      content?: string | null;
    };
  }[];
}

const NICHE_IMAGE_FALLBACKS: Record<string, string[]> = {
  'Beauty & Skincare': [
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1000&auto=format&fit=crop&q=80',
  ],
  'Health & Pain Relief': [
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1000&auto=format&fit=crop&q=80',
  ],
  'Kitchen & Home Gadgets': [
    'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=1000&auto=format&fit=crop&q=80',
  ],
  'Smart Gadgets & Electronics': [
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=1000&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&auto=format&fit=crop&q=80',
  ],
};

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function validateProductUrl(inputUrl: string): { isValid: boolean; error?: string; url?: URL } {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isValid: false, error: 'Product URL is required.' };
  }

  let formatted = inputUrl.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = 'https://' + formatted;
  }

  try {
    const parsed = new URL(formatted);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed.' };
    }

    const hostname = parsed.hostname.toLowerCase();
    const disallowedPrefixes = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.',
      '10.',
      '192.168.',
      '172.16.',
      '172.17.',
      '172.18.',
      '172.19.',
      '172.20.',
      '172.21.',
      '172.22.',
      '172.23.',
      '172.24.',
      '172.25.',
      '172.26.',
      '172.27.',
      '172.28.',
      '172.29.',
      '172.30.',
      '172.31.',
    ];

    if (disallowedPrefixes.some((prefix) => hostname === prefix || hostname.startsWith(prefix))) {
      return { isValid: false, error: 'Private and internal network addresses are not allowed.' };
    }

    return { isValid: true, url: parsed };
  } catch {
    return { isValid: false, error: 'Invalid URL format. Please provide a valid product link.' };
  }
}

export function detectPlatform(url: URL): SupportedPlatform {
  const host = url.hostname.toLowerCase();
  if (host.includes('shopify.') || host.includes('myshopify.com')) return 'Shopify';
  if (host.includes('youcan.shop') || host.includes('youcan.')) return 'YouCan';
  if (host.includes('aliexpress.')) return 'AliExpress';
  if (host.includes('amazon.') || host.includes('amzn.')) return 'Amazon';
  if (host.includes('jumia.')) return 'Jumia';
  if (host.includes('noon.')) return 'Noon';
  return 'E-Commerce Store';
}

function inferNiche(text: string): string {
  const lower = text.toLowerCase();
  if (
    /serum|cream|skin|hair|face|beauty|makeup|mask|glow|collagen|تجميل|بشرة|شعر|كريم|سيروم/.test(lower)
  ) {
    return 'Beauty & Skincare';
  }
  if (
    /pain|posture|knee|orthopedic|massage|therapy|back|neck|medical|مساج|ألم|ظهر|ركبة|صحة/.test(lower)
  ) {
    return 'Health & Pain Relief';
  }
  if (/kitchen|juicer|blender|cutter|cook|pan|coffee|airfryer|مطبخ|عصارة|خلاط|قهوة/.test(lower)) {
    return 'Kitchen & Home Gadgets';
  }
  return 'Smart Gadgets & Electronics';
}

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHighResImageUrl(rawUrl: string, baseOrigin: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let clean = rawUrl.trim().replace(/&amp;/g, '&');
  if (clean.startsWith('data:') || clean.endsWith('.svg') || clean.includes('1x1') || clean.includes('pixel')) {
    return null;
  }
  if (clean.startsWith('//')) {
    clean = 'https:' + clean;
  } else if (clean.startsWith('/')) {
    clean = baseOrigin + clean;
  }
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return null;
  }
  // Upgrade thumbnail suffixes for Shopify, AliExpress, Amazon, Jumia, and Noon
  clean = clean
    .replace(/_(50x50|100x100|160x160|240x240|300x300|480x480|600x600)(\.[a-zA-Z0-9]+)(\?.*)?$/, '$2$3')
    .replace(/\.jpg_\d+x\d+[^.]*\.jpg/i, '.jpg')
    .replace(/\._AC_[A-Z0-9,_]+_\./, '.');

  return clean;
}

function convertToMadPrice(rawAmount: number, currencyHint: string): number {
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return 249;
  const upperCurrency = currencyHint.toUpperCase();

  let mad = rawAmount;
  if (upperCurrency === 'USD' || upperCurrency === 'EUR' || upperCurrency === 'GBP') {
    mad = rawAmount * 10.2;
  } else if (upperCurrency === 'AED' || upperCurrency === 'SAR') {
    mad = rawAmount * 2.75;
  } else if (rawAmount < 45) {
    // Likely USD/EUR price without explicit currency code
    mad = rawAmount * 10;
  }

  // Round to psychological COD pricing in Morocco (e.g., 199, 249, 299 MAD)
  const clamped = Math.max(149, Math.min(2499, Math.round(mad)));
  const remainder = clamped % 10;
  return remainder === 9 ? clamped : Math.floor(clamped / 10) * 10 + 9;
}

export function buildStandardCodBundles(basePriceMad: number, originalUnitMad: number): ScrapedBundle[] {
  const unitPrice = Math.max(99, Math.round(basePriceMad));
  const origUnit = Math.max(unitPrice + 50, Math.round(originalUnitMad));

  const bundle2Price = Math.round(unitPrice * 2 * 0.85);
  const bundle3Price = Math.round(unitPrice * 3 * 0.75);

  return [
    {
      quantity: 1,
      discountPercent: 0,
      freeShipping: false,
      label: 'قطعة واحدة (العرض الأساسي)',
      price: unitPrice,
      originalPrice: origUnit,
    },
    {
      quantity: 2,
      discountPercent: 15,
      freeShipping: true,
      label: 'قطعتين (تخفيض 15% + توصيل مجاني)',
      badge: 'الأكثر طلباً 🔥',
      price: bundle2Price,
      originalPrice: origUnit * 2,
    },
    {
      quantity: 3,
      discountPercent: 25,
      freeShipping: true,
      label: '3 قطع (تخفيض 25% + توصيل مجاني + هدية مجانية 🎁)',
      badge: 'أفضل توفير 💎',
      price: bundle3Price,
      originalPrice: origUnit * 3,
    },
  ];
}

function buildDefaultVariants(niche: string): ScrapedVariant[] {
  if (niche === 'Beauty & Skincare') {
    return [
      { name: 'الحجم / العبوة', options: ['عبوة 50 مل (Standard)', 'عبوة 100 مل (XL العائلية)'] },
      { name: 'نوع البشرة', options: ['جميع أنواع البشرة', 'البشرة الحساسة والجافة'] },
    ];
  }
  if (niche === 'Health & Pain Relief') {
    return [
      { name: 'المقاس', options: ['Standard (قابل للتعديل)', 'Large / XL'] },
      { name: 'اللون', options: ['أسود طبي', 'رمادي داكن'] },
    ];
  }
  return [
    { name: 'اللون', options: ['أسود ملكي (Black)', 'فضي ميتاليك (Silver)', 'أبيض لؤlؤي (White)'] },
    { name: 'الإصدار', options: ['النسخة الأصلية Pro', 'نسخة البلس + إكسسوارات'] },
  ];
}

function buildDefaultSpecifications(title: string, platform: SupportedPlatform, niche: string): ScrapedSpecification[] {
  return [
    { label: 'العلامة التجارية والموديل', value: `${title.slice(0, 42)} — الإصدار الأصلي` },
    { label: 'الفئة', value: niche },
    { label: 'جودة التصنيع', value: 'مواد عالية الجودة مقاومة للاستخدام اليومي المكثف (شهادة CE/RoHS)' },
    { label: 'الضمان والاستبدال', value: 'ضمان شامل لمدة سنة + استبدال فوري خلال 14 يوماً' },
    { label: 'طريقة الدفع والشحن', value: 'الدفع نقداً عند الاستلام مع إمكانية المعاينة (توصيل 24-48 ساعة)' },
    {
      label: 'ماذا يوجد في العلبة؟ (What\'s in the box)',
      value: `1× ${title.slice(0, 35)} + كابل/ملحقات التشغيل الكاملة + دليل الاستخدام + بطاقة الضمان (${platform})`,
    },
  ];
}

function buildDefaultMoroccanReviews(title: string): ScrapedReview[] {
  const shortName = title.slice(0, 30);
  return [
    {
      author: 'ياسين العمراني',
      city: 'الدار البيضاء',
      rating: 5,
      comment: `وصلني ${shortName} في أقل من 24 ساعة للمعاريف! الجودة ممتازة جداً وقلبت الكوموند قبل ما نخلص الموزع. شكراً بزاف على المعاملة.`,
    },
    {
      author: 'سلمى بناني',
      city: 'الرباط',
      rating: 5,
      comment: 'صراحة منتوج واعر بزاف ونفس الصور بالضبط. خديت عرض جوج قطع بـ تخفيض 15% والتوصيل فابور لأكدال. أنصح به بشدة!',
    },
    {
      author: 'عبد الصمد التازي',
      city: 'مراكش',
      rating: 5,
      comment: 'خدمة نقية واحترافية، اتصلوا بيا فـ واتساب أكدوا الطلبية والغد ليه كانت عندي فـ جيليز. المنتوج أصلي ويستاهل كل درهم.',
    },
    {
      author: 'هدى الشرايبي',
      city: 'طنجة',
      rating: 4,
      comment: 'التغليف ممتاز والمنتوج خدام مزيان تبارك الله. التوصيل لطنجة خدا يومين والموزع كان محترم بزاف.',
    },
  ];
}

function buildDefaultFaqs(title: string): ScrapedFaq[] {
  return [
    {
      question: 'كيفاش غادي نخلص؟ واش كاين الدفع عند الاستلام؟',
      answer: 'نعم! الدفع كيكون نقداً عند الاستلام (Cash on Delivery) حتى يوصلك المنتوج لباب الدار وتعاينو بنفسك عاد تخلص.',
    },
    {
      question: 'شحال كياخد الوقت ديال التوصيل للمدن المغربية؟',
      answer: 'التوصيل سريع جداً: ما بين 24 ساعة في الدار البيضاء والرباط والنواحي، و24 إلى 48 ساعة لباقي المدن المغربية.',
    },
    {
      question: `واش ${title.slice(0, 35)} أصلي وفيه الضمان؟`,
      answer: 'أكيد، جميع منتجاتنا أصلية 100% ومرفوقة بضمان لمدة سنة كاملة ضد أي عيب مصنعي مع إمكانية الاستبدال المجاني.',
    },
    {
      question: 'شنو يوقع إلا ما ناسبنيش المنتوج من بعد الاستلام؟',
      answer: 'عندك الحق في استبدال المنتوج أو استرجاع المبلغ كاملاً داخل أجل 14 يوماً من تاريخ الاستلام بكل سهولة عبر خدمة الزبناء فـ واتساب.',
    },
  ];
}

/**
 * Layer 1: Attempt Shopify / YouCan JSON endpoint extraction
 */
async function tryShopifyOrJsonEndpoint(url: URL): Promise<Partial<ScrapedProduct> | null> {
  if (!url.pathname.includes('/products/')) return null;
  const match = url.pathname.match(/\/products\/([^/?#]+)/);
  if (!match || !match[1]) return null;

  const handle = match[1];
  const candidateUrls = [
    `${url.origin}/products/${handle}.json`,
    `${url.origin}/products/${handle}.js`,
  ];

  for (const endpoint of candidateUrls) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) continue;
      const rawJson: unknown = await response.json();
      if (!isRecord(rawJson)) continue;

      const productObj: ShopifyProductJsonRaw = isRecord(rawJson.product)
        ? (rawJson.product as unknown as ShopifyProductJsonRaw)
        : (rawJson as unknown as ShopifyProductJsonRaw);

      if (!productObj.title || typeof productObj.title !== 'string') continue;

      const extractedImages: string[] = [];
      if (Array.isArray(productObj.images)) {
        for (const item of productObj.images) {
          const rawSrc = typeof item === 'string' ? item : isRecord(item) && typeof item.src === 'string' ? item.src : '';
          const norm = normalizeHighResImageUrl(rawSrc, url.origin);
          if (norm && !extractedImages.includes(norm)) {
            extractedImages.push(norm);
          }
        }
      }

      const variants: ScrapedVariant[] = [];
      if (Array.isArray(productObj.options)) {
        for (const opt of productObj.options) {
          if (opt && typeof opt.name === 'string' && Array.isArray(opt.values)) {
            const cleanValues = opt.values
              .map((v) => String(v).trim())
              .filter((v) => v && v.toLowerCase() !== 'default title');
            if (cleanValues.length > 0) {
              variants.push({
                name: opt.name,
                options: cleanValues.slice(0, 8),
              });
            }
          }
        }
      }

      let rawPrice = 249;
      let rawCompare = 399;

      if (typeof productObj.price === 'number' && productObj.price > 0) {
        rawPrice = productObj.price > 1000 ? Math.round(productObj.price / 100) : productObj.price;
      } else if (Array.isArray(productObj.variants) && productObj.variants.length > 0) {
        const firstVar = productObj.variants[0];
        const parsedVarPrice = Number(firstVar?.price);
        if (Number.isFinite(parsedVarPrice) && parsedVarPrice > 0) {
          rawPrice = parsedVarPrice;
        }
        const parsedCompare = Number(firstVar?.compare_at_price);
        if (Number.isFinite(parsedCompare) && parsedCompare > rawPrice) {
          rawCompare = parsedCompare;
        }
      }

      if (typeof productObj.compare_at_price === 'number' && productObj.compare_at_price > 0) {
        rawCompare =
          productObj.compare_at_price > 1000
            ? Math.round(productObj.compare_at_price / 100)
            : productObj.compare_at_price;
      }

      const madPrice = convertToMadPrice(rawPrice, 'MAD');
      const madOriginal = Math.max(Math.round(madPrice * 1.45), convertToMadPrice(rawCompare, 'MAD'));
      const rawHtmlBody = productObj.body_html || productObj.description || '';
      const cleanDescription = stripHtmlTags(rawHtmlBody).slice(0, 900);

      const specs: ScrapedSpecification[] = [];
      if (productObj.vendor) {
        specs.push({ label: 'العلامة التجارية (Brand)', value: String(productObj.vendor) });
      }
      if (productObj.product_type) {
        specs.push({ label: 'التصنيف (Category)', value: String(productObj.product_type) });
      }
      specs.push({
        label: 'ماذا يوجد في العلبة؟ (What\'s in the box)',
        value: `1× ${productObj.title} + الملحقات الأصلية الكاملة + دليل الاستعمال + شهادة الضمان`,
      });

      return {
        platform: 'Shopify',
        title: productObj.title.trim(),
        description: cleanDescription,
        price: madPrice,
        originalPrice: madOriginal,
        images: extractedImages,
        variants,
        specifications: specs,
      };
    } catch {
      // Fallback to next endpoint or HTML scraping
    }
  }

  return null;
}

/**
 * Layer 2: Extract Schema.org JSON-LD (Product, AggregateRating, Review, FAQPage)
 */
function parseJsonLdFromHtml(html: string, baseOrigin: string): Partial<ScrapedProduct> {
  const result: Partial<ScrapedProduct> = {
    images: [],
    variants: [],
    specifications: [],
    reviews: [],
    faqs: [],
  };

  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const rawContent = match[1]?.trim();
    if (!rawContent) continue;

    try {
      const parsed: unknown = JSON.parse(rawContent);
      const nodes: Record<string, unknown>[] = [];

      const collectNodes = (item: unknown) => {
        if (Array.isArray(item)) {
          item.forEach(collectNodes);
        } else if (isRecord(item)) {
          nodes.push(item);
          if (Array.isArray(item['@graph'])) {
            item['@graph'].forEach(collectNodes);
          }
        }
      };
      collectNodes(parsed);

      for (const node of nodes) {
        const nodeType = String(node['@type'] || '').toLowerCase();

        if (nodeType.includes('product')) {
          if (typeof node.name === 'string' && !result.title) {
            result.title = stripHtmlTags(node.name);
          }
          if (typeof node.description === 'string' && !result.description) {
            result.description = stripHtmlTags(node.description).slice(0, 900);
          }

          // Images
          const imgField = node.image;
          const imgCandidates: string[] = [];
          if (typeof imgField === 'string') {
            imgCandidates.push(imgField);
          } else if (Array.isArray(imgField)) {
            for (const entry of imgField) {
              if (typeof entry === 'string') imgCandidates.push(entry);
              else if (isRecord(entry) && typeof entry.url === 'string') imgCandidates.push(entry.url);
            }
          } else if (isRecord(imgField) && typeof imgField.url === 'string') {
            imgCandidates.push(imgField.url);
          }

          for (const candidate of imgCandidates) {
            const norm = normalizeHighResImageUrl(candidate, baseOrigin);
            if (norm && result.images && !result.images.includes(norm)) {
              result.images.push(norm);
            }
          }

          // Offers / Price
          const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
          if (isRecord(offers)) {
            const rawPriceVal = Number(offers.price ?? offers.lowPrice ?? 0);
            const rawCurrency = String(offers.priceCurrency || 'MAD');
            if (Number.isFinite(rawPriceVal) && rawPriceVal > 0) {
              result.price = convertToMadPrice(rawPriceVal, rawCurrency);
              result.originalPrice = Math.round(result.price * 1.45);
            }
          }

          // Brand / SKU specs
          if (isRecord(node.brand) && typeof node.brand.name === 'string') {
            result.specifications?.push({
              label: 'العلامة التجارية (Brand)',
              value: node.brand.name,
            });
          } else if (typeof node.brand === 'string') {
            result.specifications?.push({
              label: 'العلامة التجارية (Brand)',
              value: node.brand,
            });
          }

          if (Array.isArray(node.additionalProperty)) {
            for (const prop of node.additionalProperty) {
              if (isRecord(prop) && typeof prop.name === 'string' && prop.value !== undefined) {
                result.specifications?.push({
                  label: stripHtmlTags(prop.name),
                  value: stripHtmlTags(String(prop.value)),
                });
              }
            }
          }

          // Reviews inside Product JSON-LD
          if (Array.isArray(node.review)) {
            const moroccanCities = ['الدار البيضاء', 'الرباط', 'مراكش', 'طنجة', 'فاس', 'أكادير'];
            node.review.slice(0, 5).forEach((rev, idx) => {
              if (isRecord(rev)) {
                const authorName = isRecord(rev.author)
                  ? String(rev.author.name || 'زبون موثق')
                  : typeof rev.author === 'string'
                  ? rev.author
                  : 'زبون موثق';
                const ratingVal = isRecord(rev.reviewRating)
                  ? Number(rev.reviewRating.ratingValue || 5)
                  : 5;
                const bodyText = String(rev.reviewBody || rev.description || '').trim();
                if (bodyText) {
                  result.reviews?.push({
                    author: authorName,
                    city: moroccanCities[idx % moroccanCities.length],
                    rating: Math.min(5, Math.max(4, Math.round(ratingVal))),
                    comment: stripHtmlTags(bodyText).slice(0, 280),
                  });
                }
              }
            });
          }
        }

        if (nodeType.includes('faqpage') && Array.isArray(node.mainEntity)) {
          for (const entity of node.mainEntity) {
            if (isRecord(entity) && typeof entity.name === 'string' && isRecord(entity.acceptedAnswer)) {
              const answerText = String(entity.acceptedAnswer.text || '');
              if (answerText) {
                result.faqs?.push({
                  question: stripHtmlTags(entity.name),
                  answer: stripHtmlTags(answerText),
                });
              }
            }
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD block
    }
  }

  return result;
}

/**
 * Layer 3 & 4: OpenGraph Meta Tags & Deep HTML DOM Extraction
 */
function parseOpenGraphAndDom(html: string, baseOrigin: string): Partial<ScrapedProduct> {
  const getMetaContent = (attrName: string): string => {
    const regex1 = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${attrName}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const regex2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${attrName}["']`,
      'i'
    );
    return (html.match(regex1)?.[1] || html.match(regex2)?.[1] || '').trim();
  };

  const ogTitle =
    getMetaContent('og:title') ||
    getMetaContent('twitter:title') ||
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    '';

  const title = stripHtmlTags(ogTitle).replace(/\s*[-–|].*$/, '').trim();

  const ogDesc =
    getMetaContent('og:description') ||
    getMetaContent('description') ||
    getMetaContent('twitter:description') ||
    '';
  const description = stripHtmlTags(ogDesc).slice(0, 900);

  // Price from meta or regex
  const rawPriceMeta =
    getMetaContent('product:price:amount') ||
    getMetaContent('og:price:amount') ||
    getMetaContent('price');
  const rawCurrencyMeta =
    getMetaContent('product:price:currency') ||
    getMetaContent('og:price:currency') ||
    'MAD';

  let price: number | undefined;
  if (rawPriceMeta) {
    const parsedNum = parseFloat(rawPriceMeta.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(parsedNum) && parsedNum > 0) {
      price = convertToMadPrice(parsedNum, rawCurrencyMeta);
    }
  } else {
    const domPriceMatch = html.match(/(?:MAD|DH|د\.م\.?|\$|€)\s*([0-9]{2,4}(?:\.[0-9]{1,2})?)/i);
    if (domPriceMatch && domPriceMatch[1]) {
      price = convertToMadPrice(parseFloat(domPriceMatch[1]), 'MAD');
    }
  }

  // Extract all high-res images from OG + DOM
  const images: string[] = [];
  const pushImage = (candidate: string) => {
    const norm = normalizeHighResImageUrl(candidate, baseOrigin);
    if (norm && !images.includes(norm)) {
      images.push(norm);
    }
  };

  const ogImg = getMetaContent('og:image') || getMetaContent('twitter:image');
  if (ogImg) pushImage(ogImg);

  const imgTagRegex = /<img[^>]+(?:data-src|data-zoom-image|data-large_image|src)=["']([^"']+)["'][^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgTagRegex.exec(html)) !== null && images.length < 10) {
    if (imgMatch[1]) pushImage(imgMatch[1]);
  }

  // Extract specifications from HTML tables (<tr><th>/<td>)
  const specifications: ScrapedSpecification[] = [];
  const rowRegex = /<tr[^>]*>\s*<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null && specifications.length < 8) {
    const label = stripHtmlTags(rowMatch[1] || '');
    const value = stripHtmlTags(rowMatch[2] || '');
    if (label && value && label.length < 60 && value.length < 180) {
      specifications.push({ label, value });
    }
  }

  // Extract bullet features from <li>
  const features: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch: RegExpExecArray | null;
  while ((liMatch = liRegex.exec(html)) !== null && features.length < 6) {
    const text = stripHtmlTags(liMatch[1] || '');
    if (text.length >= 18 && text.length <= 130 && !/cookie|privacy|login|cart|menu|home/i.test(text)) {
      if (!features.includes(text)) {
        features.push(text);
      }
    }
  }

  return {
    title,
    description,
    price,
    originalPrice: price ? Math.round(price * 1.45) : undefined,
    images,
    specifications,
    features,
  };
}

/**
 * Provider-Agnostic AI Enrichment via OpenAI-Compatible Chat Completions Endpoint
 * Supports OpenAI, DeepSeek, OpenRouter, Groq, and Google Gemini Compatibility Layer
 */
async function enrichWithGeminiAi(
  partial: {
    title: string;
    description: string;
    platform: SupportedPlatform;
    niche: string;
    rawUrl: string;
  }
): Promise<AiEnrichmentResult | null> {
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) return null;

  try {
    const systemPrompt =
      'أنت خبير تجارة إلكترونية بالدفع عند الاستلام (COD) في المغرب. أجب دائماً بصيغة JSON صالحة فقط بدون أي نص إضافي.';

    const userPrompt = `قم بتحليل بيانات هذا المنتج المستخرج من منصة (${partial.platform}):
- العنوان: ${partial.title}
- الوصف الأولي: ${partial.description || 'غير متوفر'}
- التخصص: ${partial.niche}
- الرابط: ${partial.rawUrl}

المطلوب توليد كائن JSON احترافي باللغة العربية موجه للمشتري المغربي يحتوي على الحقول التالية:
{
  "title": "عنوان تسويقي جذاب واضح باللغة العربية",
  "description": "وصف تسويقي مقنع ومفصل يبرز الفوائد العملية والحلول التي يقدمها المنتج",
  "features": ["ميزة 1", "ميزة 2", "ميزة 3", "ميزة 4"],
  "specifications": [
    { "label": "اسم المواصفة", "value": "قيمة المواصفة" },
    { "label": "ماذا يوجد في العلبة؟", "value": "محتويات العلبة الكاملة" }
  ],
  "reviews": [
    { "author": "اسم زبون مغربي", "city": "الدار البيضاء / الرباط / مراكش / طنجة", "rating": 5, "comment": "تعليق واقعي حول الجودة والتوصيل والدفع عند الاستلام" }
  ],
  "faqs": [
    { "question": "سؤال شائع للزبون المغربي", "answer": "جواب مطمئن وواضح" }
  ]
}`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) return null;

    const rawData: unknown = await response.json();
    if (!isRecord(rawData)) return null;

    const typedResponse = rawData as unknown as OpenAiCompatResponse;
    const content = typedResponse.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return null;

    const parsedContent: unknown = JSON.parse(content);
    if (!isRecord(parsedContent)) return null;

    return parsedContent as unknown as AiEnrichmentResult;
  } catch (err) {
    console.warn('AI enrichment notice (using structured Moroccan COD defaults):', err);
    return null;
  }
}

/**
 * Main Multi-Layer Product Scraper Entrypoint
 * Layers: Shopify/YouCan JSON -> Schema.org JSON-LD -> OpenGraph Meta -> HTML DOM -> Provider-Agnostic AI Enrichment & Moroccan COD Defaults
 */
export async function scrapeProductData(url: string): Promise<ScrapedProduct> {
  const validation = validateProductUrl(url);
  if (!validation.isValid || !validation.url) {
    throw new Error(validation.error || 'Invalid product URL.');
  }

  const parsedUrl = validation.url;
  let platform = detectPlatform(parsedUrl);

  // Layer 1: Try Shopify / JSON endpoint
  const shopifyData = await tryShopifyOrJsonEndpoint(parsedUrl);
  if (shopifyData?.platform) {
    platform = shopifyData.platform;
  }

  // Fetch raw HTML for Layer 2 (JSON-LD), Layer 3 (OpenGraph), and Layer 4 (DOM)
  let html = '';
  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ar-MA,ar;q=0.9,fr-MA,fr;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      html = await response.text();
    }
  } catch {
    // Graceful continuation if remote store blocks automated requests
  }

  if (html && platform === 'E-Commerce Store') {
    if (/cdn\.shopify\.com|Shopify\.theme/i.test(html)) platform = 'Shopify';
    else if (/youcan\.shop|youcan/i.test(html)) platform = 'YouCan';
  }

  const jsonLdData = html ? parseJsonLdFromHtml(html, parsedUrl.origin) : {};
  const ogDomData = html ? parseOpenGraphAndDom(html, parsedUrl.origin) : {};

  // Fallback title derived from URL slug if store blocked HTML
  const slugFallbackTitle = decodeURIComponent(
    parsedUrl.pathname
      .split('/')
      .filter(Boolean)
      .pop() || 'منتج احترافي عالي الجودة'
  )
    .replace(/\.html?$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  const rawTitle =
    shopifyData?.title ||
    jsonLdData.title ||
    ogDomData.title ||
    slugFallbackTitle ||
    'منتج احترافي أصلي للمغرب';

  const rawDescription =
    shopifyData?.description ||
    jsonLdData.description ||
    ogDomData.description ||
    `اكتشف ${rawTitle} الأصلي المصمم بأعلى معايير الجودة، متوفر الآن مع توصيل سريع لجميع المدن المغربية والدفع نقداً عند الاستلام.`;

  const niche = inferNiche(`${rawTitle} ${rawDescription} ${parsedUrl.pathname}`);

  // Merge images across all layers without duplicates
  const combinedImages: string[] = [];
  for (const list of [shopifyData?.images, jsonLdData.images, ogDomData.images]) {
    if (Array.isArray(list)) {
      for (const img of list) {
        if (img && !combinedImages.includes(img)) {
          combinedImages.push(img);
        }
      }
    }
  }

  const fallbackImages = NICHE_IMAGE_FALLBACKS[niche] || NICHE_IMAGE_FALLBACKS['Smart Gadgets & Electronics'];
  for (const fallbackImg of fallbackImages) {
    if (combinedImages.length < 4 && !combinedImages.includes(fallbackImg)) {
      combinedImages.push(fallbackImg);
    }
  }

  const basePriceMad = shopifyData?.price || jsonLdData.price || ogDomData.price || 249;
  const originalPriceMad =
    shopifyData?.originalPrice ||
    jsonLdData.originalPrice ||
    ogDomData.originalPrice ||
    Math.round(basePriceMad * 1.45);

  const bundles = buildStandardCodBundles(basePriceMad, originalPriceMad);

  // Merge variants
  const variants: ScrapedVariant[] =
    shopifyData?.variants && shopifyData.variants.length > 0
      ? shopifyData.variants
      : jsonLdData.variants && jsonLdData.variants.length > 0
      ? jsonLdData.variants
      : buildDefaultVariants(niche);

  // Merge specifications, reviews, features, FAQs, and enrich with AI if needed
  let specifications: ScrapedSpecification[] = [
    ...(shopifyData?.specifications || []),
    ...(jsonLdData.specifications || []),
    ...(ogDomData.specifications || []),
  ];

  let reviews: ScrapedReview[] = [...(jsonLdData.reviews || [])];
  let faqs: ScrapedFaq[] = [...(jsonLdData.faqs || [])];
  let features: string[] = [...(ogDomData.features || [])];
  let finalTitle = rawTitle;
  let finalDescription = rawDescription;

  if (specifications.length < 3 || reviews.length < 3 || faqs.length < 3) {
    const aiResult = await enrichWithGeminiAi({
      title: rawTitle,
      description: rawDescription,
      platform,
      niche,
      rawUrl: url,
    });

    if (aiResult) {
      if (aiResult.title) finalTitle = aiResult.title;
      if (aiResult.description) finalDescription = aiResult.description;
      if (Array.isArray(aiResult.features) && aiResult.features.length > 0) {
        features = aiResult.features;
      }
      if (Array.isArray(aiResult.specifications) && aiResult.specifications.length >= 3) {
        specifications = aiResult.specifications;
      }
      if (Array.isArray(aiResult.reviews) && aiResult.reviews.length >= 3) {
        reviews = aiResult.reviews;
      }
      if (Array.isArray(aiResult.faqs) && aiResult.faqs.length >= 3) {
        faqs = aiResult.faqs;
      }
    }
  }

  if (features.length === 0) {
    features = [
      'جودة أصلية ممتازة مضمونة 100% مع شهادة مطابقة المعايير',
      'توصيل سريع وآمن خلال 24 إلى 48 ساعة لجميع المدن المغربية',
      'الدفع نقداً عند الاستلام مع إمكانية فتح العلبة والمعاينة قبل الدفع',
      'ضمان شامل لمدة سنة كاملة وخدمة ما بعد البيع عبر واتساب',
    ];
  }

  if (specifications.length < 3) {
    specifications = buildDefaultSpecifications(finalTitle, platform, niche);
  } else if (!specifications.some((s) => /علبة|box/i.test(s.label))) {
    specifications.push({
      label: 'ماذا يوجد في العلبة؟ (What\'s in the box)',
      value: `1× ${finalTitle.slice(0, 40)} + الملحقات الأصلية الكاملة + دليل الاستخدام + بطاقة الضمان`,
    });
  }

  if (reviews.length < 3) {
    reviews = buildDefaultMoroccanReviews(finalTitle);
  }

  if (faqs.length < 3) {
    faqs = buildDefaultFaqs(finalTitle);
  }

  return {
    platform,
    title: finalTitle,
    description: finalDescription,
    price: basePriceMad,
    originalPrice: originalPriceMad,
    currency: 'MAD',
    images: combinedImages.slice(0, 10),
    features: features.slice(0, 6),
    variants,
    bundles,
    specifications: specifications.slice(0, 8),
    reviews: reviews.slice(0, 6),
    faqs: faqs.slice(0, 6),
    niche,
    rawUrl: url,
  };
}
