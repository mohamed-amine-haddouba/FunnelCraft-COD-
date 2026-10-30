import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
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
  AlignRight,
  AlignCenter,
  AlignLeft,
  Type,
  Maximize2,
  CornerUpRight,
  RotateCcw,
} from 'lucide-react';
import { PRO_BLOCK_TYPES } from './BlocksToolbar';
import { useAuth } from '../context/AuthContext';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';

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
  { name: 'Emerald', label: 'زمردي', primary: '#059669', secondary: '#a7f3d0' },
  { name: 'Blue', label: 'أزرق', primary: '#2563eb', secondary: '#bfdbfe' },
  { name: 'Rose', label: 'وردي', primary: '#e11d48', secondary: '#fda4af' },
  { name: 'Amber', label: 'ذهبي', primary: '#d97706', secondary: '#fde68a' },
  { name: 'Indigo', label: 'نيلي', primary: '#4f46e5', secondary: '#c7d2fe' },
  { name: 'Slate', label: 'داكن', primary: '#0f172a', secondary: '#cbd5e1' },
];

const FONT_FAMILY_OPTIONS: { value: PageTheme['fontFamily']; label: string }[] = [
  { value: 'Cairo', label: 'Cairo — خط كايرو (عربي عصري)' },
  { value: 'Tajawal', label: 'Tajawal — خط تجول (ناعم وأنيق)' },
  { value: 'Inter', label: 'Inter — خط إنتر (عالمي واضح)' },
  { value: 'Poppins', label: 'Poppins — خط بوبينز (متاجر حديثة)' },
  { value: 'System', label: 'System — خط النظام الافتراضي' },
];

const FONT_SIZE_OPTIONS: { value: PageTheme['fontSize']; label: string }[] = [
  { value: 'sm', label: 'صغير (S)' },
  { value: 'base', label: 'متوسط (M)' },
  { value: 'lg', label: 'كبير (L)' },
  { value: 'xl', label: 'ضخم (XL)' },
];

const BORDER_RADIUS_OPTIONS: { value: PageTheme['borderRadius']; label: string }[] = [
  { value: 'none', label: 'حاد' },
  { value: 'sm', label: 'خفيف' },
  { value: 'md', label: 'متوسط' },
  { value: 'lg', label: 'كبير' },
  { value: 'full', label: 'دائري' },
];

const SECTION_SPACING_OPTIONS: { value: PageTheme['sectionSpacing']; label: string }[] = [
  { value: 'compact', label: 'مدمج (Compact)' },
  { value: 'normal', label: 'متوازن (Normal)' },
  { value: 'spacious', label: 'واسع (Spacious)' },
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
        🔒 Upgrade Required — ترقية الباقة
      </button>
    </div>
  );
};

