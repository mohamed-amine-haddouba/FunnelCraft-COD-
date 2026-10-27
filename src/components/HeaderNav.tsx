import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ViewportMode,
  LandingPageData,
} from '../types/landingPage';
import {
  Sparkles,
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
} from 'lucide-react';
import { ALL_PRESET_TEMPLATES } from '../data/defaultTemplates';
import { useAuth } from '../context/AuthContext';
import { useLanguage, Language } from '../i18n/translations';
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
  saveStatus = 'idle',
  activeView,
  onViewChange,
  pendingOrdersCount = 0,
  onToggleCustomerLiveView,
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

  const pendingPaymentsCount = userPayments.filter((r) => r.status === 'pending').length;

  const languages: { code: Language; label: string }[] = [
    { code: 'ar', label: 'AR' },
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <header className="bg-slate-950 text-white border-b border-slate-800/90 shrink-0 select-none z-40 relative w-full">
      {/* Single Compact Row: h-14 flex-nowrap items-center justify-between px-4 gap-2 overflow-x-hidden */}
      <div className="flex h-14 flex-nowrap items-center justify-between px-4 gap-2 overflow-x-hidden w-full">
        {/* 1. Brand (Right in RTL): Logo + "CodWorth" (hidden on small screens) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard/builder')}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
            title="CodWorth — منصة صفحات الهبوط والدفع عند الاستلام"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition shrink-0">
              <Sparkles className="w-4 h-4 text-slate-950" />
            </div>
            <span className="hidden sm:inline font-black tracking-tight text-sm text-white whitespace-nowrap">
              CodWorth
            </span>
          </button>
        </div>

        {/* 2. Primary Navigation (Center): "Builder", "Orders", "Analytics" */}
        <nav className="flex items-center justify-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => handleNavigateTab('builder')}
            title={t.navBuilder}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
              currentTab === 'builder'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span>{t.navBuilder}</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigateTab('orders')}
            title={t.navOrders}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 relative ${
              currentTab === 'orders'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            <span>{t.navOrders}</span>
            {pendingOrdersCount > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[10px] font-black rounded-full font-mono shrink-0 ${
                  currentTab === 'orders'
                    ? 'bg-slate-950 text-emerald-400'
                    : 'bg-rose-500 text-white'
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
              currentTab === 'analytics'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span>{t.navAnalytics}</span>
          </button>
        </nav>

        {/* 3. Secondary Actions (Left in RTL): Icon-only Builder Tools + User Avatar Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          {currentTab === 'builder' && (
            <div className="flex items-center gap-1 shrink-0">
              {/* My Pages (Icon-only with tooltip) */}
              <button
                type="button"
                onClick={onOpenMyPagesModal}
                title={t.myPages}
                aria-label={t.myPages}
                className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-emerald-400 transition cursor-pointer shrink-0"
              >
                <FolderKanban className="w-4 h-4 shrink-0" />
              </button>

              {/* Templates (Icon-only with tooltip) */}
              <button
                type="button"
                onClick={() => {
                  setShowTemplates(!showTemplates);
                  setShowUserMenu(false);
                }}
                title={t.templates}
                aria-label={t.templates}
                className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-teal-400 transition cursor-pointer shrink-0"
              >
                <Globe className="w-4 h-4 shrink-0" />
              </button>

              {/* AI Generate (Icon-only with tooltip) */}
              <button
                type="button"
                onClick={onOpenAiModal}
                title={t.aiGenerate}
                aria-label={t.aiGenerate}
                className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xs flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <Wand2 className="w-4 h-4 shrink-0" />
              </button>

              {/* Save (Icon-only with tooltip) */}
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
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400'
                    : saveStatus === 'unsaved'
                    ? 'bg-amber-950/50 border-amber-700/60 text-amber-300 hover:bg-amber-900/50'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                }`}
              >
                {saveStatus === 'saving' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                ) : saveStatus === 'saved' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
              </button>

              {/* Publish (Icon-only with tooltip) */}
              <button
                type="button"
                onClick={onOpenPublishModal}
                title={isCurrentPagePublished ? t.published : t.publish}
                aria-label={isCurrentPagePublished ? t.published : t.publish}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer shadow-xs shrink-0 ${
                  isCurrentPagePublished
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950'
                }`}
              >
                <Rocket className="w-4 h-4 shrink-0" />
              </button>

              {/* Customer Live Storefront View (Icon-only with tooltip) */}
              {onToggleCustomerLiveView && (
                <button
                  type="button"
                  onClick={onToggleCustomerLiveView}
                  title={t.customerLiveView}
                  aria-label={t.customerLiveView}
                  className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
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
              className="hidden md:flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 text-xs font-bold transition cursor-pointer shrink-0"
            >
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono text-[11px] text-slate-300">
                {pagesCreatedCount}/{maxFreePages}
              </span>
            </button>
          )}

          {/* User Avatar Dropdown Trigger (Settings, Admin, Profile, Logout) */}
          {isLoggedIn && user ? (
            <button
              type="button"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowTemplates(false);
              }}
              title="الحساب والإعدادات"
              className="flex items-center gap-1.5 h-8 pl-2 pr-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-white transition cursor-pointer shrink-0 relative"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-[11px] shrink-0">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {isAdmin && pendingPaymentsCount > 0 && (
                <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-950" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuthModal('login')}
              title={t.login}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 hover:text-white transition cursor-pointer shrink-0"
            >
              <UserIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
          <div className="absolute top-14 end-16 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-1.5">
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
                className="w-full text-start px-3 py-2 rounded-lg hover:bg-slate-800 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white group-hover:text-emerald-400 transition truncate">
                    {tpl.title}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {tpl.language.toUpperCase()} • {tpl.direction.toUpperCase()}
                  </div>
                </div>
                {pageData.id === tpl.id && (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
          <div className="absolute top-14 end-4 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 text-xs">
            {/* Profile Info Header */}
            <div className="px-3 py-2.5 border-b border-slate-800">
              <div className="font-bold text-white truncate">{user.full_name}</div>
              <div className="text-slate-400 text-[11px] truncate">{user.email}</div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-emerald-400">
                  {isPro ? '👑 Pro Unlimited' : `${t.freeBadge} (${pagesCreatedCount}/${maxFreePages})`}
                </span>
                {user.store_name && (
                  <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
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
                className="w-full px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center gap-2.5 transition cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>الملف الشخصي والبيانات</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  handleNavigateTab('settings');
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center gap-2.5 transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>{t.navSettings}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenMyPagesModal();
                }}
                className="w-full px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center gap-2.5 transition cursor-pointer"
              >
                <FolderKanban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                    className="w-full px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{t.navAdminPortal}</span>
                    </span>
                    {pendingPaymentsCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-rose-500 text-white rounded-full font-mono">
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
                    className="w-full px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Crown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
                  className="w-full px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{t.upgrade}</span>
                </button>
              )}
            </div>

            {/* Language Selector inside User Dropdown */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-semibold">{t.language}</span>
              <div className="flex items-center gap-1" dir="ltr">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      language === lang.code
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Support & Legal Links */}
            <div className="border-t border-slate-800/80 py-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/contact');
                }}
                className="w-full px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-medium flex items-center gap-2 transition cursor-pointer text-[11px]"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>تواصل معنا (الدعم الفني)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/terms');
                }}
                className="w-full px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-medium flex items-center gap-2 transition cursor-pointer text-[11px]"
              >
                <Scale className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>شروط الاستخدام (Terms)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/privacy');
                }}
                className="w-full px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-medium flex items-center gap-2 transition cursor-pointer text-[11px]"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
              className="w-full mt-1 px-3 py-2 rounded-lg hover:bg-rose-950/50 text-rose-400 font-semibold flex items-center gap-2.5 transition cursor-pointer border-t border-slate-800"
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

