import React from 'react';
import {
  LandingPageData,
  LandingPageBlock,
  ViewportMode,
  BundleOption,
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
import { ArrowUp, ArrowDown, Copy, Trash2, Smartphone, Tablet, Monitor } from 'lucide-react';
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
  const fontFamilyStyle =
    pageData.theme.fontFamily === 'Cairo'
      ? { fontFamily: 'Cairo, sans-serif' }
      : pageData.theme.fontFamily === 'Plus Jakarta Sans'
      ? { fontFamily: 'Plus Jakarta Sans, sans-serif' }
      : { fontFamily: 'Inter, sans-serif' };

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
        return 'Sticky Promo Bar';
      case 'hero':
        return 'Hero Section';
      case 'problem-solution':
        return 'Problem vs Solution';
      case 'features':
        return 'Feature Highlights';
      case 'social-proof':
        return 'Social Proof / Reviews';
      case 'cod-form':
        return 'Native COD Checkout Form';
      case 'faq':
        return 'FAQ Accordion';
      case 'floating-cta':
        return 'Floating Mobile CTA';
      case 'trust-badges':
        return 'Trust Badges & Guarantees';
      default:
        return 'Section Block';
    }
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
      {/* Device wrapper */}
      <div
        className={getViewportWrapperStyle()}
        style={{ ...fontFamilyStyle, backgroundColor: pageData.theme.backgroundColor || '#ffffff' }}
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
        <div className="relative">
          {pageData.blocks.map((block, idx) => {
            const isSelected = selectedBlockId === block.id && !isPreviewMode;

            return (
              <div
                key={block.id}
                onClick={(e) => {
                  if (!isPreviewMode) {
                    e.stopPropagation();
                    onSelectBlock(block.id);
                  }
                }}
                className={`relative group transition-all duration-150 ${
                  !isPreviewMode ? 'cursor-pointer' : ''
                } ${
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
