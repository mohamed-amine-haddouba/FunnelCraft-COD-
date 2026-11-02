import React from 'react';
import { TrendingUp, Tag } from 'lucide-react';
import { useLanguage } from '../../i18n/translations';
import { MockupLaptop } from './MockupLaptop';
import { MockupPhone } from './MockupPhone';

export const HeroVisual: React.FC = () => {
  const { t, dir } = useLanguage();

  return (
    <div dir={dir} className="relative w-full max-w-full py-6 sm:py-8 overflow-hidden lg:overflow-visible">
      {/* Inline Keyframe Animation for Subtle Floating Cards */}
      <style>{`
        @keyframes codworthFloat {
          0%, 100% { transform: translateY(-5px); }
          50% { transform: translateY(5px); }
        }
        .codworth-float-slow {
          animation: codworthFloat 3s ease-in-out infinite;
        }
        .codworth-float-delayed {
          animation: codworthFloat 3s ease-in-out 1.5s infinite;
        }
      `}</style>

      {/* Primary Laptop Mockup */}
      <div className="relative z-10 max-w-full h-auto">
        <MockupLaptop />
      </div>

      {/* Overlapping Mobile Phone Mockup */}
      <div className="absolute -bottom-4 start-1 lg:-bottom-8 lg:-start-6 z-20 scale-75 sm:scale-90 lg:scale-100 origin-bottom-left rtl:origin-bottom-right">
        <MockupPhone />
      </div>

      {/* Floating Card 1 (Top-End of Laptop): Daily Orders / 12,450 MAD */}
      <div className="codworth-float-slow absolute top-1 end-1 lg:-top-5 lg:-end-4 z-30 bg-brand-surface border border-brand rounded-xl p-2 sm:p-3 shadow-xl flex items-center gap-2 sm:gap-2.5 max-w-[180px] sm:max-w-none">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-brand-accent shrink-0">
          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] font-medium text-brand-secondary leading-tight truncate">
            {t['home.hero.revenueCardLabel']}
          </div>
          <div className="text-xs sm:text-sm font-black text-brand-primary leading-tight mt-0.5 truncate">
            {t['home.hero.revenueCardValue']}
          </div>
        </div>
      </div>

      {/* Floating Card 2 (Bottom-Center / End): Current Offer / 249 MAD */}
      <div className="codworth-float-delayed absolute bottom-1 end-2 lg:-bottom-6 lg:end-10 z-30 bg-brand-surface border border-brand rounded-xl p-2 sm:p-3 shadow-xl flex items-center gap-2 sm:gap-2.5 max-w-[180px] sm:max-w-none">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-brand-accent shrink-0">
          <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] sm:text-[11px] font-medium text-brand-secondary leading-tight truncate">
            {t['home.hero.productCardLabel']}
          </div>
          <div className="text-xs sm:text-sm font-black text-brand-primary leading-tight mt-0.5 truncate">
            {t['home.hero.productCardValue']}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroVisual;
