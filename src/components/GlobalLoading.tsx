'use client';

import { useTheme } from '@/components/ThemeProvider';

interface GlobalLoadingProps {
  isOpen: boolean;
  text?: string;
}

// 白天模式加载图片路径
const DAY_LOADING_IMAGE = '/assets/day-loading.png';
// 夜间模式加载图片路径  
const NIGHT_LOADING_IMAGE = '/assets/night-loading.jpeg';

export default function GlobalLoading({ isOpen, text }: GlobalLoadingProps) {
  const { mode } = useTheme();
  
  if (!isOpen) return null;

  const loadingText = text || (mode === 'dark' ? '正在进入梦乡...' : '正在唤醒活力...');
  const loadingImage = mode === 'dark' ? NIGHT_LOADING_IMAGE : DAY_LOADING_IMAGE;

  return (
    <div className="fixed inset-0 bg-black/70 z-[9999]">
      {/* 顶部进度条 */}
      <div 
        className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-sky-500 to-blue-500" 
        style={{ animation: 'loadingLine 1.2s ease-in-out infinite', width: '30%' }} 
      />
      
      {/* 中心内容 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* 夜间模式星星装饰 */}
        {mode === 'dark' && (
          <div className="flex gap-2 mb-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full"
                style={{ 
                  backgroundColor: '#7dd3fc',
                  animation: `sparkle 1.5s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`
                }}
              />
            ))}
          </div>
        )}
        
        {/* 图片 + 文字 */}
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
          {/* 加载图片 */}
          <div 
            className="w-12 h-12 rounded-full overflow-hidden shadow-lg"
            style={{ animation: 'float 2s ease-in-out infinite' }}
          >
            <img 
              src={loadingImage}
              alt="Loading"
              className="w-full h-full object-cover"
              onError={(e) => {
                // 图片加载失败时显示渐变背景
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
          
          {/* 文字 */}
          <p className="text-gray-200 text-sm tracking-widest">
            {loadingText}
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes loadingLine {
          0% { left: -30%; }
          100% { left: 100%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
