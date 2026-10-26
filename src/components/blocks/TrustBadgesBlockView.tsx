import React from 'react';
import { TrustBadgesBlock, PageTheme } from '../../types/landingPage';
import { DynamicIcon } from '../DynamicIcon';

interface Props {
  block: TrustBadgesBlock;
  theme: PageTheme;
  isRtl?: boolean;
}

export const TrustBadgesBlockView: React.FC<Props> = ({ block, theme, isRtl }) => {
  return (
    <section className="max-w-5xl mx-auto px-4 py-10" dir={isRtl ? 'rtl' : 'ltr'}>
      {block.title && (
        <h3 className="text-center text-sm font-bold uppercase tracking-wider text-gray-500 mb-6">
          {block.title}
        </h3>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {block.badges.map((b, idx) => (
          <div
            key={idx}
            className="text-center p-5 rounded-2xl bg-white border border-gray-200/80 shadow-sm hover:shadow-md transition flex flex-col items-center justify-center space-y-2"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1 shadow-sm"
              style={{
                backgroundColor: `${theme.primaryColor || '#059669'}15`,
                color: theme.primaryColor || '#059669',
              }}
            >
              <DynamicIcon name={b.icon} className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-gray-900 leading-snug">{b.title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{b.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
