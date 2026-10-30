import React, { useState, useMemo } from 'react';
import { BlockType, LandingPageData } from '../types/landingPage';
import {
  Megaphone,
  Layout,
  Zap,
  Star,
  ShoppingCart,
  HelpCircle,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Layers,
  Sparkles,
  Check,
  GripVertical,
  Search,
  X,
} from 'lucide-react';
import {
  TEMPLATE_BEAUTY_EN,
  TEMPLATE_FRENCH_HEALTH,
  TEMPLATE_ARABIC_COD,
} from '../data/defaultTemplates';
import { LandingPageBlock } from '../types/landingPage';

interface Props {
  onAddBlock: (type: BlockType) => void;
  currentPageData?: LandingPageData;
  onSelectTemplate?: (data: LandingPageData) => void;
  blocks?: LandingPageBlock[];
  selectedBlockId?: string | null;
  isPro?: boolean;
  onUpgradeClick?: (reason?: string) => void;
  onSelectBlock?: (id: string | null) => void;
  onMoveBlock?: (index: number, direction: 'up' | 'down') => void;
  onDuplicateBlock?: (index: number) => void;
  onDeleteBlock?: (index: number) => void;
  onCollapse?: () => void;
}

export const PRO_BLOCK_TYPES: BlockType[] = ['floating-cta', 'trust-badges', 'social-proof'];

type BlockCategoryTab = 'All' | 'Basic' | 'Media' | 'E-commerce (COD)' | 'Social Proof';

interface BlockCatalogItem {
  type: BlockType;
  label: string;
  labelEn: string;
  desc: string;
  category: Exclude<BlockCategoryTab, 'All'>;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const BLOCK_CATALOG: BlockCatalogItem[] = [
  {
    type: 'hero',
    label: 'واجهة المنتج (Hero)',
    labelEn: 'Hero Gallery & Offer',
    desc: 'معرض صور متعدد، عنوان، وصف كامل، مواصفات وزر شراء',
    category: 'Media',
    icon: Layout,
    accent: 'text-indigo-600 bg-indigo-50 border-indigo-200/70',
  },
  {
    type: 'cod-form',
    label: 'استمارة الدفع عند الاستلام',
    labelEn: 'COD Checkout Form',
    desc: 'نموذج طلب سريع مع قوائم الدول والمدن المتسلسلة والعروض',
    category: 'E-commerce (COD)',
    icon: ShoppingCart,
    accent: 'text-emerald-600 bg-emerald-50 border-emerald-200/70',
  },
  {
    type: 'promo-bar',
    label: 'شريط العروض العلوي',
    labelEn: 'Promo Countdown Bar',
    desc: 'شريط تنبيه علوي مع عداد تنازلي وتنبيه المخزون',
    category: 'E-commerce (COD)',
    icon: Megaphone,
    accent: 'text-rose-600 bg-rose-50 border-rose-200/70',
  },
  {
    type: 'floating-cta',
    label: 'زر الشراء العائم (موبايل)',
    labelEn: 'Sticky Mobile CTA',
    desc: 'شريط سفلي ثابت على الهاتف لزيادة نسبة التحويل',
    category: 'E-commerce (COD)',
    icon: Smartphone,
    accent: 'text-purple-600 bg-purple-50 border-purple-200/70',
  },
  {
    type: 'features',
    label: 'شبكة المميزات والمواصفات',
    labelEn: 'Features & Specs Grid',
    desc: 'بطاقات أنيقة لعرض فوائد المنتج والمواصفات التقنية',
    category: 'Basic',
    icon: Zap,
    accent: 'text-teal-600 bg-teal-50 border-teal-200/70',
  },
  {
    type: 'problem-solution',
    label: 'المشكلة والحل (مقارنة)',
    labelEn: 'Problem vs Solution',
    desc: 'مقارنة بصرية بين الطرق التقليدية والحل الذي يقدمه منتجك',
    category: 'Basic',
    icon: AlertTriangle,
    accent: 'text-amber-600 bg-amber-50 border-amber-200/70',
  },
  {
    type: 'faq',
    label: 'الأسئلة الشائعة (FAQ)',
    labelEn: 'FAQ Accordion',
    desc: 'أجب عن استفسارات الشحن والضمان والمعاينة قبل الدفع',
    category: 'Basic',
    icon: HelpCircle,
    accent: 'text-blue-600 bg-blue-50 border-blue-200/70',
  },
  {
    type: 'social-proof',
    label: 'تقييمات وآراء المشترين',
    labelEn: 'Customer Reviews',
    desc: 'مراجعات وتجارب العملاء الموثقة بالنجوم والمدن',
    category: 'Social Proof',
    icon: Star,
    accent: 'text-yellow-600 bg-yellow-50 border-yellow-200/70',
  },
  {
    type: 'trust-badges',
    label: 'شارات الثقة والضمان',
    labelEn: 'Trust & COD Badges',
    desc: 'رموز الشحن المجاني، الدفع عند الاستلام، وضمان الاستبدال',
    category: 'Social Proof',
    icon: ShieldCheck,
    accent: 'text-cyan-600 bg-cyan-50 border-cyan-200/70',
  },
];

const CATEGORY_TABS: Array<{ id: BlockCategoryTab; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'Basic', label: 'Basic' },
  { id: 'Media', label: 'Media' },
  { id: 'E-commerce (COD)', label: 'E-commerce (COD)' },
  { id: 'Social Proof', label: 'Social Proof' },
];

