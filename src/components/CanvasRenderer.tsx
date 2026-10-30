import React, { useState } from 'react';
import { LandingPageData, LandingPageBlock, BlockType } from '../types/landingPage';
import { PromoBarBlockView } from './blocks/PromoBarBlockView';
import { HeroBlockView } from './blocks/HeroBlockView';
import { ProblemSolutionBlockView } from './blocks/ProblemSolutionBlockView';
import { FeaturesBlockView } from './blocks/FeaturesBlockView';
import { SocialProofBlockView } from './blocks/SocialProofBlockView';
import { CodFormBlockView } from './blocks/CodFormBlockView';
import { FaqBlockView } from './blocks/FaqBlockView';
import { FloatingCtaBlockView } from './blocks/FloatingCtaBlockView';
import { TrustBadgesBlockView } from './blocks/TrustBadgesBlockView';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  GripVertical,
  MousePointerClick,
  Plus,
} from 'lucide-react';
import { CustomerLandingPage } from './CustomerLandingPage';

export interface OrderConfirmationData {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerCountry?: string;
  customerCity?: string;
  customerAddress?: string;
  bundleName?: string;
  bundlePrice?: number | string;
}

interface Props {
  data?: LandingPageData;
  pageData?: LandingPageData;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onMoveBlock: (index: any, direction: 'up' | 'down') => void;
  onDeleteBlock: (index: any) => void;
  onDuplicateBlock?: (index: any) => void;
  onDropBlock?: (type: BlockType, index?: number) => void;
  onReorderBlocks?: (fromIndex: number, toIndex: number) => void;
  onOrderConfirmed?: (data: any) => void;
  previewMode?: 'desktop' | 'tablet' | 'mobile';
  viewport?: 'desktop' | 'tablet' | 'mobile';
  isLivePreview?: boolean;
  isPreviewMode?: boolean;
}

const BLOCK_TYPE_NAMES: Record<string, string> = {
  'promo-bar': 'Promo Bar',
  hero: 'Hero Section',
  'problem-solution': 'Problem & Solution',
  features: 'Features Grid',
  'social-proof': 'Customer Reviews',
  'cod-form': 'COD Checkout Form',
  faq: 'FAQ Section',
  'floating-cta': 'Sticky Mobile CTA',
  'trust-badges': 'Trust Badges',
};

