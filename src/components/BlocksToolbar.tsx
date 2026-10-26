import React, { useState } from 'react';
import { BlockType, LandingPageBlock } from '../types/landingPage';
import {
  Flame,
  LayoutTemplate,
  GitCompare,
  Sparkles,
  MessageSquareQuote,
  Banknote,
  HelpCircle,
  Smartphone,
  ShieldCheck,
  Plus,
  Layers,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  PanelLeftClose,
  Crown,
  Lock,
  Video,
  Code2,
} from 'lucide-react';

interface BlockDefinition {
  id: string;
  type: BlockType;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  tag: string;
  isPro?: boolean;
}

export const PRO_BLOCK_TYPES: BlockType[] = ['promo-bar', 'social-proof', 'floating-cta'];

const AVAILABLE_BLOCKS: BlockDefinition[] = [
  {
    id: 'hero',
    type: 'hero',
    title: 'Hero Section',
    description: 'High-converting headline, gallery, price strike, and primary CTA',
    icon: LayoutTemplate,
    tag: 'Core Hook',
    isPro: false,
  },
  {
    id: 'problem-solution',
    type: 'problem-solution',
    title: 'Problem vs. Solution',
    description: 'Side-by-side comparison cards (Before vs. After)',
    icon: GitCompare,
    tag: 'Persuasion',
    isPro: false,
  },
  {
    id: 'features',
    type: 'features',
    title: 'Feature Highlights',
    description: 'Icon cards highlighting key benefits and guarantees',
    icon: Sparkles,
    tag: 'Benefits',
    isPro: false,
  },
  {
    id: 'cod-form',
    type: 'cod-form',
    title: 'Native COD Form',
    description: 'Bundle selector, zero-card address inputs, and confirmation logic',
    icon: Banknote,
    tag: 'Checkout',
    isPro: false,
  },
  {
    id: 'faq',
    type: 'faq',
    title: 'FAQ Accordion',
    description: 'Address objections regarding payment, shipping, and returns',
    icon: HelpCircle,
    tag: 'Objections',
    isPro: false,
  },
  {
    id: 'trust-badges',
    type: 'trust-badges',
    title: 'Trust & Guarantees',
    description: 'Badges for Cash on Delivery, money-back, and express shipping',
    icon: ShieldCheck,
    tag: 'Reassurance',
    isPro: false,
  },
  {
    id: 'promo-bar',
    type: 'promo-bar',
    title: 'Countdown & Promo Bar',
    description: 'Urgency countdown timer, discount scarcity, and flash banner',
    icon: Flame,
    tag: 'Urgency',
    isPro: true,
  },
  {
    id: 'social-proof',
    type: 'social-proof',
    title: 'Social Proof & Reviews',
    description: 'Star ratings, verified buyer avatars, and testimonials',
    icon: MessageSquareQuote,
    tag: 'Trust',
    isPro: true,
  },
  {
    id: 'floating-cta',
    type: 'floating-cta',
    title: 'Floating CTA',
    description: 'Persistent sticky bottom bar auto-scrolling to checkout',
    icon: Smartphone,
    tag: 'Mobile CRO',
    isPro: true,
  },
  {
    id: 'video-showcase',
    type: 'features',
    title: 'Video Product Demo',
    description: 'High-converting embedded product video showcase section',
    icon: Video,
    tag: 'Video CRO',
    isPro: true,
  },
  {
    id: 'custom-html',
    type: 'trust-badges',
    title: 'Custom HTML / Pixel',
    description: 'Inject custom HTML widgets, tracking scripts, or urgency badges',
    icon: Code2,
    tag: 'Custom Code',
    isPro: true,
  },
];

interface Props {
  blocks: LandingPageBlock[];
  selectedBlockId: string | null;
  isPro?: boolean;
  onAddBlock: (type: BlockType) => void;
  onUpgradeClick?: (reason?: string) => void;
  onSelectBlock: (id: string) => void;
  onMoveBlock: (index: number, direction: 'up' | 'down') => void;
  onDuplicateBlock: (index: number) => void;
  onDeleteBlock: (index: number) => void;
  onCollapse?: () => void;
}

