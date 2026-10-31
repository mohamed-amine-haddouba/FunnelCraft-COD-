import React from 'react';
import { TrendingUp, ShoppingBag, BarChart3, Layers, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../i18n/translations';

export const MockupLaptop: React.FC = () => {
  const { t, dir } = useLanguage();

  return (
    <div
      dir={dir}
      className="relative w-full aspect-[16/10] rounded-2xl bg-[#131B2A] border border-[#1E293B] shadow-2xl overflow-hidden flex flex-col select-none"
    >
      {/* Window Top Bar */}
      <div
        dir="ltr"
        className="h-8 px-4 bg-[#0D131E]/90 border-b border-[#1E293B] flex items-center justify-between shrink-0"
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5252]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#2CD36F]" />
        </div>
        <div className="h-3.5 w-36 rounded-full bg-[#1E293B] border border-[#334155]/60 flex items-center justify-center">
          <span className="w-16 h-1.5 rounded-full bg-[#94A3B8]/40" />
        </div>
        <div className="w-8 h-2 rounded-full bg-[#1E293B]" />
      </div>

      {/* Dashboard Body */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar (20% width) */}
        <div className="w-1/5 bg-[#0D131E]/60 border-e border-[#1E293B] p-3 flex flex-col justify-between shrink-0">
          <div className="space-y-2.5">
            <div className="h-6 rounded-lg bg-[#E25B26]/20 border border-[#E25B26]/40 flex items-center px-2 gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#E25B26] shrink-0" />
              <div className="h-2 w-full rounded bg-[#F8FAFC]/80" />
            </div>
            <div className="h-6 rounded-lg bg-[#1E293B]/70 flex items-center px-2 gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              <div className="h-1.5 w-4/5 rounded bg-[#94A3B8]/40" />
            </div>
            <div className="h-6 rounded-lg bg-[#1E293B]/50 flex items-center px-2 gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              <div className="h-1.5 w-3/4 rounded bg-[#94A3B8]/30" />
            </div>
            <div className="h-6 rounded-lg bg-[#1E293B]/40 flex items-center px-2 gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2CD36F] shrink-0" />
              <div className="h-1.5 w-2/3 rounded bg-[#94A3B8]/30" />
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#1E293B]/60 border border-[#334155]/40 space-y-1.5">
            <div className="h-1.5 w-3/4 rounded bg-[#CBD5E1]/40" />
            <div className="h-1.5 w-1/2 rounded bg-[#E25B26]/70" />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-4 flex flex-col justify-between gap-3 bg-[#131B2A]">
          {/* Top KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Prominent KPI Card */}
            <div className="col-span-2 rounded-xl bg-[#1E293B] border border-[#334155] p-3 flex items-center justify-between shadow-md">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-[#94A3B8]">
                  {t['home.hero.revenueCardLabel']}
                </div>
                <div className="text-base sm:text-lg font-black text-[#F8FAFC] tracking-tight">
                  {t['home.hero.revenueCardValue']}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#2CD36F]/15 border border-[#2CD36F]/30 flex items-center justify-center text-[#2CD36F] shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            {/* Secondary KPI Card */}
            <div className="rounded-xl bg-[#1E293B]/80 border border-[#334155]/60 p-3 flex flex-col justify-between">
              <div className="text-[10px] font-medium text-[#94A3B8] truncate">
                {t['home.hero.productCardLabel']}
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-[#E25B26]">
                {t['home.hero.productCardValue']}
              </div>
            </div>
          </div>

          {/* Middle Bar Chart Simulation Card */}
          <div className="flex-1 rounded-xl bg-[#1E293B]/70 border border-[#334155]/50 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E25B26]" />
                <div className="h-2 w-24 rounded bg-[#CBD5E1]/50" />
              </div>
              <div className="h-2 w-12 rounded bg-[#2CD36F]/50" />
            </div>

            <div className="flex items-end justify-between gap-2 h-20 pt-2 px-1">
              <div className="flex-1 bg-[#334155]/60 rounded-t-md h-[38%]" />
              <div className="flex-1 bg-[#334155]/80 rounded-t-md h-[52%]" />
              <div className="flex-1 bg-[#E25B26]/50 rounded-t-md h-[45%]" />
              <div className="flex-1 bg-[#E25B26]/70 rounded-t-md h-[68%]" />
              <div className="flex-1 bg-[#E25B26]/85 rounded-t-md h-[82%]" />
              <div className="flex-1 bg-[#2CD36F]/80 rounded-t-md h-[74%]" />
              <div className="flex-1 bg-[#E25B26] rounded-t-md h-full shadow-sm" />
            </div>
          </div>

          {/* Bottom Activity Strip */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-7 rounded-lg bg-[#1E293B]/60 border border-[#334155]/40 px-2.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2CD36F]" />
              <div className="h-1.5 w-full rounded bg-[#CBD5E1]/30" />
            </div>
            <div className="h-7 rounded-lg bg-[#1E293B]/60 border border-[#334155]/40 px-2.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E25B26]" />
              <div className="h-1.5 w-4/5 rounded bg-[#CBD5E1]/30" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockupLaptop;