const READY_TEMPLATES: {
  id: string;
  name: string;
  category: string;
  langBadge: string;
  accent: string;
  previewImage: string;
  data: LandingPageData;
}[] = [
  {
    id: TEMPLATE_ARABIC_COD.id,
    name: TEMPLATE_ARABIC_COD.title,
    category: 'عناية وتجميل • الدفع عند الاستلام',
    langBadge: '🇲🇦 عربي (RTL)',
    accent: 'from-emerald-600 to-teal-700',
    previewImage:
      'https://images.unsplash.com/photo-1608248597359-0e6d526a682b?auto=format&fit=crop&w=400&q=80',
    data: TEMPLATE_ARABIC_COD,
  },
  {
    id: TEMPLATE_FRENCH_HEALTH.id,
    name: TEMPLATE_FRENCH_HEALTH.title,
    category: 'الصحة والعناية الجسدية',
    langBadge: '🇫🇷 Français',
    accent: 'from-sky-600 to-indigo-700',
    previewImage:
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=400&q=80',
    data: TEMPLATE_FRENCH_HEALTH,
  },
  {
    id: TEMPLATE_BEAUTY_EN.id,
    name: TEMPLATE_BEAUTY_EN.title,
    category: 'أجهزة ذكية وعناية بالبشرة',
    langBadge: '🇬🇧 English',
    accent: 'from-rose-600 to-pink-700',
    previewImage:
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=400&q=80',
    data: TEMPLATE_BEAUTY_EN,
  },
];

export const BlocksToolbar: React.FC<Props> = ({
  onAddBlock,
  currentPageData,
  onSelectTemplate,
}) => {
  const [activeTab, setActiveTab] = useState<'blocks' | 'templates'>('blocks');
  const [selectedCategory, setSelectedCategory] = useState<BlockCategoryTab>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBlocks = useMemo(() => {
    return BLOCK_CATALOG.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        item.label.toLowerCase().includes(q) ||
        item.labelEn.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery]);

  return (
    <aside
      dir="rtl"
      className="w-80 bg-white border-l border-slate-200/90 flex flex-col h-[calc(100vh-3.5rem)] sticky top-14 select-none shrink-0 shadow-xs"
    >
      {/* Top Switcher Tabs (Blocks vs Ready Templates) */}
      <div className="p-2.5 border-b border-slate-200 bg-slate-50/80 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('blocks')}
          className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'blocks'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>الأقسام (Blocks)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'templates'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>قوالب جاهزة ({READY_TEMPLATES.length})</span>
        </button>
      </div>

      {activeTab === 'blocks' ? (
        <>
          {/* Search Input & Category Filter Tabs */}
          <div className="p-3 border-b border-slate-100 space-y-2.5 bg-white">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن قسم (Hero, COD, FAQ...)"
                aria-label="Search blocks"
                className="w-full pr-8 pl-7 py-2 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none text-xs font-medium text-slate-800 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Tabs ("Basic", "Media", "E-commerce (COD)", "Social Proof") */}
            <div className="flex flex-wrap gap-1" dir="ltr">
              {CATEGORY_TABS.map((tab) => {
                const isActive = selectedCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Draggable Block Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredBlocks.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                لا توجد أقسام مطابقة لبحثك "{searchQuery}"
              </div>
            ) : (
              filteredBlocks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-funnelcraft-block', item.type);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onAddBlock(item.type)}
                    className="w-full text-right p-3 rounded-xl border border-slate-200/90 hover:border-blue-500/80 hover:bg-blue-50/20 transition-all group flex items-start gap-2.5 cursor-grab active:cursor-grabbing bg-white shadow-2xs hover:shadow-md"
                  >
                    {/* Minimalist Drag Handle */}
                    <div
                      className="mt-1.5 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 flex flex-col items-center"
                      title="Drag onto canvas"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Minimalist Block Icon */}
                    <div
                      className={`p-2 rounded-lg border shrink-0 transition-transform group-hover:scale-105 ${item.accent}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Labels & Category Tag */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-extrabold text-slate-800 group-hover:text-blue-700 truncate">
                          {item.label}
                        </span>
                        <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400 truncate" dir="ltr">
                        {item.labelEn} • {item.category}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-1 line-clamp-2">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 text-center font-medium">
            💡 اسحب أي قسم وأفلته داخل مساحة العمل أو اضغط لإضافته
          </div>
        </>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              قوالب احترافية عالية التحويل
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              اختر قالباً جاهزاً وعدّل نصوصه وصوره بحرية
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {READY_TEMPLATES.map((tpl) => {
              const isSelected = currentPageData?.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => onSelectTemplate?.(tpl.data)}
                  className={`group rounded-2xl border overflow-hidden transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20'
                      : 'border-slate-200 hover:border-blue-400 bg-white hover:shadow-md'
                  }`}
                >
                  <div className="relative h-24 w-full overflow-hidden bg-slate-900">
                    <img
                      src={tpl.previewImage}
                      alt={tpl.name}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                    />
                    <div
                      className={`absolute inset-0 bg-gradient-to-t ${tpl.accent} opacity-60`}
                    />
                    <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {tpl.langBadge}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                        <Check className="w-3 h-3" /> مفعل حالياً
                      </span>
                    )}
                    <div className="absolute bottom-2 right-3 left-3 text-white">
                      <div className="text-xs font-black truncate drop-shadow">{tpl.name}</div>
                    </div>
                  </div>
                  <div className="p-2.5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium truncate">{tpl.category}</span>
                    <span className="text-blue-600 font-extrabold group-hover:underline shrink-0">
                      استخدام القالب ←
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
};
