import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  Paperclip,
  ChevronDown,
  Send,
  Sparkles,
  Plus,
  Loader2,
  AlertCircle,
  Lock,
  Crown,
  Trash2,
  FileText,
  X,
  Link2,
  Check,
  ArrowUpRight,
} from 'lucide-react';
import { useLanguage } from '../i18n/translations';
import { useAuth } from '../context/AuthContext';
import { useLocalizedNavigate } from '../hooks/useLocalizedNavigate';
import { getPlanCapabilities } from '../utils/planLimits';
import { LandingPageData, ScrapedProduct } from '../types/landingPage';
import { buildLandingPageFromScrapedProduct } from './AiGeneratorModal';

export interface AiChatHistoryItem {
  id: string;
  prompt: string;
  mode: 'product-page' | 'cod-funnel' | 'url-import';
  isUrl: boolean;
  createdAt: string;
  pageTitle?: string;
}

const CHAT_HISTORY_STORAGE_KEY = 'funnelcraft_ai_chat_history';
const MAX_CHAT_HISTORY_ITEMS = 10;

const CLIENT_ILLEGAL_PATTERNS: RegExp[] = [
  /\b(cocaine|heroin|methamphetamine|fentanyl|mdma|ecstasy|lsd|weed|cannabis|marijuana|hashish|narcotics|opioids)\b/i,
  /(كوكايين|هيروين|مخدرات|حشيش|قنب|أقراص مهلوسة|القرقوبي|حبوب الهلوسة|مواد مخدرة)/i,
  /\b(firearm|handgun|pistol|rifle|ak-47|ar-15|ammunition|explosives|bomb|grenade|silencer|illegal weapon)\b/i,
  /(سلاح ناري|مسدس|بندقية|كلاشينكوف|ذخيرة|رصاص حي|متفجرات|قنبلة|أسلحة ممنوعة)/i,
  /\b(fake passport|forged id|counterfeit money|stolen credit card|carding|phishing kit|ransomware)\b/i,
  /(جواز سفر مزور|بطاقة هوية مزورة|عملات مزورة|نقود مزورة|بطاقات بنكية مسروقة|اختراق حسابات|نصب واحتيال)/i,
];

interface AiPageBuilderPageProps {
  onApplyGeneratedPage?: (page: LandingPageData) => Promise<void> | void;
  onUpgradeClick?: (reason?: string) => void;
}

