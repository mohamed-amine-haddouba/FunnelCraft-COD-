import React from 'react';
import { FloatingCtaBlock, PageTheme } from '../../types/landingPage';
import { ShoppingBag } from 'lucide-react';

interface Props {
  block: FloatingCtaBlock;
  theme: PageTheme;
  isRtl?: boolean;
  onCtaClick?: () => void;
}

export const FloatingCtaBlockView: React.FC<Props> = ({ block, theme, isRtl, onCtaClick }) => {
  return (
    <div
      className="fixed bottom-0 start-0 end-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 shadow-2xl transition"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-gray-900 truncate">{block.title}</h4>
          <div className="text-xs font-black text-emerald-600 mt-0.5">{block.priceText}</div>
        </div>

        <button
          type="button"
          onClick={onCtaClick}
          className="shrink-0 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
          style={{ backgroundColor: theme.primaryColor || '#059669' }}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{block.buttonText}</span>
        </button>
      </div>
    </div>
  );
};
