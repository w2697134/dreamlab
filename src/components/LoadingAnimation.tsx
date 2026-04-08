'use client';

import { useTheme } from '@/components/ThemeProvider';

interface LoadingAnimationProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export default function LoadingAnimation({ size = 'md', text = '加载中...' }: LoadingAnimationProps) {
  const { mode } = useTheme();

  const sizeMap = {
    sm: { container: 40, circle: 32, wave: 60 },
    md: { container: 60, circle: 48, wave: 80 },
    lg: { container: 80, circle: 64, wave: 100 },
  };

  const s = sizeMap[size];

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div 
        className="relative flex items-center"
        style={{ height: s.container }}
      >
        {/* 圆形人物头像 */}
        <div 
          className={`relative rounded-full overflow-hidden border-2 animate-bounce ${
            mode === 'dark' 
              ? 'border-purple-400 shadow-lg shadow-purple-500/30' 
              : 'border-sky-400 shadow-lg shadow-sky-500/30'
          }`}
          style={{ 
            width: s.circle, 
            height: s.circle,
            animationDuration: '0.6s',
            animationTimingFunction: 'ease-in-out'
          }}
        >
          {/* 人物简笔画 */}
          <svg 
            viewBox="0 0 100 100" 
            className="w-full h-full"
            fill="none"
          >
            {/* 头部 */}
            <circle 
              cx="50" 
              cy="35" 
              r="20" 
              className={mode === 'dark' ? 'fill-purple-300' : 'fill-sky-300'}
            />
            {/* 身体 */}
            <path 
              d="M50 55 L50 85 M30 70 L50 55 L70 70 M35 95 L50 85 L65 95" 
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={mode === 'dark' ? 'stroke-purple-400' : 'stroke-sky-400'}
            />
            {/* 眼睛 */}
            <circle cx="43" cy="32" r="3" className="fill-gray-800" />
            <circle cx="57" cy="32" r="3" className="fill-gray-800" />
            {/* 微笑 */}
            <path 
              d="M42 42 Q50 48 58 42" 
              strokeWidth="3"
              strokeLinecap="round"
              className={mode === 'dark' ? 'stroke-purple-500' : 'stroke-sky-500'}
            />
          </svg>
        </div>

        {/* 波浪轨迹 */}
        <div 
          className="absolute flex items-center gap-1"
          style={{ 
            left: s.circle - 10,
            width: s.wave,
            height: s.container
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`rounded-full animate-pulse ${
                mode === 'dark' 
                  ? 'bg-purple-400/60' 
                  : 'bg-sky-400/60'
              }`}
              style={{
                width: 6,
                height: 6,
                animationDelay: `${i * 0.15}s`,
                animationDuration: '0.8s',
                transform: `translateY(${Math.sin(i * 0.8) * 8}px)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* 文字 */}
      {text && (
        <span className={`text-sm font-medium animate-pulse ${
          mode === 'dark' ? 'text-white/70' : 'text-gray-600'
        }`}>
          {text}
        </span>
      )}
    </div>
  );
}
