import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../i18n/translations';

export const MockupPhone: React.FC = () => {
  const { dir } = useLanguage();

  return (
    <div
      dir={dir}
      className="w-[140px] sm:w-[152px] aspect-[9/19.5] rounded-3xl bg-[#131B2A] border-2 border-[#334155] shadow-2xl p-2.5 flex flex-col justify-between select-none"
    >
      {/* Top Speaker Notch */}
      <div className="w-10 h-1 rounded-full bg-[#334155] mx-auto mb-1.5 shrink-0" />

      {/* Top Product Image Area (No gradient backgrounds) */}
      <div className="relative h-24 rounded-t-xl bg-[#0D131E] border border-[#334155] shrink-0 overflow-hidden">
        <img
          src="/assets/brand/photo1.jpg"
          className="w-full h-full object-cover"
          alt="Product"
        />
      </div>

      {/* COD Form Fields Placeholder */}
      <div className="space-y-1.5 my-2 flex-1 flex flex-col justify-center">
        <div className="h-5 rounded-lg bg-[#0D131E] border border-[#1E293B] px-2 flex items-center">
          <div className="h-1.5 w-2/3 rounded bg-[#CBD5E1]/40" />
        </div>
        <div className="h-5 rounded-lg bg-[#0D131E] border border-[#1E293B] px-2 flex items-center">
          <div className="h-1.5 w-3/4 rounded bg-[#CBD5E1]/40" />
        </div>
        <div className="h-5 rounded-lg bg-[#0D131E] border border-[#1E293B] px-2 flex items-center">
          <div className="h-1.5 w-1/2 rounded bg-[#CBD5E1]/40" />
        </div>
      </div>

      {/* Bottom Solid Accent Submit Button */}
      <div className="space-y-1.5 shrink-0">
        <div className="h-7 w-full rounded-xl bg-[#E25B26] flex items-center justify-center gap-1 shadow-md">
          <ShieldCheck className="w-3 h-3 text-[#F8FAFC]" />
          <div className="h-1.5 w-12 rounded bg-[#F8FAFC]" />
        </div>
        <div className="w-10 h-1 rounded-full bg-[#334155] mx-auto" />
      </div>
    </div>
  );
};

export default MockupPhone;
