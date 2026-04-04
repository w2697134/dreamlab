'use client';

import { ProgressBarPreview } from '@/components/ProgressBarVariants';
import { useTheme } from '@/components/ThemeProvider';

export default function ProgressPreviewPage() {
  const { mode, toggleMode } = useTheme();
  return (
    <div className={`min-h-screen p-8 ${mode === 'dark' ? 'bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900' : 'bg-gradient-to-br from-sky-50 via-purple-50 to-sky-50'}`}>
      <button
        onClick={toggleMode}
        className="fixed top-4 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl z-50 transition-all duration-300 shadow-lg"
        style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)' }}
      >
        {mode === 'light' ? '🌙' : '☀️'}
      </button>
      <div className="max-w-4xl mx-auto">
        <ProgressBarPreview />
      </div>
    </div>
  );
}
