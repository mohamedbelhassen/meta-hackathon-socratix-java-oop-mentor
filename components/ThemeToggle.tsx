'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', size = 'sm', showLabel = false }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    setIsDark(isCurrentlyDark);

    const handleThemeChange = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    window.addEventListener('socratix-theme-change', handleThemeChange);
    return () => window.removeEventListener('socratix-theme-change', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);

    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.style.colorScheme = 'dark';
      try {
        localStorage.setItem('socratix_theme', 'dark');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.style.colorScheme = 'light';
      try {
        localStorage.setItem('socratix_theme', 'light');
      } catch {}
    }

    window.dispatchEvent(new Event('socratix-theme-change'));
  };

  const buttonSizeClasses = showLabel
    ? size === 'sm'
      ? 'h-8 px-2.5 text-xs gap-1.5'
      : 'h-8 px-3 text-xs gap-2'
    : size === 'sm'
    ? 'w-8 h-8'
    : 'w-9 h-9';

  const currentIsDark = mounted ? isDark : true;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={currentIsDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={currentIsDark ? 'Passer en mode clair (Light mode)' : 'Passer en mode sombre (Dark mode)'}
      className={`inline-flex items-center justify-center rounded-lg border font-medium transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ${
        currentIsDark
          ? 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 hover:border-slate-600 text-amber-400 hover:text-amber-300'
          : 'bg-white hover:bg-[#f8fafc] border-[#cbd5e1] hover:border-[#94a3b8] text-[#334155] hover:text-[#0f172a]'
      } ${buttonSizeClasses} ${className}`}
    >
      {currentIsDark ? (
        <>
          <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />
          {showLabel && <span className="text-[11px] font-semibold text-slate-200">Clair</span>}
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-[#334155] fill-[#334155]/20 shrink-0" />
          {showLabel && <span className="text-[11px] font-semibold text-[#0f172a]">Sombre</span>}
        </>
      )}
    </button>
  );
}

export default ThemeToggle;
