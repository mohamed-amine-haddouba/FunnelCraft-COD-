import React from 'react';
import { ProblemSolutionBlock, PageTheme } from '../../types/landingPage';
import { X, Check } from 'lucide-react';

interface Props {
  block: ProblemSolutionBlock;
  theme: PageTheme;
  isRtl?: boolean;
}

export const ProblemSolutionBlockView: React.FC<Props> = ({ block, theme, isRtl }) => {
  return (
    <section className="max-w-5xl mx-auto px-4 py-12 md:py-20" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="text-center max-w-2xl mx-auto mb-12">
        {block.highlightBadge && (
          <span className="inline-block px-3.5 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full mb-3 uppercase tracking-wider">
            {block.highlightBadge}
          </span>
        )}
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3 tracking-tight">
          {block.title}
        </h2>
        <p className="text-gray-600 text-sm md:text-base leading-relaxed">{block.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* The Problem / Before */}
        <div className="bg-red-50/80 border border-red-200/90 rounded-3xl p-6 md:p-8 space-y-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-red-200 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <X className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase text-red-500 tracking-wider">Before / Traditional</span>
              <h3 className="text-xl font-bold text-red-950">{block.problemTitle}</h3>
            </div>
          </div>
          <ul className="space-y-3.5 pt-1">
            {block.problemItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-red-900 leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-red-200 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                  <X className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* The Solution / After */}
        <div
          className="bg-emerald-50/80 border-2 rounded-3xl p-6 md:p-8 space-y-5 shadow-xl relative"
          style={{ borderColor: theme.primaryColor || '#059669' }}
        >
          <div
            className="absolute -top-3.5 end-6 text-white text-[11px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full shadow"
            style={{ backgroundColor: theme.primaryColor || '#059669' }}
          >
            Recommended Choice
          </div>
          <div className="flex items-center gap-3 border-b border-emerald-200 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase text-emerald-600 tracking-wider">After / Proven Result</span>
              <h3 className="text-xl font-bold text-emerald-950">{block.solutionTitle}</h3>
            </div>
          </div>
          <ul className="space-y-3.5 pt-1">
            {block.solutionItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-emerald-950 font-medium leading-relaxed">
                <div className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
