import React from 'react';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/700.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/700.css';
import {
  LandingPageData,
  LandingPageBlock,
  ViewportMode,
  BundleOption,
  PageTheme,
} from '../types/landingPage';
import { PromoBarBlockView } from './blocks/PromoBarBlockView';
import { HeroBlockView } from './blocks/HeroBlockView';
import { ProblemSolutionBlockView } from './blocks/ProblemSolutionBlockView';
import { FeaturesBlockView } from './blocks/FeaturesBlockView';
import { SocialProofBlockView } from './blocks/SocialProofBlockView';
import { CodFormBlockView } from './blocks/CodFormBlockView';
import { FaqBlockView } from './blocks/FaqBlockView';
import { FloatingCtaBlockView } from './blocks/FloatingCtaBlockView';
import { TrustBadgesBlockView } from './blocks/TrustBadgesBlockView';
import { ArrowUp, ArrowDown, Copy, Trash2 } from 'lucide-react';
import { OrderConfirmationData } from './OrderSuccessModal';

interface Props {
  pageData: LandingPageData;
  viewport: ViewportMode;
  selectedBlockId: string | null;
  isPreviewMode: boolean;
  onSelectBlock: (id: string | null) => void;
  onMoveBlock: (index: number, direction: 'up' | 'down') => void;
  onDuplicateBlock: (index: number) => void;
  onDeleteBlock: (index: number) => void;
  onOrderConfirmed: (data: OrderConfirmationData) => void;
}

function resolveFontFamilyCss(fontFamily?: PageTheme['fontFamily']): string {
  switch (fontFamily) {
    case 'Cairo':
      return "'Cairo', sans-serif";
    case 'Tajawal':
      return "'Tajawal', sans-serif";
    case 'Inter':
      return "'Inter', sans-serif";
    case 'Poppins':
      return "'Poppins', sans-serif";
    case 'System':
      return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    default:
      return "'Cairo', sans-serif";
  }
}

function resolveFontSizeScale(fontSize?: PageTheme['fontSize']): {
  baseSize: string;
  zoomScale: number;
} {
  switch (fontSize) {
    case 'sm':
      return { baseSize: '14px', zoomScale: 0.92 };
    case 'lg':
      return { baseSize: '17px', zoomScale: 1.06 };
    case 'xl':
      return { baseSize: '19px', zoomScale: 1.12 };
    case 'base':
    default:
      return { baseSize: '16px', zoomScale: 1 };
  }
}

function resolveBorderRadiusPx(borderRadius?: PageTheme['borderRadius']): string {
  switch (borderRadius) {
    case 'none':
      return '0px';
    case 'sm':
      return '6px';
    case 'md':
      return '12px';
    case 'lg':
      return '20px';
    case 'full':
      return '32px';
    default:
      return '16px';
  }
}

function resolveSectionSpacingRem(sectionSpacing?: PageTheme['sectionSpacing']): string {
  switch (sectionSpacing) {
    case 'compact':
      return '0.75rem';
    case 'spacious':
      return '3rem';
    case 'normal':
    default:
      return '1.75rem';
  }
}