export const BlocksToolbar: React.FC<Props> = ({
  blocks,
  selectedBlockId,
  isPro = false,
  onAddBlock,
  onUpgradeClick,
  onSelectBlock,
  onMoveBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'add' | 'layers'>('add');

  const handleBlockItemClick = (item: BlockDefinition) => {
    if (item.isPro && !isPro) {
      if (onUpgradeClick) {
        onUpgradeClick(
          `قسم "${item.title}" متاح حصرياً في الباقات الاحترافية (Pro). قم بالترقية الآن لإضافته إلى صفحتك!`
        );
      }
      return;
    }
    onAddBlock(item.type);
  };

  return (
    <aside className="w-[280px] shrink-0 bg-white border-r border-gray-200 flex flex-col h-full min-h-0 select-none overflow-y-auto overflow-x-hidden">
      {/* Header Tabs */}
      <div className="flex items-center border-b border-gray-200 p-1.5 gap-1 bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
            activeTab === 'add'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200/80'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Add Sections</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
            activeTab === 'layers'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200/80'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Outline ({blocks.length})</span>
        </button>

        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="إخفاء القائمة الجانبية"
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200/60 transition cursor-pointer shrink-0"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tab 1: Add Sections */}
      {activeTab === 'add' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1 pt-1">
            Conversion Blocks
          </div>

          {AVAILABLE_BLOCKS.map((item) => {
            const Icon = item.icon;
            const isLocked = Boolean(item.isPro && !isPro);

            return (
              <div
                key={item.id}
                onClick={() => handleBlockItemClick(item)}
                className={`group p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3 ${
                  item.isPro
                    ? 'border-amber-200/90 bg-gradient-to-br from-white to-amber-50/30 hover:border-amber-400 hover:shadow-md'
                    : 'border-gray-200/90 bg-white hover:border-emerald-500/80 hover:bg-emerald-50/20 hover:shadow-md'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                    item.isPro
                      ? 'bg-amber-100/80 text-amber-700 group-hover:bg-amber-500 group-hover:text-white'
                      : 'bg-gray-100 group-hover:bg-emerald-100 text-gray-700 group-hover:text-emerald-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 group-hover:text-emerald-950 truncate">
                        {item.title}
                      </h4>
                      {item.isPro && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-900 text-amber-400 text-[9px] font-black tracking-wider shrink-0 border border-amber-400/40 shadow-xs">
                          <Crown className="w-3 h-3 text-amber-400" />
                          <span>PRO</span>
                        </span>
                      )}
                    </div>
                    {!item.isPro && (
                      <span className="text-[10px] font-bold bg-gray-100 group-hover:bg-emerald-100 text-gray-600 group-hover:text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                        {item.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">
                    {item.description}
                  </p>
                </div>

                <button
                  type="button"
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition shrink-0 mt-1 ${
                    isLocked
                      ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-slate-950'
                      : 'bg-gray-100 group-hover:bg-emerald-600 group-hover:text-white text-gray-400'
                  }`}
                  title={isLocked ? 'ميزة احترافية - ترقية الآن' : 'إضافة القسم'}
                >
                  {isLocked ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Tab 2: Layers & Outline */
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1 pt-1">
            Page Blocks Sequence
          </div>

          {blocks.map((block, index) => {
            const isSelected = selectedBlockId === block.id;
            const isProBlock = PRO_BLOCK_TYPES.includes(block.type);
            return (
              <div
                key={block.id}
                onClick={() => onSelectBlock(block.id)}
                className={`p-3 rounded-2xl border transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-500'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-mono font-bold text-gray-400 w-4">
                    {index + 1}.
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <h5 className="text-xs font-bold text-gray-900 truncate">
                        {block.type.replace('-', ' ').toUpperCase()}
                      </h5>
                      {isProBlock && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-slate-900 text-amber-400 text-[8px] font-black shrink-0">
                          <Crown className="w-2.5 h-2.5 text-amber-400" />
                          <span>PRO</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 truncate block">
                      {block.id}
                    </span>
                  </div>
                </div>

                {/* Layer item actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMoveBlock(index, 'up')}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-20"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={index === blocks.length - 1}
                    onClick={() => onMoveBlock(index, 'down')}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-20"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDuplicateBlock(index)}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500"
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteBlock(index)}
                    className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};
