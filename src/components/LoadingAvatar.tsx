'use client';

import { useTheme } from '@/components/ThemeProvider';

interface LoadingAvatarProps {
  size?: number;
  className?: string;
}

export default function LoadingAvatar({ size = 48, className = '' }: LoadingAvatarProps) {
  const { mode } = useTheme();

  return (
    <div 
      className={`rounded-full overflow-hidden shadow-lg relative ${className}`}
      style={{ 
        width: size, 
        height: size,
        animation: 'float 2s ease-in-out infinite'
      }}
    >
      {mode === 'light' ? (
        // 白天模式：温暖的日出渐变效果
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-300 via-orange-300 to-yellow-400" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-white/10" />
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-200/40 via-transparent to-orange-300/40" />
          {/* 中心光晕 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-2/3 rounded-full bg-gradient-to-br from-white via-amber-100 to-orange-200 blur-sm opacity-80" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 rounded-full bg-gradient-to-br from-yellow-100 via-white to-amber-100" />
        </>
      ) : (
        // 夜间模式：梦幻蓝紫色渐变效果
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-200 via-sky-200 to-blue-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-white/20" />
          <div className="absolute inset-0 bg-gradient-to-br from-sky-300/30 via-transparent to-blue-300/30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-white via-blue-100 to-sky-100 blur-sm" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/4 h-1/4 rounded-full bg-gradient-to-br from-yellow-100 via-white to-blue-100" />
        </>
      )}
    </div>
  );
}
