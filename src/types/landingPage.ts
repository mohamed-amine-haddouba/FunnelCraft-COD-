import type { ScrapedProduct } from '../../server/scraper';

export type { ScrapedProduct };

export type BlockType =
  | 'promo-bar'
  | 'hero'
  | 'problem-solution'
  | 'features'
  | 'social-proof'
  | 'cod-form'
  | 'faq'
  | 'floating-cta'
  | 'trust-badges';

export interface PromoBarBlock {
  id: string;
  type: 'promo-bar';
  text: string;
  countdownMinutes: number;
  showTimer: boolean;
  stockWarning: string;
  bgColor: string;
  textColor: string;
  isSticky: boolean;
}

export interface HeroBlock {
  id: string;
  type: 'hero';
  badge: string;
  headline: string;
  subheadline: string;
  priceOriginal: number;
  priceDiscounted: number;
  currency: string;
  ctaText: string;
  ctaSubtext: string;
  images: string[];
  rating: number;
  reviewCount: number;
  trustPoints: string[];
}

export interface ProblemSolutionBlock {
  id: string;
  type: 'problem-solution';
  title: string;
  subtitle: string;
  problemTitle: string;
  problemItems: string[];
  solutionTitle: string;
  solutionItems: string[];
  highlightBadge: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  badge?: string;
}

export interface FeaturesBlock {
  id: string;
  type: 'features';
  title: string;
  subtitle: string;
  items: FeatureItem[];
  layout: 'grid-3' | 'grid-4' | 'cards';
}

export interface ReviewItem {
  id: string;
  name: string;
  city: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
  avatar?: string;
}

export interface SocialProofBlock {
  id: string;
  type: 'social-proof';
  title: string;
  subtitle: string;
  overallRating: number;
  totalReviews: number;
  reviews: ReviewItem[];
}

export interface BundleOption {
  id: string;
  name: string;
  quantity: number;
  price: number;
  originalPrice: number;
  badge?: string;
  popular?: boolean;
}

export interface CodFormBlock {
  id: string;
  type: 'cod-form';
  title: string;
  subtitle: string;
  currency: string;
  bundles: BundleOption[];
  shippingCost: number;
  guaranteeText: string;
  buttonText: string;
  fields: {
    requireAddress: boolean;
    requireCity: boolean;
    requireNote: boolean;
    defaultCities: string[];
  };
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqBlock {
  id: string;
  type: 'faq';
  title: string;
  subtitle: string;
  items: FaqItem[];
}

export interface FloatingCtaBlock {
  id: string;
  type: 'floating-cta';
  title: string;
  priceText: string;
  buttonText: string;
  timerText: string;
  showOnMobileOnly: boolean;
}

export interface TrustBadgeItem {
  icon: string;
  title: string;
  description: string;
}

export interface TrustBadgesBlock {
  id: string;
  type: 'trust-badges';
  title: string;
  badges: TrustBadgeItem[];
}

export type LandingPageBlock =
  | PromoBarBlock
  | HeroBlock
  | ProblemSolutionBlock
  | FeaturesBlock
  | SocialProofBlock
  | CodFormBlock
  | FaqBlock
  | FloatingCtaBlock
  | TrustBadgesBlock;

export interface PageTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontFamily: 'Inter' | 'Cairo' | 'Plus Jakarta Sans';
  borderRadius: 'rounded-none' | 'rounded-md' | 'rounded-xl' | 'rounded-2xl' | 'rounded-full';
}

export interface LandingPageData {
  id: string;
  title: string;
  slug?: string;
  language: 'en' | 'fr' | 'ar';
  direction: 'ltr' | 'rtl';
  theme: PageTheme;
  blocks: LandingPageBlock[];
  scrapedData?: ScrapedProduct;
}

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';
