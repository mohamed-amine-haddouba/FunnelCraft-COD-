import React from 'react';
import { SocialProofBlock, PageTheme } from '../../types/landingPage';
import { Star, CheckCircle, Quote } from 'lucide-react';

interface Props {
  block: SocialProofBlock;
  theme: PageTheme;
  isRtl?: boolean;
}

export const SocialProofBlockView: React.FC<Props> = ({ block, theme, isRtl }) => {
  return (
    <section className="max-w-6xl mx-auto px-4 py-12 md:py-20 bg-gray-50/60 rounded-3xl my-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="flex items-center justify-center gap-1.5 mb-3 text-amber-400">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2 tracking-tight">
          {block.title}
        </h2>
        <p className="text-gray-600 text-sm md:text-base">
          {block.subtitle} • <span className="font-bold text-gray-900">{block.overallRating || 4.9}</span> out of 5 based on <span className="font-bold text-gray-900">{block.totalReviews || 2400}+</span> verified orders
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {block.reviews.map((rev) => (
          <div
            key={rev.id}
            className="bg-white border border-gray-200/90 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex text-amber-400">
                  {[...Array(rev.rating || 5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-xs text-gray-400 font-medium">{rev.date}</span>
              </div>

              <p className="text-gray-700 text-sm leading-relaxed relative">
                <Quote className="w-4 h-4 text-gray-300 inline me-1 -mt-1" />
                {rev.comment}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              {rev.avatar ? (
                <img
                  src={rev.avatar}
                  alt={rev.name}
                  className="w-11 h-11 rounded-full object-cover border-2 border-emerald-400 shadow-sm"
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-full font-bold flex items-center justify-center text-sm shadow-sm"
                  style={{
                    backgroundColor: `${theme.primaryColor || '#059669'}20`,
                    color: theme.primaryColor || '#059669',
                  }}
                >
                  {rev.name.charAt(0)}
                </div>
              )}
              <div>
                <h4 className="font-bold text-sm text-gray-900 leading-tight">{rev.name}</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                  <span>{rev.city}</span>
                  {rev.verified && (
                    <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                      <CheckCircle className="w-3 h-3 fill-emerald-100" /> Verified Buyer
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
