import React, { useState, useEffect } from 'react';
import { PromoBarBlock } from '../../types/landingPage';
import { Flame, Clock } from 'lucide-react';

interface Props {
  block: PromoBarBlock;
  isRtl?: boolean;
}

export const PromoBarBlockView: React.FC<Props> = ({ block, isRtl }) => {
  const [secondsLeft, setSecondsLeft] = useState(block.countdownMinutes * 60);

  useEffect(() => {
    setSecondsLeft(block.countdownMinutes * 60);
  }, [block.countdownMinutes]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : block.countdownMinutes * 60));
    }, 1000);
    return () => clearInterval(timer);
  }, [block.countdownMinutes]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      className={`w-full py-2.5 px-4 text-xs md:text-sm font-semibold shadow-sm transition flex items-center justify-center flex-wrap gap-3 ${
        block.isSticky ? 'sticky top-0 z-30' : ''
      }`}
      style={{
        backgroundColor: block.bgColor || '#111827',
        color: block.textColor || '#ffffff',
      }}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center gap-1.5 font-bold">
        <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
        <span>{block.text}</span>
      </div>

      {block.showTimer && (
        <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full font-mono text-xs font-black tracking-widest border border-white/20">
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <span>{formattedTime}</span>
        </div>
      )}

      {block.stockWarning && (
        <span className="bg-red-500 text-white px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider animate-bounce">
          {block.stockWarning}
        </span>
      )}
    </div>
  );
};
