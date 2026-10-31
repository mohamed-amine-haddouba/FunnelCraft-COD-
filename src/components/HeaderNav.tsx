import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ViewportMode,
  LandingPageData,
} from '../types/landingPage';
import {
  Globe,
  Check,
  Wand2,
  User as UserIcon,
  Crown,
  LogOut,
  ShieldAlert,
  FolderKanban,
  Rocket,
  Save,
  Loader2,
  Settings,
  ShoppingBag,
  BarChart3,
  Store,
  ExternalLink,
  HelpCircle,
  Scale,
  FileText,
  ChevronDown,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  ArrowRight,
  Sun,
  Moon,
} from 'lucide-react';
import { ALL_PRESET_TEMPLATES } from '../data/defaultTemplates';
import { useAuth } from '../context/AuthContext';
import { useLanguage, Language } from '../i18n/translations';
import { useTheme } from '../context/ThemeContext';
import { SubscriptionPlanId } from '../types/orders';

export type WorkspaceTab =
  | 'builder'
  | 'orders'
  | 'analytics'
  | 'settings'
  | 'admin'
  | 'pricing'
  | 'contact'
  | 'terms'
  | 'privacy';

interface Props {
  pageData: LandingPageData;
  viewport: ViewportMode;
  isPreviewMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'unsaved' | 'error';
  activeView?: WorkspaceTab;
  onViewChange?: (view: WorkspaceTab) => void;
  pendingOrdersCount?: number;
  currentPlan?: SubscriptionPlanId;
  onViewportChange: (mode: ViewportMode) => void;
  onTogglePreview: () => void;
  onToggleCustomerLiveView?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSavePage: () => void;
  onOpenMyPagesModal: () => void;
  onOpenPublishModal: () => void;
  onOpenSettingsModal: () => void;
  isCurrentPagePublished?: boolean;
  currentPublishedSlug?: string;
  onOpenAiModal: () => void;
  onOpenExportModal?: () => void;
  onOpenAuthModal: (mode: 'login' | 'register') => void;
  onOpenUpgradeModal: () => void;
  onOpenAdminModal: () => void;
  onLoadTemplate: (template: LandingPageData) => void;
  onUpdateTitle: (title: string) => void;
  isLeftSidebarOpen?: boolean;
  isRightSidebarOpen?: boolean;
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
}