export const CanvasRenderer: React.FC<Props> = ({
  data: propData,
  pageData,
  selectedBlockId,
  onSelectBlock,
  onMoveBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onDropBlock,
  onReorderBlocks,
  onOrderConfirmed,
  previewMode: propPreviewMode,
  viewport,
  isLivePreview: propIsLivePreview,
  isPreviewMode,
}) => {
  const data = (propData || pageData)!;
  const previewMode = propPreviewMode || viewport || 'desktop';
  const isLivePreview = propIsLivePreview ?? isPreviewMode ?? false;

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);

  const fontClassMap: Record<string, string> = {
    Inter: 'font-sans',
    Poppins: 'font-poppins',
    Cairo: 'font-cairo',
    Tajawal: 'font-tajawal',
    Montserrat: 'font-montserrat',
    System: 'font-sans',
  };

  const renderBlockContent = (block: LandingPageBlock) => {
    switch (block.type) {
      case 'promo-bar':
        return <PromoBarBlockView block={block} isRtl={data.direction === 'rtl'} />;
      case 'hero':
        return <HeroBlockView block={block} theme={data.theme} />;
      case 'problem-solution':
        return <ProblemSolutionBlockView block={block} theme={data.theme} />;
      case 'features':
        return <FeaturesBlockView block={block} theme={data.theme} />;
      case 'social-proof':
        return <SocialProofBlockView block={block} theme={data.theme} />;
      case 'cod-form':
        return (
          <CodFormBlockView
            block={block}
            theme={data.theme}
            pageSlug={data.slug || data.id}
            pageTitle={data.title}
            onOrderConfirmed={onOrderConfirmed}
          />
        );
      case 'faq':
        return <FaqBlockView block={block} theme={data.theme} />;
      case 'floating-cta':
        return <FloatingCtaBlockView block={block} theme={data.theme} />;
      case 'trust-badges':
        return <TrustBadgesBlockView block={block} theme={data.theme} />;
      default:
        return null;
    }
  };

  const containerWidthClass =
    previewMode === 'mobile'
      ? 'max-w-[390px] my-6 rounded-[36px] border-[10px] border-slate-900 shadow-2xl overflow-hidden'
      : previewMode === 'tablet'
      ? 'max-w-[768px] my-6 rounded-[24px] border-[8px] border-slate-800 shadow-2xl overflow-hidden'
      : 'w-full max-w-[1220px] my-6 rounded-2xl border border-slate-200/90 shadow-xl';

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (isLivePreview) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedBlockIndex !== null ? 'move' : 'copy';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    if (isLivePreview) return;
    e.preventDefault();
    setDragOverIndex(null);

    const reorderFrom = e.dataTransfer.getData('application/x-funnelcraft-reorder-index');
    if (reorderFrom !== '' && onReorderBlocks) {
      const fromIdx = parseInt(reorderFrom, 10);
      if (!Number.isNaN(fromIdx) && fromIdx !== index) {
        onReorderBlocks(fromIdx, index);
      }
      setDraggedBlockIndex(null);
      return;
    }

    const blockType = e.dataTransfer.getData('application/x-funnelcraft-block') as BlockType;
    if (blockType && onDropBlock) {
      onDropBlock(blockType, index);
    }
    setDraggedBlockIndex(null);
  };

  return (
    <div
      className="flex-1 bg-[#f8fafc] overflow-y-auto flex justify-center items-start min-h-[calc(100vh-3.5rem)] px-2 sm:px-6 transition-all relative"
      style={{
        backgroundColor: '#f8fafc',
        backgroundImage: 'radial-gradient(#cbd5e1 1.25px, transparent 1.25px)',
        backgroundSize: '20px 20px',
      }}
      onClick={() => !isLivePreview && onSelectBlock(null)}
    >
      <div
        dir={data.direction}
        style={{
          backgroundColor: data.theme.backgroundColor,
          color: data.theme.textColor,
        }}
        className={`${containerWidthClass} ${
          fontClassMap[data.theme.fontFamily] || 'font-sans'
        } transition-all duration-300 bg-white min-h-[82vh] relative`}
        onDragOver={(e) => {
          if (!isLivePreview && data.blocks.length === 0) {
            e.preventDefault();
            setDragOverIndex(0);
          }
        }}
        onDrop={(e) => {
          if (!isLivePreview && data.blocks.length === 0) {
            handleDrop(e, 0);
          }
        }}
      >
        {isLivePreview && data.scrapedData ? (
          <CustomerLandingPage
            product={data.scrapedData}
            pageSlug={data.slug || data.id}
            funnelId={data.id}
          />
        ) : data.blocks.length === 0 ? (
          <div className="p-20 text-center text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border-2 border-dashed border-blue-300 flex items-center justify-center mx-auto mb-4 text-blue-600">
              <Plus className="w-8 h-8" />
            </div>
            <p className="text-lg font-bold text-slate-700">Canvas is Empty</p>
            <p className="text-sm mt-1">
              Drag & drop blocks from the left toolbar or import a product URL to start building.
            </p>
          </div>
        ) : (
          data.blocks.map((block, index) => {
            const isSelected = !isLivePreview && selectedBlockId === block.id;
            const isFirst = index === 0;
            const isLast = index === data.blocks.length - 1;
            const isDragTarget = !isLivePreview && dragOverIndex === index;

            const customStyles: React.CSSProperties = {};
            if (block.blockBgColor) customStyles.backgroundColor = block.blockBgColor;
            if (block.textColorOverride) customStyles.color = block.textColorOverride;
            if (block.textAlign) customStyles.textAlign = block.textAlign;
            if (block.blockPadding !== undefined) {
              customStyles.paddingTop = `${block.blockPadding}px`;
              customStyles.paddingBottom = `${block.blockPadding}px`;
            }
            if (block.blockMarginY !== undefined) {
              customStyles.marginTop = `${block.blockMarginY}px`;
              customStyles.marginBottom = `${block.blockMarginY}px`;
            }
            if (block.fontSizeScale !== undefined && block.fontSizeScale !== 100) {
              customStyles.fontSize = `${block.fontSizeScale}%`;
            }
            if (block.borderRadiusPx !== undefined) {
              customStyles.borderRadius = `${block.borderRadiusPx}px`;
            }

            return (
              <div
                key={block.id}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleDrop(e, index)}
                onClick={(e) => {
                  if (!isLivePreview) {
                    e.stopPropagation();
                    onSelectBlock(block.id);
                  }
                }}
                style={customStyles}
                className={`relative group/block transition-all duration-150 ${
                  !isLivePreview ? 'cursor-pointer' : ''
                } ${
                  isSelected
                    ? 'outline-2 outline-blue-600 -outline-offset-2 z-20 bg-blue-50/5 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]'
                    : !isLivePreview
                    ? 'hover:outline-2 hover:outline-blue-500/80 hover:-outline-offset-2'
                    : ''
                }`}
              >
                {/* Drop zone indicator bar */}
                {isDragTarget && (
                  <div className="h-1.5 bg-blue-600 w-full flex items-center justify-center relative z-30">
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow">
                      Drop block here
                    </span>
                  </div>
                )}

                {/* Sleek Framer/Webflow-Style Floating Toolbar Above Selected Block */}
                {isSelected && !isLivePreview && (
                  <div
                    dir="ltr"
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute ${
                      isFirst ? 'top-2' : '-top-11'
                    } left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-slate-900/95 backdrop-blur-md text-white px-2 py-1.5 rounded-xl shadow-2xl border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150`}
                  >
                    {/* Drag Handle */}
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDraggedBlockIndex(index);
                        e.dataTransfer.setData('application/x-funnelcraft-reorder-index', String(index));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggedBlockIndex(null);
                        setDragOverIndex(null);
                      }}
                      title="Drag to reorder block"
                      className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-grab active:cursor-grabbing flex items-center gap-1"
                    >
                      <GripVertical className="w-3.5 h-3.5 text-blue-400" />
                    </div>

                    {/* Block Type Badge */}
                    <span className="text-[11px] font-bold tracking-wide px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-md whitespace-nowrap">
                      {BLOCK_TYPE_NAMES[block.type] || block.type}
                    </span>

                    <div className="h-4 w-px bg-slate-700 mx-0.5" />

                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveBlock(index, 'up');
                      }}
                      className="p-1.5 hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveBlock(index, 'down');
                      }}
                      className="p-1.5 hover:bg-slate-800 rounded-lg disabled:opacity-30 transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Duplicate */}
                    {onDuplicateBlock && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateBlock(index);
                        }}
                        className="p-1.5 hover:bg-blue-500/20 text-blue-300 rounded-lg transition-colors cursor-pointer"
                        title="Duplicate Block"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBlock(index);
                      }}
                      className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                      title="Delete Block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Subtle Blue Hover Pill when hovering unselected blocks */}
                {!isSelected && !isLivePreview && (
                  <div
                    dir="ltr"
                    className="opacity-0 group-hover/block:opacity-100 transition-opacity absolute top-2 right-2 z-20 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 pointer-events-none shadow-md"
                  >
                    <MousePointerClick className="w-3 h-3" />
                    <span>{BLOCK_TYPE_NAMES[block.type] || block.type}</span>
                  </div>
                )}

                {renderBlockContent(block)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
