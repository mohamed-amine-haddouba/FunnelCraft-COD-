import React, { useState } from 'react';
import {
  X,
  FolderKanban,
  Plus,
  ExternalLink,
  Copy,
  Trash2,
  Sparkles,
  Layers,
  AlertCircle,
  CheckCircle2,
  Search,
  Globe,
  Clock,
  Cloud,
  Rocket,
  Eye,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StoredPage } from '../types/user';
import { LandingPageData } from '../types/landingPage';

interface MyPagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPageId: string;
  onSelectPage: (page: StoredPage) => void;
  onCreateNewPage: () => void;
  onSaveCurrentPage: () => void;
  onUpgradeClick: (reason?: string) => void;
}

export const MyPagesModal: React.FC<MyPagesModalProps> = ({
  isOpen,
  onClose,
  currentPageId,
  onSelectPage,
  onCreateNewPage,
  onSaveCurrentPage,
  onUpgradeClick,
}) => {
  const {
    userPages,
    planId,
    isStarter,
    isPro,
    pagesCreatedCount,
    maxPages,
    maxFreePages,
    isLimitReached,
    deleteUserPageFromCloud,
    duplicateUserPageInCloud,
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );

  if (!isOpen) return null;

  const filteredPages = userPages.filter((page) =>
    (page.title || 'Untitled Landing Page')
      .toLowerCase()
      .includes(searchQuery.toLowerCase().trim())
  );

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 2) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hr ago`;
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const handleDuplicate = async (pageId: string) => {
    if (isLimitReached) {
      onUpgradeClick(
        `🔒 Upgrade Required: Plan limit reached (${pagesCreatedCount}/${maxPages ?? maxFreePages} pages). Upgrade to Pro for unlimited pages.`
      );
      return;
    }

    setDuplicatingId(pageId);
    setActionMessage(null);
    try {
      const res = await duplicateUserPageInCloud(pageId);
      if (res.isLimitReached) {
        onUpgradeClick(res.error || 'Upgrade to Pro to create more pages.');
      } else if (res.success && res.page) {
        setActionMessage({ text: 'Page duplicated successfully in cloud!', type: 'success' });
      } else {
        setActionMessage({ text: res.error || 'Failed to duplicate page.', type: 'error' });
      }
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (pageId: string) => {
    if (deletingId !== pageId) {
      setDeletingId(pageId);
      return;
    }

    setActionMessage(null);
    try {
      const res = await deleteUserPageFromCloud(pageId);
      if (res.success) {
        setActionMessage({ text: 'Page deleted from cloud storage.', type: 'success' });
      } else {
        setActionMessage({ text: res.error || 'Failed to delete page.', type: 'error' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateNew = () => {
    if (isLimitReached) {
      onUpgradeClick(
        `🔒 Upgrade Required: Plan limit reached (${pagesCreatedCount}/${maxPages ?? maxFreePages} pages). Upgrade to Pro to build unlimited landing pages.`
      );
      return;
    }
    onCreateNewPage();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">My Pages & Funnels</h2>
                {isPro ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 tracking-wider">
                    {planId.toUpperCase()} • Unlimited
                  </span>
                ) : isStarter ? (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 tracking-wider">
                    Starter Plan: {pagesCreatedCount}/{maxPages ?? 5} Pages
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 tracking-wider">
                    Free Tier: {pagesCreatedCount}/{maxPages ?? maxFreePages} Pages
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                All landing pages permanently stored in your cloud account — accessible across devices
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isPro && (
              <button
                type="button"
                onClick={() => onUpgradeClick('Upgrade to Pro for unlimited funnels, Custom Domains, and Tracking Pixels')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isLimitReached ? '🔒 Upgrade Required' : 'Upgrade to Pro'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action / Feedback Banner */}
        {actionMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center gap-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100'
                : 'bg-rose-50 text-rose-800 border-b border-rose-100'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Toolbar: Search & Create New Button */}
        <div className="p-4 sm:p-6 pb-2 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search landing pages by title or slug..."
              className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 text-xs outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveCurrentPage}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 font-bold text-xs transition cursor-pointer"
            >
              <Cloud className="w-4 h-4 text-emerald-600" />
              <span>Save Current Page</span>
            </button>

            <button
              type="button"
              onClick={handleCreateNew}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create New Page</span>
            </button>
          </div>
        </div>

        {/* Main Content: List of Pages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredPages.length === 0 ? (
            <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <FolderKanban className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                {searchQuery ? 'No landing pages match your search' : 'No Saved Landing Pages Yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
                {searchQuery
                  ? 'Try searching with different keywords or clear the search field.'
                  : 'Save your current canvas to your account cloud database so you can access and manage it from any browser.'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onSaveCurrentPage}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  Save Current Canvas Now
                </button>
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 bg-white text-xs font-bold transition cursor-pointer"
                >
                  Create New Page
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredPages.map((page) => {
                const isCurrentlyActive = page.id === currentPageId;
                const pageData = page.data as LandingPageData | undefined;
                const blocksCount = pageData?.blocks?.length ?? 0;
                const lang = pageData?.language ?? 'ar';
                const isArabic = lang === 'ar';
                const isFrench = lang === 'fr';

                return (
                  <div
                    key={page.id}
                    className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                      isCurrentlyActive
                        ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm hover:shadow'
                    }`}
                  >
                    <div>
                      {/* Card Top: Badges & Active Status */}
                      <div className="flex items-center justify-between mb-2.5 gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isCurrentlyActive && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                              Active in Editor
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {blocksCount} Sections
                          </span>

                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            <Globe className="w-3 h-3 text-slate-400" />
                            {isArabic ? '🇲🇦 Arabic / Darija' : isFrench ? '🇫🇷 French' : '🇺🇸 English'}
                          </span>

                          {page.isPublished && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              LIVE
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatDate(page.updatedAt)}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1 mb-1">
                        {page.title || 'Untitled Funnel'}
                      </h4>

                      {/* Slug & Live link */}
                      <div className="flex items-center justify-between text-[11px] mb-3">
                        <p className="font-mono text-slate-400 truncate max-w-[160px]">
                          /{page.slug || page.id}
                        </p>
                        {page.isPublished ? (
                          <div className="flex items-center gap-2.5 text-[10px] font-bold text-emerald-700">
                            <span className="flex items-center gap-0.5" title="إجمالي المشاهدات">
                              <Eye className="w-3 h-3 text-emerald-600" />
                              {page.viewsCount || 0}
                            </span>
                            <span className="flex items-center gap-0.5" title="إجمالي طلبات الدفع عند الاستلام">
                              <ShoppingBag className="w-3 h-3 text-emerald-600" />
                              {page.ordersCount || 0}
                            </span>
                            <a
                              href={`/p/${page.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:text-emerald-900 underline flex items-center gap-0.5"
                              title="عرض الصفحة المنشورة"
                            >
                              <span>معاينة</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.2 rounded border border-slate-100">
                            مسودة غير منشورة
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPage(page);
                          onClose();
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isCurrentlyActive
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{isCurrentlyActive ? 'Continue Editing' : 'Open in Editor'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(page.id)}
                        disabled={duplicatingId === page.id}
                        title="Duplicate Funnel"
                        className="p-2 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(page.id)}
                        title={deletingId === page.id ? 'Click again to confirm delete' : 'Delete Funnel'}
                        className={`p-2 rounded-xl border transition cursor-pointer ${
                          deletingId === page.id
                            ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold text-[11px] px-3'
                            : 'border-slate-200 hover:border-rose-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                      >
                        {deletingId === page.id ? 'Confirm?' : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Bottom Banner / Cloud Sync Info */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Permanent encrypted Cloud persistence • Continue your work from any PC or mobile</span>
          </div>
          <span className="font-semibold text-slate-700">
            Total Pages: {userPages.length}
          </span>
        </div>
      </div>
    </div>
  );
};
export default MyPagesModal;