export const CanvasRenderer: React.FC<Props> = ({
  pageData,
  viewport,
  selectedBlockId,
  isPreviewMode,
  onSelectBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onOrderConfirmed,
}) => {
  const isRtl = pageData.direction === 'rtl' || pageData.language === 'ar';
  const fontFamilyCss = resolveFontFamilyCss(pageData.theme.fontFamily);
  const { baseSize, zoomScale } = resolveFontSizeScale(pageData.theme.fontSize);
  const radiusPx = resolveBorderRadiusPx(pageData.theme.borderRadius);
  const sectionGapRem = resolveSectionSpacingRem(pageData.theme.sectionSpacing);
  const themeBgColor = pageData.theme.backgroundColor || '#ffffff';
  const themeTextColor = pageData.theme.textColor || '#0f172a';

  // Scroll to checkout form helper
  const handleScrollToCheckout = () => {
    const el = document.getElementById('cod-checkout-form');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCodSubmit = (payload: {
    customerName: string;
    customerPhone: string;
    customerCity: string;
    customerAddress: string;
    customerNote?: string;
    bundle: BundleOption;
    totalPrice: number;
    currency: string;
    recaptchaToken?: string;
    turnstileToken?: string;
  }) => {
    const orderId = `#COD-${Math.floor(10000 + Math.random() * 90000)}`;
    onOrderConfirmed({
      orderId,
      ...payload,
    });
  };

  // Viewport container sizing
  const getViewportWrapperStyle = () => {
    switch (viewport) {
      case 'mobile':
        return 'w-[390px] min-h-[844px] shadow-2xl rounded-[44px] border-[10px] border-gray-900 bg-white overflow-hidden my-8 ring-1 ring-gray-900/10 transition-all duration-300';
      case 'tablet':
        return 'w-[768px] min-h-[1024px] shadow-2xl rounded-[32px] border-[12px] border-gray-800 bg-white overflow-hidden my-8 transition-all duration-300';
      case 'desktop':
      default:
        return 'w-full min-h-screen bg-white transition-all duration-300 shadow-sm';
    }
  };

  const renderBlockContent = (block: LandingPageBlock) => {
    switch (block.type) {
      case 'promo-bar':
        return <PromoBarBlockView block={block} isRtl={isRtl} />;
      case 'hero':
        return (
          <HeroBlockView
            block={block}
            theme={pageData.theme}
            viewport={viewport}
            isRtl={isRtl}
            onCtaClick={handleScrollToCheckout}
          />
        );
      case 'problem-solution':
        return (
          <ProblemSolutionBlockView block={block} theme={pageData.theme} isRtl={isRtl} />
        );
      case 'features':
        return <FeaturesBlockView block={block} theme={pageData.theme} isRtl={isRtl} />;
      case 'social-proof':
        return <SocialProofBlockView block={block} theme={pageData.theme} isRtl={isRtl} />;
      case 'cod-form':
        return (
          <CodFormBlockView
            block={block}
            theme={pageData.theme}
            isRtl={isRtl}
            onOrderSubmit={handleCodSubmit}
          />
        );
      case 'faq':
        return <FaqBlockView block={block} theme={pageData.theme} isRtl={isRtl} />;
      case 'floating-cta':
        return (
          <FloatingCtaBlockView
            block={block}
            theme={pageData.theme}
            isRtl={isRtl}
            onCtaClick={handleScrollToCheckout}
          />
        );
      case 'trust-badges':
        return <TrustBadgesBlockView block={block} theme={pageData.theme} isRtl={isRtl} />;
      default:
        return null;
    }
  };

  const getBlockFriendlyName = (type: string) => {
    switch (type) {
      case 'promo-bar':
        return 'شريط الإعلان العلوي';
      case 'hero':
        return 'القسم الرئيسي (Hero)';
      case 'problem-solution':
        return 'المشكلة والحل';
      case 'features':
        return 'مميزات المنتج';
      case 'social-proof':
        return 'تقييمات الزبناء';
      case 'cod-form':
        return 'استمارة الدفع عند الاستلام';
      case 'faq':
        return 'الأسئلة الشائعة';
      case 'floating-cta':
        return 'زر الشراء العائم';
      case 'trust-badges':
        return 'شارات الثقة والضمان';
      default:
        return 'قسم الصفحة';
    }
  };

  const canvasCssVariables: React.CSSProperties = {
    fontFamily: fontFamilyCss,
    fontSize: baseSize,
    backgroundColor: themeBgColor,
    color: themeTextColor,
    ['--cw-font-family' as string]: fontFamilyCss,
    ['--cw-font-size' as string]: baseSize,
    ['--cw-font-scale' as string]: String(zoomScale),
    ['--cw-radius' as string]: radiusPx,
    ['--cw-section-spacing' as string]: sectionGapRem,
    ['--cw-bg-color' as string]: themeBgColor,
    ['--cw-text-color' as string]: themeTextColor,
    ['--cw-primary-color' as string]: pageData.theme.primaryColor,
    ['--cw-secondary-color' as string]: pageData.theme.secondaryColor,
  };

  return (
    <div
      className="flex-1 min-w-0 min-h-0 h-full overflow-y-auto overflow-x-hidden bg-gray-100/90 flex flex-col items-center p-0 md:p-6 pb-20 transition-all duration-300"
      onClick={(e) => {
        // If clicking canvas background, unselect block
        if (e.target === e.currentTarget && !isPreviewMode) {
          onSelectBlock(null);
        }
      }}
    >
      {/* Dynamic real-time design system overrides scoped to the canvas */}
      <style>{`
        .cw-canvas-theme {
          font-family: var(--cw-font-family) !important;
          font-size: var(--cw-font-size);
          color: var(--cw-text-color);
          background-color: var(--cw-bg-color);
        }
        .cw-canvas-theme * {
          font-family: inherit;
        }
        .cw-canvas-theme button,
        .cw-canvas-theme input,
        .cw-canvas-theme select,
        .cw-canvas-theme textarea,
        .cw-canvas-theme .rounded-xl,
        .cw-canvas-theme .rounded-2xl,
        .cw-canvas-theme .rounded-3xl,
        .cw-canvas-theme .rounded-lg {
          border-radius: var(--cw-radius) !important;
        }
        .cw-canvas-block-overrides section,
        .cw-canvas-block-overrides > div {
          background-color: inherit !important;
        }
      `}</style>

      {/* Device wrapper */}
      <div
        className={`${getViewportWrapperStyle()} cw-canvas-theme`}
        style={canvasCssVariables}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Mobile Notch Bar */}
        {viewport === 'mobile' && (
          <div className="w-full bg-gray-900 text-white pt-2 pb-1 px-7 flex justify-between items-center text-[10px] font-semibold select-none">
            <span>9:41</span>
            <div className="w-24 h-4 bg-black rounded-full mx-auto" />
            <div className="flex items-center gap-1">
              <span>5G</span>
              <div className="w-4 h-2.5 border border-white rounded-sm flex items-center p-0.5">
                <div className="w-full h-full bg-white rounded-2xs" />
              </div>
            </div>
          </div>
        )}

        {/* Blocks container */}
        <div
          className="relative flex flex-col"
          style={{
            gap: sectionGapRem,
            zoom: zoomScale,
          }}
        >
          {pageData.blocks.map((block, idx) => {
            const isSelected = selectedBlockId === block.id && !isPreviewMode;
            const hasBlockBg = Boolean(block.blockBgColor);
            const hasCustomPadding = typeof block.blockPadding === 'number';
            const blockWrapperStyle: React.CSSProperties = {
              backgroundColor: block.blockBgColor || undefined,
              textAlign: block.textAlign || undefined,
              paddingTop: hasCustomPadding ? `${(block.blockPadding ?? 0) * 4}px` : undefined,
              paddingBottom: hasCustomPadding ? `${(block.blockPadding ?? 0) * 4}px` : undefined,
            };

            return (
              <div
                key={block.id}
                onClick={(e) => {
                  if (!isPreviewMode) {
                    e.stopPropagation();
                    onSelectBlock(block.id);
                  }
                }}
                style={blockWrapperStyle}
                className={`relative group transition-all duration-150 ${
                  hasBlockBg ? 'cw-canvas-block-overrides' : ''
                } ${!isPreviewMode ? 'cursor-pointer' : ''} ${
                  isSelected
                    ? 'ring-2 ring-emerald-500 ring-offset-2 z-20'
                    : !isPreviewMode
                    ? 'hover:ring-1 hover:ring-emerald-300/80 hover:ring-offset-1'
                    : ''
                }`}
              >
                {/* Floating Editor Controls Toolbar */}
                {isSelected && (
                  <div
                    className="absolute -top-9 start-3 z-30 flex items-center gap-1 bg-gray-900 text-white text-xs py-1 px-2.5 rounded-lg shadow-xl animate-in fade-in"
                    onClick={(e) => e.stopPropagation()}
                    dir="ltr"
                  >
                    <span className="font-semibold text-[11px] text-emerald-400 me-2 border-r border-gray-700 pe-2">
                      {getBlockFriendlyName(block.type)}
                    </span>

                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMoveBlock(idx, 'up')}
                      title="Move Up"
                      className="p-1 hover:bg-gray-800 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === pageData.blocks.length - 1}
                      onClick={() => onMoveBlock(idx, 'down')}
                      title="Move Down"
                      className="p-1 hover:bg-gray-800 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDuplicateBlock(idx)}
                      title="Duplicate Block"
                      className="p-1 hover:bg-gray-800 rounded"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteBlock(idx)}
                      title="Delete Block"
                      className="p-1 hover:bg-red-600 rounded text-red-400 hover:text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Render the block view */}
                {renderBlockContent(block)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