/* --- Block Style Section (Top of every selected block) --- */
const BlockStyleSection: React.FC<{
  block: LandingPageBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  const currentAlign = block.textAlign || 'right';
  const currentPadding = typeof block.blockPadding === 'number' ? block.blockPadding : 6;
  const currentBg = block.blockBgColor || '#ffffff';

  return (
    <div
      dir="rtl"
      className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3 shadow-2xs"
    >
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[11px] font-black text-slate-800">
            تنسيق القسم (Block Style)
          </span>
        </div>
        {(block.blockBgColor || block.textAlign || block.blockPadding !== undefined) && (
          <button
            type="button"
            onClick={() =>
              onUpdate({
                ...block,
                blockBgColor: undefined,
                textAlign: undefined,
                blockPadding: undefined,
              })
            }
            className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition cursor-pointer"
            title="إعادة الضبط للوضع الافتراضي"
          >
            <RotateCcw className="w-3 h-3" />
            <span>افتراضي</span>
          </button>
        )}
      </div>

      {/* Background Color */}
      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          لون خلفية القسم (Background Color)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={currentBg}
            onChange={(e) => onUpdate({ ...block, blockBgColor: e.target.value })}
            className="w-9 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
          />
          <input
            type="text"
            dir="ltr"
            value={block.blockBgColor || 'افتراضي (شفاف)'}
            onChange={(e) => {
              const val = e.target.value.trim();
              if (val.startsWith('#') || val === '') {
                onUpdate({ ...block, blockBgColor: val || undefined });
              }
            }}
            className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-mono text-slate-700 outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Text Alignment Pills */}
      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          محاذاة النص (Text Alignment)
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { value: 'right' as const, label: 'يمين', icon: AlignRight },
            { value: 'center' as const, label: 'وسط', icon: AlignCenter },
            { value: 'left' as const, label: 'يسار', icon: AlignLeft },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = currentAlign === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ ...block, textAlign: opt.value })}
                className={`h-8 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Padding Slider (0 to 12) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-bold text-slate-700">
            الهوامش الداخلية (Padding)
          </label>
          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
            {currentPadding} ({currentPadding * 4}px)
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={12}
          step={1}
          value={currentPadding}
          onChange={(e) => onUpdate({ ...block, blockPadding: Number(e.target.value) })}
          className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
        <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-0.5" dir="ltr">
          <span>0</span>
          <span>3</span>
          <span>6</span>
          <span>9</span>
          <span>12</span>
        </div>
      </div>
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
  const {
    canUsePixels,
    canRemoveWatermark,
    savePagePixels,
    userPages,
  } = useAuth();

  const [openColorPicker, setOpenColorPicker] = useState<'primary' | 'background' | 'text' | null>(
    null
  );
  const [savingPixels, setSavingPixels] = useState(false);
  const [pixelsSavedMsg, setPixelsSavedMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const selectedBlock = pageData.blocks.find((b) => b.id === selectedBlockId);
  const isSavedCloudPage = userPages.some((p) => p.id === pageData.id);
  const effectiveWatermarkUnlocked = canRemoveWatermark || isPro;
  const effectivePixelsUnlocked = canUsePixels || isPro;

  const handleSavePixelsToCloud = async () => {
    if (!effectivePixelsUnlocked) {
      onUpgradeClick?.('ربط بيكسل فيسبوك وتيك توك متاح في باقة Pro و Enterprise فقط.');
      return;
    }
    if (!isSavedCloudPage) {
      setPixelsSavedMsg({
        text: 'تم حفظ البيكسل في المسودة الحالية. احفظ الصفحة أو انشرها لتفعيل التتبع.',
        type: 'success',
      });
      return;
    }
    setSavingPixels(true);
    setPixelsSavedMsg(null);
    try {
      const res = await savePagePixels(pageData.id, {
        facebookPixelId: pageData.pixels?.facebookPixelId || '',
        tiktokPixelId: pageData.pixels?.tiktokPixelId || '',
        googleAnalyticsId: pageData.pixels?.googleAnalyticsId || '',
      });
      if (res.isLimitReached) {
        onUpgradeClick?.(res.error || 'Upgrade to Pro to configure tracking pixels.');
      } else if (res.success) {
        setPixelsSavedMsg({ text: 'تم حفظ إعدادات البيكسل بنجاح!', type: 'success' });
      } else {
        setPixelsSavedMsg({ text: res.error || 'تعذر حفظ البيكسل.', type: 'error' });
      }
    } finally {
      setSavingPixels(false);
    }
  };

  const currentFontFamily: PageTheme['fontFamily'] =
    pageData.theme.fontFamily &&
    ['Cairo', 'Tajawal', 'Inter', 'Poppins', 'System'].includes(pageData.theme.fontFamily)
      ? pageData.theme.fontFamily
      : 'Cairo';

  const currentFontSize: PageTheme['fontSize'] = pageData.theme.fontSize || 'base';
  const currentBorderRadius: PageTheme['borderRadius'] =
    pageData.theme.borderRadius &&
    ['none', 'sm', 'md', 'lg', 'full'].includes(pageData.theme.borderRadius)
      ? pageData.theme.borderRadius
      : 'lg';
  const currentSectionSpacing: PageTheme['sectionSpacing'] =
    pageData.theme.sectionSpacing || 'normal';
  const currentTextColor = pageData.theme.textColor || '#0f172a';
  const currentBgColor = pageData.theme.backgroundColor || '#ffffff';

  // If no block selected, display Global Page & Styling inspector
  if (!selectedBlock) {
    return (
      <aside
        dir="rtl"
        className="w-[300px] shrink-0 bg-white border-l border-gray-200 flex flex-col h-full min-h-0 select-none overflow-y-auto overflow-x-hidden"
      >
        <div className="px-3.5 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50/90 sticky top-0 z-20 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Palette className="w-4 h-4 text-emerald-600 shrink-0" />
            <h3 className="text-xs font-black text-gray-900 truncate">
              إعدادات التصميم والهوية البصرية
            </h3>
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition cursor-pointer shrink-0"
              title="إخفاء القائمة الجانبية"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-3.5 space-y-4 text-xs">
          {/* Landing Page Title */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              عنوان صفحة الهبوط (Page Title)
            </label>
            <input
              type="text"
              value={pageData.title}
              onChange={(e) => onUpdatePageMeta({ title: e.target.value })}
              className="w-full h-8 px-2.5 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white font-semibold"
            />
          </div>

          {/* Language & Direction */}
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
                لغة الصفحة
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
                <option value="ar">العربية (RTL)</option>
                <option value="fr">Français (LTR)</option>
                <option value="en">English (LTR)</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
                اتجاه النص
              </label>
              <select
                value={pageData.direction}
                onChange={(e) =>
                  onUpdatePageMeta({ direction: e.target.value as 'ltr' | 'rtl' })
                }
                className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
              >
                <option value="rtl">من اليمين لليسار (RTL)</option>
                <option value="ltr">من اليسار لليمين (LTR)</option>
              </select>
            </div>
          </div>

          {/* 1 & 2: Color Presets + HexColorPicker Popovers */}
          <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-gray-800 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-emerald-600" />
                <span>قوالب الألوان الجاهزة (6 Palettes)</span>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {COLOR_PRESETS.map((p) => {
                const isActive =
                  pageData.theme.primaryColor.toLowerCase() === p.primary.toLowerCase();
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
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-right transition cursor-pointer min-w-0 ${
                      isActive
                        ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center -space-x-1 space-x-reverse shrink-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs"
                        style={{ backgroundColor: p.primary }}
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white"
                        style={{ backgroundColor: p.secondary }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-800 truncate">
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Primary & Background Color Pickers with HexColorPicker Popovers */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Primary Color */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-gray-600 mb-1">
                  اللون الأساسي (Primary)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setOpenColorPicker(openColorPicker === 'primary' ? null : 'primary')
                  }
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 bg-white flex items-center justify-between gap-1.5 hover:border-emerald-500 transition cursor-pointer"
                >
                  <span
                    className="w-4 h-4 rounded-md border border-gray-200 shrink-0"
                    style={{ backgroundColor: pageData.theme.primaryColor }}
                  />
                  <span className="font-mono text-[11px] text-gray-700 uppercase" dir="ltr">
                    {pageData.theme.primaryColor}
                  </span>
                </button>

                {openColorPicker === 'primary' && (
                  <div className="absolute right-0 top-16 z-30 p-2.5 bg-white rounded-xl shadow-xl border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                      <span className="text-[10px] font-bold text-gray-700">
                        اختر اللون الأساسي
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenColorPicker(null)}
                        className="text-gray-400 hover:text-gray-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <HexColorPicker
                      color={pageData.theme.primaryColor}
                      onChange={(color) =>
                        onUpdateTheme({ ...pageData.theme, primaryColor: color })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Background Color */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-gray-600 mb-1">
                  لون الخلفية (Background)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setOpenColorPicker(openColorPicker === 'background' ? null : 'background')
                  }
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 bg-white flex items-center justify-between gap-1.5 hover:border-emerald-500 transition cursor-pointer"
                >
                  <span
                    className="w-4 h-4 rounded-md border border-gray-300 shrink-0"
                    style={{ backgroundColor: currentBgColor }}
                  />
                  <span className="font-mono text-[11px] text-gray-700 uppercase" dir="ltr">
                    {currentBgColor}
                  </span>
                </button>

                {openColorPicker === 'background' && (
                  <div className="absolute left-0 top-16 z-30 p-2.5 bg-white rounded-xl shadow-xl border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                      <span className="text-[10px] font-bold text-gray-700">
                        اختر لون الخلفية
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenColorPicker(null)}
                        className="text-gray-400 hover:text-gray-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <HexColorPicker
                      color={currentBgColor}
                      onChange={(color) =>
                        onUpdateTheme({ ...pageData.theme, backgroundColor: color })
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Text Color */}
            <div className="relative pt-1">
              <label className="block text-[10px] font-bold text-gray-600 mb-1">
                لون النصوص العام (Text Color)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setOpenColorPicker(openColorPicker === 'text' ? null : 'text')
                  }
                  className="flex-1 h-8 px-2.5 rounded-lg border border-gray-200 bg-white flex items-center justify-between gap-2 hover:border-emerald-500 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-md border border-gray-300 shrink-0"
                      style={{ backgroundColor: currentTextColor }}
                    />
                    <span className="text-[11px] font-bold text-gray-700">لون الخط</span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-600 uppercase" dir="ltr">
                    {currentTextColor}
                  </span>
                </button>
              </div>

              {openColorPicker === 'text' && (
                <div className="absolute right-0 top-16 z-30 p-2.5 bg-white rounded-xl shadow-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-700">اختر لون النص</span>
                    <button
                      type="button"
                      onClick={() => setOpenColorPicker(null)}
                      className="text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <HexColorPicker
                    color={currentTextColor}
                    onChange={(color) =>
                      onUpdateTheme({ ...pageData.theme, textColor: color })
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* 3. Font Family Dropdown */}
          <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2.5">
            <label className="text-[11px] font-black text-gray-800 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-emerald-600" />
              <span>نوع الخط (Font Family)</span>
            </label>
            <select
              value={currentFontFamily}
              onChange={(e) =>
                onUpdateTheme({
                  ...pageData.theme,
                  fontFamily: e.target.value as PageTheme['fontFamily'],
                })
              }
              className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white font-bold text-gray-800 cursor-pointer"
            >
              {FONT_FAMILY_OPTIONS.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>

            {/* 4. Font Size Selector (Pills) */}
            <div className="pt-1">
              <label className="block text-[10px] font-bold text-gray-600 mb-1.5">
                حجم الخط العام (Font Size)
              </label>
              <div className="grid grid-cols-4 gap-1">
                {FONT_SIZE_OPTIONS.map((size) => {
                  const active = currentFontSize === size.value;
                  return (
                    <button
                      key={size.value}
                      type="button"
                      onClick={() =>
                        onUpdateTheme({
                          ...pageData.theme,
                          fontSize: size.value,
                        })
                      }
                      className={`h-7.5 px-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {size.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. Border Radius Selector (Pills) */}
          <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2">
            <label className="text-[11px] font-black text-gray-800 flex items-center gap-1.5">
              <CornerUpRight className="w-3.5 h-3.5 text-emerald-600" />
              <span>استدارة الحواف والأزرار (Border Radius)</span>
            </label>
            <div className="grid grid-cols-5 gap-1">
              {BORDER_RADIUS_OPTIONS.map((rad) => {
                const active = currentBorderRadius === rad.value;
                return (
                  <button
                    key={rad.value}
                    type="button"
                    onClick={() =>
                      onUpdateTheme({
                        ...pageData.theme,
                        borderRadius: rad.value,
                      })
                    }
                    className={`h-7.5 px-1 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {rad.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Section Spacing Selector (Pills) */}
          <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2">
            <label className="text-[11px] font-black text-gray-800 flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>تباعد الأقسام (Section Spacing)</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {SECTION_SPACING_OPTIONS.map((sp) => {
                const active = currentSectionSpacing === sp.value;
                return (
                  <button
                    key={sp.value}
                    type="button"
                    onClick={() =>
                      onUpdateTheme({
                        ...pageData.theme,
                        sectionSpacing: sp.value,
                      })
                    }
                    className={`h-8 px-1.5 rounded-lg border text-[10px] font-bold transition cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {sp.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tracking Pixels (Facebook & TikTok Pixel) - Pro / Enterprise Only */}
          <div className="relative rounded-xl p-3 border border-gray-200 bg-gray-50/70 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-black text-gray-800 flex items-center gap-1.5">
                  <span>بيكسل التتبع (Facebook & TikTok Pixels)</span>
                  {!effectivePixelsUnlocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      <Lock className="w-2.5 h-2.5" /> PRO
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500">
                  تتبع زيارات الصفحة وأحداث الشراء (Purchase / PageView) تلقائياً
                </div>
              </div>
            </div>

            <div className="space-y-2" dir="ltr">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                  Facebook Pixel ID
                </label>
                <input
                  type="text"
                  disabled={!effectivePixelsUnlocked}
                  placeholder="e.g. 123456789012345"
                  value={pageData.pixels?.facebookPixelId || ''}
                  onChange={(e) =>
                    onUpdatePageMeta({
                      pixels: {
                        ...pageData.pixels,
                        facebookPixelId: e.target.value,
                      },
                    })
                  }
                  className="w-full h-8 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-mono outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">
                  TikTok Pixel ID
                </label>
                <input
                  type="text"
                  disabled={!effectivePixelsUnlocked}
                  placeholder="e.g. C1234ABCDEFG5678"
                  value={pageData.pixels?.tiktokPixelId || ''}
                  onChange={(e) =>
                    onUpdatePageMeta({
                      pixels: {
                        ...pageData.pixels,
                        tiktokPixelId: e.target.value,
                      },
                    })
                  }
                  className="w-full h-8 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-mono outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                />
              </div>
            </div>

            {effectivePixelsUnlocked && (
              <div className="pt-1 space-y-1.5">
                <button
                  type="button"
                  onClick={handleSavePixelsToCloud}
                  disabled={savingPixels}
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
                >
                  {savingPixels ? 'جاري حفظ البيكسل...' : 'حفظ وتفعيل البيكسل'}
                </button>
                {pixelsSavedMsg && (
                  <div
                    className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md ${
                      pixelsSavedMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {pixelsSavedMsg.type === 'success' ? (
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 shrink-0" />
                    )}
                    <span>{pixelsSavedMsg.text}</span>
                  </div>
                )}
              </div>
            )}

            {!effectivePixelsUnlocked && (
              <ProFeatureLockOverlay
                onUpgradeClick={onUpgradeClick}
                reason="ربط بيكسل فيسبوك وتيك توك متاح في باقة Pro و Enterprise فقط."
              />
            )}
          </div>

          {/* Remove Platform Watermark (Pro/Starter Feature Lock for Free Users) */}
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
                checked={effectiveWatermarkUnlocked}
                disabled={!effectiveWatermarkUnlocked}
                readOnly
                className="w-4 h-4 accent-emerald-600 rounded"
              />
            </div>
            {!effectiveWatermarkUnlocked && (
              <ProFeatureLockOverlay
                compact
                onUpgradeClick={onUpgradeClick}
                reason="إزالة العلامة المائية متاحة بدايةً من باقة Starter و Pro."
              />
            )}
          </div>

          <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-emerald-900 text-[11px] leading-relaxed">
            💡 نصيحة: اضغط على أي قسم داخل الصفحة لتخصيص ألوانه، محاذاة نصوصه، الهوامش، والصور والعروض الخاصة به.
          </div>
        </div>
      </aside>
    );
  }

  const isSelectedBlockPro = PRO_BLOCK_TYPES.includes(selectedBlock.type);

  // Active Block Inspector
  return (
    <aside
      dir="rtl"
      className="w-[300px] shrink-0 bg-white border-l border-gray-200 flex flex-col h-full min-h-0 select-none overflow-y-auto overflow-x-hidden"
    >
      <div className="px-3.5 py-2.5 border-b border-gray-200 flex items-center justify-between bg-gray-50/90 sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sliders className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 truncate">
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
            title="إلغاء تحديد القسم"
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

      <div className="p-3.5 space-y-4 text-xs relative">
        {/* If a Free user selects a Pro-only block, overlay translucent lock */}
        {isSelectedBlockPro && !isPro && (
          <ProFeatureLockOverlay
            onUpgradeClick={onUpgradeClick}
            reason={`تعديل إعدادات قسم "${selectedBlock.type}" ميزة احترافية تتطلب الترقية إلى باقة Pro.`}
          />
        )}

        {/* Step 4: Block Style Section at the top for each block type */}
        <BlockStyleSection block={selectedBlock} onUpdate={onUpdateBlock} />

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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">
          نص الشريط الإعلاني
        </label>
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
            المؤقت (دقائق)
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
            إظهار العداد
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
            {block.showTimer ? 'مفعّل' : 'مخفي'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">
          تنبيه ندرة المخزون
        </label>
        <input
          type="text"
          value={block.stockWarning}
          onChange={(e) => onUpdate({ ...block, stockWarning: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
          placeholder="مثال: متبقي 7 قطع فقط"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <label className="block text-[11px] font-bold text-gray-700 mb-1 truncate">
            لون الشريط
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
            لون النص
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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">شارة العرض العلوية</label>
        <input
          type="text"
          value={block.badge}
          onChange={(e) => onUpdate({ ...block, badge: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">العنوان الرئيسي</label>
        <textarea
          rows={2}
          value={block.headline}
          onChange={(e) => onUpdate({ ...block, headline: e.target.value })}
          className="w-full px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-bold bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">الوصف الفرعي</label>
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
          <label className="block text-[10px] font-bold text-gray-700 mb-1 truncate">
            سعر التخفيض
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
          <label className="block text-[10px] font-bold text-gray-700 mb-1 truncate">
            السعر الأصلي
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
          <label className="block text-[10px] font-bold text-gray-700 mb-1 truncate">
            العملة
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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">نص زر الشراء (CTA)</label>
        <input
          type="text"
          value={block.ctaText}
          onChange={(e) => onUpdate({ ...block, ctaText: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-xs font-bold bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">
          نص الطمأنة أسفل الزر
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
            <span>صور المنتج (Gallery)</span>
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
              dir="ltr"
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
                  dir="ltr"
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
            <Plus className="w-3 h-3" /> إضافة صور إضافية للمعرض
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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">عنوان القسم</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">شارة التميز</label>
        <input
          type="text"
          value={block.highlightBadge}
          onChange={(e) => onUpdate({ ...block, highlightBadge: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-red-700 mb-1">عنوان بطاقة المشكلة</label>
        <input
          type="text"
          value={block.problemTitle}
          onChange={(e) => onUpdate({ ...block, problemTitle: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-red-200 text-xs outline-none focus:border-red-400 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-emerald-700 mb-1">
          عنوان بطاقة الحل
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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">العنوان</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">العنوان الفرعي</label>
        <input
          type="text"
          value={block.subtitle}
          onChange={(e) => onUpdate({ ...block, subtitle: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-gray-700">
          قائمة المميزات ({block.items.length})
        </label>
        {block.items.map((item, idx) => (
          <div key={idx} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-gray-700">ميزة #{idx + 1}</span>
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
              placeholder="عنوان الميزة"
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
              placeholder="وصف الميزة"
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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">عنوان التقييمات</label>
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
            التقييم (من 5)
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
            إجمالي المراجعات
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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">عنوان استمارة الطلب</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">نص زر تأكيد الطلب</label>
        <input
          type="text"
          value={block.buttonText}
          onChange={(e) => onUpdate({ ...block, buttonText: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">
          رسالة ضمان الدفع عند الاستلام
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
            عروض الكميات (Bundles) ({block.bundles.length})
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
                    name: 'عرض إضافي مميز',
                    quantity: block.bundles.length + 1,
                    price: 299,
                    originalPrice: 499,
                    badge: 'توفير إضافي',
                    popular: false,
                  },
                ],
              })
            }
            className="text-emerald-600 hover:text-emerald-700 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> إضافة عرض
          </button>
        </div>

        {block.bundles.map((bundle, idx) => (
          <div key={bundle.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-gray-800">عرض #{idx + 1}</span>
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
              placeholder="اسم العرض"
            />

            <div className="grid grid-cols-2 gap-1.5">
              <div className="min-w-0">
                <label className="block text-[10px] text-gray-500 font-bold truncate mb-0.5">
                  السعر ({block.currency})
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
                  السعر قبل الخصم
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
                placeholder="شارة (مثال: خصم 50%)"
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
                {bundle.popular ? '★ الأكثر طلباً' : 'تعيين كأفضل عرض'}
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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">عنوان الأسئلة الشائعة</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-gray-700">
          الأسئلة ({block.items.length})
        </label>
        {block.items.map((item, idx) => (
          <div key={item.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-gray-700">سؤال #{idx + 1}</span>
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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">اسم المنتج المختصر</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">نص السعر</label>
        <input
          type="text"
          value={block.priceText}
          onChange={(e) => onUpdate({ ...block, priceText: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold text-emerald-600 outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-gray-700 mb-1">نص الزر العائم</label>
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
        <label className="block text-[11px] font-bold text-gray-700 mb-1">عنوان شارات الثقة</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-gray-200 text-xs font-bold outline-none focus:border-emerald-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-gray-700">
          الشارات ({block.badges.length})
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
              placeholder="عنوان الشارة"
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
              placeholder="وصف الشارة"
              className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
