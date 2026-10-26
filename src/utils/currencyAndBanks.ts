import { MoroccanBankAccount, MoroccanPaymentMethod } from '../types/user';

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  MAD: 10.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.51,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  MAD: 'DH',
  CAD: 'C$',
  AUD: 'A$',
};

export const SUPPORTED_DISPLAY_CURRENCIES: Array<{
  code: string;
  symbol: string;
  label: string;
  flag: string;
}> = [
  { code: 'MAD', symbol: 'DH', label: 'درهم مغربي (MAD)', flag: '🇲🇦' },
  { code: 'USD', symbol: '$', label: 'دولار أمريكي (USD)', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', label: 'يورو (EUR)', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', label: 'جنيه إسترليني (GBP)', flag: '🇬🇧' },
  { code: 'CAD', symbol: 'C$', label: 'دولار كندي (CAD)', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', label: 'دولار أسترالي (AUD)', flag: '🇦🇺' },
];

/**
 * Converts a base price in MAD into the target currency formatted with its symbol.
 * Step 1: Convert MAD -> USD using rates['MAD'] (default 10).
 * Step 2: Convert USD -> targetCurrency using rates[targetCurrency] (default 1).
 */
export function formatConvertedPrice(
  basePriceMAD: number,
  targetCurrency: string,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): string {
  const safeBase = Number.isFinite(basePriceMAD) && basePriceMAD > 0 ? basePriceMAD : 0;
  const madRate = rates['MAD'] && rates['MAD'] > 0 ? rates['MAD'] : 10.0;
  const priceUSD = safeBase / madRate;
  const targetRate =
    targetCurrency === 'USD'
      ? 1
      : rates[targetCurrency] && rates[targetCurrency] > 0
      ? rates[targetCurrency]
      : 1;
  const converted = priceUSD * targetRate;
  const symbol = CURRENCY_SYMBOLS[targetCurrency] || targetCurrency;
  return `${converted.toFixed(2)} ${symbol}`;
}

/**
 * Calculates the numerical USD settlement amount for PayPal Checkout from a base MAD price.
 */
export function calculatePayPalUsdSettlement(
  basePriceMAD: number,
  rates: Record<string, number> = DEFAULT_EXCHANGE_RATES
): {
  amount: number;
  formattedAmount: string;
  amountUSD: number;
  formattedUSD: string;
  currency: 'USD';
  isConverted: boolean;
} {
  const safeBase = Number.isFinite(basePriceMAD) && basePriceMAD > 0 ? basePriceMAD : 0;
  const madRate = rates['MAD'] && rates['MAD'] > 0 ? rates['MAD'] : 10.0;
  const amountUSD = Number((safeBase / madRate).toFixed(2));
  const formattedUSD = amountUSD.toFixed(2);
  return {
    amount: amountUSD,
    formattedAmount: formattedUSD,
    amountUSD,
    formattedUSD,
    currency: 'USD',
    isConverted: true,
  };
}

/**
 * Normalizes raw API exchange rate responses into a clean rates record with fallback guarantees.
 */
export function normalizeExchangeRates(
  rawRates: Record<string, unknown> | undefined | null
): Record<string, number> {
  const normalized: Record<string, number> = { ...DEFAULT_EXCHANGE_RATES };
  if (!rawRates || typeof rawRates !== 'object') {
    return normalized;
  }

  for (const key of Object.keys(DEFAULT_EXCHANGE_RATES)) {
    const val = Number(rawRates[key]);
    if (Number.isFinite(val) && val > 0) {
      normalized[key] = Number(val.toFixed(4));
    }
  }
  normalized.USD = 1;
  return normalized;
}

export const DEFAULT_MOROCCAN_BANK_ACCOUNTS: MoroccanBankAccount[] = [
  {
    id: 'bank-cih',
    methodId: 'CIH',
    name: 'CIH Bank',
    bankName: 'بنك CIH المغرب',
    subtitle: 'تطبيق CIH Mobile أو وكالة بنكية',
    badge: 'تحويل فوري مجاني',
    rib: '230 780 49182940120194 52',
    beneficiary: 'CODWORTH SARL',
    instructions: 'قم بإجراء تحويل بنكي مباشر من تطبيق CIH Mobile أو الشباك البنكي للـ RIB أسفله.',
    isActive: true,
  },
  {
    id: 'bank-attijari',
    methodId: 'Attijariwafa',
    name: 'Attijariwafa Bank',
    bankName: 'التجاري وفا بنك',
    subtitle: 'التجاري وفا بنك (Attijari Mobile / Agence)',
    badge: 'تأكيد سريع',
    rib: '007 780 00019284910294 38',
    beneficiary: 'CODWORTH SARL',
    instructions: 'قم بتحويل المبلغ إلى حسابنا البنكي التجاري وفا بنك عبر التطبيق أو الإيداع النقدي.',
    isActive: true,
  },
  {
    id: 'bank-bp',
    methodId: 'BanquePopulaire',
    name: 'Banque Populaire (البنك الشعبي)',
    bankName: 'البنك الشعبي المغربي (Chaabi)',
    subtitle: 'تطبيق Pocket Bank أو وكالة بنكية',
    badge: 'شبكة واسعة',
    rib: '101 780 21213456789012 44',
    beneficiary: 'CODWORTH SARL',
    instructions: 'أرسل التحويل عبر تطبيق Pocket Bank أو من أي فرع للبنك الشعبي في المملكة.',
    isActive: true,
  },
  {
    id: 'bank-cashplus',
    methodId: 'CashPlus',
    name: 'Cash Plus (كاش بلوس)',
    bankName: 'Cash Plus Maroc',
    subtitle: 'حوالة نقدية عبر أقرب وكالة كاش بلوس',
    badge: 'دفع نقدي فوري',
    rib: '',
    beneficiary: 'Karim Bennani',
    cin: 'BE892104',
    phone: '+212 661 928 410',
    instructions: 'توجه إلى أي وكالة Cash Plus وأرسل المبلغ باسم المستفيد ورقم البطاقة الوطنية (CIN).',
    isActive: true,
  },
];

export function filterActiveBankAccounts(accounts: MoroccanBankAccount[]): MoroccanBankAccount[] {
  if (!Array.isArray(accounts)) return [];
  return accounts.filter((acc) => acc && acc.isActive !== false && Boolean(acc.name?.trim()));
}

export function inferMoroccanPaymentMethod(
  input?: string | MoroccanBankAccount
): MoroccanPaymentMethod {
  if (input && typeof input === 'object') {
    if (
      input.methodId === 'CIH' ||
      input.methodId === 'Attijariwafa' ||
      input.methodId === 'BanquePopulaire' ||
      input.methodId === 'CashPlus' ||
      input.methodId === 'Wafacash'
    ) {
      return input.methodId;
    }
    return inferMoroccanPaymentMethod(`${input.id || ''} ${input.name || ''} ${input.bankName || ''}`);
  }
  const val = (input || '').trim();
  if (
    val === 'CIH' ||
    val === 'Attijariwafa' ||
    val === 'BanquePopulaire' ||
    val === 'CashPlus' ||
    val === 'Wafacash'
  ) {
    return val;
  }
  const lower = val.toLowerCase();
  if (lower.includes('attijari')) return 'Attijariwafa';
  if (lower.includes('populaire') || lower.includes('chaabi') || lower.includes('شعبي')) {
    return 'BanquePopulaire';
  }
  if (lower.includes('cash') && lower.includes('plus')) return 'CashPlus';
  if (lower.includes('wafa')) return 'Wafacash';
  return 'CIH';
}
