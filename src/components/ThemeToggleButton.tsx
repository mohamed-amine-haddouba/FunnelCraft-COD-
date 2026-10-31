import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface ThemeToggleButtonProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  className = '',
  size = 'md',
}) => {
  const { theme, toggleTheme } = useTheme();

  const buttonSizeClasses = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const iconSizeClasses = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'تبديل إلى الوضع النهاري (Light Mode)' : 'تبديل إلى الوضع الليلي (Dark Mode)'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`flex items-center justify-center rounded-lg bg-[#131B2A] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#334155] text-[#CBD5E1] hover:text-[#E25B26] transition-all duration-200 cursor-pointer shrink-0 shadow-xs ${buttonSizeClasses} ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className={`${iconSizeClasses} text-[#E25B26] transition-transform duration-300 hover:rotate-45`} />
      ) : (
        <Moon className={`${iconSizeClasses} text-[#F8FAFC] transition-transform duration-300 hover:-rotate-12`} />
      )}
    </button>
  );
};

export default ThemeToggleButton;
