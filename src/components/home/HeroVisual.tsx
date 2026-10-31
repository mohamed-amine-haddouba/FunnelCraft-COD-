import React from 'react';
import { TrendingUp, Tag } from 'lucide-react';
import { useLanguage } from '../../i18n/translations';
import { MockupLaptop } from './MockupLaptop';
import { MockupPhone } from './MockupPhone';

export const HeroVisual: React.FC = () => {
  const { t, dir } = useLanguage();

  return (
    <div dir={dir} className="relative w-full py-6 sm:py-8">
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

      {/* Radial Background Glow behind Laptop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 rounded-full bg-gradient-to-br from-[#E25B26]/20 to-transparent blur-3xl"
      />

      {/* Primary Laptop Mockup */}
      <div className="relative z-10">
        <MockupLaptop />
      </div>

      {/* Overlapping Mobile Phone Mockup (-bottom-8 -start-4 sm:-start-8) */}
      <div className="absolute -bottom-6 start-2 sm:-bottom-8 sm:-start-6 z-20 scale-90 sm:scale-100 origin-bottom">
        <MockupPhone />
      </div>

      {/* Floating Card 1 (Top-End of Laptop): Daily Orders / 12,450 MAD */}
      <div className="codworth-float-slow absolute -top-4 end-2 sm:-top-5 sm:-end-4 z-30 bg-[#1E293B] border border-[#334155] rounded-xl p-3 shadow-xl flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#2CD36F]/15 border border-[#2CD36F]/30 flex items-center justify-center text-[#2CD36F] shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-[#CBD5E1] leading-tight">
            {t['home.hero.revenueCardLabel']}
          </div>
          <div className="text-xs sm:text-sm font-black text-[#F8FAFC] leading-tight mt-0.5">
            {t['home.hero.revenueCardValue']}
          </div>
        </div>
      </div>

      {/* Floating Card 2 (Bottom-Center / End): Current Offer / 249 MAD */}
      <div className="codworth-float-delayed absolute -bottom-5 end-4 sm:-bottom-6 sm:end-10 z-30 bg-[#1E293B] border border-[#334155] rounded-xl p-3 shadow-xl flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#E25B26]/15 border border-[#E25B26]/30 flex items-center justify-center text-[#E25B26] shrink-0">
          <Tag className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-[#CBD5E1] leading-tight">
            {t['home.hero.productCardLabel']}
          </div>
          <div className="text-xs sm:text-sm font-black text-[#F8FAFC] leading-tight mt-0.5">
            {t['home.hero.productCardValue']}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroVisual;
