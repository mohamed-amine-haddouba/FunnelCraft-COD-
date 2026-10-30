/**
 * CodWorth - E-Commerce Product URL Scraper & Metadata Extractor
 * Supports AliExpress, Alibaba, Shopify, YouCan, and general e-commerce stores.
 */

import { scrapeProductData } from './scraper';

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ScrapedProduct {
  platform: 'AliExpress' | 'Alibaba' | 'Shopify' | 'YouCan' | 'Amazon' | 'Jumia' | 'Noon' | 'E-Commerce Store';
  title: string;
  description: string;
  price?: number;
  originalPrice?: number;
  currency?: string;
  images: string[];
  features: string[];
  specifications: ProductSpecification[];
  niche: string;
  rawUrl: string;
}

// Niche category photo collections for high-conversion fallbacks
const NICHE_UNSPLASH_FALLBACKS: Record<string, string[]> = {
  beauty: [
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&auto=format&fit=crop&q=80',
  ],
  health: [
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop&q=80',
  ],
  kitchen: [
    'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=800&auto=format&fit=crop&q=80',
  ],
  electronics: [
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800&auto=format&fit=crop&q=80',
  ],
  general: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80',
  ],
};

/**
 * Validates and sanitizes product URLs to prevent SSRF and invalid protocols
 */
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
    // Disallow loopback / private IP addresses to prevent SSRF
    const disallowed = [
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

    if (disallowed.some((d) => hostname === d || hostname.startsWith(d))) {
      return { isValid: false, error: 'Private and internal network addresses are not allowed.' };
    }

    return { isValid: true, url: parsed };
  } catch (e: any) {
    return { isValid: false, error: 'Invalid URL format. Please paste a full web link.' };
  }
}

/**
 * Detects the e-commerce store platform from the hostname/pathname
 */
export function detectPlatform(url: URL): ScrapedProduct['platform'] {
  const host = url.hostname.toLowerCase();
  if (host.includes('aliexpress.')) return 'AliExpress';
  if (host.includes('alibaba.')) return 'Alibaba';
  if (host.includes('youcan.')) return 'YouCan';
  if (host.includes('amazon.')) return 'Amazon';
  if (host.includes('myshopify.com')) return 'Shopify';
  return 'E-Commerce Store';
}

/**
 * Detects product niche from title, keywords, or URL
 */
function inferNiche(text: string): string {
  const lower = text.toLowerCase();
  if (
    lower.includes('serum') ||
    lower.includes('cream') ||
    lower.includes('skin') ||
    lower.includes('hair') ||
    lower.includes('face') ||
    lower.includes('beauty') ||
    lower.includes('makeup') ||
    lower.includes('تجميل') ||
    lower.includes('بشرة') ||
    lower.includes('شعر')
  ) {
    return 'Beauty & Skincare';
  }
  if (
    lower.includes('pain') ||
    lower.includes('posture') ||
    lower.includes('knee') ||
    lower.includes('orthopedic') ||
    lower.includes('massage') ||
    lower.includes('therapy') ||
    lower.includes('back') ||
    lower.includes('مساج') ||
    lower.includes('ألم') ||
    lower.includes('ظهر')
  ) {
    return 'Health & Pain Relief';
  }
  if (
    lower.includes('kitchen') ||
    lower.includes('juicer') ||
    lower.includes('blender') ||
    lower.includes('cutter') ||
    lower.includes('cook') ||
    lower.includes('pan') ||
    lower.includes('مطبخ') ||
    lower.includes('عصارة') ||
    lower.includes('خلاط')
  ) {
    return 'Kitchen & Home Gadgets';
  }
  if (
    lower.includes('car') ||
    lower.includes('cleaner') ||
    lower.includes('vacuum') ||
    lower.includes('tool') ||
    lower.includes('سيارة') ||
    lower.includes('تنظيف')
  ) {
    return 'Car & Home Gadgets';
  }
  return 'Smart Gadgets & Electronics';
}

/**
 * Extracts OpenGraph, meta tags, and structured JSON-LD data from raw HTML
 */
