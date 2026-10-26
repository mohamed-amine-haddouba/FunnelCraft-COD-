import React from 'react';
import {
  LandingPageData,
  LandingPageBlock,
  PromoBarBlock,
  HeroBlock,
  ProblemSolutionBlock,
  FeaturesBlock,
  SocialProofBlock,
  CodFormBlock,
  FaqBlock,
  FloatingCtaBlock,
  TrustBadgesBlock,
  PageTheme,
} from '../types/landingPage';
import {
  Sliders,
  Palette,
  Plus,
  Trash2,
  X,
  Image as ImageIcon,
  PanelRightClose,
  Crown,
  Lock,
} from 'lucide-react';
import { PRO_BLOCK_TYPES } from './BlocksToolbar';

interface Props {
  pageData: LandingPageData;
  selectedBlockId: string | null;
  isPro?: boolean;
  onUpgradeClick?: (reason?: string) => void;
  onUpdateBlock: (updatedBlock: LandingPageBlock) => void;
  onUpdateTheme: (updatedTheme: PageTheme) => void;
  onUpdatePageMeta: (updates: Partial<LandingPageData>) => void;
  onClose: () => void;
  onCollapse?: () => void;
}

const COLOR_PRESETS = [
  { name: 'Emerald', primary: '#059669', secondary: '#a7f3d0' },
  { name: 'Rose', primary: '#e11d48', secondary: '#fda4af' },
  { name: 'Sky', primary: '#0284c7', secondary: '#bae6fd' },
  { name: 'Amber', primary: '#d97706', secondary: '#fde68a' },
  { name: 'Indigo', primary: '#4f46e5', secondary: '#c7d2fe' },
  { name: 'Dark Slate', primary: '#0f172a', secondary: '#cbd5e1' },
];

const ProFeatureLockOverlay: React.FC<{
  onUpgradeClick?: (reason?: string) => void;
  reason?: string;
  compact?: boolean;
}> = ({ onUpgradeClick, reason, compact = false }) => {
  return (
    <div
      dir="rtl"
      className={`absolute inset-0 z-20 rounded-xl bg-slate-950/75 backdrop-blur-[2px] border border-amber-400/50 flex flex-col items-center justify-center text-center ${
        compact ? 'p-2' : 'p-4'
      }`}
    >
      <div className="flex items-center gap-1 text-amber-300 text-[10px] font-black mb-1.5">
        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>ميزة حصرية لمشتركي Pro</span>
      </div>
      <button
        type="button"
        onClick={() => onUpgradeClick?.(reason)}
        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-[11px] shadow-md transition cursor-pointer whitespace-nowrap"
      >
        🔒 ميزة احترافية - ترقية الآن
      </button>
    </div>
  );
};