export const AiPageBuilderPage: React.FC<AiPageBuilderPageProps> = ({
  onApplyGeneratedPage,
  onUpgradeClick,
}) => {
  const { language, t, dir, isRtl } = useLanguage();
  const { user, token } = useAuth();
  const navigate = useLocalizedNavigate();

  const [promptInput, setPromptInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<'product-page' | 'cod-funnel' | 'url-import'>('product-page');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [attachedFileContent, setAttachedFileContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<AiChatHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_CHAT_HISTORY_ITEMS) : [];
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const planCaps = getPlanCapabilities(user?.plan_id, user?.role, user?.email);
  const hasAiAccess = planCaps.canUseAiBuilder || planCaps.isAdmin;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const savePromptToHistory = (promptText: string, isUrl: boolean, pageTitle?: string) => {
    const cleanPrompt = promptText.trim();
    if (!cleanPrompt) return;

    const newItem: AiChatHistoryItem = {
      id: `chat-${Date.now()}`,
      prompt: cleanPrompt,
      mode: selectedMode,
      isUrl,
      createdAt: new Date().toISOString(),
      pageTitle,
    };

    setChatHistory((prev) => {
      const filtered = prev.filter((item) => item.prompt !== cleanPrompt);
      const updated = [newItem, ...filtered].slice(0, MAX_CHAT_HISTORY_ITEMS);
      try {
        localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage quota issues
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    setChatHistory([]);
    try {
      localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleNewChat = () => {
    setPromptInput('');
    setAttachedFileName(null);
    setAttachedFileContent('');
    setErrorMessage(null);
    setStatusMessage(null);
    textareaRef.current?.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFileName(file.name);
    setErrorMessage(null);

    if (file.type.startsWith('text/') || /\.(txt|md|json|csv)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result.slice(0, 1500) : '';
        setAttachedFileContent(text);
      };
      reader.readAsText(file);
    } else {
      setAttachedFileContent(`[Attached Product Asset: ${file.name}]`);
    }

    e.target.value = '';
  };

  const extractFirstUrl = (text: string): string | null => {
    const match = text.match(/https?:\/\/[^\s"'<>]+/i);
    return match ? match[0].trim() : null;
  };

  const containsIllegalContent = (text: string): boolean => {
    return CLIENT_ILLEGAL_PATTERNS.some((pattern) => pattern.test(text));
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const trimmedInput = promptInput.trim();
    if (!trimmedInput && !attachedFileContent) {
      textareaRef.current?.focus();
      return;
    }

    // 1. Strict Plan Limit Enforcement (Pro, Business, or Admin bypass)
    if (!hasAiAccess) {
      setErrorMessage(t.aiBuilderPlanLockedDesc);
      if (onUpgradeClick) {
        onUpgradeClick(t.aiBuilderPlanLockedTitle);
      }
      return;
    }

    // 2. Content Moderation & Legal Check
    const combinedText = `${trimmedInput} ${attachedFileContent}`.trim();
    if (containsIllegalContent(combinedText)) {
      setErrorMessage(t.aiBuilderIllegalContentError);
      return;
    }

    const detectedUrl = extractFirstUrl(trimmedInput);
    const isUrlInput = Boolean(detectedUrl);

    setIsGenerating(true);
    setStatusMessage(isUrlInput ? t.aiBuilderScrapingUrl : t.aiBuilderGenerating);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      let generatedPage: LandingPageData | null = null;

      if (isUrlInput && detectedUrl) {
        // Use the 3-layer product scraper first, with fallback to /api/ai/import-from-url
        const scrapeRes = await fetch('/api/scrape-product', {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: detectedUrl }),
        });
        const scrapeJson = await scrapeRes.json().catch(() => ({}));

        if (scrapeRes.ok && (scrapeJson?.product || scrapeJson?.title)) {
          const rawProduct = scrapeJson.product || scrapeJson;
          const parsedPrice =
            typeof rawProduct.price === 'number'
              ? rawProduct.price
              : typeof rawProduct.numericPrice === 'number'
              ? rawProduct.numericPrice
              : parseInt(String(rawProduct.price || '249').replace(/[^\d]/g, ''), 10) || 249;
          const parsedOrigPrice =
            typeof rawProduct.originalPrice === 'number'
              ? rawProduct.originalPrice
              : typeof rawProduct.numericOriginalPrice === 'number'
              ? rawProduct.numericOriginalPrice
              : parseInt(String(rawProduct.originalPrice || '399').replace(/[^\d]/g, ''), 10) || 399;

          const productData: ScrapedProduct = {
            title: rawProduct.title || 'منتج مميز',
            price: parsedPrice,
            originalPrice: parsedOrigPrice,
            currency: rawProduct.currency || 'MAD',
            description: rawProduct.description || '',
            features: Array.isArray(rawProduct.features) ? rawProduct.features : [],
            specifications: Array.isArray(rawProduct.specifications)
              ? rawProduct.specifications
              : [],
            images: Array.isArray(rawProduct.images) ? rawProduct.images : [],
            reviews: Array.isArray(rawProduct.reviews) ? rawProduct.reviews : [],
            faqs: Array.isArray(rawProduct.faqs) ? rawProduct.faqs : [],
            variants: Array.isArray(rawProduct.variants) ? rawProduct.variants : [],
            bundles: Array.isArray(rawProduct.bundles) ? rawProduct.bundles : [],
            niche: rawProduct.niche || 'E-Commerce',
            rawUrl: rawProduct.rawUrl || detectedUrl,
            platform: rawProduct.platform || 'Store',
          };
          generatedPage = buildLandingPageFromScrapedProduct(
            productData,
            language === 'fr' ? 'fr' : language === 'en' ? 'en' : 'ar'
          );
        } else {
          const importRes = await fetch('/api/ai/import-from-url', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              productUrl: detectedUrl,
              language: language === 'fr' ? 'fr' : language === 'en' ? 'en' : 'ar',
            }),
          });
          const importJson = await importRes.json().catch(() => ({}));
          if (!importRes.ok || !importJson?.data) {
            throw new Error(importJson?.error || importJson?.message || 'Failed to import product URL.');
          }
          generatedPage = importJson.data as LandingPageData;
        }
      } else {
        // Text prompt -> AI Generation endpoint
        const aiRes = await fetch('/api/ai/generate', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prompt: trimmedInput,
            productName: trimmedInput.slice(0, 80),
            niche: selectedMode === 'cod-funnel' ? 'Cash on Delivery Flash Offer' : 'E-Commerce Product',
            language: language === 'fr' ? 'fr' : language === 'en' ? 'en' : 'ar',
            targetAudience: 'Moroccan & Global Online Shoppers',
            offerAngle:
              selectedMode === 'cod-funnel'
                ? '50% Off Flash Sale + Free Cash on Delivery'
                : 'High-Converting Product Landing Page + Free Delivery',
            pageType: selectedMode,
            attachedContext: attachedFileContent,
          }),
        });

        const aiJson = await aiRes.json().catch(() => ({}));

        if (!aiRes.ok || !aiJson?.data) {
          throw new Error(
            aiJson?.error || aiJson?.message || t.aiBuilderIllegalContentError
          );
        }

        generatedPage = aiJson.data as LandingPageData;
      }

      if (generatedPage) {
        savePromptToHistory(trimmedInput || attachedFileName || 'AI Page', isUrlInput, generatedPage.title);

        try {
          localStorage.setItem('funnelcraft_page_draft', JSON.stringify(generatedPage));
        } catch {
          // Ignore storage quota issues
        }

        if (onApplyGeneratedPage) {
          await onApplyGeneratedPage(generatedPage);
        }

        navigate('/dashboard/builder');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء توليد الصفحة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGenerating(false);
      setStatusMessage(null);
    }
  };

  const modeLabelMap: Record<'product-page' | 'cod-funnel' | 'url-import', string> = {
    'product-page': t.aiBuilderProductPage,
    'cod-funnel': t.aiBuilderModeCodFunnel,
    'url-import': t.aiBuilderModeUrlImport,
  };

  const detectedUrlInInput = extractFirstUrl(promptInput);

  return (
    <div
      dir={dir}
      className="flex-1 min-w-0 min-h-0 flex flex-col bg-brand-bg text-brand-primary relative overflow-y-auto select-none"
    >
      {/* Top Bar inside AI Builder Workspace */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 pt-5 pb-3 flex items-center justify-between gap-3 shrink-0">
        {/* Left in LTR / Right in RTL: New Chat + */}
        <button
          type="button"
          onClick={handleNewChat}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-surface hover:bg-brand-elevated border border-brand text-brand-primary text-xs sm:text-sm font-bold shadow-2xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4 text-brand-accent shrink-0" />
          <span>{t.aiBuilderNewChat}</span>
        </button>

        {/* Right in LTR / Left in RTL: Chat History with Clock Icon */}
        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-surface hover:bg-brand-elevated border border-brand text-brand-secondary hover:text-brand-primary text-xs sm:text-sm font-bold shadow-2xs transition cursor-pointer"
        >
          <span>{t.aiBuilderChatHistory}</span>
          <Clock className="w-4 h-4 text-brand-accent shrink-0" />
          {chatHistory.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-brand-elevated text-brand-primary border border-brand">
              {chatHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Centered Prompt Composer Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 max-w-3xl w-full mx-auto">
        {/* Title & Subtitle */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-surface border border-brand text-brand-accent text-xs font-bold mb-3 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini AI • COD Funnel Architect</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-primary tracking-tight mb-2.5">
            {t.aiBuilderTitle}
          </h1>
          <p className="text-xs sm:text-sm text-brand-secondary max-w-xl mx-auto leading-relaxed">
            {t.aiBuilderSubtitle}
          </p>
        </div>

        {/* Plan Restriction Banner if Starter / Free */}
        {!hasAiAccess && (
          <div className="w-full mb-5 p-4 rounded-2xl bg-brand-surface border border-amber-500/40 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-500 mb-0.5">
                  <Crown className="w-3.5 h-3.5" />
                  <span>{t.aiBuilderPlanLockedBadge}</span>
                </div>
                <h2 className="text-sm font-bold text-brand-primary">
                  {t.aiBuilderPlanLockedTitle}
                </h2>
                <p className="text-xs text-brand-secondary mt-0.5">
                  {t.aiBuilderPlanLockedDesc}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onUpgradeClick) {
                  onUpgradeClick(t.aiBuilderPlanLockedTitle);
                } else {
                  navigate('/dashboard/pricing');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-brand-accent hover:opacity-95 text-white text-xs font-black whitespace-nowrap shrink-0 shadow-sm transition cursor-pointer"
            >
              {t.aiBuilderUpgradeCta}
            </button>
          </div>
        )}

        {/* Main Chat Composer Card (Matches Reference) */}
        <form
          onSubmit={handleGenerate}
          className="w-full bg-brand-surface border border-brand rounded-2xl shadow-lg p-3.5 sm:p-4 transition-all focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-accent/15"
        >
          {/* URL Detected Pill or Attached File Pill */}
          {(detectedUrlInInput || attachedFileName) && (
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              {detectedUrlInInput && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-elevated border border-brand text-xs font-semibold text-brand-accent">
                  <Link2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-xs" dir="ltr">
                    {detectedUrlInInput}
                  </span>
                </div>
              )}

              {attachedFileName && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-elevated border border-brand text-xs font-semibold text-brand-primary">
                  <FileText className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                  <span>{t.aiBuilderAttachedFileLabel}</span>
                  <span className="font-mono text-[11px] text-brand-secondary truncate max-w-[180px]">
                    {attachedFileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedFileName(null);
                      setAttachedFileContent('');
                    }}
                    title={t.aiBuilderRemoveFile}
                    className="text-brand-secondary hover:text-rose-500 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Large Textarea */}
          <textarea
            ref={textareaRef}
            rows={4}
            disabled={isGenerating}
            value={promptInput}
            onChange={(e) => {
              setPromptInput(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleGenerate();
              }
            }}
            placeholder={t.aiBuilderPlaceholder}
            className="w-full resize-none bg-transparent text-brand-primary placeholder-brand-secondary/70 text-sm sm:text-base leading-relaxed focus:outline-none min-h-[110px]"
          />

          {/* Bottom Controls Bar inside the Textarea Box */}
          <div className="pt-3 mt-2 border-t border-brand flex flex-wrap items-center justify-between gap-2.5">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.csv,image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Secondary Action Buttons: Attach File + Product Page Dropdown */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Attach File ("إرفاق ملف") with Paperclip Icon */}
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-bg hover:bg-brand-elevated border border-brand text-brand-secondary hover:text-brand-primary text-xs font-bold transition cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5 text-brand-secondary shrink-0" />
                <span>{t.aiBuilderAttachFile}</span>
              </button>

              {/* 2. Product Page ("صفحة منتج") with Dropdown Icon */}
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setIsModeDropdownOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-bg hover:bg-brand-elevated border border-brand text-brand-primary text-xs font-bold transition cursor-pointer"
                >
                  <span>{modeLabelMap[selectedMode]}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-secondary shrink-0" />
                </button>

                {isModeDropdownOpen && (
                  <div
                    className={`absolute bottom-full mb-2 ${
                      isRtl ? 'right-0' : 'left-0'
                    } w-60 rounded-xl bg-brand-surface border border-brand shadow-xl py-1.5 z-30`}
                  >
                    {(
                      [
                        { id: 'product-page', label: t.aiBuilderModeProductPage },
                        { id: 'cod-funnel', label: t.aiBuilderModeCodFunnel },
                        { id: 'url-import', label: t.aiBuilderModeUrlImport },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSelectedMode(option.id);
                          setIsModeDropdownOpen(false);
                        }}
                        className="w-full px-3.5 py-2 text-xs font-bold text-brand-primary hover:bg-brand-elevated flex items-center justify-between gap-2 transition cursor-pointer"
                      >
                        <span>{option.label}</span>
                        {selectedMode === option.id && (
                          <Check className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Primary Generate ("توليد") Button with Paper Plane (Send) Icon */}
            <button
              type="submit"
              disabled={isGenerating || (!promptInput.trim() && !attachedFileContent)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-accent hover:opacity-95 disabled:opacity-50 text-white text-xs sm:text-sm font-black shadow-md transition cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{statusMessage || t.aiBuilderGenerating}</span>
                </>
              ) : (
                <>
                  <span>{t.aiBuilderGenerate}</span>
                  <Send className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error Alert (Plan Limit or Content Moderation) */}
        {errorMessage && (
          <div className="w-full mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-start gap-2.5 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Prompt Suggestions */}
        <div className="w-full mt-6">
          <div className="text-[11px] font-bold text-brand-secondary mb-2.5 px-1">
            {t.aiBuilderQuickSuggestionsLabel}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[t.aiBuilderSuggestion1, t.aiBuilderSuggestion2, t.aiBuilderSuggestion3].map(
              (suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setPromptInput(suggestion);
                    setErrorMessage(null);
                    textareaRef.current?.focus();
                  }}
                  className="p-3 rounded-xl bg-brand-surface hover:bg-brand-elevated border border-brand text-brand-secondary hover:text-brand-primary text-xs font-medium text-start leading-relaxed transition cursor-pointer flex items-start justify-between gap-2 group"
                >
                  <span className="line-clamp-2">{suggestion}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-brand-secondary group-hover:text-brand-accent shrink-0 mt-0.5 transition" />
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Chat History Modal / Drawer */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            dir={dir}
            className="w-full max-w-lg bg-brand-surface border border-brand rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-brand flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-accent" />
                <h3 className="text-sm font-black text-brand-primary">
                  {t.aiBuilderChatHistory}
                </h3>
                <span className="text-xs font-mono text-brand-secondary">
                  ({chatHistory.length}/{MAX_CHAT_HISTORY_ITEMS})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {chatHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.aiBuilderHistoryClear}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="w-8 h-8 rounded-lg bg-brand-bg hover:bg-brand-elevated border border-brand flex items-center justify-center text-brand-secondary hover:text-brand-primary transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {chatHistory.length === 0 ? (
                <div className="py-12 text-center text-brand-secondary text-xs font-semibold">
                  {t.aiBuilderHistoryEmpty}
                </div>
              ) : (
                chatHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-brand-bg border border-brand hover:border-brand-accent/50 transition flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-brand-secondary">
                      <span className="font-bold text-brand-accent">
                        {item.pageTitle || modeLabelMap[item.mode]}
                      </span>
                      <span className="font-mono">
                        {new Date(item.createdAt).toLocaleDateString(
                          language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : 'en-US',
                          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-brand-primary line-clamp-2 leading-relaxed">
                      {item.prompt}
                    </p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setPromptInput(item.prompt);
                          setSelectedMode(item.mode);
                          setIsHistoryOpen(false);
                          setErrorMessage(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-brand-surface hover:bg-brand-elevated border border-brand text-brand-primary text-xs font-bold transition cursor-pointer"
                      >
                        {t.aiBuilderHistoryUsePrompt}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AiPageBuilderPage;