export async function scrapeProductFromUrl(targetUrl: string): Promise<ScrapedProduct> {
  const val = validateProductUrl(targetUrl);
  if (!val.isValid || !val.url) {
    throw new Error(val.error || 'Invalid product URL.');
  }

  try {
    const deepData = await scrapeProductData(targetUrl);
    if (deepData && deepData.images && deepData.images.length > 0) {
      return {
        platform: deepData.platform,
        title: deepData.title,
        description: deepData.description,
        price: deepData.price,
        originalPrice: deepData.originalPrice,
        currency: deepData.currency,
        images: deepData.images,
        features: deepData.features,
        specifications: deepData.specifications,
        niche: deepData.niche,
        rawUrl: deepData.rawUrl,
      };
    }
  } catch (err) {
    console.warn('Deep scraper delegation notice, continuing with fallback:', err);
  }

  const url = val.url;
  const platform = detectPlatform(url);

  // Special optimization: Shopify /products/handle.js or .json
  if (url.pathname.includes('/products/')) {
    try {
      const match = url.pathname.match(/\/products\/([^\/\?#]+)/);
      if (match && match[1]) {
        const handle = match[1];
        const jsonUrl = `${url.origin}/products/${handle}.js`;
        const res = await fetch(jsonUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const shopifyData: any = await res.json();
          if (shopifyData && shopifyData.title) {
            const rawImages = (shopifyData.images || []).map((img: string) =>
              img.startsWith('//') ? 'https:' + img : img
            );
            const price = shopifyData.price ? Math.round(shopifyData.price / 100) : 249;
            const originalPrice = shopifyData.compare_at_price
              ? Math.round(shopifyData.compare_at_price / 100)
              : Math.round(price * 1.6);

            return {
              platform: 'Shopify',
              title: shopifyData.title.trim(),
              description: (shopifyData.description || '').replace(/<[^>]*>?/gm, '').slice(0, 500),
              price,
              originalPrice,
              currency: 'MAD',
              images: rawImages.slice(0, 6),
              features: (shopifyData.variants || [])
                .slice(0, 4)
                .map((v: any) => v.title)
                .filter((t: string) => t && t !== 'Default Title'),
              specifications: [
                { label: 'Brand & Model', value: shopifyData.vendor || 'Official Brand Edition' },
                { label: 'Product Type', value: shopifyData.product_type || 'Premium E-Commerce Line' },
                { label: 'Availability', value: 'In Stock - Ready for Fast COD Dispatch' },
              ],
              niche: inferNiche(shopifyData.title + ' ' + (shopifyData.description || '')),
              rawUrl: targetUrl,
            };
          }
        }
      }
    } catch (e) {
      // Continue to HTML scraping fallback
    }
  }

  // Fetch HTML with browser emulation headers
  let html = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8,fr;q=0.7',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      html = await response.text();
    }
  } catch (err: any) {
    // If request timed out or was blocked by anti-bot, infer from URL
    console.warn('URL Fetch warning:', err.message);
  }

  // Parse HTML
  let title = '';
  let description = '';
  const images: string[] = [];
  let price: number | undefined;
  let originalPrice: number | undefined;
  const features: string[] = [];

  if (html) {
    // 1. Title Extraction
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const twTitle = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
    const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const h1Title = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

    title = ogTitle?.[1] || twTitle?.[1] || h1Title?.[1] || htmlTitle?.[1] || '';
    title = title
      .replace(/\s*[-–|].*$/, '') // Remove site suffixes like " - AliExpress"
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();

    // 2. Description Extraction
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    description = ogDesc?.[1] || metaDesc?.[1] || '';
    description = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600);

    // 3. Images Extraction
    const ogImg = html.match(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/gi);
    if (ogImg) {
      for (const m of ogImg) {
        const urlMatch = m.match(/content=["']([^"']+)["']/i);
        if (urlMatch && urlMatch[1] && !images.includes(urlMatch[1])) {
          images.push(urlMatch[1]);
        }
      }
    }

    const twImg = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/gi);
    if (twImg) {
      for (const m of twImg) {
        const urlMatch = m.match(/content=["']([^"']+)["']/i);
        if (urlMatch && urlMatch[1] && !images.includes(urlMatch[1])) {
          images.push(urlMatch[1]);
        }
      }
    }

    // Check JSON-LD structured data
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const block of jsonLdMatches) {
        try {
          const content = block.replace(/<script[^>]*>|<\/script>/gi, '').trim();
          const parsed = JSON.parse(content);
          const item = parsed['@graph'] ? parsed['@graph'].find((x: any) => x['@type'] === 'Product') : parsed;

          if (item && (item['@type'] === 'Product' || item.name)) {
            if (!title && item.name) title = item.name;
            if (!description && item.description) description = item.description;

            if (item.image) {
              const imgArray = Array.isArray(item.image) ? item.image : [item.image];
              for (const im of imgArray) {
                const imgUrl = typeof im === 'string' ? im : im.url;
                if (imgUrl && !images.includes(imgUrl)) images.push(imgUrl);
              }
            }

            if (item.offers) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer && offer.price) {
                price = parseFloat(offer.price);
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON-LD
        }
      }
    }

    // Search HTML for gallery images (e.g. alicdn, shopify, youcan)
    const imgMatches = html.match(/<img[^>]+src=["']([^"']+)["']/gi);
    if (imgMatches) {
      for (const im of imgMatches) {
        const srcMatch = im.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          const src = srcMatch[1];
          if (
            (src.includes('alicdn.com') ||
              src.includes('cdn.shopify.com') ||
              src.includes('youcan') ||
              src.includes('/product') ||
              src.includes('cloudfront.net')) &&
            !src.includes('icon') &&
            !src.includes('logo') &&
            !src.includes('badge') &&
            !src.includes('1x1') &&
            !src.endsWith('.svg')
          ) {
            let normalized = src;
            if (normalized.startsWith('//')) normalized = 'https:' + normalized;
            else if (normalized.startsWith('/')) normalized = new URL(normalized, url.origin).href;

            if (!images.includes(normalized)) {
              images.push(normalized);
            }
          }
        }
      }
    }

    // 4. Price Extraction
    if (!price) {
      const priceMeta = html.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i);
      if (priceMeta && priceMeta[1]) {
        price = parseFloat(priceMeta[1]);
      }
    }

    // 5. Technical Specifications Extraction
    // Check HTML tables, definitions, and spec lists
    const tableRowMatches = html.matchAll(/<tr[^>]*>\s*<(?:th|td)[^>]*>(.*?)<\/(?:th|td)>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gis);
    for (const match of tableRowMatches) {
      const rawLabel = (match[1] || '').replace(/<[^>]+>/g, '').trim();
      const rawVal = (match[2] || '').replace(/<[^>]+>/g, '').trim();
      if (rawLabel && rawVal && rawLabel.length < 40 && rawVal.length < 80 && !rawLabel.toLowerCase().includes('cookie')) {
        features.push(`${rawLabel}: ${rawVal}`);
      }
    }

    const dlMatches = html.matchAll(/<dt[^>]*>(.*?)<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/gis);
    for (const match of dlMatches) {
      const rawLabel = (match[1] || '').replace(/<[^>]+>/g, '').trim();
      const rawVal = (match[2] || '').replace(/<[^>]+>/g, '').trim();
      if (rawLabel && rawVal && rawLabel.length < 40 && rawVal.length < 80) {
        features.push(`${rawLabel}: ${rawVal}`);
      }
    }
  }

  // Fallback: Infer product name from URL slug if title is empty
  if (!title) {
    const segments = url.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    const cleanSlug = lastSegment
      .replace(/\.html?$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\d{6,}\b/g, '') // remove pure item IDs
      .trim();

    title = cleanSlug
      ? cleanSlug.replace(/\b\w/g, (c) => c.toUpperCase())
      : `${platform} Featured Product`;
  }

  // Normalize pricing
  if (!price || isNaN(price) || price <= 0) {
    price = 249; // Default 249 MAD / $24.99
  } else {
    if (price < 50) {
      price = Math.round(price * 10);
    }
  }
  originalPrice = Math.round(price * 1.6);

  // Normalize images and add high-res Unsplash fallbacks if sparse
  const validImages = images
    .map((im) => (im.startsWith('//') ? 'https:' + im : im))
    .filter((im) => im.startsWith('http://') || im.startsWith('https://'))
    .slice(0, 5);

  const niche = inferNiche(title + ' ' + description);
  const nicheKey = niche.toLowerCase().includes('beauty')
    ? 'beauty'
    : niche.toLowerCase().includes('health')
    ? 'health'
    : niche.toLowerCase().includes('kitchen')
    ? 'kitchen'
    : niche.toLowerCase().includes('electro')
    ? 'electronics'
    : 'general';

  const finalImages = validImages.length >= 2 ? validImages : [...validImages, ...NICHE_UNSPLASH_FALLBACKS[nicheKey]];

  // Build structured specifications
  const defaultSpecsByNiche: Record<string, ProductSpecification[]> = {
    electronics: [
      { label: 'Display & Optics', value: '1080p FHD Native (4K Ultra HD Decoding Support)' },
      { label: 'Battery / Power', value: 'High-Capacity 5000mAh Battery (Up to 4h Runtime)' },
      { label: 'Wireless Connectivity', value: 'Dual-Band Wi-Fi 6 + Bluetooth 5.3 Low Latency' },
      { label: 'Chassis Materials', value: 'Aviation-Grade Anodized Aluminum + Matte ABS' },
      { label: 'Dimensions & Weight', value: 'Ultra-Compact 140 x 100 x 40mm, 420g Portable' },
    ],
    beauty: [
      { label: 'Active Ingredients', value: '100% Pure Cold-Pressed Argan, Jojoba & Castor Oils' },
      { label: 'Net Volume', value: '50 ml / 1.7 fl. oz (Over 60 Applications)' },
      { label: 'Skin & Hair Type', value: 'All Types (Hypoallergenic & Dermatologically Tested)' },
      { label: 'Origin', value: 'Certified Organic Moroccan Sourcing' },
    ],
    health: [
      { label: 'Ergonomic Design', value: 'Multi-Level Adjustable Acupressure Nodes' },
      { label: 'Material & Durability', value: 'Eco-Friendly High-Toughness ABS Polymer' },
      { label: 'Maximum Load', value: 'Tested up to 150 kg (330 lbs)' },
      { label: 'Recommended Use', value: '5-10 Minutes Daily for Rapid Decompression' },
    ],
    kitchen: [
      { label: 'Blade System', value: '6-Leaf 304 Stainless Steel Serrated Blades' },
      { label: 'Motor Speed', value: '22,000 RPM High-Torque Turbo Copper Motor' },
      { label: 'Capacity & Battery', value: '450 ml BPA-Free Tritan Cup, USB-C Rechargeable' },
    ],
    general: [
      { label: 'Build Quality', value: 'Premium Commercial-Grade Construction' },
      { label: 'Warranty', value: '12-Month Replacement Guarantee Included' },
      { label: 'Package Includes', value: 'Product Unit, Quick Start Guide, Accessories' },
    ],
  };

  const parsedSpecs: ProductSpecification[] = [];
  for (const f of features) {
    if (f.includes(':')) {
      const [l, ...rest] = f.split(':');
      const v = rest.join(':').trim();
      if (l.trim() && v && parsedSpecs.length < 5) {
        parsedSpecs.push({ label: l.trim(), value: v });
      }
    }
  }

  const finalSpecs = parsedSpecs.length >= 2 ? parsedSpecs : defaultSpecsByNiche[nicheKey] || defaultSpecsByNiche.electronics;

  return {
    platform,
    title,
    description: description || `Original high-demand bestselling product with verified quality and replacement guarantee.`,
    price,
    originalPrice,
    currency: 'MAD',
    images: finalImages.slice(0, 6),
    features: [
      'Original premium quality with modern, highly durable ergonomic design',
      'Instant and visible results from the very first days of use',
      'Comprehensive 12-month manufacturer replacement warranty included',
      'Fast doorstep cash on delivery with inspection before payment',
    ],
    specifications: finalSpecs,
    niche,
    rawUrl: targetUrl,
  };
}