export const PropertiesSidebar: React.FC<Props> = ({
  pageData,
  selectedBlockId,
  isPro = false,
  onUpgradeClick,
  onUpdateBlock,
  onUpdateTheme,
  onUpdatePageMeta,
  onClose,
  onCollapse,
}) => {
  const selectedBlock = pageData.blocks.find((b) => b.id === selectedBlockId);

  // If no block selected, display Global Page & Styling inspector
  if (!selectedBlock) {
    return (
      <aside className="w-[280px] shrink-0 bg-white border-l border-gray-200 flex flex-col h-full min-h-0 select-none overflow-y-auto overflow-x-hidden">
        <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <Palette className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 truncate">
              Page & Theme Settings
            </h3>
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition cursor-pointer shrink-0"
              title="إخفاء القائمة الجانبية"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="p-3 space-y-3.5 text-xs">
          {/* Landing Page Title */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              Landing Page Title
            </label>
            <input
              type="text"
              value={pageData.title}
              onChange={(e) => onUpdatePageMeta({ title: e.target.value })}
              className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
            />
          </div>

          {/* Language & Direction */}
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
                Language
              </label>
              <select
                value={pageData.language}
                onChange={(e) => {
                  const lang = e.target.value as 'en' | 'fr' | 'ar';
                  onUpdatePageMeta({
                    language: lang,
                    direction: lang === 'ar' ? 'rtl' : 'ltr',
                  });
                }}
                className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
              >
                <option value="en">English (LTR)</option>
                <option value="fr">Français (LTR)</option>
                <option value="ar">العربية (RTL)</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
                Text Direction
              </label>
              <select
                value={pageData.direction}
                onChange={(e) =>
                  onUpdatePageMeta({ direction: e.target.value as 'ltr' | 'rtl' })
                }
                className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
              >
                <option value="ltr">LTR (Left-Right)</option>
                <option value="rtl">RTL (Right-Left)</option>
              </select>
            </div>
          </div>

          {/* Brand Color Presets */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1.5">
              Primary Brand Palette
            </label>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {COLOR_PRESETS.map((p) => {
                const isActive = pageData.theme.primaryColor === p.primary;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() =>
                      onUpdateTheme({
                        ...pageData.theme,
                        primaryColor: p.primary,
                        secondaryColor: p.secondary,
                      })
                    }
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-start transition cursor-pointer min-w-0 ${
                      isActive
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: p.primary }}
                    />
                    <span className="text-[10px] font-bold text-gray-800 truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={pageData.theme.primaryColor}
                onChange={(e) =>
                  onUpdateTheme({ ...pageData.theme, primaryColor: e.target.value })
                }
                className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0"
              />
              <span className="font-mono text-gray-600 uppercase text-[11px]">
                {pageData.theme.primaryColor}
              </span>
            </div>
          </div>

          {/* Typography Font (Pro Feature Lock for Free Users) */}
          <div className="relative rounded-xl p-2 border border-gray-200 bg-gray-50/50">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-700">
                Custom Font Family
              </label>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-900 text-amber-400 text-[9px] font-black">
                <Crown className="w-2.5 h-2.5 text-amber-400" />
                <span>PRO</span>
              </span>
            </div>
            <select
              disabled={!isPro}
              value={pageData.theme.fontFamily}
              onChange={(e) =>
                onUpdateTheme({
                  ...pageData.theme,
                  fontFamily: e.target.value as 'Inter' | 'Cairo' | 'Plus Jakarta Sans',
                })
              }
              className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
            >
              <option value="Plus Jakarta Sans">Plus Jakarta Sans (Modern SaaS)</option>
              <option value="Inter">Inter (Clean & Crisp)</option>
              <option value="Cairo">Cairo (Arabic / RTL Best)</option>
            </select>
            {!isPro && (
              <ProFeatureLockOverlay
                compact
                onUpgradeClick={onUpgradeClick}
                reason="تخصيص الخطوط الاحترافية متاح في باقة Pro."
              />
            )}
          </div>

          {/* Remove Platform Watermark (Pro Feature Lock for Free Users) */}
          <div className="relative rounded-xl p-2.5 border border-gray-200 bg-gray-50/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold text-gray-800 flex items-center gap-1">
                  <span>إزالة العلامة المائية (Watermark)</span>
                </div>
                <div className="text-[10px] text-gray-500">
                  إخفاء شعار المنصة أسفل صفحة الهبوط
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPro}
                disabled={!isPro}
                readOnly
                className="w-4 h-4 accent-emerald-600 rounded"
              />
            </div>
            {!isPro && (
              <ProFeatureLockOverlay
                compact
                onUpgradeClick={onUpgradeClick}
                reason="إزالة العلامة المائية متاحة بدايةً من باقة Starter و Pro."
              />
            )}
          </div>

          {/* Border Radius */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              Component Corner Radius
            </label>
            <select
              value={pageData.theme.borderRadius}
              onChange={(e) =>
                onUpdateTheme({
                  ...pageData.theme,
                  borderRadius: e.target.value as PageTheme['borderRadius'],
                })
              }
              className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
            >
              <option value="rounded-md">Subtle (rounded-md)</option>
              <option value="rounded-xl">Standard (rounded-xl)</option>
              <option value="rounded-2xl">Modern Soft (rounded-2xl)</option>
              <option value="rounded-none">Sharp Modern (none)</option>
            </select>
          </div>

          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-[11px] leading-relaxed">
            💡 Tip: Click any block on the canvas to inspect and edit its texts, offer bundles, images, and discounts.
          </div>
        </div>
      </aside>
    );
  }

  const isSelectedBlockPro = PRO_BLOCK_TYPES.includes(selectedBlock.type);

  // Active Block Inspector
  return (
    <aside className="w-[280px] shrink-0 bg-white border-l border-gray-200 flex flex-col h-full min-h-0 select-none overflow-y-auto overflow-x-hidden">
      <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sliders className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 truncate">
                {selectedBlock.type.replace('-', ' ')}
              </h3>
              {isSelectedBlockPro && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-400 text-[9px] font-black">
                  <Crown className="w-2.5 h-2.5 text-amber-400" />
                  <span>PRO</span>
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-400 block truncate">{selectedBlock.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition cursor-pointer"
            title="Deselect block"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition cursor-pointer"
              title="إخفاء القائمة الجانبية"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3.5 text-xs relative">
        {/* If a Free user selects a Pro-only block, overlay translucent lock */}
        {isSelectedBlockPro && !isPro && (
          <ProFeatureLockOverlay
            onUpgradeClick={onUpgradeClick}
            reason={`تعديل إعدادات قسم "${selectedBlock.type}" ميزة احترافية تتطلب الترقية إلى باقة Pro.`}
          />
        )}

        {/* Render Form Inputs specific to each Block Type */}
        {selectedBlock.type === 'promo-bar' && (
          <PromoBarEditor block={selectedBlock} onUpdate={onUpdateBlock} />
        )}

        {selectedBlock.type === 'hero' && (
          <HeroEditor
            block={selectedBlock}
            onUpdate={onUpdateBlock}
            isPro={isPro}
            onUpgradeClick={onUpgradeClick}
          />
        )}

        {selectedBlock.type === 'problem-solution' && (
          <ProblemSolutionEditor block={selectedBlock} onUpdate={onUpdateBlock} />
        )}

        {selectedBlock.type === 'features' && (
          <FeaturesEditor block={selectedBlock} onUpdate={onUpdateBlock} />
        )}

        {selectedBlock.type === 'social-proof' && (
          <SocialProofEditor block={selectedBlock} onUpdate={onUpdateBlock} />
        )}

        {selectedBlock.type === 'cod-form' && (
          <CodFormEditor block={selectedBlock} onUpdate={onUpdateBlock} />
        )}

        {selectedBlock.type === 'faq' && (
          <FaqEditor block={selectedBlock} onUpdate={onUpdateBlock} />
        )}

        {selectedBlock.type === 'floating-cta' && (
          <FloatingCtaEditor block={selectedBlock} onUpdate={onUpdateBlock} />
        )}

        {selectedBlock.type === 'trust-badges' && (
          <TrustBadgesEditor block={selectedBlock} onUpdate={onUpdateBlock} />
        )}
      </div>
    </aside>
  );
};

/* --- Block Specific Sub-Editors --- */

const PromoBarEditor: React.FC<{
  block: PromoBarBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Banner Text</label>
        <textarea
          rows={2}
          value={block.text}
          onChange={(e) => onUpdate({ ...block, text: e.target.value })}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
            Timer (Min)
          </label>
          <input
            type="number"
            value={block.countdownMinutes}
            onChange={(e) =>
              onUpdate({ ...block, countdownMinutes: Number(e.target.value) || 15 })
            }
            className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-mono bg-white"
          />
        </div>

        <div className="min-w-0">
          <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
            Show Timer
          </label>
          <button
            type="button"
            onClick={() => onUpdate({ ...block, showTimer: !block.showTimer })}
            className={`w-full h-8 py-1 px-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
              block.showTimer
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            {block.showTimer ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">
          Scarcity Stock Alert
        </label>
        <input
          type="text"
          value={block.stockWarning}
          onChange={(e) => onUpdate({ ...block, stockWarning: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
          placeholder="e.g. Only 7 left in stock"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
            Background
          </label>
          <input
            type="color"
            value={block.bgColor}
            onChange={(e) => onUpdate({ ...block, bgColor: e.target.value })}
            className="w-full h-8 rounded-lg border border-gray-200 cursor-pointer p-0"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
            Text Color
          </label>
          <input
            type="color"
            value={block.textColor}
            onChange={(e) => onUpdate({ ...block, textColor: e.target.value })}
            className="w-full h-8 rounded-lg border border-gray-200 cursor-pointer p-0"
          />
        </div>
      </div>
    </div>
  );
};

const HeroEditor: React.FC<{
  block: HeroBlock;
  onUpdate: (b: LandingPageBlock) => void;
  isPro?: boolean;
  onUpgradeClick?: (reason?: string) => void;
}> = ({ block, onUpdate, isPro = false, onUpgradeClick }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Top Hook Badge</label>
        <input
          type="text"
          value={block.badge}
          onChange={(e) => onUpdate({ ...block, badge: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Headline</label>
        <textarea
          rows={2}
          value={block.headline}
          onChange={(e) => onUpdate({ ...block, headline: e.target.value })}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-bold bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Subheadline</label>
        <textarea
          rows={3}
          value={block.subheadline}
          onChange={(e) => onUpdate({ ...block, subheadline: e.target.value })}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
        />
      </div>

      {/* Compact 3-Column Row: Discount Price, Original Price, Currency */}
      <div className="grid grid-cols-3 gap-1.5 items-end">
        <div className="min-w-0">
          <label className="block text-[10px] font-bold text-gray-700 mb-1 truncate" title="Discount Price">
            Discount Price
          </label>
          <input
            type="number"
            value={block.priceDiscounted}
            onChange={(e) =>
              onUpdate({ ...block, priceDiscounted: Number(e.target.value) || 0 })
            }
            className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-mono font-bold text-emerald-600 bg-white"
          />
        </div>

        <div className="min-w-0">
          <label className="block text-[10px] font-bold text-gray-700 mb-1 truncate" title="Original Price">
            Original Price
          </label>
          <input
            type="number"
            value={block.priceOriginal}
            onChange={(e) =>
              onUpdate({ ...block, priceOriginal: Number(e.target.value) || 0 })
            }
            className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-mono text-gray-500 bg-white"
          />
        </div>

        <div className="min-w-0">
          <label className="block text-[10px] font-bold text-gray-700 mb-1 truncate" title="Currency">
            Currency
          </label>
          <input
            type="text"
            value={block.currency}
            onChange={(e) => onUpdate({ ...block, currency: e.target.value })}
            className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-mono bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">CTA Button Text</label>
        <input
          type="text"
          value={block.ctaText}
          onChange={(e) => onUpdate({ ...block, ctaText: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-bold bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">
          CTA Reassurance Subtext
        </label>
        <input
          type="text"
          value={block.ctaSubtext}
          onChange={(e) => onUpdate({ ...block, ctaSubtext: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
        />
      </div>

      {/* Image Gallery URLs (Multiple Images is Pro-only) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
            <span>Product Gallery Images</span>
          </label>
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-900 text-amber-400 text-[9px] font-black">
            <Crown className="w-2.5 h-2.5 text-amber-400" />
            <span>PRO</span>
          </span>
        </div>

        {/* First primary image is always editable */}
        {block.images.length > 0 && (
          <div className="flex gap-1 items-center">
            <input
              type="text"
              value={block.images[0]}
              onChange={(e) => {
                const updated = [...block.images];
                updated[0] = e.target.value;
                onUpdate({ ...block, images: updated });
              }}
              className="flex-1 h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs truncate bg-white outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* Additional gallery images + Add Multiple Images button locked for Free users */}
        <div className="relative rounded-xl p-2 border border-gray-200 bg-gray-50/50 space-y-1.5">
          {block.images.slice(1).map((img, idx) => {
            const realIdx = idx + 1;
            return (
              <div key={realIdx} className="flex gap-1 items-center">
                <input
                  type="text"
                  disabled={!isPro}
                  value={img}
                  onChange={(e) => {
                    const updated = [...block.images];
                    updated[realIdx] = e.target.value;
                    onUpdate({ ...block, images: updated });
                  }}
                  className="flex-1 h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs truncate bg-white outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={!isPro}
                  onClick={() => {
                    const updated = block.images.filter((_, i) => i !== realIdx);
                    onUpdate({ ...block, images: updated });
                  }}
                  className="p-1 text-red-400 hover:text-red-600 rounded cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            disabled={!isPro}
            onClick={() =>
              onUpdate({
                ...block,
                images: [
                  ...block.images,
                  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1000&q=80',
                ],
              })
            }
            className="w-full h-8 py-1 px-2 border border-dashed border-gray-300 hover:border-gray-400 rounded-lg text-gray-500 hover:text-gray-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Multiple Images (Gallery)
          </button>

          {!isPro && (
            <ProFeatureLockOverlay
              compact
              onUpgradeClick={onUpgradeClick}
              reason="إضافة معرض صور متعددة للمنتج في قسم Hero ميزة احترافية في باقة Pro."
            />
          )}
        </div>
      </div>
    </div>
  );
};

const ProblemSolutionEditor: React.FC<{
  block: ProblemSolutionBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Section Title</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Highlight Badge</label>
        <input
          type="text"
          value={block.highlightBadge}
          onChange={(e) => onUpdate({ ...block, highlightBadge: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-red-700 mb-1">Problem Card Title</label>
        <input
          type="text"
          value={block.problemTitle}
          onChange={(e) => onUpdate({ ...block, problemTitle: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-red-200 text-xs outline-none focus:border-red-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-emerald-700 mb-1">
          Solution Card Title
        </label>
        <input
          type="text"
          value={block.solutionTitle}
          onChange={(e) => onUpdate({ ...block, solutionTitle: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-emerald-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>
    </div>
  );
};

const FeaturesEditor: React.FC<{
  block: FeaturesBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Subtitle</label>
        <input
          type="text"
          value={block.subtitle}
          onChange={(e) => onUpdate({ ...block, subtitle: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-gray-700">
          Feature Items ({block.items.length})
        </label>
        {block.items.map((item, idx) => (
          <div key={idx} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-gray-700">Feature #{idx + 1}</span>
              <button
                type="button"
                onClick={() => {
                  const items = block.items.filter((_, i) => i !== idx);
                  onUpdate({ ...block, items });
                }}
                className="text-red-400 hover:text-red-600 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={item.title}
              onChange={(e) => {
                const items = [...block.items];
                items[idx] = { ...items[idx], title: e.target.value };
                onUpdate({ ...block, items });
              }}
              placeholder="Feature Title"
              className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500"
            />
            <textarea
              rows={2}
              value={item.description}
              onChange={(e) => {
                const items = [...block.items];
                items[idx] = { ...items[idx], description: e.target.value };
                onUpdate({ ...block, items });
              }}
              placeholder="Description"
              className="w-full px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const SocialProofEditor: React.FC<{
  block: SocialProofBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Headline</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
            Rating (out of 5)
          </label>
          <input
            type="number"
            step="0.1"
            value={block.overallRating}
            onChange={(e) =>
              onUpdate({ ...block, overallRating: Number(e.target.value) || 5 })
            }
            className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-mono outline-none focus:border-emerald-500 bg-white"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
            Total Orders
          </label>
          <input
            type="number"
            value={block.totalReviews}
            onChange={(e) =>
              onUpdate({ ...block, totalReviews: Number(e.target.value) || 2000 })
            }
            className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-mono outline-none focus:border-emerald-500 bg-white"
          />
        </div>
      </div>
    </div>
  );
};

const CodFormEditor: React.FC<{
  block: CodFormBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Form Header Title</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Submit Button Text</label>
        <input
          type="text"
          value={block.buttonText}
          onChange={(e) => onUpdate({ ...block, buttonText: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">
          COD Guarantee Notice
        </label>
        <textarea
          rows={2}
          value={block.guaranteeText}
          onChange={(e) => onUpdate({ ...block, guaranteeText: e.target.value })}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      {/* Bundles Configuration */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-gray-700">
            Quantity / Bundles ({block.bundles.length})
          </label>
          <button
            type="button"
            onClick={() =>
              onUpdate({
                ...block,
                bundles: [
                  ...block.bundles,
                  {
                    id: `bundle-${Date.now()}`,
                    name: 'Extra Bundle Option',
                    quantity: block.bundles.length + 1,
                    price: 69.99,
                    originalPrice: 139.99,
                    badge: 'Special Deal',
                    popular: false,
                  },
                ],
              })
            }
            className="text-emerald-600 hover:text-emerald-700 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add Tier
          </button>
        </div>

        {block.bundles.map((bundle, idx) => (
          <div key={bundle.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-gray-800">Tier #{idx + 1}</span>
              <button
                type="button"
                onClick={() => {
                  const bundles = block.bundles.filter((_, i) => i !== idx);
                  onUpdate({ ...block, bundles });
                }}
                className="text-red-400 hover:text-red-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <input
              type="text"
              value={bundle.name}
              onChange={(e) => {
                const bundles = [...block.bundles];
                bundles[idx] = { ...bundles[idx], name: e.target.value };
                onUpdate({ ...block, bundles });
              }}
              className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500"
              placeholder="Bundle Name"
            />

            <div className="grid grid-cols-2 gap-1.5">
              <div className="min-w-0">
                <label className="block text-[10px] text-gray-500 font-bold truncate mb-0.5">
                  Price ({block.currency})
                </label>
                <input
                  type="number"
                  value={bundle.price}
                  onChange={(e) => {
                    const bundles = [...block.bundles];
                    bundles[idx] = { ...bundles[idx], price: Number(e.target.value) || 0 };
                    onUpdate({ ...block, bundles });
                  }}
                  className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-[10px] text-gray-500 font-bold truncate mb-0.5">
                  Original Price
                </label>
                <input
                  type="number"
                  value={bundle.originalPrice}
                  onChange={(e) => {
                    const bundles = [...block.bundles];
                    bundles[idx] = {
                      ...bundles[idx],
                      originalPrice: Number(e.target.value) || 0,
                    };
                    onUpdate({ ...block, bundles });
                  }}
                  className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs font-mono text-gray-400 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5 gap-1.5">
              <input
                type="text"
                value={bundle.badge || ''}
                onChange={(e) => {
                  const bundles = [...block.bundles];
                  bundles[idx] = { ...bundles[idx], badge: e.target.value };
                  onUpdate({ ...block, bundles });
                }}
                placeholder="Badge (e.g. 50% Off)"
                className="flex-1 h-8 px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 min-w-0"
              />

              <button
                type="button"
                onClick={() => {
                  const bundles = block.bundles.map((b, i) => ({
                    ...b,
                    popular: i === idx,
                  }));
                  onUpdate({ ...block, bundles });
                }}
                className={`h-8 px-2 py-1 rounded-lg text-[10px] font-bold shrink-0 cursor-pointer ${
                  bundle.popular
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {bundle.popular ? '★ Popular' : 'Set Popular'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FaqEditor: React.FC<{
  block: FaqBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Section Title</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-gray-700">
          FAQ Questions ({block.items.length})
        </label>
        {block.items.map((item, idx) => (
          <div key={item.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-gray-700">Q#{idx + 1}</span>
              <button
                type="button"
                onClick={() => {
                  const items = block.items.filter((_, i) => i !== idx);
                  onUpdate({ ...block, items });
                }}
                className="text-red-400 hover:text-red-600 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={item.question}
              onChange={(e) => {
                const items = [...block.items];
                items[idx] = { ...items[idx], question: e.target.value };
                onUpdate({ ...block, items });
              }}
              className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500"
            />
            <textarea
              rows={2}
              value={item.answer}
              onChange={(e) => {
                const items = [...block.items];
                items[idx] = { ...items[idx], answer: e.target.value };
                onUpdate({ ...block, items });
              }}
              className="w-full px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const FloatingCtaEditor: React.FC<{
  block: FloatingCtaBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Product Title</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Price Tag Text</label>
        <input
          type="text"
          value={block.priceText}
          onChange={(e) => onUpdate({ ...block, priceText: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold text-emerald-600 outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Button Label</label>
        <input
          type="text"
          value={block.buttonText}
          onChange={(e) => onUpdate({ ...block, buttonText: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>
    </div>
  );
};

const TrustBadgesEditor: React.FC<{
  block: TrustBadgesBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">Section Title</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-gray-700">
          Badges ({block.badges.length})
        </label>
        {block.badges.map((badge, idx) => (
          <div key={idx} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
            <input
              type="text"
              value={badge.title}
              onChange={(e) => {
                const badges = [...block.badges];
                badges[idx] = { ...badges[idx], title: e.target.value };
                onUpdate({ ...block, badges });
              }}
              placeholder="Badge Title"
              className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={badge.description}
              onChange={(e) => {
                const badges = [...block.badges];
                badges[idx] = { ...badges[idx], description: e.target.value };
                onUpdate({ ...block, badges });
              }}
              placeholder="Badge Description"
              className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
