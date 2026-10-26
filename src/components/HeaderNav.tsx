import React, { useState } from 'react';
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
  Cloud,
  Loader2,
  Settings,
  ShoppingBag,
  BarChart3,
  Store,
  Shield,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  HelpCircle,
  Scale,
  FileText,
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
  activeView: WorkspaceTab;
  onViewChange: (view: WorkspaceTab) => void;
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
  isLeftSidebarOpen = true,
  isRightSidebarOpen = true,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
      {/* Single Ultra-Compact Top Bar */}
      <div className="h-12 px-2.5 flex items-center justify-between gap-1.5 flex-nowrap overflow-x-hidden w-full">
        {/* Left Section: Brand + Primary Workspace Switcher + Sidebar Toggles */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          {/* Brand Logo */}
          <div
            onClick={() => onViewChange('builder')}
            className="flex items-center gap-1.5 cursor-pointer group shrink-0"
            title="CodWorth"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            </div>
            <div className="hidden 2xl:block leading-tight">
              <div className="flex items-center gap-1">
                <span className="font-extrabold tracking-tight text-xs text-white whitespace-nowrap">
                  {t.funnelCraft}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 whitespace-nowrap">
                  {t.codBadge}
                </span>
              </div>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block shrink-0" />

          {/* Main SaaS Navigation Tabs (Compact) */}
          <nav className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => onViewChange('builder')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'builder'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={t.navBuilder}
            >
              <Store className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">{t.navBuilder}</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange('orders')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition cursor-pointer relative whitespace-nowrap ${
                activeView === 'orders'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={t.navOrders}
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">{t.navOrders}</span>
              {pendingOrdersCount > 0 && (
                <span
                  className={`px-1 py-0.2 text-[9px] font-black rounded-full transition font-mono ${
                    activeView === 'orders'
                      ? 'bg-slate-950 text-emerald-400'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            {/* Analytics & Settings: Icon-only with tooltips on top bar */}
            <button
              type="button"
              onClick={() => onViewChange('analytics')}
              title={t.navAnalytics}
              className={`flex items-center justify-center p-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                activeView === 'analytics'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onViewChange('settings')}
              title={t.navSettings}
              className={`flex items-center justify-center p-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                activeView === 'settings'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => onViewChange('admin')}
                title={t.navAdminPortal}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition cursor-pointer relative whitespace-nowrap ${
                  activeView === 'admin'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/10'
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">{t.navAdminPortal}</span>
                {pendingPaymentsCount > 0 && (
                  <span className="px-1 py-0.2 text-[9px] font-black rounded-full bg-rose-500 text-white font-mono">
                    {pendingPaymentsCount}
                  </span>
                )}
              </button>
            )}
          </nav>

          {/* Builder Context Actions: Sidebar Toggles, My Pages, Templates */}
          {activeView === 'builder' && (
            <div className="flex items-center gap-1 shrink-0">
              {onToggleLeftSidebar && (
                <button
                  type="button"
                  onClick={onToggleLeftSidebar}
                  title={isLeftSidebarOpen ? 'إخفاء القائمة الجانبية للأقسام' : 'إظهار القائمة الجانبية للأقسام'}
                  className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                    isLeftSidebarOpen
                      ? 'bg-slate-800 text-emerald-400 border-slate-700'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {isLeftSidebarOpen ? (
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  ) : (
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              {onToggleRightSidebar && (
                <button
                  type="button"
                  onClick={onToggleRightSidebar}
                  title={isRightSidebarOpen ? 'إخفاء خصائص التصميم' : 'إظهار خصائص التصميم'}
                  className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                    isRightSidebarOpen
                      ? 'bg-slate-800 text-emerald-400 border-slate-700'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {isRightSidebarOpen ? (
                    <PanelRightClose className="w-3.5 h-3.5" />
                  ) : (
                    <PanelRightOpen className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onOpenMyPagesModal}
                title={t.myPages}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 transition cursor-pointer whitespace-nowrap"
              >
                <FolderKanban className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden xl:inline">{t.myPages}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowTemplates(!showTemplates);
                  setShowUserMenu(false);
                }}
                title={t.templates}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 transition cursor-pointer whitespace-nowrap"
              >
                <Globe className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="hidden xl:inline">{t.templates}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Section: Secondary Builder Actions + Plan + Language + User Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeView === 'builder' && (
            <>
              {/* Save Button */}
              <button
                type="button"
                onClick={onSavePage}
                title={t.save}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition cursor-pointer whitespace-nowrap ${
                  saveStatus === 'saved'
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                    : saveStatus === 'unsaved'
                    ? 'bg-amber-950/50 border-amber-700/60 text-amber-300 hover:bg-amber-900/50'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                }`}
              >
                {saveStatus === 'saving' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 shrink-0" />
                ) : saveStatus === 'saved' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="hidden lg:inline">
                  {saveStatus === 'saving'
                    ? t.saving
                    : saveStatus === 'saved'
                    ? t.saved
                    : t.save}
                </span>
              </button>

              {/* AI Generate Button */}
              <button
                type="button"
                onClick={onOpenAiModal}
                title={t.aiGenerate}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-sm transition cursor-pointer whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden lg:inline">{t.aiGenerate}</span>
              </button>

              {/* Publish Button */}
              <button
                type="button"
                onClick={onOpenPublishModal}
                title={isCurrentPagePublished ? t.published : t.publish}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm whitespace-nowrap ${
                  isCurrentPagePublished
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950'
                }`}
              >
                <Rocket className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden lg:inline">
                  {isCurrentPagePublished ? t.published : t.publish}
                </span>
              </button>

              {/* Customer Storefront Live Preview Button */}
              {onToggleCustomerLiveView && (
                <button
                  type="button"
                  onClick={onToggleCustomerLiveView}
                  title={t.customerLiveView}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 transition cursor-pointer whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden lg:inline">{t.customerLiveView}</span>
                </button>
              )}
            </>
          )}

          {/* Plan Counter / Upgrade Pill */}
          {isPro ? (
            <button
              type="button"
              onClick={() => onViewChange('pricing')}
              title="الباقات والأسعار"
              className={`hidden xl:inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer ${
                activeView === 'pricing'
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-amber-400/40 text-amber-300 hover:border-amber-400'
              }`}
            >
              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{t.proBadge}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onViewChange('pricing');
                onOpenUpgradeModal();
              }}
              title={t.upgrade}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                activeView === 'pricing'
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800'
              }`}
            >
              <Crown
                className={`w-3.5 h-3.5 shrink-0 ${
                  activeView === 'pricing' ? 'text-slate-950' : 'text-amber-400'
                }`}
              />
              <span
                className={`font-mono ${
                  activeView === 'pricing' ? 'text-slate-950 font-black' : 'text-slate-300'
                }`}
              >
                {pagesCreatedCount}/{maxFreePages}
              </span>
              <span
                className={`hidden xl:inline font-extrabold ${
                  activeView === 'pricing' ? 'text-slate-950' : 'text-amber-400'
                }`}
              >
                {t.upgrade}
              </span>
            </button>
          )}

          {/* Language Switcher */}
          <div
            className="hidden sm:flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 shrink-0"
            dir="ltr"
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold transition cursor-pointer ${
                  language === lang.code
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* User Account / Auth Trigger */}
          {isLoggedIn && user ? (
            <button
              type="button"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowTemplates(false);
              }}
              className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-white transition cursor-pointer shrink-0"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-[10px] shrink-0">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="max-w-[72px] truncate hidden xl:inline text-[11px]">
                {user.store_name || user.full_name}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuthModal('login')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 hover:text-white transition cursor-pointer shrink-0"
            >
              <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">{t.login}</span>
            </button>
          )}
        </div>
      </div>

      {/* Templates Dropdown Menu (Rendered outside overflow-x-hidden row) */}
      {showTemplates && activeView === 'builder' && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowTemplates(false)}
          />
          <div className="absolute top-12 start-28 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
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

      {/* User Profile Dropdown Menu (Includes Analytics & Settings) */}
      {showUserMenu && isLoggedIn && user && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowUserMenu(false)}
          />
          <div className="absolute top-12 end-2.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs">
            <div className="px-3 py-2 border-b border-slate-800">
              <div className="font-bold text-white truncate">{user.full_name}</div>
              <div className="text-slate-400 text-[11px] truncate">{user.email}</div>
              <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-emerald-400">
                {isPro ? '👑 Pro Unlimited' : `${t.freeBadge} (${pagesCreatedCount}/${maxFreePages})`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowUserMenu(false);
                onOpenMyPagesModal();
              }}
              className="w-full mt-1 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.myPages}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowUserMenu(false);
                onViewChange('analytics');
              }}
              className="w-full mt-0.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-teal-400" />
              <span>{t.navAnalytics}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowUserMenu(false);
                onOpenSettingsModal();
              }}
              className="w-full mt-0.5 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.navSettings}</span>
            </button>

            {!isPro && (
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onViewChange('pricing');
                }}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.upgrade}</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenAdminModal();
                }}
                className="w-full mt-1 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.adminPanel}</span>
                </span>
                {pendingPaymentsCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-rose-500 text-white rounded-full font-mono">
                    {pendingPaymentsCount}
                  </span>
                )}
              </button>
            )}

            {/* Legal & Support Links */}
            <div className="border-t border-slate-800/80 my-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onViewChange('contact');
                }}
                className="w-full px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-medium flex items-center gap-2 transition cursor-pointer text-[11px]"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>تواصل معنا (الدعم الفني)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onViewChange('terms');
                }}
                className="w-full px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-medium flex items-center gap-2 transition cursor-pointer text-[11px]"
              >
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                <span>شروط الاستخدام (Terms)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onViewChange('privacy');
                }}
                className="w-full px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 font-medium flex items-center gap-2 transition cursor-pointer text-[11px]"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>سياسة الخصوصية (Privacy)</span>
              </button>
            </div>

            {/* Mobile Language Switcher inside Profile Menu */}
            <div className="sm:hidden flex items-center justify-between px-3 py-2 border-t border-slate-800 mt-1">
              <span className="text-[11px] text-slate-400">{t.language}</span>
              <div className="flex items-center gap-1" dir="ltr">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      language === lang.code
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                logout();
                setShowUserMenu(false);
              }}
              className="w-full mt-1 px-3 py-2 rounded-lg hover:bg-rose-950/50 text-rose-400 font-semibold flex items-center gap-2 transition cursor-pointer border-t border-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.logout}</span>
            </button>
          </div>
        </>
      )}
    </header>
  );
};
