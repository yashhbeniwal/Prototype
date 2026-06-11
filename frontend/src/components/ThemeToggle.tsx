'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    // Check initial theme from HTML class
    if (document.documentElement.classList.contains('light')) {
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    if (theme === 'dark') {
      document.documentElement.classList.replace('dark', 'light');
      setTheme('light');
    } else {
      document.documentElement.classList.replace('light', 'dark');
      setTheme('dark');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-6 right-6 p-3 rounded-full glass hover-lift z-50 text-gray-400 hover:text-white transition-all shadow-lg flex items-center justify-center"
      style={{ background: 'var(--bg-card)' }}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-500" />}
    </button>
  );
}
