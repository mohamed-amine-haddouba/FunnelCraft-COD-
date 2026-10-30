import React, { useState, useEffect } from 'react';
import {
  X,
  Rocket,
  Globe,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Eye,
  ShoppingBag,
  Sparkles,
  Link2,
  HelpCircle,
  PowerOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LandingPageData } from '../types/landingPage';
import { StoredPage } from '../types/user';
import { generateStandaloneHtml } from '../utils/htmlExporter';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageData: LandingPageData;
  currentPage?: StoredPage;
  onRequireAuth: () => void;
  onRequireUpgrade: (reason?: string) => void;
  onPageUpdated?: (page: StoredPage) => void;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  pageData,
  currentPage,
  onRequireAuth,
  onRequireUpgrade,
  onPageUpdated,
}) => {
  const {
    isLoggedIn,
    planId,
    isPro,
    canUseCustomDomain,
    pagesCreatedCount,
    maxFreePages,
    publishUserPageInCloud,
    unpublishUserPageInCloud,
    checkSlugAvailability,
    saveUserPageToCloud,
    savePageCustomDomain,
    verifyPageCustomDomain,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'platform' | 'custom'>('platform');
  const [slug, setSlug] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugAvailableState, setIsSlugAvailableState] = useState<boolean | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCname, setCopiedCname] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Real DNS verification state
  const [isVerifyingDns, setIsVerifyingDns] = useState(false);
  const [dnsStatus, setDnsStatus] = useState<'idle' | 'checking' | 'connected' | 'pending_dns' | 'error'>('idle');
  const [dnsMessage, setDnsMessage] = useState('');
  const [resolvedDnsRecords, setResolvedDnsRecords] = useState<{ a: string[]; cname: string[] } | null>(null);

  const sanitizeSlugValue = (raw?: string): string => {
    const cleaned = (raw || '')
      .replace(/\b404\s*[-_]*\s*(page|not\s*found)?\b/gi, '')
      .replace(/\bpage\s*not\s*found\b/gi, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!cleaned || cleaned === '404' || cleaned === '404-page') {
      return '';
    }
    return cleaned;
  };

  // Initial slug & custom domain sync from currentPage
  useEffect(() => {
    if (isOpen) {
      const fromPageDataSlug = sanitizeSlugValue(pageData.slug);
      const fromCurrentPageSlug = sanitizeSlugValue(currentPage?.slug);
      const fromTitle = sanitizeSlugValue(pageData.title);

      const initialSlug =
        fromPageDataSlug ||
        fromCurrentPageSlug ||
        fromTitle ||
        `page-${Date.now()}`;

      setSlug(initialSlug);
      setCustomDomain(currentPage?.customDomain || '');
      setStatusMessage(null);
      if (currentPage?.domainStatus === 'active') {
        setDnsStatus('connected');
      } else if (currentPage?.domainStatus === 'pending_dns') {
        setDnsStatus('pending_dns');
      } else if (currentPage?.domainStatus === 'error') {
        setDnsStatus('error');
      } else {
        setDnsStatus('idle');
      }
      setDnsMessage('');
    }
  }, [isOpen, currentPage, pageData.slug, pageData.title]);

  // Debounced slug availability check
  useEffect(() => {
    if (!slug.trim() || !isOpen) {
      setIsSlugAvailableState(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingSlug(true);
      const res = await checkSlugAvailability(slug.trim(), currentPage?.id);
      setIsSlugAvailableState(res.available);
      setIsCheckingSlug(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [slug, currentPage?.id, isOpen, checkSlugAvailability]);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.host : 'codworth.com';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const origin = `${protocol}//${currentHost}`;
  const safeDisplaySlug =
    slug.trim() && slug.trim() !== '404-page' ? slug.trim() : sanitizeSlugValue(pageData.title) || `page-${Date.now()}`;
  const liveUrl = `${origin}/p/${safeDisplaySlug}`;
  const isCurrentlyPublished = !!currentPage?.isPublished;
  const viewsCount = currentPage?.viewsCount || 0;
  const ordersCount = currentPage?.ordersCount || 0;

  const handleSlugChange = (val: string) => {
    // Format slug automatically: Arabic letters, alphanumeric, and hyphens (never 404-page)
    const clean = val
      .replace(/\b404-page\b/gi, '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u0600-\u06FF\-]/g, '');
    setSlug(clean);
  };

  const handlePublish = async () => {
    if (!isLoggedIn) {
      onRequireAuth();
      return;
    }

    if (!slug.trim()) {
      setStatusMessage({ text: 'يرجى إدخال اسم الرابط المختصر (Slug)', type: 'error' });
      return;
    }

    setIsPublishing(true);
    setStatusMessage(null);

    try {
      // 1. Ensure the page exists in cloud first
      let pageId = currentPage?.id || pageData.id;
      const compiledHtml = generateStandaloneHtml({
        ...pageData,
        slug: slug.trim(),
      });

      if (!currentPage?.id) {
        const saveRes = await saveUserPageToCloud({
          id: pageId,
          title: pageData.title,
          slug: slug.trim(),
          data: pageData,
        });

        if (saveRes.isLimitReached) {
          setIsPublishing(false);
          onRequireUpgrade(saveRes.error);
          return;
        }

        if (!saveRes.success || !saveRes.page) {
          setIsPublishing(false);
          setStatusMessage({ text: saveRes.error || 'تعذر حفظ مسودة الصفحة قبل النشر.', type: 'error' });
          return;
        }
        pageId = saveRes.page.id;
      }

      // 2. Publish live
      const pubRes = await publishUserPageInCloud(
        pageId,
        slug.trim(),
        customDomain.trim() || undefined,
        compiledHtml
      );

      if (pubRes.isLimitReached) {
        onRequireUpgrade(pubRes.error);
      } else if (pubRes.success && pubRes.page) {
        setStatusMessage({
          text: '🚀 تم نشر صفحة الهبوط بنجاح وأصبحت مباشرة على الإنترنت للزوار والطلبات!',
          type: 'success',
        });
        if (onPageUpdated) {
          onPageUpdated(pubRes.page);
        }
      } else {
        setStatusMessage({ text: pubRes.error || 'فشل في نشر الصفحة.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err?.message || 'حدث خطأ في الاتصال بالنظام.', type: 'error' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!currentPage?.id) return;
    setIsUnpublishing(true);
    setStatusMessage(null);
    try {
      const res = await unpublishUserPageInCloud(currentPage.id);
      if (res.success && res.page) {
        setStatusMessage({ text: 'تم إيقاف نشر الصفحة بنجاح وإعادتها لحالة مسودة.', type: 'success' });
        if (onPageUpdated) {
          onPageUpdated(res.page);
        }
      } else {
        setStatusMessage({ text: res.error || 'تعذر إلغاء النشر.', type: 'error' });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setIsUnpublishing(false);
    }
  };

  const handleCopyLink = () => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(liveUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCname = () => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText('domains.codworth.me');
    setCopiedCname(true);
    setTimeout(() => setCopiedCname(false), 2500);
  };

  const handleCopyIp = () => {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText('217.160.116.237');
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2500);
  };

  const handleVerifyDns = async () => {
    if (!isLoggedIn) {
      onRequireAuth();
      return;
    }

    if (!canUseCustomDomain) {
      onRequireUpgrade('ربط النطاق المخصص (Custom Domain) متاح فقط لمشتركي باقة Pro و Enterprise.');
      return;
    }

    if (!customDomain.trim()) {
      setDnsStatus('error');
      setDnsMessage('يرجى كتابة اسم الدومين أولاً (مثلاً: shop.yourbrand.ma أو yourbrand.com)');
      return;
    }

    setIsVerifyingDns(true);
    setDnsStatus('checking');
    setDnsMessage('جاري الاتصال بخوادم الـ DNS لفحص سجل A (217.160.116.237) أو سجل CNAME (domains.codworth.me)...');

    try {
      let targetPageId = currentPage?.id || pageData.id;
      if (!currentPage?.id) {
        const saveRes = await saveUserPageToCloud({
          id: targetPageId,
          title: pageData.title,
          slug: slug.trim() || sanitizeSlugValue(pageData.title) || `page-${Date.now()}`,
          data: pageData,
        });
        if (saveRes.isLimitReached) {
          setIsVerifyingDns(false);
          onRequireUpgrade(saveRes.error);
          return;
        }
        if (!saveRes.success || !saveRes.page) {
          setIsVerifyingDns(false);
          setDnsStatus('error');
          setDnsMessage(saveRes.error || 'تعذر حفظ الصفحة قبل فحص النطاق.');
          return;
        }
        targetPageId = saveRes.page.id;
      }

      // First save the domain on the page
      const saveDomRes = await savePageCustomDomain(targetPageId, customDomain.trim());
      if (saveDomRes.isLimitReached) {
        setIsVerifyingDns(false);
        onRequireUpgrade(saveDomRes.error);
        return;
      }
      if (!saveDomRes.success) {
        setIsVerifyingDns(false);
        setDnsStatus('error');
        setDnsMessage(saveDomRes.error || 'صيغة الدومين غير صالحة.');
        return;
      }

      // Now trigger live DNS verification via Node dns.promises
      const verifyRes = await verifyPageCustomDomain(targetPageId, customDomain.trim());
      setIsVerifyingDns(false);

      if (verifyRes.resolvedRecords) {
        setResolvedDnsRecords(verifyRes.resolvedRecords);
      }

      if (verifyRes.page && onPageUpdated) {
        onPageUpdated(verifyRes.page);
      }

      if (verifyRes.success && verifyRes.verified) {
        setDnsStatus('connected');
        setDnsMessage(
          verifyRes.message ||
            '✓ تم التحقق من سجلات DNS بنجاح! النطاق متصل ونشط الآن (Active).'
        );
      } else {
        setDnsStatus('error');
        setDnsMessage(
          verifyRes.error ||
            'لم يتم العثور على سجلات DNS المطابقة بعد. تأكد من توجيه سجل A (@) إلى 217.160.116.237 أو سجل CNAME (www) إلى domains.codworth.me'
        );
      }
    } catch (err: any) {
      setIsVerifyingDns(false);
      setDnsStatus('error');
      setDnsMessage(err?.message || 'حدث خطأ أثناء فحص سجلات الـ DNS.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shadow-inner">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  نشر صفحة الهبوط مباشرة (1-Click Live Hosting)
                </h3>
                {isCurrentlyPublished && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 truncate max-w-sm sm:max-w-md">
                استضف صفحتك على خوادم سريعة جداً مع نموذج دفع عند الاستلام حقيقي وجاهز للإعلانات.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Published Status Alert & Metric Bar */}
        {isCurrentlyPublished && (
          <div className="bg-emerald-50/90 border-b border-emerald-200/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div className="font-bold text-emerald-900">
                الصفحة منشورة وتستقبل الزوار حالياً!
              </div>
            </div>

            <div className="flex items-center gap-4 text-emerald-800 font-semibold">
              <div className="flex items-center gap-1" title="إجمالي الزيارات">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-extrabold">{viewsCount}</span> مشاهدة
              </div>
              <div className="flex items-center gap-1" title="إجمالي طلبات الدفع عند الاستلام المسجلة">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-extrabold">{ordersCount}</span> طلبية (COD)
              </div>
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={isUnpublishing}
                className="text-[11px] font-bold text-slate-500 hover:text-rose-600 transition flex items-center gap-1 cursor-pointer"
                title="إلغاء النشر مؤقتاً"
              >
                {isUnpublishing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <PowerOff className="w-3 h-3" />
                )}
                <span>إيقاف النشر</span>
              </button>
            </div>
          </div>
        )}

        {/* Status Message Notification */}
        {statusMessage && (
          <div
            className={`px-4 sm:px-6 py-3 text-xs font-semibold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-rose-50 border-b border-rose-200 text-rose-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="flex-1">{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="px-5 sm:px-6 pt-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('platform')}
            className={`pb-3 px-3 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'platform'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>نطاق المنصة السريع (Platform Domain)</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
              فوري 1-ثانية
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`pb-3 px-3 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'custom'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>دومين خاص بالتاجر (Custom Domain)</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
              Pro / DNS
            </span>
          </button>
        </div>

        {/* Tab 1: Platform Instant Domain */}
        {activeTab === 'platform' && (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
            {/* Slug URL Generator Box */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                رابط صفحة الهبوط على المنصة (Live Funnel URL)
              </label>

              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition">
                <span className="px-3.5 py-2.5 bg-slate-100/90 text-slate-500 font-mono text-xs border-e border-slate-200 select-all shrink-0">
                  {origin}/p/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="air-fryer-pro"
                  className="w-full px-3 py-2.5 bg-transparent text-slate-900 font-bold text-xs outline-none"
                  dir="ltr"
                />
                <div className="px-3 shrink-0 flex items-center">
                  {isCheckingSlug ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  ) : isSlugAvailableState === true ? (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> متاح
                    </span>
                  ) : isSlugAvailableState === false ? (
                    <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                      <X className="w-3 h-3" /> محجوز
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                يمكنك تخصيص الرابط بحسب اسم منتجك أو حملتك الإعلانية على تيك توك وفيسبوك.
              </p>
            </div>

            {/* Published Result Card */}
            {isCurrentlyPublished ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border border-emerald-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>رابط الصفحة المباشر والجاهز للإعلانات:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(!showQrModal)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>{showQrModal ? 'إخفاء الـ QR' : 'رمز QR للموبايل'}</span>
                  </button>
                </div>

                {/* Live URL Pill with 1-Click Copy */}
                <div className="flex items-center gap-2 p-1.5 ps-3 bg-white rounded-xl border border-emerald-200 shadow-xs">
                  <span className="font-mono text-xs text-slate-800 font-bold truncate flex-1 select-all" dir="ltr">
                    {liveUrl}
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'تم النسخ ✓' : 'نسخ الرابط'}</span>
                  </button>

                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح الصفحة</span>
                  </a>
                </div>

                {/* Mobile QR Code Box */}
                {showQrModal && (
                  <div className="p-4 bg-white rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-start animate-in fade-in duration-200">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                        liveUrl
                      )}`}
                      alt="QR Code"
                      className="w-28 h-28 rounded-xl border border-slate-200 p-1 bg-white shadow-xs"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 mb-1">
                        افحص الـ QR بهاتفك لاختبار الصفحة فوراً
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                        وجه كاميرا هاتفك نحو الكود لمعاينة تجربة الشراء والدفع عند الاستلام كما سيراها زبائنك تماماً على الموبايل.
                      </p>
                      <span className="inline-block text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Fast COD Mobile Checkout Optimized
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Features Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-600">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>شهادة SSL مشفرة وتلقائية</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>استضافة سريعة فائقة الأداء</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>نموذج COD حقيقي يحفظ الطلبات</span>
              </div>
            </div>

            {/* Big Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || isSlugAvailableState === false}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-xl shadow-emerald-600/25 transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 transform active:scale-[0.99]"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>جاري تجميع ونشر الصفحة على السيرفر...</span>
                  </>
                ) : isCurrentlyPublished ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-white" />
                    <span>تحديث محتوى الصفحة المنشورة (Update Live Version)</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 text-amber-300" />
                    <span>نشر الصفحة الآن مباشرة (Publish Live Now)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Custom Domain Mapping */}
        {activeTab === 'custom' && (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
            {!canUseCustomDomain && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <span>🔒 الترقية مطلوبة (Upgrade Required)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    ربط النطاق المخصص (Custom Domain) متاح فقط لمشتركي باقة Pro و Enterprise. باقتك الحالية هي ({planId.toUpperCase()}).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onRequireUpgrade('ربط النطاق المخصص متاح لمشتركي باقة Pro و Enterprise فقط.')
                  }
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm transition cursor-pointer shrink-0"
                >
                  🔒 ترقية إلى باقة Pro
                </button>
              </div>
            )}

            <div className={!canUseCustomDomain ? 'opacity-50 pointer-events-none select-none space-y-5' : 'space-y-5'}>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-slate-700">
                    اسم الدومين الخاص بمتجرك (Custom Domain)
                  </label>
                  {dnsStatus === 'connected' && (
                    <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1.5">
                      <span>🟢</span>
                      <span>Active (نشط ومتصل)</span>
                    </span>
                  )}
                  {(dnsStatus === 'pending_dns' || dnsStatus === 'checking') && (
                    <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold flex items-center gap-1.5">
                      <span>🟡</span>
                      <span>Pending (في انتظار DNS)</span>
                    </span>
                  )}
                  {dnsStatus === 'error' && (
                    <span className="text-xs px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-bold flex items-center gap-1.5">
                      <span>🔴</span>
                      <span>Error (فشل التحقق)</span>
                    </span>
                  )}
                  {dnsStatus === 'idle' && (
                    <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-bold flex items-center gap-1.5">
                      <span>⚪</span>
                      <span>Not Connected (غير متصل)</span>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    disabled={!canUseCustomDomain}
                    placeholder="shop.yourbrand.ma أو yourbrand.com"
                    className="w-full ps-10 pe-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 font-mono text-xs outline-none transition"
                    dir="ltr"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  أدخل النطاق الفرعي أو الدومين الرئيسي الذي تريد ربطه بصفحة الهبوط هذه.
                </p>
              </div>

              {/* Real DNS Instructions Guide */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <span>إعداد سجلات الـ DNS في لوحة تحكم نطاقك (Cloudflare, Namecheap, GoDaddy):</span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* A Record Row */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2" dir="ltr">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">A Record</span>
                      <span className="text-slate-400">Host:</span>
                      <span className="font-bold text-slate-900">@</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-400">Value:</span>
                      <code className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-bold text-emerald-700">
                        217.160.116.237
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyIp}
                        className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition cursor-pointer inline-flex items-center gap-1 text-[11px] font-sans font-bold"
                        title="نسخ عنوان IP"
                      >
                        {copiedIp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedIp ? 'تم النسخ ✓' : 'نسخ (Copy)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* CNAME Record Row */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2" dir="ltr">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">CNAME</span>
                      <span className="text-slate-400">Host:</span>
                      <span className="font-bold text-slate-900">www</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-400">Target:</span>
                      <code className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-bold text-indigo-700">
                        domains.codworth.me
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyCname}
                        className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 transition cursor-pointer inline-flex items-center gap-1 text-[11px] font-sans font-bold"
                        title="نسخ القيمة"
                      >
                        {copiedCname ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedCname ? 'تم النسخ ✓' : 'نسخ (Copy)'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Developer Diagnostics (<details>) */}
                <details className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
                  <summary className="px-3.5 py-2.5 cursor-pointer select-none font-bold text-slate-700 hover:text-slate-950 flex items-center justify-between">
                    <span>تفاصيل تقنية للمطورين (Raw DNS Diagnostic Info)</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      DNS Lookup
                    </span>
                  </summary>
                  <div className="p-3 border-t border-slate-200 bg-slate-900 text-slate-200 font-mono text-[11px] space-y-1.5" dir="ltr">
                    <div>Expected A (@): <span className="text-emerald-400">217.160.116.237</span></div>
                    <div>Expected CNAME (www): <span className="text-indigo-400">domains.codworth.me</span></div>
                    <div>Resolved A: <span className="text-white">[{resolvedDnsRecords?.a?.join(', ') || 'none'}]</span></div>
                    <div>Resolved CNAME: <span className="text-white">[{resolvedDnsRecords?.cname?.join(', ') || 'none'}]</span></div>
                  </div>
                </details>

                <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    يتحقق النظام فعلياً من سجلات DNS الخاصة بنطاقك ويوجه الزوار مباشرة إلى هذه الصفحة فور تفعيل السجل.
                  </span>
                </div>
              </div>

              {/* DNS Check Feedback */}
              {dnsMessage && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    dnsStatus === 'connected'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : dnsStatus === 'checking'
                      ? 'bg-sky-50 border-sky-200 text-sky-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {dnsStatus === 'connected' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span dir="ltr" className="text-left">{dnsMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleVerifyDns}
                  disabled={!canUseCustomDomain || isVerifyingDns}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isVerifyingDns ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  <span>تحقق من سجلات DNS (Verify DNS Records)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={!canUseCustomDomain || isPublishing}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPublishing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  <span>حفظ الدومين ونشر الصفحة الآن</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold">حالة الخطة:</span>
            <span className="font-extrabold text-slate-800">
              {isPro ? 'Pro غير محدود' : `المجانية (${pagesCreatedCount}/${maxFreePages} صفحات)`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
