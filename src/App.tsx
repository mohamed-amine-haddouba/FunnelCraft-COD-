import React, { useState, useEffect, useCallback } from 'react';
import {
  LandingPageData,
  LandingPageBlock,
  BlockType,
  ViewportMode,
  PageTheme,
} from './types/landingPage';
import { TEMPLATE_BEAUTY_EN, TEMPLATE_ARABIC_COD } from './data/defaultTemplates';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HeaderNav, WorkspaceTab } from './components/HeaderNav';
import { BlocksToolbar } from './components/BlocksToolbar';
import { CanvasRenderer } from './components/CanvasRenderer';
import { PropertiesSidebar } from './components/PropertiesSidebar';
import { AiGeneratorModal } from './components/AiGeneratorModal';
import { ExportModal } from './components/ExportModal';
import { AuthModal } from './components/AuthModal';
import { UpgradeModal } from './components/UpgradeModal';
import { AdminPaymentsModal } from './components/AdminPaymentsModal';
import { MyPagesModal } from './components/MyPagesModal';
import { PublishModal } from './components/PublishModal';
import { SettingsPage } from './components/SettingsPage';
import { OrdersDashboard } from './components/OrdersDashboard';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AuthPage } from './components/AuthPage';
import { AdminOwnerDashboard } from './components/AdminOwnerDashboard';
import { PricingPage } from './components/PricingPage';
import { ContactPage } from './components/ContactPage';
import { TermsPage } from './components/TermsPage';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { CustomerLandingPage, ScrapedProduct } from './components/CustomerLandingPage';
import { LanguageProvider, useLanguage } from './i18n/translations';
import { StoredPage } from './types/user';
import { SubscriptionPlanId } from './types/orders';
import {
  OrderSuccessModal,
  OrderConfirmationData,
} from './components/OrderSuccessModal';
import {
  Link2,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers,
  X,
  Clock,
  LogOut,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

const STORAGE_KEY = 'funnelcraft_page_draft';

const ARABIC_TO_LATIN_MAP: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ء': '', 'ؤ': 'w', 'ئ': 'y',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

function slugify(text: string): string {
  let raw = (text || '').toString();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep raw if not URI encoded
  }

  const cleanedInput = raw
    .replace(/\b404\s*[-_]*\s*(page|not\s*found)?\b/gi, '')
    .replace(/\bpage\s*not\s*found\b/gi, '')
    .toLowerCase()
    .trim();

  const transliterated = Array.from(cleanedInput)
    .map((ch) => (ARABIC_TO_LATIN_MAP[ch] !== undefined ? ARABIC_TO_LATIN_MAP[ch] : ch))
    .join('');

  const cleaned = transliterated
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!cleaned || cleaned === '404' || cleaned === '404-page' || cleaned.includes('404-page')) {
    return `funnel-${Date.now().toString(36)}`;
  }
  return cleaned;
}

function buildBlocksFromScrapedProduct(
  scraped: ScrapedProduct,
  existingTheme: PageTheme
): LandingPageData {
  const timestamp = Date.now();
  const discountPct =
    scraped.originalPrice > scraped.price && scraped.originalPrice > 0
      ? Math.round(((scraped.originalPrice - scraped.price) / scraped.originalPrice) * 100)
      : 30;

  const blocks: LandingPageBlock[] = [
    {
      id: `block-promo-${timestamp}`,
      type: 'promo-bar',
      text: `🔥 تخفيض حصري ${discountPct}% اليوم فقط + التوصيل مجاني والدفع عند الاستلام 🇲🇦`,
      countdownMinutes: 15,
      showTimer: true,
      stockWarning: 'الكمية المتبقية محدودة جداً!',
      bgColor: '#065f46',
      textColor: '#ffffff',
      isSticky: true,
    },
    {
      id: `block-hero-${timestamp}`,
      type: 'hero',
      badge: `⭐ الأكثر مبيعاً في المغرب (${scraped.platform})`,
      headline: scraped.title,
      subheadline: scraped.description,
      priceOriginal: scraped.originalPrice,
      priceDiscounted: scraped.price,
      currency: scraped.currency || 'MAD',
      ctaText: 'اطلب الآن — الدفع عند الاستلام',
      ctaSubtext: '🚚 توصيل سريع 24-48 ساعة • 📦 الدفع عند الاستلام • 🛡️ ضمان الجودة 100%',
      images:
        Array.isArray(scraped.images) && scraped.images.length > 0
          ? scraped.images
          : [
              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80',
            ],
      rating: 4.9,
      reviewCount: scraped.reviews?.length || 128,
      trustPoints:
        Array.isArray(scraped.features) && scraped.features.length > 0
          ? scraped.features.slice(0, 4)
          : [
              'منتج أصلي عالي الجودة ومفحوص قبل الإرسال',
              'توصيل سريع لباب المنزل في جميع المدن المغربية',
              'لا تدفع أي درهم حتى تتوصل بالمنتج وتتحقق منه',
            ],
    },
    {
      id: `block-features-${timestamp}`,
      type: 'features',
      title: 'لماذا يختار الزبناء هذا المنتج؟',
      subtitle: 'مميزات حصرية ومواصفات مضمونة',
      layout: 'grid-3',
      items: (Array.isArray(scraped.features) && scraped.features.length > 0
        ? scraped.features
        : ['جودة عالية ومضمونة', 'سهل الاستخدام وعملي', 'ضمان الاستبدال المجاني']
      ).map((feat, idx) => ({
        icon: idx === 0 ? 'Sparkles' : idx === 1 ? 'ShieldCheck' : 'Truck',
        title: feat,
        description:
          scraped.specifications?.[idx]?.value ||
          'مصمم بعناية ليمنحك أفضل تجربة وأعلى قيمة مقابل السعر.',
        badge: idx === 0 ? 'مضمون 100%' : undefined,
      })),
    },
    {
      id: `block-cod-${timestamp}`,
      type: 'cod-form',
      title: 'اطلب الآن — الدفع نقداً عند الاستلام',
      subtitle: 'املأ معلوماتك بالأسفل وسنتصل بك هاتفياً لتأكيد الطلب وإرساله فوراً',
      currency: scraped.currency || 'MAD',
      shippingCost: 0,
      guaranteeText: 'ضمان 100%: عاين طلبك عند الاستلام قبل الدفع للموزع.',
      buttonText: 'تأكيد الطلب الآن (الدفع عند الاستلام)',
      bundles: (Array.isArray(scraped.bundles) && scraped.bundles.length > 0
        ? scraped.bundles
        : [
            {
              quantity: 1,
              discountPercent: 0,
              freeShipping: true,
              label: 'قطعة واحدة (1x)',
              price: scraped.price,
              originalPrice: scraped.originalPrice,
            },
          ]
      ).map((b, idx) => ({
        id: `bundle-${timestamp}-${idx}`,
        name: b.label,
        quantity: b.quantity,
        price: b.price,
        originalPrice: b.originalPrice,
        badge: b.badge || (b.discountPercent > 0 ? `توفير ${b.discountPercent}%` : 'توصيل مجاني'),
        popular: idx === 1,
      })),
      fields: {
        requireAddress: true,
        requireCity: true,
        requireNote: true,
        defaultCities: ['الدار البيضاء', 'الرباط', 'مراكش', 'طنجة', 'فاس', 'أكادير'],
      },
    },
    {
      id: `block-reviews-${timestamp}`,
      type: 'social-proof',
      title: 'آراء وتجارب زبنائنا في المغرب 🇲🇦',
      subtitle: 'تقييمات حقيقية من زبناء توصلوا بالمنتج',
      overallRating: 4.9,
      totalReviews: scraped.reviews?.length || 145,
      reviews: (Array.isArray(scraped.reviews) ? scraped.reviews : []).map((r, idx) => ({
        id: `rev-${timestamp}-${idx}`,
        name: r.author,
        city: r.city,
        rating: r.rating || 5,
        date: 'منذ يومين',
        comment: r.comment,
        verified: true,
      })),
    },
    {
      id: `block-faq-${timestamp}`,
      type: 'faq',
      title: 'الأسئلة الشائعة',
      subtitle: 'كل ما تحتاج معرفته حول الطلب والتوصيل والضمان',
      items: (Array.isArray(scraped.faqs) ? scraped.faqs : []).map((f, idx) => ({
        id: `faq-${timestamp}-${idx}`,
        question: f.question,
        answer: f.answer,
      })),
    },
  ];

  return {
    id: `page-${timestamp}`,
    title: scraped.title,
    slug: slugify(scraped.title),
    language: 'ar',
    direction: 'rtl',
    theme: {
      ...existingTheme,
      fontFamily: 'Cairo',
    },
    blocks,
    scrapedData: {
      ...scraped,
      images: Array.isArray(scraped.images) ? [...scraped.images] : [],
      features: Array.isArray(scraped.features) ? [...scraped.features] : [],
    },
  };
}

