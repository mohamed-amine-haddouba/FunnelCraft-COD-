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
  ChevronDown,
  ChevronUp,
  Globe,
  FileText,
} from 'lucide-react';
import { PRO_BLOCK_TYPES } from './BlocksToolbar';
import { useAuth } from '../context/AuthContext';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { getCountriesSorted } from '../utils/countriesCities';

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

/* --- Modern Framer/Webflow Control Primitives --- */

export const CollapsibleAccordion: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200/90 rounded-xl bg-white overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-slate-50/90 hover:bg-slate-100/80 flex items-center justify-between gap-2 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-blue-600 shrink-0">{icon}</span>}
          <div className="text-right min-w-0">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 block truncate">
              {title}
            </span>
            {subtitle && (
              <span className="text-[10px] text-slate-400 font-medium block truncate">
                {subtitle}
              </span>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
      </button>
      {isOpen && <div className="p-3 space-y-3 border-t border-slate-100">{children}</div>}
    </div>
  );
};

export const ColorWithHexInput: React.FC<{
  label: string;
  value: string | undefined;
  defaultColor?: string;
  onChange: (hex: string | undefined) => void;
}> = ({ label, value, defaultColor = '#ffffff', onChange }) => {
  const activeColor = value && /^#[0-9A-Fa-f]{3,8}$/.test(value) ? value : defaultColor;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => {
            if (onDeleteBlock && selectedBlockIndex !== undefined && selectedBlockIndex !== -1) {
              onDeleteBlock(selectedBlockIndex);
            }
          }}
          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors ml-2"
          title="حذف القسم (Delete Block)"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <label className="text-[11px] font-bold text-slate-700">{label}</label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[10px] text-slate-400 hover:text-blue-600 font-semibold cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={activeColor}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
        />
        <input
          type="text"
          dir="ltr"
          value={value || activeColor}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v || undefined);
          }}
          placeholder="#ffffff"
          className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50/70 focus:bg-white text-[11px] font-mono text-slate-800 outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
};

export const SliderWithNumericInput: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step = 1, unit = 'px', onChange }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-bold text-slate-700">{label}</label>
        <div className="flex items-center gap-1" dir="ltr">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const num = Number(e.target.value);
              if (!Number.isNaN(num)) {
                onChange(Math.max(min, Math.min(max, num)));
              }
            }}
            className="w-14 h-6 px-1.5 rounded-md border border-slate-200 bg-white text-[11px] font-mono font-bold text-center text-slate-800 outline-none focus:border-blue-500"
          />
          <span className="text-[10px] font-mono text-slate-400">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
      />
    </div>
  );
};

