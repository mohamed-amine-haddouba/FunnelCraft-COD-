import React, { useState } from 'react';
import { FaqBlock, PageTheme } from '../../types/landingPage';
import { ChevronDown } from 'lucide-react';

interface Props {
  block: FaqBlock;
  theme: PageTheme;
  isRtl?: boolean;
}

export const FaqBlockView: React.FC<Props> = ({ block, theme, isRtl }) => {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({
    [block.items[0]?.id || '']: true,
  });

  const toggle = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="max-w-3xl mx-auto px-4 py-12 md:py-20" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2 tracking-tight">
          {block.title}
        </h2>
        <p className="text-gray-600 text-sm md:text-base">{block.subtitle}</p>
      </div>

      <div className="space-y-4">
        {block.items.map((item) => {
          const isOpen = !!openIds[item.id];
          return (
            <div
              key={item.id}
              className="bg-white border border-gray-200/90 rounded-2xl overflow-hidden shadow-sm transition hover:border-gray-300"
            >
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="w-full p-5 text-start font-bold text-gray-900 flex justify-between items-center transition bg-transparent hover:bg-gray-50/50 cursor-pointer"
              >
                <span className="text-sm md:text-base pe-4">{item.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 shrink-0 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  style={{ color: isOpen ? theme.primaryColor || '#059669' : undefined }}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-50">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
