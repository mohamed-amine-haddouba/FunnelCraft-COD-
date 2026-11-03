import type { StoredPage } from '../src/types/user';
import { getPublishedPageBySlug } from './db';

export interface ProductQuote {
  pageId: string;
  slug: string;
  ownerId: string;
  product: string;
  quantity: number;
  price: number;
  currency: string;
}
interface Offer { id?: string; name?: string; label?: string; quantity?: number; price?: number }
interface Catalog {
  price?: number; currency?: string; bundles?: Offer[];
  scrapedData?: { price?: number; currency?: string; bundles?: Offer[] };
  blocks?: { type?: string; bundles?: Offer[]; shippingCost?: number; currency?: string; priceDiscounted?: number }[];
}
export function publishedQuote(page: StoredPage | null, choice: Record<string, unknown>): ProductQuote | null {
  if (!page?.isPublished || !page.userId || !page.data) return null;
  const data = page.data as Catalog;
  const form = data.blocks?.find(b => b.type === 'cod-form');
  const hero = data.blocks?.find(b => b.type === 'hero');
  const blockCheckout = typeof choice.bundleId === 'string' || typeof choice.bundleName === 'string';
  const scrapedOffers = data.scrapedData?.bundles ?? data.bundles;
  const useForm = Boolean(form?.bundles?.length && (blockCheckout || !scrapedOffers?.length));
  const offers = (useForm ? form?.bundles : scrapedOffers) ?? [];
  const requestedQty = Number(choice.quantity ?? choice.bundleQuantity ?? 1);
  let offer: Offer | undefined;
  if (offers.length) {
    if (choice.bundleId) offer = offers.find(b => b.id === choice.bundleId);
    else if (choice.bundleName) offer = offers.find(b => (b.name || b.label) === choice.bundleName);
    else if (choice.bundleIndex != null) offer = offers[Number(choice.bundleIndex)];
    else offer = offers.find(b => Number(b.quantity) === requestedQty);
  } else {
    const base = Number(data.scrapedData?.price ?? data.price ?? hero?.priceDiscounted);
    // Same default bundle schedule as the public product view, derived from the saved price.
    const discounts = [1, 0.85, 0.75];
    if (Number.isFinite(base) && base > 0 && [1, 2, 3].includes(requestedQty))
      offer = { quantity: requestedQty, price: requestedQty === 1 ? base : Math.round(base * requestedQty * discounts[requestedQty - 1]) };
  }
  if (!offer) return null;
  const qty = Number(offer.quantity), price = Number(offer.price), shipping = useForm ? Number(form?.shippingCost ?? 0) : 0;
  if (!Number.isInteger(qty) || qty < 1 || !Number.isFinite(price) || price <= 0 || !Number.isFinite(shipping) || shipping < 0) return null;
  const rawCurrency = useForm ? form?.currency : data.scrapedData?.currency ?? data.currency ?? hero?.currency;
  const code = String(rawCurrency || 'MAD').trim().toUpperCase();
  const currency = ({ 'DH': 'MAD', 'DHS': 'MAD', 'د.م.': 'MAD', '$': 'USD', '€': 'EUR' } as Record<string,string>)[code] ?? code;
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return { pageId: page.id, slug: page.slug, ownerId: page.userId, product: page.title, quantity: qty, price: Math.round((price + shipping) * 100) / 100, currency };
}

export function resolveQuote(choice: Record<string, unknown>) {
  const slug = choice.pageSlug || choice.funnelId || choice.identifier;
  return typeof slug === 'string' ? publishedQuote(getPublishedPageBySlug(slug), choice) : null;
}
