'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ThemeToggle({ className = '', size = 'sm' }: ThemeToggleProps) {
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

  if (!mounted) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 opacity-60 ${
          size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
        } ${className}`}
      >
        <span className="w-3.5 h-3.5" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
      title={isDark ? 'Switch to Light mode (Ideal for crisp recording)' : 'Switch to Dark mode'}
      className={`inline-flex items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-all shadow-sm active:scale-95 cursor-pointer ${
        size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5 text-amber-400 animate-in spin-in-90 duration-200" />
      ) : (
        <Moon className="w-3.5 h-3.5 text-indigo-500 animate-in spin-in-90 duration-200" />
      )}
    </button>
  );
}

export default ThemeToggle;

