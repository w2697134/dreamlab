'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

interface BackToHomeButtonProps {
  className?: string;
}

export default function BackToHomeButton({ className = '' }: BackToHomeButtonProps) {
  const router = useRouter();
  const { mode } = useTheme();

  return (
    <button
      onClick={() => router.push('/')}
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        px-6 py-3 rounded-full
        flex items-center gap-2
        font-medium text-sm
        shadow-lg shadow-black/30
        border-2 border-white/30
        opacity-100 !opacity-100
        transition-all duration-300
        hover:scale-105 active:scale-95
        ${mode === 'dark'
          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
          : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400'
        }
        ${className}
      `}
      style={{ opacity: 1 }}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
      返回首页
    </button>
  );
}
