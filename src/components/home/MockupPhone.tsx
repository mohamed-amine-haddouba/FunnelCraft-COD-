import React from 'react';
import { ShoppingBag, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../i18n/translations';

export const MockupPhone: React.FC = () => {
  const { t, dir } = useLanguage();

  return (
    <div
      dir={dir}
      className="w-[140px] sm:w-[152px] aspect-[9/19.5] rounded-3xl bg-[#131B2A] border-2 border-[#334155] shadow-2xl p-2.5 flex flex-col justify-between select-none"
    >
      {/* Top Speaker Notch */}
      <div className="w-10 h-1 rounded-full bg-[#334155] mx-auto mb-1.5 shrink-0" />

      {/* Product Image Placeholder */}
      <div className="relative h-20 rounded-xl bg-gradient-to-br from-[#E25B26]/30 via-[#1E293B] to-[#0D131E] border border-[#334155]/70 flex flex-col items-center justify-center p-2 shrink-0 overflow-hidden">
        <div className="w-8 h-8 rounded-xl bg-[#E25B26]/20 border border-[#E25B26]/40 flex items-center justify-center text-[#E25B26] mb-1">
          <ShoppingBag className="w-4 h-4" />
        </div>
        <div className="text-[10px] font-black text-[#F8FAFC] truncate max-w-full">
          {t['home.hero.productCardValue']}
        </div>
      </div>

      {/* COD Form Fields Placeholder */}
      <div className="space-y-1.5 my-2 flex-1 flex flex-col justify-center">
        <div className="h-5 rounded-lg bg-[#0F172A] border border-[#1E293B] px-2 flex items-center">
          <div className="h-1.5 w-2/3 rounded bg-[#94A3B8]/40" />
        </div>
        <div className="h-5 rounded-lg bg-[#0F172A] border border-[#1E293B] px-2 flex items-center">
          <div className="h-1.5 w-3/4 rounded bg-[#94A3B8]/40" />
        </div>
        <div className="h-5 rounded-lg bg-[#0F172A] border border-[#1E293B] px-2 flex items-center">
          <div className="h-1.5 w-1/2 rounded bg-[#94A3B8]/40" />
        </div>
      </div>

      {/* Bottom Solid Accent Submit Button */}
      <div className="space-y-1.5 shrink-0">
        <div className="h-7 w-full rounded-xl bg-[#E25B26] flex items-center justify-center gap-1 shadow-md">
          <ShieldCheck className="w-3 h-3 text-[#F8FAFC]" />
          <div className="h-1.5 w-12 rounded bg-[#F8FAFC]" />
        </div>
        <div className="w-10 h-1 rounded-full bg-[#334155]/80 mx-auto" />
      </div>
    </div>
  );
};

export default MockupPhone;