export const ModernToggleSwitch: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, description, checked, disabled = false, onChange }) => {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-800">{label}</div>
        {description && <div className="text-[10px] text-slate-400 leading-tight">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none cursor-pointer disabled:opacity-50 ${
          checked ? 'bg-blue-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? '-translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

/* --- Block Style Accordions: Typography, Spacing, Background --- */
const BlockStyleAccordions: React.FC<{
  block: LandingPageBlock;
  onUpdate: (b: LandingPageBlock) => void;
}> = ({ block, onUpdate }) => {
  const currentAlign = block.textAlign || 'right';
  const currentPadding = typeof block.blockPadding === 'number' ? block.blockPadding : 24;
  const currentMarginY = typeof block.blockMarginY === 'number' ? block.blockMarginY : 0;
  const currentFontScale = typeof block.fontSizeScale === 'number' ? block.fontSizeScale : 100;
  const currentRadius = typeof block.borderRadiusPx === 'number' ? block.borderRadiusPx : 0;

  return (
    <div className="space-y-2.5">
      {/* Typography Accordion */}
      <CollapsibleAccordion
        title="Typography (الخط والمحاذاة)"
        subtitle="Text alignment, scale & text color"
        icon={<Type className="w-3.5 h-3.5" />}
        defaultOpen={false}
      >
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
            Text Alignment (محاذاة النص)
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
                      ? 'bg-blue-600 text-slate-800 border-blue-600 shadow-xs'
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

        <SliderWithNumericInput
          label="Font Size Scale (حجم الخط)"
          value={currentFontScale}
          min={80}
          max={140}
          step={5}
          unit="%"
          onChange={(val) => onUpdate({ ...block, fontSizeScale: val })}
        />

        <ColorWithHexInput
          label="Text Color Override (لون النص)"
          value={block.textColorOverride}
          defaultColor="#0f172a"
          onChange={(hex) => onUpdate({ ...block, textColorOverride: hex })}
        />
      </CollapsibleAccordion>

      {/* Spacing Accordion */}
      <CollapsibleAccordion
        title="Spacing (الأبعاد والهوامش)"
        subtitle="Padding, vertical margin & corner radius"
        icon={<Maximize2 className="w-3.5 h-3.5" />}
        defaultOpen={false}
      >
        <SliderWithNumericInput
          label="Vertical Padding (الهامش الداخلي)"
          value={currentPadding}
          min={0}
          max={120}
          step={4}
          unit="px"
          onChange={(val) => onUpdate({ ...block, blockPadding: val })}
        />

        <SliderWithNumericInput
          label="Vertical Margin (الهامش الخارجي)"
          value={currentMarginY}
          min={0}
          max={80}
          step={4}
          unit="px"
          onChange={(val) => onUpdate({ ...block, blockMarginY: val })}
        />

        <SliderWithNumericInput
          label="Corner Radius (استدارة الحواف)"
          value={currentRadius}
          min={0}
          max={48}
          step={2}
          unit="px"
          onChange={(val) => onUpdate({ ...block, borderRadiusPx: val })}
        />
      </CollapsibleAccordion>

      {/* Background Accordion */}
      <CollapsibleAccordion
        title="Background (الخلفية والألوان)"
        subtitle="Block surface color & reset"
        icon={<Palette className="w-3.5 h-3.5" />}
        defaultOpen={false}
      >
        <ColorWithHexInput
          label="Background Color (لون الخلفية)"
          value={block.blockBgColor}
          defaultColor="#ffffff"
          onChange={(hex) => onUpdate({ ...block, blockBgColor: hex })}
        />

        {(block.blockBgColor ||
          block.textColorOverride ||
          block.textAlign ||
          block.blockPadding !== undefined ||
          block.blockMarginY !== undefined ||
          block.fontSizeScale !== undefined ||
          block.borderRadiusPx !== undefined) && (
          <button
            type="button"
            onClick={() =>
              onUpdate({
                ...block,
                blockBgColor: undefined,
                textColorOverride: undefined,
                textAlign: undefined,
                blockPadding: undefined,
                blockMarginY: undefined,
                fontSizeScale: undefined,
                borderRadiusPx: undefined,
              })
            }
            className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Style Overrides</span>
          </button>
        )}
      </CollapsibleAccordion>
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

  // If no block selected, display Global Page & Styling inspector grouped into Collapsible Accordions
  if (!selectedBlock) {
    return (
      <aside
        dir="rtl"
        className="w-[320px] shrink-0 bg-white border-l border-slate-200 flex flex-col h-full min-h-0 select-none overflow-y-auto overflow-x-hidden sticky top-14"
      >
        <div className="px-3.5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/95 sticky top-0 z-20 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Palette className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-xs font-black text-slate-900 truncate">
              إعدادات التصميم والهوية البصرية
            </h3>
          </div>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition cursor-pointer shrink-0"
              title="إخفاء القائمة الجانبية"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-3.5 space-y-2.5 text-xs">
          {/* 1. Content Accordion */}
          <CollapsibleAccordion
            title="Content (المحتوى والهوية)"
            subtitle="Page title, language, direction & pixels"
            icon={<FileText className="w-3.5 h-3.5" />}
            defaultOpen={true}
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                عنوان صفحة الهبوط (Page Title)
              </label>
              <input
                type="text"
                value={pageData.title}
                onChange={(e) => onUpdatePageMeta({ title: e.target.value })}
                className="w-full h-8 px-2.5 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
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
                  className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                >
                  <option value="ar">العربية (RTL)</option>
                  <option value="fr">Français (LTR)</option>
                  <option value="en">English (LTR)</option>
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
                  اتجاه النص
                </label>
                <select
                  value={pageData.direction}
                  onChange={(e) =>
                    onUpdatePageMeta({ direction: e.target.value as 'ltr' | 'rtl' })
                  }
                  className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
                >
                  <option value="rtl">من اليمين لليسار (RTL)</option>
                  <option value="ltr">من اليسار لليمين (LTR)</option>
                </select>
              </div>
            </div>

            {/* Remove Platform Watermark */}
            <div className="relative rounded-xl p-2.5 border border-slate-200 bg-slate-50/70">
              <ModernToggleSwitch
                label="إزالة العلامة المائية (Watermark)"
                description="إخفاء شعار المنصة أسفل صفحة الهبوط"
                checked={effectiveWatermarkUnlocked}
                disabled={!effectiveWatermarkUnlocked}
                onChange={() => {}}
              />
              {!effectiveWatermarkUnlocked && (
                <ProFeatureLockOverlay
                  compact
                  onUpgradeClick={onUpgradeClick}
                  reason="إزالة العلامة المائية متاحة بدايةً من باقة Starter و Pro."
                />
              )}
            </div>
          </CollapsibleAccordion>

          {/* 2. Typography Accordion */}
          <CollapsibleAccordion
            title="Typography (الخطوط والنصوص)"
            subtitle="Font family, size scale & global text color"
            icon={<Type className="w-3.5 h-3.5" />}
            defaultOpen={true}
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                نوع الخط (Font Family)
              </label>
              <select
                value={currentFontFamily}
                onChange={(e) =>
                  onUpdateTheme({
                    ...pageData.theme,
                    fontFamily: e.target.value as PageTheme['fontFamily'],
                  })
                }
                className="w-full h-8.5 px-2.5 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white font-bold text-slate-800 cursor-pointer"
              >
                {FONT_FAMILY_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1.5">
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
                          ? 'bg-blue-600 text-slate-800 border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {size.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <ColorWithHexInput
              label="لون النصوص العام (Text Color)"
              value={currentTextColor}
              defaultColor="#0f172a"
              onChange={(color) => onUpdateTheme({ ...pageData.theme, textColor: color || '#0f172a' })}
            />
          </CollapsibleAccordion>

          {/* 3. Spacing Accordion */}
          <CollapsibleAccordion
            title="Spacing (الأبعاد والحواف)"
            subtitle="Section spacing & button corner radius"
            icon={<Maximize2 className="w-3.5 h-3.5" />}
            defaultOpen={false}
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                تباعد الأقسام (Section Spacing)
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
                          ? 'bg-blue-600 text-slate-800 border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                استدارة الحواف والأزرار (Border Radius)
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
                          ? 'bg-blue-600 text-slate-800 border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {rad.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CollapsibleAccordion>

          {/* 4. Background & Colors Accordion */}
          <CollapsibleAccordion
            title="Background (الألوان والخلفية)"
            subtitle="Color palettes, primary & background hex"
            icon={<Palette className="w-3.5 h-3.5" />}
            defaultOpen={true}
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                قوالب الألوان الجاهزة (6 Palettes)
              </label>
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
                          ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white hover:border-slate-300'
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
                      <span className="text-[10px] font-bold text-slate-800 truncate">
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <ColorWithHexInput
              label="اللون الأساسي (Primary Color)"
              value={pageData.theme.primaryColor}
              defaultColor="#059669"
              onChange={(color) => onUpdateTheme({ ...pageData.theme, primaryColor: color || '#059669' })}
            />

            <ColorWithHexInput
              label="لون الخلفية العام (Background Color)"
              value={currentBgColor}
              defaultColor="#ffffff"
              onChange={(color) => onUpdateTheme({ ...pageData.theme, backgroundColor: color || '#ffffff' })}
            />
          </CollapsibleAccordion>

          {/* Tracking Pixels (Facebook & TikTok Pixel) - Pro / Enterprise Only */}
          <div className="relative rounded-xl p-3 border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                  <span>بيكسل التتبع (Facebook & TikTok Pixels)</span>
                  {!effectivePixelsUnlocked && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      <Lock className="w-2.5 h-2.5" /> PRO
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500">
                  تتبع زيارات الصفحة وأحداث الشراء (Purchase / PageView) تلقائياً
                </div>
              </div>
            </div>

            <div className="space-y-2" dir="ltr">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
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
                  className="w-full h-8 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
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
                  className="w-full h-8 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            {effectivePixelsUnlocked && (
              <div className="pt-1 space-y-1.5">
                <button
                  type="button"
                  onClick={handleSavePixelsToCloud}
                  disabled={savingPixels}
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-slate-800 font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
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
        </div>
      </aside>
    );
  }

  const isSelectedBlockPro = PRO_BLOCK_TYPES.includes(selectedBlock.type);

  // Active Block Inspector with Collapsible Accordions: Content, Typography, Spacing, Background
  return (
    <aside
      dir="rtl"
      className="w-[320px] shrink-0 bg-white border-l border-slate-200 flex flex-col h-full min-h-0 select-none overflow-y-auto overflow-x-hidden sticky top-14"
    >
      <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/95 sticky top-0 z-20 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sliders className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 truncate">
                {selectedBlock.type.replace('-', ' ')}
              </h3>
              {isSelectedBlockPro && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-slate-900 text-amber-400 text-[9px] font-black">
                  <Crown className="w-2.5 h-2.5 text-amber-400" />
                  <span>PRO</span>
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 block truncate">{selectedBlock.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition cursor-pointer"
            title="إلغاء تحديد القسم"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition cursor-pointer"
              title="إخفاء القائمة الجانبية"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-2.5 text-xs relative">
        {isSelectedBlockPro && !isPro && (
          <ProFeatureLockOverlay
            onUpgradeClick={onUpgradeClick}
            reason={`تعديل إعدادات قسم "${selectedBlock.type}" ميزة احترافية تتطلب الترقية إلى باقة Pro.`}
          />
        )}

        {/* 1. Content Accordion */}
        <CollapsibleAccordion
          title="Content (المحتوى والبيانات)"
          subtitle="Block text, media, offers & fields"
          icon={<FileText className="w-3.5 h-3.5" />}
          defaultOpen={true}
        >
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
        </CollapsibleAccordion>

        {/* 2. Typography, 3. Spacing, 4. Background Accordions */}
        <BlockStyleAccordions block={selectedBlock} onUpdate={onUpdateBlock} />
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
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          نص الشريط الإعلاني
        </label>
        <textarea
          rows={2}
          value={block.text}
          onChange={(e) => onUpdate({ ...block, text: e.target.value })}
          className="w-full px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
        />
      </div>

      <SliderWithNumericInput
        label="المؤقت التنازلي (دقائق)"
        value={block.countdownMinutes || 15}
        min={1}
        max={120}
        step={1}
        unit="min"
        onChange={(val) => onUpdate({ ...block, countdownMinutes: val })}
      />

      <ModernToggleSwitch
        label="إظهار العداد التنازلي (Countdown Timer)"
        description="عرض مؤقت العرض المحدود في الشريط العلوي"
        checked={!!block.showTimer}
        onChange={(checked) => onUpdate({ ...block, showTimer: checked })}
      />

      <ModernToggleSwitch
        label="تثبيت الشريط أعلى الصفحة (Sticky)"
        checked={!!block.isSticky}
        onChange={(checked) => onUpdate({ ...block, isSticky: checked })}
      />

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          تنبيه ندرة المخزون
        </label>
        <input
          type="text"
          value={block.stockWarning}
          onChange={(e) => onUpdate({ ...block, stockWarning: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
          placeholder="مثال: متبقي 7 قطع فقط"
        />
      </div>

      <ColorWithHexInput
        label="لون خلفية الشريط"
        value={block.bgColor}
        defaultColor="#0f172a"
        onChange={(hex) => onUpdate({ ...block, bgColor: hex || '#0f172a' })}
      />

      <ColorWithHexInput
        label="لون نص الشريط"
        value={block.textColor}
        defaultColor="#ffffff"
        onChange={(hex) => onUpdate({ ...block, textColor: hex || '#ffffff' })}
      />
    </div>
  );
};

const HeroEditor: React.FC<{
  block: HeroBlock;
  onUpdate: (b: LandingPageBlock) => void;
  isPro?: boolean;
  onUpgradeClick?: (reason?: string) => void;
}> = ({ block, onUpdate }) => {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">شارة العرض العلوية</label>
        <input
          type="text"
          value={block.badge}
          onChange={(e) => onUpdate({ ...block, badge: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">العنوان الرئيسي</label>
        <textarea
          rows={2}
          value={block.headline}
          onChange={(e) => onUpdate({ ...block, headline: e.target.value })}
          className="w-full px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs font-bold bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">الوصف الفرعي</label>
        <textarea
          rows={2}
          value={block.subheadline}
          onChange={(e) => onUpdate({ ...block, subheadline: e.target.value })}
          className="w-full px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          الوصف الكامل للمنتج (Full Description)
        </label>
        <textarea
          rows={3}
          value={block.description || ''}
          onChange={(e) => onUpdate({ ...block, description: e.target.value })}
          placeholder="تفاصيل المنتج الكاملة المستخرجة من المتجر..."
          className="w-full px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
        />
      </div>

      {/* Compact 3-Column Row: Discount Price, Original Price, Currency */}
      <div className="grid grid-cols-3 gap-1.5 items-end">
        <div className="min-w-0">
          <label className="block text-[10px] font-bold text-slate-700 mb-1 truncate">
            سعر التخفيض
          </label>
          <input
            type="number"
            value={block.priceDiscounted}
            onChange={(e) =>
              onUpdate({ ...block, priceDiscounted: Number(e.target.value) || 0 })
            }
            className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs font-mono font-bold text-emerald-600 bg-white"
          />
        </div>

        <div className="min-w-0">
          <label className="block text-[10px] font-bold text-slate-700 mb-1 truncate">
            السعر الأصلي
          </label>
          <input
            type="number"
            value={block.priceOriginal}
            onChange={(e) =>
              onUpdate({ ...block, priceOriginal: Number(e.target.value) || 0 })
            }
            className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs font-mono text-slate-500 bg-white"
          />
        </div>

        <div className="min-w-0">
          <label className="block text-[10px] font-bold text-slate-700 mb-1 truncate">
            العملة
          </label>
          <input
            type="text"
            value={block.currency}
            onChange={(e) => onUpdate({ ...block, currency: e.target.value })}
            className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs font-mono bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">نص زر الشراء (CTA)</label>
        <input
          type="text"
          value={block.ctaText}
          onChange={(e) => onUpdate({ ...block, ctaText: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs font-bold bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          نص الطمأنة أسفل الزر
        </label>
        <input
          type="text"
          value={block.ctaSubtext}
          onChange={(e) => onUpdate({ ...block, ctaSubtext: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs bg-white"
        />
      </div>

      {/* Image Gallery URLs */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>معرض صور المنتج ({block.images.length})</span>
          </label>
          <button
            type="button"
            onClick={() =>
              onUpdate({
                ...block,
                images: [
                  ...block.images,
                  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1000&q=80',
                ],
              })
            }
            className="text-blue-600 hover:text-blue-700 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> إضافة صورة
          </button>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
          {block.images.map((img, idx) => (
            <div key={idx} className="flex gap-1.5 items-center">
              <img
                src={img}
                alt={`Thumb ${idx + 1}`}
                className="w-7 h-7 rounded-md object-cover border border-slate-200 shrink-0 bg-slate-100"
              />
              <input
                type="text"
                dir="ltr"
                value={img}
                onChange={(e) => {
                  const updated = [...block.images];
                  updated[idx] = e.target.value;
                  onUpdate({ ...block, images: updated });
                }}
                className="flex-1 h-7.5 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-mono truncate bg-white outline-none focus:border-blue-500"
              />
              {block.images.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const updated = block.images.filter((_, i) => i !== idx);
                    onUpdate({ ...block, images: updated });
                  }}
                  className="p-1 text-rose-400 hover:text-rose-600 rounded cursor-pointer shrink-0"
                  title="حذف الصورة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
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
        <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان القسم</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">شارة التميز</label>
        <input
          type="text"
          value={block.highlightBadge}
          onChange={(e) => onUpdate({ ...block, highlightBadge: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 bg-white"
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
        <label className="block text-[11px] font-bold text-slate-700 mb-1">العنوان</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">العنوان الفرعي</label>
        <input
          type="text"
          value={block.subtitle}
          onChange={(e) => onUpdate({ ...block, subtitle: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-bold text-slate-700">
          قائمة المميزات ({block.items.length})
        </label>
        {block.items.map((item, idx) => (
          <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-700">ميزة #{idx + 1}</span>
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
              className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-blue-500"
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
              className="w-full px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500"
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
        <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان التقييمات</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-blue-500 bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
            التقييم (من 5)
          </label>
          <input
            type="number"
            step="0.1"
            value={block.overallRating}
            onChange={(e) =>
              onUpdate({ ...block, overallRating: Number(e.target.value) || 5 })
            }
            className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono outline-none focus:border-blue-500 bg-white"
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate">
            إجمالي المراجعات
          </label>
          <input
            type="number"
            value={block.totalReviews}
            onChange={(e) =>
              onUpdate({ ...block, totalReviews: Number(e.target.value) || 2000 })
            }
            className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono outline-none focus:border-blue-500 bg-white"
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
  const countriesList = getCountriesSorted();
  const isCascadingEnabled = block.showCountryCityDropdowns !== false;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان استمارة الطلب</label>
        <input
          type="text"
          value={block.title}
          onChange={(e) => onUpdate({ ...block, title: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-blue-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">نص زر تأكيد الطلب</label>
        <input
          type="text"
          value={block.buttonText}
          onChange={(e) => onUpdate({ ...block, buttonText: e.target.value })}
          className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-blue-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          رسالة ضمان الدفع عند الاستلام
        </label>
        <textarea
          rows={2}
          value={block.guaranteeText}
          onChange={(e) => onUpdate({ ...block, guaranteeText: e.target.value })}
          className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 bg-white"
        />
      </div>

      {/* Cascading Country & City Dropdowns Configuration */}
      <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-black text-blue-950">
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span>الدول والمدن المتسلسلة (Country & City)</span>
        </div>

        <ModernToggleSwitch
          label="تفعيل قوائم الدول والمدن (Cascading Dropdowns)"
          description="اختيار الدولة أولاً ثم عرض مدنها أبجدياً"
          checked={isCascadingEnabled}
          onChange={(checked) =>
            onUpdate({ ...block, showCountryCityDropdowns: checked })
          }
        />

        {isCascadingEnabled && (
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-1">
              الدولة الافتراضية (Default Country)
            </label>
            <select
              value={block.defaultCountry || ''}
              onChange={(e) =>
                onUpdate({ ...block, defaultCountry: e.target.value || undefined })
              }
              className="w-full h-8 px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">-- بدون دولة افتراضية (يختارها الزبون) --</option>
              {countriesList.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.flag} {c.nameAr}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Form Fields Toggle Switches */}
      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
        <ModernToggleSwitch
          label="إظهار حقل المدينة (City)"
          checked={block.fields.requireCity}
          onChange={(checked) =>
            onUpdate({
              ...block,
              fields: { ...block.fields, requireCity: checked },
            })
          }
        />
        <ModernToggleSwitch
          label="إظهار حقل العنوان التفصيلي (Address)"
          checked={block.fields.requireAddress}
          onChange={(checked) =>
            onUpdate({
              ...block,
              fields: { ...block.fields, requireAddress: checked },
            })
          }
        />
        <ModernToggleSwitch
          label="إظهار حقل ملاحظات التوصيل (Notes)"
          checked={block.fields.requireNote}
          onChange={(checked) =>
            onUpdate({
              ...block,
              fields: { ...block.fields, requireNote: checked },
            })
          }
        />
      </div>

      {/* Bundles Configuration */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-700">
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
            className="text-blue-600 hover:text-blue-700 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> إضافة عرض
          </button>
        </div>

        {block.bundles.map((bundle, idx) => (
          <div key={bundle.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-slate-800">عرض #{idx + 1}</span>
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
              className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-blue-500"
              placeholder="اسم العرض"
            />

            <div className="grid grid-cols-2 gap-1.5">
              <div className="min-w-0">
                <label className="block text-[10px] text-slate-500 font-bold truncate mb-0.5">
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
                  className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-mono font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-[10px] text-slate-500 font-bold truncate mb-0.5">
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
                  className="w-full h-8 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-mono text-slate-400 outline-none focus:border-blue-500"
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
                className="flex-1 h-8 px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs outline-none focus:border-blue-500 min-w-0"
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
                    ? 'bg-emerald-600 text-slate-800'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
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