function BuilderWorkspace() {
  const {
    user,
    isLoading,
    isLoggedIn,
    isPro,
    isAdmin,
    isImpersonating,
    impersonatedUser,
    stopImpersonating,
    logout,
    pagesCreatedCount,
    maxFreePages,
    isLimitReached,
    checkCanPerformAction,
    recordPageAction,
    saveUserPageToCloud,
    userPages,
  } = useAuth();
  const { dir, language, t } = useLanguage();

  // Initialize state with LocalStorage draft if available, otherwise preset template
  const [pageData, setPageData] = useState<LandingPageData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.blocks)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read saved draft:', e);
    }
    return TEMPLATE_BEAUTY_EN;
  });

  // Undo / Redo history
  const [history, setHistory] = useState<{
    past: LandingPageData[];
    future: LandingPageData[];
  }>({
    past: [],
    future: [],
  });

  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isAdminPaymentsModalOpen, setIsAdminPaymentsModalOpen] = useState(false);
  const [isMyPagesModalOpen, setIsMyPagesModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved' | 'error'>('idle');
  const [upgradeTriggerReason, setUpgradeTriggerReason] = useState<string>('');
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmationData | null>(null);

  // Scraper URL Import States
  const [scrapeUrl, setScrapeUrl] = useState<string>('');
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeSuccessToast, setScrapeSuccessToast] = useState<string | null>(null);
  const [builderRenderMode, setBuilderRenderMode] = useState<'scraped' | 'blocks'>(() =>
    pageData.scrapedData ? 'scraped' : 'blocks'
  );

  // Helper to resolve public view from URL pathname
  const resolvePublicViewFromPathname = (rawPath: string): 'contact' | 'terms' | 'privacy' | null => {
    const cleanPath = rawPath.replace(/\/$/, '');
    if (cleanPath === '/contact') return 'contact';
    if (cleanPath === '/terms') return 'terms';
    if (cleanPath === '/privacy') return 'privacy';
    return null;
  };

  // Platform-wide SaaS View & Pro Plan Gating
  const [activeView, setActiveView] = useState<WorkspaceTab>(() => {
    if (typeof window !== 'undefined') {
      const publicView = resolvePublicViewFromPathname(window.location.pathname);
      if (publicView) return publicView;
    }
    return 'builder';
  });
  const [isCustomerLiveView, setIsCustomerLiveView] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlanId>(() => {
    return (localStorage.getItem('funnelcraft_plan') as SubscriptionPlanId) || 'free';
  });
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

  const handleViewChange = useCallback((nextView: WorkspaceTab) => {
    if (typeof window !== 'undefined') {
      if (nextView === 'contact' || nextView === 'terms' || nextView === 'privacy') {
        const targetPath = `/${nextView}`;
        if (window.location.pathname !== targetPath) {
          window.history.pushState({}, '', targetPath);
        }
      } else {
        const currentClean = window.location.pathname.replace(/\/$/, '');
        if (currentClean === '/contact' || currentClean === '/terms' || currentClean === '/privacy') {
          window.history.pushState({}, '', '/');
        }
      }
    }
    setActiveView(nextView);
  }, []);

  // Listen to browser back/forward navigation for public routes
  useEffect(() => {
    const handlePopState = () => {
      const pubView = resolvePublicViewFromPathname(window.location.pathname);
      if (pubView) {
        setActiveView(pubView);
      } else {
        setActiveView((prev) =>
          prev === 'contact' || prev === 'terms' || prev === 'privacy' ? 'builder' : prev
        );
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigateToPricing = useCallback((reason?: string) => {
    setUpgradeTriggerReason(reason || '');
    handleViewChange('pricing');
  }, [handleViewChange]);

  // Immediate Super Admin access: when naadianajah2020@gmail.com / admin logs in, grant immediate access to Admin Control Center
  useEffect(() => {
    if (typeof window !== 'undefined' && resolvePublicViewFromPathname(window.location.pathname)) {
      return;
    }
    if (user && (user.email?.toLowerCase() === 'naadianajah2020@gmail.com' || user.role === 'admin')) {
      setActiveView((prev) =>
        prev === 'contact' || prev === 'terms' || prev === 'privacy' ? prev : 'admin'
      );
    }
  }, [user?.id, user?.email, user?.role]);

  // Fallback if non-admin tries to stay on admin tab
  useEffect(() => {
    if (activeView === 'admin' && !isAdmin) {
      setActiveView('builder');
    }
  }, [activeView, isAdmin]);

  // Sync initial pending orders count from backend (authenticated)
  useEffect(() => {
    const authToken = localStorage.getItem('funnelcraft_auth_token');
    if (!authToken) return;
    fetch('/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.orders)) {
          const pending = data.orders.filter((o: { status?: string }) => o.status === 'pending').length;
          setPendingOrdersCount(pending);
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  // Handle Live COD Order Confirmation & capture to server
  const handleOrderConfirmed = useCallback(async (data: OrderConfirmationData) => {
    setOrderConfirmation(data);
    setPendingOrdersCount((prev) => prev + 1);

    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: data.customerName,
          phone: data.customerPhone,
          city: data.customerCity,
          address: data.customerAddress,
          productName: data.bundle?.name || pageData.title || 'منتج صفحة الهبوط',
          price: data.totalPrice,
          quantity: data.bundle?.quantity || 1,
          funnelId: pageData.id,
          pageSlug: pageData.slug,
          notes: data.customerNote,
          recaptchaToken: data.recaptchaToken,
          turnstileToken: data.turnstileToken,
        }),
      });
    } catch (err) {
      console.warn('Failed to post order to server:', err);
    }
  }, [pageData.id, pageData.slug, pageData.title]);

  const currentStoredPage = userPages.find((p) => p.id === pageData.id);

  // Auto-save to LocalStorage with debounce and mark unsaved
  useEffect(() => {
    setSaveStatus((prev) => (prev === 'saved' ? 'unsaved' : prev));
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pageData));
      } catch (err) {
        console.error('Failed to save to localStorage:', err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [pageData]);

  // Push new state to history for Undo/Redo
  const updatePageDataWithHistory = useCallback(
    (updater: (prev: LandingPageData) => LandingPageData) => {
      setPageData((current) => {
        const next = updater(current);
        setHistory((h) => ({
          past: [...h.past.slice(-20), current],
          future: [],
        }));
        return next;
      });
    },
    []
  );

  // Handler for "استيراد منتج بالرابط" (POST /api/scrape-product)
  const handleScrapeProductByUrl = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedUrl = scrapeUrl.trim();
    if (!trimmedUrl) {
      setScrapeError('المرجو إدخال رابط المنتج أولاً (Shopify, YouCan, AliExpress, Amazon, Jumia, Noon).');
      return;
    }

    setIsScraping(true);
    setScrapeError(null);
    setScrapeSuccessToast(null);

    try {
      const response = await fetch('/api/scrape-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      if (!response.ok) {
        const errPayload = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(
          errPayload.error || errPayload.message || 'فشل استيراد بيانات المنتج من الرابط.'
        );
      }

      const rawPayload = (await response.json()) as ScrapedProduct & {
        product?: ScrapedProduct;
      };
      const scrapedProduct: ScrapedProduct = rawPayload.product ? rawPayload.product : rawPayload;

      // Completely replace current pageData with a fresh LandingPageData object
      const freshPageData = buildBlocksFromScrapedProduct(scrapedProduct, pageData.theme);
      updatePageDataWithHistory(() => freshPageData);

      setBuilderRenderMode('scraped');
      setSelectedBlockId(null);
      setSaveStatus('unsaved');
      setScrapeUrl('');
      setScrapeSuccessToast(`تم استيراد "${scrapedProduct.title}" وتجهيز صفحة الهبوط بنجاح!`);
      setTimeout(() => {
        setScrapeSuccessToast(null);
      }, 5000);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء سحب بيانات المنتج. تأكد من صحة الرابط وحاول مجدداً.';
      setScrapeError(message);
      setTimeout(() => {
        setScrapeError(null);
      }, 6000);
    } finally {
      setIsScraping(false);
    }
  };

  const handleUndo = useCallback(() => {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, history.past.length - 1);

    setHistory((h) => ({
      past: newPast,
      future: [pageData, ...h.future],
    }));
    setPageData(previous);
  }, [history, pageData]);

  const handleRedo = useCallback(() => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    const newFuture = history.future.slice(1);

    setHistory((h) => ({
      past: [...h.past, pageData],
      future: newFuture,
    }));
    setPageData(next);
  }, [history, pageData]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if (e.key === 'Escape') {
        setSelectedBlockId(null);
        setIsAiModalOpen(false);
        setIsExportModalOpen(false);
        setIsAuthModalOpen(false);
        setIsUpgradeModalOpen(false);
        setIsAdminPaymentsModalOpen(false);
        setIsMyPagesModalOpen(false);
        setIsPublishModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  /* --- Cloud Persistence & Funnels Manager Actions --- */

  const handleSaveCurrentPage = async () => {
    if (!isLoggedIn) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }

    setSaveStatus('saving');
    try {
      const resolvedSlug =
        pageData.slug && !pageData.slug.includes('404')
          ? slugify(pageData.slug)
          : slugify(pageData.title);

      const updatedPageData: LandingPageData = {
        ...pageData,
        slug: resolvedSlug,
      };

      const res = await saveUserPageToCloud({
        id: updatedPageData.id,
        title: updatedPageData.title,
        slug: resolvedSlug,
        data: updatedPageData,
      });

      if (res.isLimitReached) {
        handleNavigateToPricing(
          res.error ||
            `Free Tier Limit Reached (${pagesCreatedCount}/${maxFreePages} Pages). Upgrade to Pro to save more pages.`
        );
        setSaveStatus('idle');
        return;
      }

      if (res.success && res.page) {
        setSaveStatus('saved');
        setPageData((prev) => ({
          ...prev,
          id: res.page!.id || prev.id,
          slug: res.page!.slug || resolvedSlug,
        }));
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  };

  const handleSelectPage = (page: StoredPage) => {
    if (page && page.data && Array.isArray(page.data.blocks)) {
      updatePageDataWithHistory(() => ({
        ...page.data,
        id: page.id,
        title: page.title || page.data.title || 'Untitled Landing Page',
      }));
      setBuilderRenderMode(page.data.scrapedData ? 'scraped' : 'blocks');
      setSelectedBlockId(null);
      setSaveStatus('saved');
    }
  };

  const handleCreateNewBlankPage = () => {
    if (!isPro && isLimitReached) {
      handleNavigateToPricing(
        `Free Tier Limit Reached (${pagesCreatedCount}/${maxFreePages} Pages Used). Upgrade to Pro to create unlimited funnels.`
      );
      return;
    }

    const newId = `page-${Date.now()}`;
    const newTitle = 'New Landing Page';
    const newPage: LandingPageData = {
      id: newId,
      title: newTitle,
      language: 'ar',
      direction: 'rtl',
      theme: TEMPLATE_ARABIC_COD.theme,
      blocks: TEMPLATE_ARABIC_COD.blocks.slice(0, 3),
    };

    updatePageDataWithHistory(() => newPage);
    setBuilderRenderMode('blocks');
    setSelectedBlockId(null);
    setSaveStatus('unsaved');
  };

  /* --- Freemium Limit Guard Actions --- */

  const handleTriggerAiGeneration = () => {
    const guard = checkCanPerformAction();
    if (!guard.allowed) {
      handleNavigateToPricing(
        `Free Tier Limit Reached (${pagesCreatedCount}/${maxFreePages} Pages Used). Upgrade to Pro for unlimited AI funnels.`
      );
      return;
    }
    setIsAiModalOpen(true);
  };

  const handleTriggerExport = async () => {
    const guard = checkCanPerformAction();
    if (!guard.allowed) {
      handleNavigateToPricing(
        `Free Tier Limit Reached (${pagesCreatedCount}/${maxFreePages} Pages Used). Upgrade to Pro to export unlimited funnels.`
      );
      return;
    }
    await recordPageAction();
    setIsExportModalOpen(true);
  };

  // Block Manipulation Handlers
  const handleAddBlock = (type: BlockType) => {
    const newId = `block-${type}-${Date.now()}`;
    let newBlock: LandingPageBlock;

    switch (type) {
      case 'promo-bar':
        newBlock = {
          id: newId,
          type: 'promo-bar',
          text: '⚡ FLASH SALE: 50% OFF + FREE CASH ON DELIVERY TODAY ONLY!',
          countdownMinutes: 15,
          showTimer: true,
          stockWarning: 'Only 9 items remaining in stock!',
          bgColor: '#0f172a',
          textColor: '#ffffff',
          isSticky: true,
        };
        break;

      case 'hero':
        newBlock = {
          id: newId,
          type: 'hero',
          badge: '⭐ #1 TOP RATED E-COMMERCE DEAL',
          headline: 'Transform Your Daily Life with Our Proven Solution',
          subheadline:
            'Engineered for maximum effectiveness and guaranteed results. Pay in cash only when your order arrives at your doorstep.',
          priceOriginal: 99.99,
          priceDiscounted: 49.99,
          currency: pageData.blocks.find((b) => b.type === 'hero')?.currency || 'USD',
          ctaText: 'Claim 50% Off & Pay on Delivery',
          ctaSubtext: '🚚 Free Express Shipping • 📦 Cash on Delivery • 🛡️ 30-Day Guarantee',
          images: [
            'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1000&q=80',
          ],
          rating: 4.9,
          reviewCount: 1890,
          trustPoints: [
            '100% Quality inspection before shipping',
            'Visible results from the first week',
            'Pay safely in cash to the courier',
          ],
        };
        break;

      case 'problem-solution':
        newBlock = {
          id: newId,
          type: 'problem-solution',
          title: 'Why Traditional Solutions Waste Your Money',
          subtitle: 'Compare older market alternatives with our newly engineered solution',
          problemTitle: 'Standard Market Products',
          problemItems: [
            'Overpriced with short-lived results',
            'Complicated to use and prone to breaking',
            'Requires risky upfront card payments',
          ],
          solutionTitle: 'Our Tested Solution',
          solutionItems: [
            'Affordable lifetime investment with durable design',
            'Easy and convenient to use anywhere',
            'Zero risk with Cash on Delivery at your door',
          ],
          highlightBadge: 'Proven 98% satisfaction rate',
        };
        break;

      case 'features':
        newBlock = {
          id: newId,
          type: 'features',
          title: 'Key Product Advantages',
          subtitle: 'Designed with cutting-edge materials and medical-grade precision',
          layout: 'grid-4',
          items: [
            {
              icon: 'Sparkles',
              title: 'Premium Materials',
              description: 'Long-lasting and ergonomic build designed for daily use.',
              badge: 'Top Tier',
            },
            {
              icon: 'ShieldCheck',
              title: '100% Certified Safe',
              description: 'Fully inspected and verified for optimal user safety.',
              badge: 'Guaranteed',
            },
            {
              icon: 'Truck',
              title: 'Rapid Doorstep Delivery',
              description: 'Arrives in 24 to 48 hours with direct local tracking.',
              badge: 'Express',
            },
            {
              icon: 'CheckCircle2',
              title: '30-Day Money Back',
              description: 'Love the results or receive an immediate prompt refund.',
            },
          ],
        };
        break;

      case 'social-proof':
        newBlock = {
          id: newId,
          type: 'social-proof',
          title: 'Loved by Over 18,000+ Verified Buyers',
          subtitle: 'Real customer feedback from people who order with Cash on Delivery',
          overallRating: 4.9,
          totalReviews: 2420,
          reviews: [
            {
              id: 'rev-sample-1',
              name: 'Jessica T.',
              city: 'Chicago, IL',
              rating: 5,
              date: '2 days ago',
              comment:
                'Paying in cash when the delivery guy arrived gave me 100% peace of mind. The quality exceeded my expectations!',
              verified: true,
              avatar:
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
            },
            {
              id: 'rev-sample-2',
              name: 'Michael B.',
              city: 'Houston, TX',
              rating: 5,
              date: '5 days ago',
              comment:
                'The 2-pack bundle is the best value. Fast shipping and fantastic customer service!',
              verified: true,
              avatar:
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
            },
          ],
        };
        break;

      case 'cod-form':
        newBlock = {
          id: newId,
          type: 'cod-form',
          title: 'Fast Cash on Delivery Checkout',
          subtitle: 'Fill in your details below. You do NOT need a credit card—pay only when you receive your package.',
          currency: 'USD',
          shippingCost: 0,
          guaranteeText: 'Zero risk: inspect your order upon arrival before handing cash to the delivery driver.',
          buttonText: 'CONFIRM MY ORDER (PAY ON ARRIVAL)',
          bundles: [
            {
              id: 'b-starter',
              name: '1x Standard Unit',
              quantity: 1,
              price: 49.99,
              originalPrice: 99.99,
              badge: '50% OFF',
              popular: false,
            },
            {
              id: 'b-duo',
              name: '2x Units (Most Popular)',
              quantity: 2,
              price: 79.99,
              originalPrice: 199.98,
              badge: 'BUY 1 GET 2ND 40% OFF - BEST VALUE',
              popular: true,
            },
          ],
          fields: {
            requireAddress: true,
            requireCity: true,
            requireNote: true,
            defaultCities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami'],
          },
        };
        break;

      case 'faq':
        newBlock = {
          id: newId,
          type: 'faq',
          title: 'Frequently Asked Questions',
          subtitle: 'Everything you need to know before completing your order',
          items: [
            {
              id: 'faq-new-1',
              question: 'How do I pay with Cash on Delivery?',
              answer:
                'Simply enter your address and phone number. Our team will verify your address, and our driver delivers the parcel directly to you. You pay in cash at that moment.',
            },
            {
              id: 'faq-new-2',
              question: 'How long does shipping take?',
              answer: 'Orders are dispatched within 24 hours and typically arrive within 24-48 business hours.',
            },
          ],
        };
        break;

      case 'floating-cta':
        newBlock = {
          id: newId,
          type: 'floating-cta',
          title: pageData.title || 'Special Offer Product',
          priceText: '$49.99 (Save 50%)',
          buttonText: 'Order Now (Pay on Delivery)',
          timerText: '14:59',
          showOnMobileOnly: true,
        };
        break;

      case 'trust-badges':
        newBlock = {
          id: newId,
          type: 'trust-badges',
          title: 'Our Customer Guarantees',
          badges: [
            {
              icon: 'ShieldCheck',
              title: 'Cash on Delivery Safe',
              description: 'Zero card fraud risk. Pay only upon delivery.',
            },
            {
              icon: 'Truck',
              title: 'Fast Free Delivery',
              description: 'Local express fulfillment to your door.',
            },
            {
              icon: 'CheckCircle2',
              title: '30-Day Money Back',
              description: 'Complete satisfaction or full return.',
            },
            {
              icon: 'PhoneCall',
              title: 'WhatsApp Phone Support',
              description: 'Direct assistance whenever you need it.',
            },
          ],
        };
        break;
    }

    updatePageDataWithHistory((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));
    setBuilderRenderMode('blocks');
    setSelectedBlockId(newId);
  };

  const handleUpdateBlock = (updatedBlock: LandingPageBlock) => {
    updatePageDataWithHistory((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)),
    }));
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pageData.blocks.length) return;

    updatePageDataWithHistory((prev) => {
      const updated = [...prev.blocks];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return { ...prev, blocks: updated };
    });
  };

  const handleDuplicateBlock = (index: number) => {
    const blockToCopy = pageData.blocks[index];
    const newBlock = {
      ...JSON.parse(JSON.stringify(blockToCopy)),
      id: `block-${blockToCopy.type}-${Date.now()}`,
    };

    updatePageDataWithHistory((prev) => {
      const updated = [...prev.blocks];
      updated.splice(index + 1, 0, newBlock);
      return { ...prev, blocks: updated };
    });
    setSelectedBlockId(newBlock.id);
  };

  const handleDeleteBlock = (index: number) => {
    const blockToDelete = pageData.blocks[index];
    updatePageDataWithHistory((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== index),
    }));
    if (selectedBlockId === blockToDelete.id) {
      setSelectedBlockId(null);
    }
  };

  const handleUpdateTheme = (updatedTheme: PageTheme) => {
    updatePageDataWithHistory((prev) => ({
      ...prev,
      theme: updatedTheme,
    }));
  };

  const handleUpdatePageMeta = (updates: Partial<LandingPageData>) => {
    updatePageDataWithHistory((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const handleLoadTemplate = (template: LandingPageData) => {
    updatePageDataWithHistory(() => JSON.parse(JSON.stringify(template)));
    setBuilderRenderMode(template.scrapedData ? 'scraped' : 'blocks');
    setSelectedBlockId(null);
  };

  // Detect public routes from window.location.pathname OR activeView BEFORE any authentication check
  const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : ''; // remove trailing slash
  const isPublicRoute =
    pathname === '/contact' ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    activeView === 'contact' ||
    activeView === 'terms' ||
    activeView === 'privacy';

  if (isPublicRoute && (!isLoggedIn || !user || user.status === 'pending')) {
    const resolvedPublicTab =
      pathname === '/contact'
        ? 'contact'
        : pathname === '/terms'
        ? 'terms'
        : pathname === '/privacy'
        ? 'privacy'
        : activeView;

    if (resolvedPublicTab === 'contact') {
      return (
        <div className="min-h-screen w-screen overflow-y-auto overflow-x-hidden bg-slate-950 font-sans text-slate-100" dir={dir}>
          <ContactPage
            onBackToHome={() => handleViewChange('builder')}
            onNavigateToTerms={() => handleViewChange('terms')}
            onNavigateToPrivacy={() => handleViewChange('privacy')}
          />
          <FloatingWhatsApp />
        </div>
      );
    }

    if (resolvedPublicTab === 'terms') {
      return (
        <div className="min-h-screen w-screen overflow-y-auto overflow-x-hidden bg-slate-950 font-sans text-slate-100" dir={dir}>
          <TermsPage
            onBackToHome={() => handleViewChange('builder')}
            onNavigateToContact={() => handleViewChange('contact')}
            onNavigateToPrivacy={() => handleViewChange('privacy')}
          />
          <FloatingWhatsApp />
        </div>
      );
    }

    if (resolvedPublicTab === 'privacy') {
      return (
        <div className="min-h-screen w-screen overflow-y-auto overflow-x-hidden bg-slate-950 font-sans text-slate-100" dir={dir}>
          <PrivacyPolicyPage
            onBackToHome={() => handleViewChange('builder')}
            onNavigateToTerms={() => handleViewChange('terms')}
            onNavigateToContact={() => handleViewChange('contact')}
          />
          <FloatingWhatsApp />
        </div>
      );
    }
  }

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3" dir={dir}>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-500/20 animate-pulse">
          ⚡
        </div>
        <div className="text-xs font-semibold text-slate-300">CodWorth</div>
      </div>
    );
  }

  // Security Gate: require authenticated merchant session to access workspace
  if (!isLoggedIn || !user) {
    return (
      <>
        <AuthPage
          initialMode="login"
          onNavigateToContact={() => handleViewChange('contact')}
          onNavigateToTerms={() => handleViewChange('terms')}
          onNavigateToPrivacy={() => handleViewChange('privacy')}
        />
        <FloatingWhatsApp />
      </>
    );
  }

  // Frontend Gate for Suspended Users only (New merchants are auto-activated)
  if (user.status === 'suspended' && !isImpersonating) {
    return (
      <div
        dir="rtl"
        className="min-h-screen w-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center p-4"
      >
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-8 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">
              ⚠️ الحساب موقوف مؤقتاً
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              مرحباً بك، {user.full_name}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed pt-1">
              تم إيقاف حسابك مؤقتاً من قبل الإدارة. يرجى التواصل مع فريق الدعم للمزيد من المعلومات.
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700 hover:border-rose-500"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج (Logout)</span>
          </button>
        </div>
      </div>
    );
  }

  // Pure Customer Storefront Live View
  if (isCustomerLiveView) {
    const effectiveSlug = pageData.slug || currentStoredPage?.slug;

    // Task 2: If pageData has scrapedData saved in its data object, render CustomerLandingPage
    if (pageData.scrapedData) {
      return (
        <div className="min-h-screen w-screen bg-slate-50 overflow-y-auto font-sans relative">
          {/* Floating Customer Live View Exit Pill */}
          <div className="fixed top-14 left-4 z-50 flex items-center gap-2 bg-slate-950/90 backdrop-blur-md text-white border border-slate-700 px-4 py-2 rounded-full shadow-2xl text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t.storefrontLivePreview}</span>
            <button
              type="button"
              onClick={() => setIsCustomerLiveView(false)}
              className="ms-2 px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition cursor-pointer"
            >
              {t.exitStorefront}
            </button>
          </div>

          <CustomerLandingPage
            product={pageData.scrapedData}
            pageSlug={effectiveSlug}
            funnelId={pageData.id}
            userId={user.id}
            onBack={() => setIsCustomerLiveView(false)}
          />
        </div>
      );
    }

    return (
      <div
        className="min-h-screen w-screen bg-white overflow-y-auto font-sans relative"
        dir={pageData.direction || (pageData.language === 'ar' ? 'rtl' : 'ltr')}
      >
        {/* Floating Customer Live View Exit Pill */}
        <div className="fixed top-4 end-4 z-50 flex items-center gap-2 bg-slate-950/90 backdrop-blur-md text-white border border-slate-700 px-4 py-2 rounded-full shadow-2xl text-xs font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{t.storefrontLivePreview}</span>
          <button
            type="button"
            onClick={() => setIsCustomerLiveView(false)}
            className="ms-2 px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition cursor-pointer"
          >
            {t.exitStorefront}
          </button>
        </div>

        {/* Fallback to existing Live Canvas Interactive Storefront */}
        <CanvasRenderer
          pageData={pageData}
          viewport="desktop"
          selectedBlockId={null}
          isPreviewMode={true}
          onSelectBlock={() => {}}
          onMoveBlock={() => {}}
          onDuplicateBlock={() => {}}
          onDeleteBlock={() => {}}
          onOrderConfirmed={handleOrderConfirmed}
        />

        {/* COD Order Confirmation Celebration Modal */}
        <OrderSuccessModal
          orderData={orderConfirmation}
          onClose={() => setOrderConfirmation(null)}
          isRtl={pageData.direction === 'rtl' || pageData.language === 'ar'}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden overflow-x-hidden bg-slate-950 font-sans text-slate-100" dir={dir}>
      {/* Top Application Navbar */}
      <HeaderNav
        pageData={pageData}
        viewport={viewport}
        isPreviewMode={isPreviewMode}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        saveStatus={saveStatus}
        activeView={activeView}
        onViewChange={handleViewChange}
        pendingOrdersCount={pendingOrdersCount}
        currentPlan={currentPlan}
        onViewportChange={setViewport}
        onTogglePreview={() => setIsPreviewMode(!isPreviewMode)}
        onToggleCustomerLiveView={() => setIsCustomerLiveView(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSavePage={handleSaveCurrentPage}
        onOpenMyPagesModal={() => setIsMyPagesModalOpen(true)}
        onOpenPublishModal={() => setIsPublishModalOpen(true)}
        onOpenSettingsModal={() => handleViewChange('settings')}
        isCurrentPagePublished={!!currentStoredPage?.isPublished}
        currentPublishedSlug={currentStoredPage?.slug}
        onOpenAiModal={handleTriggerAiGeneration}
        onOpenExportModal={handleTriggerExport}
        onOpenAuthModal={(mode) => {
          setAuthModalMode(mode);
          setIsAuthModalOpen(true);
        }}
        onOpenUpgradeModal={() => {
          handleNavigateToPricing('');
        }}
        onOpenAdminModal={() => setIsAdminPaymentsModalOpen(true)}
        onLoadTemplate={handleLoadTemplate}
        onUpdateTitle={(title) => handleUpdatePageMeta({ title })}
        isLeftSidebarOpen={isLeftSidebarOpen}
        isRightSidebarOpen={isRightSidebarOpen}
        onToggleLeftSidebar={() => setIsLeftSidebarOpen((prev) => !prev)}
        onToggleRightSidebar={() => setIsRightSidebarOpen((prev) => !prev)}
      />

      {/* Sticky Impersonation Warning Banner (Across App) */}
      {isImpersonating && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-lg z-40 shrink-0 border-b border-amber-600">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">👑</span>
            <span className="truncate">
              {language === 'ar'
                ? `وضع المالك: أنت تتحكم الآن في حساب التاجر [${impersonatedUser?.full_name || impersonatedUser?.email || ''} - ${impersonatedUser?.store_name || ''}] — يمكنك تعديل صفحاته، طلبياته، وإعداداته`
                : language === 'fr'
                ? `Mode Propriétaire: Vous contrôlez le compte marchand [${impersonatedUser?.full_name || impersonatedUser?.email || ''} - ${impersonatedUser?.store_name || ''}]`
                : `Owner Mode: Managing merchant account [${impersonatedUser?.full_name || impersonatedUser?.email || ''} - ${impersonatedUser?.store_name || ''}]`}
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              await stopImpersonating();
              handleViewChange('admin');
            }}
            className="px-3 py-1 rounded-md bg-slate-950 hover:bg-slate-900 text-amber-300 border border-amber-400/50 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <span>↩️</span>
            <span>{t.impersonationReturnBtn}</span>
          </button>
        </div>
      )}

      {/* Toast Notifications for Product Scraper */}
      {scrapeError && (
        <div
          dir="rtl"
          className="fixed bottom-6 left-6 z-50 max-w-md bg-rose-950/95 border border-rose-500/60 text-rose-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold backdrop-blur-md"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="flex-1">{scrapeError}</span>
          <button
            type="button"
            onClick={() => setScrapeError(null)}
            className="text-rose-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {scrapeSuccessToast && (
        <div
          dir="rtl"
          className="fixed bottom-6 left-6 z-50 max-w-md bg-emerald-950/95 border border-emerald-500/60 text-emerald-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold backdrop-blur-md"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="flex-1">{scrapeSuccessToast}</span>
          <button
            type="button"
            onClick={() => setScrapeSuccessToast(null)}
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main SaaS Workspace Switcher - Strict Single Page Separation */}
      {activeView === 'admin' && isAdmin ? (
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-950">
          <AdminOwnerDashboard
            onImpersonateSuccess={() => {
              handleViewChange('builder');
            }}
            onNavigateToStorefront={() => {
              setIsCustomerLiveView(true);
            }}
          />
        </div>
      ) : activeView === 'pricing' ? (
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-950">
          <PricingPage
            currentPlan={currentPlan}
            triggerReason={upgradeTriggerReason}
            onSelectFreePlan={() => handleViewChange('builder')}
            onBackToBuilder={() => handleViewChange('builder')}
            onNavigateToContact={() => handleViewChange('contact')}
            onNavigateToTerms={() => handleViewChange('terms')}
            onNavigateToPrivacy={() => handleViewChange('privacy')}
            onUpgradeSuccess={(tier) => {
              setCurrentPlan(tier);
              try {
                localStorage.setItem('funnelcraft_plan', tier);
              } catch (_) {}
            }}
          />
        </div>
      ) : activeView === 'contact' ? (
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-950">
          <ContactPage
            onBackToHome={() => handleViewChange('builder')}
            onNavigateToTerms={() => handleViewChange('terms')}
            onNavigateToPrivacy={() => handleViewChange('privacy')}
          />
        </div>
      ) : activeView === 'terms' ? (
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-950">
          <TermsPage
            onBackToHome={() => handleViewChange('builder')}
            onNavigateToContact={() => handleViewChange('contact')}
            onNavigateToPrivacy={() => handleViewChange('privacy')}
          />
        </div>
      ) : activeView === 'privacy' ? (
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-950">
          <PrivacyPolicyPage
            onBackToHome={() => handleViewChange('builder')}
            onNavigateToTerms={() => handleViewChange('terms')}
            onNavigateToContact={() => handleViewChange('contact')}
          />
        </div>
      ) : activeView === 'builder' ? (
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
          {/* Task 5: Compact Single-Row Product URL Scraper Bar (h-10) */}
          {!isPreviewMode && (
            <div className="h-10 bg-slate-900 border-b border-slate-800 px-2.5 shrink-0 flex items-center justify-between gap-2 overflow-x-hidden flex-nowrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLeftSidebarOpen((prev) => !prev)}
                  title={isLeftSidebarOpen ? 'إخفاء قائمة الأقسام' : 'إظهار قائمة الأقسام'}
                  className={`h-7 px-2 rounded-md border text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                    isLeftSidebarOpen
                      ? 'bg-slate-800 text-emerald-400 border-slate-700'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {isLeftSidebarOpen ? (
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  ) : (
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden xl:inline text-[11px]">الأقسام</span>
                </button>
              </div>

              <form
                onSubmit={handleScrapeProductByUrl}
                className="flex-1 min-w-0 flex items-center gap-1.5 max-w-2xl mx-auto"
              >
                <div className="relative flex-1 min-w-0">
                  <Link2 className="w-3.5 h-3.5 text-emerald-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="url"
                    dir="ltr"
                    disabled={isScraping}
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    placeholder="https://... (Shopify, YouCan, AliExpress, Amazon, Jumia, Noon)"
                    className="w-full h-7 pr-8 pl-2.5 py-1 rounded-md bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isScraping}
                  className="h-7 px-2.5 py-1 rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 flex items-center gap-1 transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  {isScraping ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>جاري الاستيراد...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>استيراد منتج بالرابط</span>
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center gap-1.5 shrink-0">
                {pageData.scrapedData && (
                  <>
                    <span className="hidden lg:inline-flex text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-700/50 px-2 py-0.5 rounded-md whitespace-nowrap">
                      ✓ {pageData.scrapedData.platform}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setBuilderRenderMode((m) => (m === 'scraped' ? 'blocks' : 'scraped'))
                      }
                      className="h-7 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                    >
                      {builderRenderMode === 'scraped' ? (
                        <>
                          <Layers className="w-3 h-3 text-amber-400" />
                          <span className="hidden sm:inline">محرر الأقسام</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3 text-emerald-400" />
                          <span className="hidden sm:inline">صفحة المنتج</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setIsRightSidebarOpen((prev) => !prev)}
                  title={isRightSidebarOpen ? 'إخفاء خصائص التصميم' : 'إظهار خصائص التصميم'}
                  className={`h-7 px-2 rounded-md border text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                    isRightSidebarOpen
                      ? 'bg-slate-800 text-emerald-400 border-slate-700'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span className="hidden xl:inline text-[11px]">الخصائص</span>
                  {isRightSidebarOpen ? (
                    <PanelRightClose className="w-3.5 h-3.5" />
                  ) : (
                    <PanelRightOpen className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Builder Workspace Content */}
          {pageData.scrapedData && builderRenderMode === 'scraped' ? (
            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-100 pb-20">
              <CustomerLandingPage
                product={pageData.scrapedData}
                pageSlug={pageData.slug || currentStoredPage?.slug}
                funnelId={pageData.id}
                userId={user.id}
              />
            </div>
          ) : (
            <div className="flex-1 min-w-0 min-h-0 flex overflow-hidden relative">
              {/* Collapsible Left Sidebar (Blocks & Layer Outline) */}
              {!isPreviewMode && isLeftSidebarOpen && (
                <BlocksToolbar
                  blocks={pageData.blocks}
                  selectedBlockId={selectedBlockId}
                  isPro={isPro}
                  onAddBlock={handleAddBlock}
                  onUpgradeClick={handleNavigateToPricing}
                  onSelectBlock={setSelectedBlockId}
                  onMoveBlock={handleMoveBlock}
                  onDuplicateBlock={handleDuplicateBlock}
                  onDeleteBlock={handleDeleteBlock}
                  onCollapse={() => setIsLeftSidebarOpen(false)}
                />
              )}

              {/* Center Visual Canvas (Expands with flex-1 min-w-0 min-h-0) */}
              <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
                <CanvasRenderer
                  pageData={pageData}
                  viewport={viewport}
                  selectedBlockId={selectedBlockId}
                  isPreviewMode={isPreviewMode}
                  onSelectBlock={setSelectedBlockId}
                  onMoveBlock={handleMoveBlock}
                  onDuplicateBlock={handleDuplicateBlock}
                  onDeleteBlock={handleDeleteBlock}
                  onOrderConfirmed={handleOrderConfirmed}
                />
              </div>

              {/* Collapsible Right Properties Inspector */}
              {!isPreviewMode && isRightSidebarOpen && (
                <PropertiesSidebar
                  pageData={pageData}
                  selectedBlockId={selectedBlockId}
                  isPro={isPro}
                  onUpgradeClick={handleNavigateToPricing}
                  onUpdateBlock={handleUpdateBlock}
                  onUpdateTheme={handleUpdateTheme}
                  onUpdatePageMeta={handleUpdatePageMeta}
                  onClose={() => setSelectedBlockId(null)}
                  onCollapse={() => setIsRightSidebarOpen(false)}
                />
              )}
            </div>
          )}

          {/* Task 2: Compact Floating Bottom-Center Canvas Dock (Figma / Framer Style) */}
          <div
            dir="ltr"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-2.5 py-1.5 rounded-2xl shadow-2xl text-slate-200 select-none"
          >
            {/* Viewport Switcher */}
            <div className="flex items-center bg-slate-950/90 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewport('desktop')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewport === 'desktop'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Desktop View"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewport('tablet')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewport === 'tablet'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tablet View"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewport('mobile')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewport === 'mobile'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mobile View"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-700/80" />

            {/* Undo / Redo Controls */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={history.past.length === 0}
                onClick={handleUndo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title={t.undo}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={history.future.length === 0}
                onClick={handleRedo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                title={t.redo}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-700/80" />

            {/* Preview Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                isPreviewMode
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title={isPreviewMode ? t.edit : t.preview}
            >
              {isPreviewMode ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{t.edit}</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.preview}</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : activeView === 'orders' ? (
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden">
          <OrdersDashboard
            currentPlan={currentPlan}
            onUpgradeClick={() => {
              handleNavigateToPricing('تصدير الطلبيات والربط مع شركات التوصيل ميزة حصرية لمشتركي Pro');
            }}
            onNewOrderCreated={() => setPendingOrdersCount((prev) => prev + 1)}
          />
        </div>
      ) : activeView === 'analytics' ? (
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden">
          <AnalyticsDashboard
            currentPlan={currentPlan}
            onUpgradeClick={() => {
              handleNavigateToPricing('التقارير المتقدمة وتحليلات الأداء ميزة حصرية لمشتركي باقة Pro');
            }}
            onNavigateToBuilder={() => setActiveView('builder')}
          />
        </div>
      ) : (
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-950">
          <SettingsPage
            isOpen={true}
            asModal={false}
            currentPlan={currentPlan}
            onUpgradeClick={() => {
              handleNavigateToPricing('ربط الدومين المخصص ميزة حصرية لمشتركي باقة Pro');
            }}
            onClose={() => setActiveView('builder')}
          />
        </div>
      )}

      {/* Framer AI Generator Modal */}
      <AiGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyGeneratedPage={async (generatedPage) => {
          await recordPageAction();
          updatePageDataWithHistory(() => generatedPage);
          setBuilderRenderMode(generatedPage.scrapedData ? 'scraped' : 'blocks');
          setSelectedBlockId(null);
        }}
      />

      {/* Export Clean HTML / JSON Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        pageData={pageData}
        onImportJson={(importedData) => {
          updatePageDataWithHistory(() => importedData);
          setBuilderRenderMode(importedData.scrapedData ? 'scraped' : 'blocks');
          setSelectedBlockId(null);
        }}
      />

      {/* User Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      {/* Pro Plan Paywall Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        triggerReason={upgradeTriggerReason}
        onRequireAuth={() => {
          setAuthModalMode('register');
          setIsAuthModalOpen(true);
        }}
        onUpgradeSuccess={(tier) => {
          setCurrentPlan(tier);
          try {
            localStorage.setItem('funnelcraft_plan', tier);
          } catch (_) {}
        }}
      />

      {/* User Pages & Funnels Manager Modal */}
      <MyPagesModal
        isOpen={isMyPagesModalOpen}
        onClose={() => setIsMyPagesModalOpen(false)}
        currentPageId={pageData.id}
        onSelectPage={handleSelectPage}
        onCreateNewPage={handleCreateNewBlankPage}
        onSaveCurrentPage={handleSaveCurrentPage}
        onUpgradeClick={(reason) => {
          setIsMyPagesModalOpen(false);
          handleNavigateToPricing(reason || '');
        }}
      />

      {/* 1-Click Publishing & Live Domain Hosting Modal */}
      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        pageData={pageData}
        currentPage={currentStoredPage}
        onRequireAuth={() => {
          setAuthModalMode('register');
          setIsAuthModalOpen(true);
        }}
        onRequireUpgrade={(reason) => {
          setIsPublishModalOpen(false);
          handleNavigateToPricing(reason || '');
        }}
        onPageUpdated={(updatedPage) => {
          if (updatedPage.slug && updatedPage.slug !== pageData.slug) {
            setPageData((prev) => ({ ...prev, slug: updatedPage.slug }));
          }
        }}
      />

      {/* Merchant Account & Store Settings Page */}
      <SettingsPage
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Moroccan Offline Payments Admin Verification Modal */}
      <AdminPaymentsModal
        isOpen={isAdminPaymentsModalOpen}
        onClose={() => setIsAdminPaymentsModalOpen(false)}
      />

      {/* COD Order Confirmation Celebration Modal */}
      <OrderSuccessModal
        orderData={orderConfirmation}
        onClose={() => setOrderConfirmation(null)}
        isRtl={pageData.direction === 'rtl' || pageData.language === 'ar'}
      />

      {/* Global Floating WhatsApp Button (Hidden in Builder, Preview Mode & Customer Live View) */}
      {activeView !== 'builder' && !isPreviewMode && !isCustomerLiveView && <FloatingWhatsApp />}
    </div>
  );
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function App() {
  const [publicPage, setPublicPage] = useState<LandingPageData | null>(null);
  const [isLoadingPublic, setIsLoadingPublic] = useState(true);
  const [pageOwnerId, setPageOwnerId] = useState<string | undefined>(undefined);
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmationData | null>(null);

  const rawPathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const path = rawPathname.replace(/\/$/, '');
  const isPublicFunnelRoute = path.startsWith('/p/');
  const rawSlug = isPublicFunnelRoute ? path.slice(3).trim() : '';
  let slug = rawSlug;
  if (rawSlug) {
    try {
      slug = decodeURIComponent(rawSlug);
    } catch {
      slug = rawSlug;
    }
  }

  useEffect(() => {
    const currentPath = window.location.pathname.replace(/\/$/, '');
    if (!currentPath.startsWith('/p/')) {
      setIsLoadingPublic(false);
      return;
    }

    const extractedRawSlug = currentPath.slice(3).trim();
    let extractedSlug = extractedRawSlug;
    try {
      extractedSlug = decodeURIComponent(extractedRawSlug);
    } catch {
      extractedSlug = extractedRawSlug;
    }

    if (!extractedSlug) {
      setPublicPage(null);
      setIsLoadingPublic(false);
      return;
    }

    let isMounted = true;
    setIsLoadingPublic(true);

    fetch(`/api/public/pages/${encodeURIComponent(extractedSlug)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Not found');
        }
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        const resolvedData: LandingPageData | null =
          json?.data || json?.page?.data || (json?.blocks || json?.scrapedData ? json : null);

        if (!resolvedData) {
          setPublicPage(null);
        } else {
          setPublicPage({
            ...resolvedData,
            id: resolvedData.id || json?.page?.id || 'funnel-public',
            slug: resolvedData.slug || json?.page?.slug || extractedSlug,
            title: resolvedData.title || json?.page?.title || 'CodWorth Store',
          });
          setPageOwnerId(json?.userId || json?.page?.userId);
        }
        setIsLoadingPublic(false);
      })
      .catch(() => {
        if (isMounted) {
          setPublicPage(null);
          setIsLoadingPublic(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePublicOrderConfirmed = useCallback(
    async (data: OrderConfirmationData) => {
      setOrderConfirmation(data);
      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: data.customerName,
            phone: data.customerPhone,
            city: data.customerCity,
            address: data.customerAddress,
            productName: data.bundle?.name || publicPage?.title || 'منتج صفحة الهبوط',
            price: data.totalPrice,
            quantity: data.bundle?.quantity || 1,
            funnelId: publicPage?.id,
            pageSlug: publicPage?.slug || slug,
            userId: pageOwnerId,
            notes: data.customerNote,
            recaptchaToken: data.recaptchaToken,
            turnstileToken: data.turnstileToken,
          }),
        });
      } catch (err) {
        console.warn('Failed to submit public order:', err);
      }
    },
    [publicPage, slug, pageOwnerId]
  );

  // 1. PUBLIC FUNNEL ROUTE (/p/:slug)
  if (isPublicFunnelRoute) {
    if (isLoadingPublic) {
      return (
        <div
          dir="rtl"
          className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-3 font-sans"
        >
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm font-bold">جاري تحميل الصفحة...</p>
        </div>
      );
    }

    if (publicPage) {
      if (publicPage.scrapedData) {
        return (
          <CustomerLandingPage
            product={publicPage.scrapedData}
            pageSlug={publicPage.slug || slug}
            funnelId={publicPage.id}
            userId={pageOwnerId}
          />
        );
      }

      return (
        <div
          className="min-h-screen w-screen bg-white overflow-y-auto font-sans relative"
          dir={publicPage.direction || (publicPage.language === 'ar' ? 'rtl' : 'ltr')}
        >
          <CanvasRenderer
            pageData={publicPage}
            viewport="desktop"
            selectedBlockId={null}
            isPreviewMode={true}
            onSelectBlock={() => {}}
            onMoveBlock={() => {}}
            onDuplicateBlock={() => {}}
            onDeleteBlock={() => {}}
            onOrderConfirmed={handlePublicOrderConfirmed}
          />
          <OrderSuccessModal
            orderData={orderConfirmation}
            onClose={() => setOrderConfirmation(null)}
            isRtl={publicPage.direction === 'rtl' || publicPage.language === 'ar'}
          />
        </div>
      );
    }

    return (
      <div
        dir="rtl"
        className="min-h-screen w-screen bg-slate-950 text-white flex items-center justify-center p-4 font-sans"
      >
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black mb-2">الصفحة غير موجودة</h1>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            عذراً، الرابط الذي تحاول الوصول إليه غير متوفر حالياً أو تم تغيير عنوانه.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition"
          >
            <span>العودة إلى الصفحة الرئيسية</span>
          </a>
        </div>
      </div>
    );
  }

  // 2. IMMEDIATE PUBLIC ROUTE CHECK (No Auth Required)
  if (path === '/contact') {
    return (
      <>
        <ContactPage />
        <FloatingWhatsApp />
      </>
    );
  }
  if (path === '/terms') {
    return (
      <>
        <TermsPage />
        <FloatingWhatsApp />
      </>
    );
  }
  if (path === '/privacy') {
    return (
      <>
        <PrivacyPolicyPage />
        <FloatingWhatsApp />
      </>
    );
  }

  // 3. Normal App Flow (Protected)
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <LanguageProvider>
        <AuthProvider>
          <BuilderWorkspace />
        </AuthProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  );
}