export const HeaderNav: React.FC<Props> = ({
  pageData,
  viewport,
  canUndo,
  canRedo,
  saveStatus = 'idle',
  activeView,
  onViewChange,
  pendingOrdersCount = 0,
  onViewportChange,
  onToggleCustomerLiveView,
  onUndo,
  onRedo,
  onSavePage,
  onOpenMyPagesModal,
  onOpenPublishModal,
  onOpenSettingsModal,
  isCurrentPagePublished = false,
  onOpenAiModal,
  onOpenAuthModal,
  onOpenUpgradeModal,
  onOpenAdminModal,
  onLoadTemplate,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const currentTab: WorkspaceTab = (tab as WorkspaceTab) || activeView || 'builder';

  const handleNavigateTab = (target: WorkspaceTab) => {
    if (target === 'contact' || target === 'terms' || target === 'privacy') {
      navigate(`/${target}`);
    } else {
      navigate(`/dashboard/${target}`);
    }
    onViewChange?.(target);
  };

  const {
    user,
    isLoggedIn,
    isPro,
    isAdmin,
    pagesCreatedCount,
    maxFreePages,
    logout,
    userPayments,
  } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const pendingPaymentsCount = userPayments.filter((r) => r.status === 'pending').length;

  const languages: { code: Language; label: string }[] = [
    { code: 'ar', label: 'AR' },
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <header className="bg-[#0D131E] text-[#F8FAFC] border-b border-[#1E293B] shrink-0 select-none z-40 relative w-full shadow-md">
      <div className="flex h-14 flex-nowrap items-center justify-between px-3 sm:px-4 gap-2 overflow-x-hidden w-full">
        {/* 1. Brand + Back to Dashboard (Right in RTL) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/builder')}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
            title="CodWorth — منصة صفحات الهبوط والدفع عند الاستلام"
          >
            <img
              src="/assets/brand/logo.jpg"
              className="h-8 w-auto object-contain rounded-lg"
              alt="CodWorth Logo"
            />
          </button>

          {currentTab === 'builder' && (
            <button
              type="button"
              onClick={() => handleNavigateTab('orders')}
              title="Back to Dashboard (لوحة التحكم والطلبات)"
              className="hidden lg:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#131B2A] hover:bg-[#1E293B] border border-[#1E293B] text-[#CBD5E1] hover:text-[#F8FAFC] text-[11px] font-bold transition cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
              <span>لوحة التحكم</span>
            </button>
          )}
        </div>

        {/* 2. Primary Navigation + Builder Viewport & Undo/Redo Controls (Center) */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <nav className="flex items-center justify-center gap-1 bg-[#131B2A] p-1 rounded-xl border border-[#1E293B] min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigateTab('builder')}
              title={t.navBuilder}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                currentTab === 'builder'
                  ? 'bg-[#E25B26] text-[#F8FAFC] shadow-xs'
                  : 'text-[#CBD5E1] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
              }`}
            >
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span>{t.navBuilder}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigateTab('orders')}
              title={t.navOrders}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 relative ${
                currentTab === 'orders'
                  ? 'bg-[#E25B26] text-[#F8FAFC] shadow-xs'
                  : 'text-[#CBD5E1] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span>{t.navOrders}</span>
              {pendingOrdersCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-black rounded-full font-mono shrink-0 ${
                    currentTab === 'orders'
                      ? 'bg-[#0D131E] text-[#F8FAFC]'
                      : 'bg-[#E25B26] text-[#F8FAFC]'
                  }`}
                >
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleNavigateTab('analytics')}
              title={t.navAnalytics}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                currentTab === 'analytics'
                  ? 'bg-[#E25B26] text-[#F8FAFC] shadow-xs'
                  : 'text-[#CBD5E1] hover:text-[#F8FAFC] hover:bg-[#1E293B]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>{t.navAnalytics}</span>
            </button>
          </nav>

          {/* Viewport Toggle (Desktop/Tablet/Mobile) & Undo/Redo in Top Bar */}
          {currentTab === 'builder' && (
            <div className="hidden xl:flex items-center gap-1.5 bg-[#131B2A] p-1 rounded-xl border border-[#1E293B]" dir="ltr">
              <button
                type="button"
                onClick={() => onViewportChange('desktop')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewport === 'desktop'
                    ? 'bg-[#E25B26] text-[#F8FAFC] shadow-xs'
                    : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                }`}
                title="Desktop Viewport"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onViewportChange('tablet')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewport === 'tablet'
                    ? 'bg-[#E25B26] text-[#F8FAFC] shadow-xs'
                    : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                }`}
                title="Tablet Viewport"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onViewportChange('mobile')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewport === 'mobile'
                    ? 'bg-[#E25B26] text-[#F8FAFC] shadow-xs'
                    : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                }`}
                title="Mobile Viewport"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-[#1E293B] mx-0.5" />

              <button
                type="button"
                disabled={!canUndo}
                onClick={onUndo}
                className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-[#F8FAFC] hover:bg-[#1E293B] disabled:opacity-30 transition cursor-pointer"
                title={t.undo}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!canRedo}
                onClick={onRedo}
                className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-[#F8FAFC] hover:bg-[#1E293B] disabled:opacity-30 transition cursor-pointer"
                title={t.redo}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 3. Secondary Actions (Left in RTL): Builder Tools + Prominent Publish Button + User Avatar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {currentTab === 'builder' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* My Pages */}
              <button
                type="button"
                onClick={onOpenMyPagesModal}
                title={t.myPages}
                aria-label={t.myPages}
                className="w-8 h-8 rounded-lg bg-[#131B2A] hover:bg-[#1E293B] border border-[#1E293B] flex items-center justify-center text-[#CBD5E1] hover:text-[#E25B26] transition cursor-pointer shrink-0"
              >
                <FolderKanban className="w-4 h-4 shrink-0" />
              </button>

              {/* Templates */}
              <button
                type="button"
                onClick={() => {
                  setShowTemplates(!showTemplates);
                  setShowUserMenu(false);
                }}
                title={t.templates}
                aria-label={t.templates}
                className="w-8 h-8 rounded-lg bg-[#131B2A] hover:bg-[#1E293B] border border-[#1E293B] flex items-center justify-center text-[#CBD5E1] hover:text-[#E25B26] transition cursor-pointer shrink-0"
              >
                <Globe className="w-4 h-4 shrink-0" />
              </button>

              {/* AI Generate / Import Product Modal */}
              <button
                type="button"
                onClick={onOpenAiModal}
                title={t.aiGenerate}
                aria-label={t.aiGenerate}
                className="h-8 px-2.5 rounded-lg bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-[#F8FAFC] shadow-xs flex items-center gap-1.5 text-xs font-bold transition cursor-pointer shrink-0"
              >
                <Wand2 className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                <span className="hidden md:inline">AI / استيراد</span>
              </button>

              {/* Save */}
              <button
                type="button"
                onClick={onSavePage}
                title={
                  saveStatus === 'saving'
                    ? t.saving
                    : saveStatus === 'saved'
                    ? t.saved
                    : t.save
                }
                aria-label={t.save}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition cursor-pointer shrink-0 ${
                  saveStatus === 'saved'
                    ? 'bg-[#E25B26]/20 border-[#E25B26]/50 text-[#E25B26]'
                    : saveStatus === 'unsaved'
                    ? 'bg-amber-950/50 border-amber-700/60 text-amber-300 hover:bg-amber-900/50'
                    : 'bg-[#131B2A] hover:bg-[#1E293B] border-[#1E293B] text-[#CBD5E1]'
                }`}
              >
                {saveStatus === 'saving' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#E25B26] shrink-0" />
                ) : saveStatus === 'saved' ? (
                  <Check className="w-4 h-4 text-[#E25B26] shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
              </button>

              {/* Prominent Publish Button (Brand Accent) */}
              <button
                type="button"
                onClick={onOpenPublishModal}
                title={isCurrentPagePublished ? t.published : t.publish}
                aria-label={isCurrentPagePublished ? t.published : t.publish}
                className="h-8 px-3 rounded-lg bg-[#E25B26] hover:bg-[#F16F3C] text-[#F8FAFC] font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shrink-0"
              >
                <Rocket className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {isCurrentPagePublished ? t.published : t.publish}
                </span>
              </button>

              {/* Customer Live Storefront View */}
              {onToggleCustomerLiveView && (
                <button
                  type="button"
                  onClick={onToggleCustomerLiveView}
                  title={t.customerLiveView}
                  aria-label={t.customerLiveView}
                  className="w-8 h-8 rounded-lg bg-[#131B2A] hover:bg-[#1E293B] text-[#E25B26] border border-[#1E293B] flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </button>
              )}
            </div>
          )}

          {/* Compact Upgrade / Plan Indicator */}
          {!isPro && (
            <button
              type="button"
              onClick={() => {
                handleNavigateTab('pricing');
                onOpenUpgradeModal();
              }}
              title={`${t.upgrade} (${pagesCreatedCount}/${maxFreePages})`}
              className="hidden md:flex items-center gap-1 h-8 px-2.5 rounded-lg bg-[#131B2A] hover:bg-[#1E293B] border border-[#1E293B] text-[#E25B26] text-xs font-bold transition cursor-pointer shrink-0"
            >
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono text-[11px] text-[#CBD5E1]">
                {pagesCreatedCount}/{maxFreePages}
              </span>
            </button>
          )}

          {/* Global Theme Toggle (Sun/Moon) */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'تبديل إلى الوضع النهاري (Light Mode)' : 'تبديل إلى الوضع الليلي (Dark Mode)'}
            aria-label="Toggle theme"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#131B2A] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#334155] text-[#CBD5E1] hover:text-[#E25B26] transition-all duration-200 cursor-pointer shrink-0 shadow-xs"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#E25B26] transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-[#F8FAFC] transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* User Avatar Dropdown Trigger (Settings, Admin, Profile, Logout) */}
          {isLoggedIn && user ? (
            <button
              type="button"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowTemplates(false);
              }}
              title="الحساب والإعدادات"
              className="flex items-center gap-1.5 h-8 pl-2 pr-1.5 rounded-lg bg-[#131B2A] hover:bg-[#1E293B] border border-[#1E293B] text-xs font-bold text-[#F8FAFC] transition cursor-pointer shrink-0 relative"
            >
              <div className="w-6 h-6 rounded-full bg-[#E25B26] text-[#F8FAFC] flex items-center justify-center font-black text-[11px] shrink-0">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
              {isAdmin && pendingPaymentsCount > 0 && (
                <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-[#E25B26] ring-2 ring-[#0D131E]" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuthModal('login')}
              title={t.login}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#E25B26] hover:bg-[#F16F3C] text-xs font-bold text-[#F8FAFC] transition cursor-pointer shrink-0"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#F8FAFC] shrink-0" />
              <span className="hidden sm:inline">{t.login}</span>
            </button>
          )}
        </div>
      </div>

      {/* Templates Dropdown Menu */}
      {showTemplates && currentTab === 'builder' && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTemplates(false)}
          />
          <div className="absolute top-14 end-16 w-72 bg-[#131B2A] border border-[#1E293B] rounded-xl shadow-2xl p-2 z-50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#CBD5E1] px-3 py-1.5">
              {t.templates}
            </div>
            {ALL_PRESET_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  onLoadTemplate(tpl);
                  setShowTemplates(false);
                }}
                className="w-full text-start px-3 py-2 rounded-lg hover:bg-[#1E293B] transition flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#F8FAFC] group-hover:text-[#E25B26] transition truncate">
                    {tpl.title}
                  </div>
                  <div className="text-[10px] text-[#CBD5E1]">
                    {tpl.language.toUpperCase()} • {tpl.direction.toUpperCase()}
                  </div>
                </div>
                {pageData.id === tpl.id && (
                  <Check className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* User Dropdown Menu (Profile, Settings, Admin, Language, Logout) */}
      {showUserMenu && isLoggedIn && user && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowUserMenu(false)}
          />
          <div className="absolute top-14 end-4 w-64 bg-[#131B2A] border border-[#1E293B] rounded-2xl shadow-2xl p-2 z-50 text-xs">
            {/* Profile Info Header */}
            <div className="px-3 py-2.5 border-b border-[#1E293B]">
              <div className="font-bold text-[#F8FAFC] truncate">{user.full_name}</div>
              <div className="text-[#CBD5E1] text-[11px] truncate">{user.email}</div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E293B] text-[10px] font-semibold text-[#E25B26]">
                  {isPro ? '👑 Pro Unlimited' : `${t.freeBadge} (${pagesCreatedCount}/${maxFreePages})`}
                </span>
                {user.store_name && (
                  <span className="text-[10px] text-[#CBD5E1] truncate max-w-[100px]">
                    {user.store_name}
                  </span>
                )}
              </div>
            </div>

            {/* Primary Account Items: Profile/Settings, My Pages, Admin */}
            <div className="py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  handleNavigateTab('settings');
                  onOpenSettingsModal();
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-[#1E293B] text-[#F8FAFC] font-semibold flex items-center gap-2.5 transition cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                <span>الملف الشخصي والبيانات</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  handleNavigateTab('settings');
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-[#1E293B] text-[#F8FAFC] font-semibold flex items-center gap-2.5 transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                <span>{t.navSettings}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenMyPagesModal();
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-[#1E293B] text-[#F8FAFC] font-semibold flex items-center gap-2.5 transition cursor-pointer"
              >
                <FolderKanban className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
                <span>{t.myPages}</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      handleNavigateTab('admin');
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[#E25B26]/15 hover:bg-[#E25B26]/25 text-[#E25B26] font-bold flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                      <span>{t.navAdminPortal}</span>
                    </span>
                    {pendingPaymentsCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-[#E25B26] text-[#F8FAFC] rounded-full font-mono">
                        {pendingPaymentsCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenAdminModal();
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-[#1E293B] text-[#F8FAFC] font-semibold flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Crown className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                      <span>{t.adminPanel}</span>
                    </span>
                  </button>
                </>
              )}

              {!isPro && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    handleNavigateTab('pricing');
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#E25B26]/15 hover:bg-[#E25B26]/25 text-[#E25B26] font-bold flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                  <span>{t.upgrade}</span>
                </button>
              )}
            </div>

            {/* Language Selector inside User Dropdown */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-[#1E293B]">
              <span className="text-[11px] text-[#CBD5E1] font-semibold">{t.language}</span>
              <div className="flex items-center gap-1" dir="ltr">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      language === lang.code
                        ? 'bg-[#E25B26] text-[#F8FAFC]'
                        : 'bg-[#1E293B] text-[#CBD5E1] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Support & Legal Links */}
            <div className="border-t border-[#1E293B] py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/contact');
                }}
                className="w-full px-3 py-1.5 rounded-lg hover:bg-[#1E293B] text-[#CBD5E1] font-medium flex items-center gap-2 transition cursor-pointer text-[11px]"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
                <span>تواصل معنا (الدعم الفني)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/terms');
                }}
                className="w-full px-3 py-1.5 rounded-lg hover:bg-[#1E293B] text-[#CBD5E1] font-medium flex items-center gap-2 transition cursor-pointer text-[11px]"
              >
                <Scale className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
                <span>شروط الاستخدام (Terms)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/privacy');
                }}
                className="w-full px-3 py-1.5 rounded-lg hover:bg-[#1E293B] text-[#CBD5E1] font-medium flex items-center gap-2 transition cursor-pointer text-[11px]"
              >
                <FileText className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
                <span>سياسة الخصوصية (Privacy)</span>
              </button>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={async () => {
                setShowUserMenu(false);
                await logout();
                navigate('/login');
              }}
              className="w-full mt-1 px-3 py-2 rounded-lg hover:bg-rose-950/50 text-rose-400 font-semibold flex items-center gap-2.5 transition cursor-pointer border-t border-[#1E293B]"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>{t.logout}</span>
            </button>
          </div>
        </>
      )}
    </header>
  );
};
