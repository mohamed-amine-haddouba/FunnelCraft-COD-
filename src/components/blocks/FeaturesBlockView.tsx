import React from 'react';
import { FeaturesBlock, PageTheme } from '../../types/landingPage';
import { DynamicIcon } from '../DynamicIcon';

interface Props {
  block: FeaturesBlock;
  theme: PageTheme;
  isRtl?: boolean;
}

export const FeaturesBlockView: React.FC<Props> = ({ block, theme, isRtl }) => {
  const gridClass =
    block.layout === 'grid-3'
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  return (
    <section className="max-w-6xl mx-auto px-4 py-12 md:py-20" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3 tracking-tight">
          {block.title}
        </h2>
        <p className="text-gray-600 text-sm md:text-base leading-relaxed">{block.subtitle}</p>
      </div>

      <div className={`grid ${gridClass} gap-6`}>
        {block.items.map((item, idx) => (
          <div
            key={idx}
            className="p-6 rounded-3xl bg-white border border-gray-200/90 shadow-sm hover:shadow-xl hover:border-emerald-500/50 transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold mb-4 transition duration-300 group-hover:scale-110"
                style={{
                  backgroundColor: `${theme.primaryColor || '#059669'}15`,
                  color: theme.primaryColor || '#059669',
                }}
              >
                <DynamicIcon name={item.icon} className="w-6 h-6" />
              </div>

              {item.badge && (
                <span
                  className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider mb-2"
                  style={{
                    backgroundColor: `${theme.primaryColor || '#059669'}20`,
                    color: theme.primaryColor || '#059669',
                  }}
                >
                  {item.badge}
                </span>
              )}

              <h3 className="font-bold text-lg text-gray-900 mb-2 leading-snug">{item.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
