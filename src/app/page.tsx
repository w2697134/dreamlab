'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import dynamic from 'next/dynamic';
import StarBackground from '@/components/StarBackground';
import GlobalLoading from '@/components/GlobalLoading';

// 首页组件

export default function Home() {
  const router = useRouter();
  const { mode, toggleMode } = useTheme();
  const { isDeveloper } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);



  const navigateToDream = () => {
    if (isLoading) return;
    setIsLoading(true);
    // 跳转到左侧栏的梦境生成页面
    router.push('/dream');
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f0a1e] via-[#1a1030] to-[#2d1f4e] flex flex-col items-center justify-center relative overflow-hidden">
        {/* 背景星星效果 */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.3,
                animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* 中心月亮动画 */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sky-300 via-blue-400 to-blue-500 shadow-2xl shadow-blue-500/30 animate-pulse" />
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-br from-sky-300 via-blue-400 to-blue-500 animate-spin" style={{ animationDuration: '8s' }}>
            <div className="absolute inset-2 rounded-full bg-gradient-to-b from-[#0f0a1e] via-[#1a1030] to-[#2d1f4e]" />
          </div>
          {/* 月亮光晕 */}
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-blue-500/20 via-sky-500/20 to-blue-500/20 blur-xl animate-pulse" />
        </div>

        {/* 加载文字 */}
        <div className="text-center">
          <h2 className="text-2xl font-light text-white/90 tracking-widest mb-2">
            忆梦空间
          </h2>
          <div className="flex items-center justify-center gap-1">
            <span className="text-sky-300/80 animate-pulse" style={{ animationDelay: '0s' }}>梦</span>
            <span className="text-sky-300/80 animate-pulse" style={{ animationDelay: '0.2s' }}>境</span>
            <span className="text-sky-300/80 animate-pulse" style={{ animationDelay: '0.4s' }}>加</span>
            <span className="text-sky-300/80 animate-pulse" style={{ animationDelay: '0.6s' }}>载</span>
            <span className="text-sky-300/80 animate-pulse" style={{ animationDelay: '0.8s' }}>中</span>
            <span className="text-sky-300/80 animate-pulse" style={{ animationDelay: '1s' }}>.</span>
            <span className="text-sky-300/80 animate-pulse" style={{ animationDelay: '1.2s' }}>.</span>
            <span className="text-sky-300/80 animate-pulse" style={{ animationDelay: '1.4s' }}>.</span>
          </div>
        </div>

        {/* 底部波浪 */}
        <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
          <svg className="absolute bottom-0 w-full" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path
              d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,90 1440,60 L1440,120 L0,120 Z"
              fill="url(#loadingWaveGradient)"
              className="animate-pulse"
              style={{ animationDuration: '3s' }}
            />
            <defs>
              <linearGradient id="loadingWaveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* CSS 动画 */}
        <style jsx>{`
          @keyframes twinkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen flex flex-col items-center justify-between relative overflow-hidden transition-colors duration-500 ${
        mode === 'dark' 
          ? 'bg-gradient-to-b from-[#0f0a1e] via-[#1a1030] to-[#2d1f4e]' 
          : 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd]'
      }`}
      style={{ backgroundColor: mode === 'dark' ? '#020617' : '#f0f9ff' }}
    >
      {/* 模式切换 */}
      <button
        onClick={toggleMode}
        className="fixed top-4 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl z-50 transition-all duration-300 shadow-lg"
        style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)' }}
      >
        {mode === 'light' ? '🌙' : '☀️'}
      </button>

      {/* 加载遮罩 */}
      <GlobalLoading isOpen={isLoading} />

      {/* 背景效果 */}
      <div className={`absolute top-20 left-10 w-64 h-64 rounded-full blur-[100px] ${mode === 'dark' ? 'bg-blue-500/10' : 'bg-sky-200/30'}`} />
      <div className={`absolute top-40 right-20 w-72 h-72 rounded-full blur-[120px] ${mode === 'dark' ? 'bg-blue-500/8' : 'bg-blue-200/25'}`} />
      <div className={`absolute bottom-40 left-20 w-56 h-56 rounded-full blur-[100px] ${mode === 'dark' ? 'bg-pink-500/8' : 'bg-cyan-200/20'}`} />

      {/* 星空背景 */}
      <StarBackground />

      {/* 主内容 */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
        <h1 className={`text-4xl md:text-5xl font-extralight mb-4 tracking-widest text-center ${mode === 'dark' ? 'text-white/90' : 'text-gray-700'}`}>
          忆梦空间
        </h1>
        <p className={`text-lg md:text-xl mb-20 text-center max-w-lg ${mode === 'dark' ? 'text-sky-200/70' : 'text-gray-500'}`}>
          记录你的梦境碎片
          <br />
          让 AI 为你描绘那些模糊的记忆
        </p>

        {/* 进入按钮 */}
        <button
          onClick={navigateToDream}
          disabled={isLoading}
          className={`relative group transition-all duration-500 ease-out ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
        >
          <div className={`absolute inset-0 scale-150 blur-2xl transition-all duration-500 group-hover:scale-[1.8] ${mode === 'dark' ? 'bg-purple-400/10' : 'bg-purple-300/20'}`} />
          {mode === 'light' && (
            <svg
              width="280"
              height="160"
              viewBox="0 0 280 160"
              className="relative drop-shadow-xl cloud-day"
            >
              <defs>
                <linearGradient id="cloudGradWhite" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#f8f8ff" />
                  <stop offset="100%" stopColor="#f0f0ff" />
                </linearGradient>
                <linearGradient id="cloudGradPurple" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e8e4f3" />
                  <stop offset="50%" stopColor="#f0e8f5" />
                  <stop offset="100%" stopColor="#f5f0f8" />
                </linearGradient>
              </defs>
              <path
                d="M60,120 Q25,120 25,90 Q25,60 55,60 Q55,30 95,30 Q110,5 145,5 Q180,5 195,30 Q230,20 255,50 Q280,50 280,80 Q280,120 245,120 Z"
                fill="url(#cloudGradWhite)"
                className="cloud-white-path"
              />
              <path
                d="M60,120 Q25,120 25,90 Q25,60 55,60 Q55,30 95,30 Q110,5 145,5 Q180,5 195,30 Q230,20 255,50 Q280,50 280,80 Q280,120 245,120 Z"
                fill="url(#cloudGradPurple)"
                className="cloud-purple-path"
              />
            </svg>
          )}
          {mode === 'dark' && (
            <svg
              width="280"
              height="160"
              viewBox="0 0 280 160"
              className="relative drop-shadow-xl"
              style={{ animation: 'cloudFade 8s ease-in-out infinite' }}
            >
              <defs>
                <linearGradient id="cloudGradDark" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(200,180,255,0.7)" />
                  <stop offset="50%" stopColor="rgba(180,160,240,0.6)" />
                  <stop offset="100%" stopColor="rgba(147,197,253,0.6)" />
                </linearGradient>
              </defs>
              <path
                d="M60,120 Q25,120 25,90 Q25,60 55,60 Q55,30 95,30 Q110,5 145,5 Q180,5 195,30 Q230,20 255,50 Q280,50 280,80 Q280,120 245,120 Z"
                fill="url(#cloudGradDark)"
              />
            </svg>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-medium tracking-[0.4em] ${mode === 'dark' ? 'text-white drop-shadow-lg' : 'text-gray-700 drop-shadow-md'}`} style={{ 
              textShadow: mode === 'dark' 
                ? '0 0 20px rgba(167, 139, 250, 0.5), 0 0 40px rgba(167, 139, 250, 0.3)' 
                : '0 2px 10px rgba(147, 197, 253, 0.3)'
            }}>
              进入梦境
            </span>
          </div>
        </button>

        <p className={`mt-12 text-sm tracking-wide ${mode === 'dark' ? 'text-purple-300/50' : 'text-gray-400'}`}>
          点击云朵，开启你的梦境之旅
        </p>
      </div>

      {/* 云朵颜色忽深忽浅动画 + 炫酷星星闪烁动画 */}
      <style jsx global>{`
        @keyframes cloudFade {
          0%, 100% { 
            filter: brightness(0.7); 
            transform: scale(1); 
          }
          50% { 
            filter: brightness(1.3); 
            transform: scale(1.08); 
          }
        }
        .cloud-day {
          animation: cloudDayScale 8s ease-in-out infinite;
        }
        .cloud-white-path {
          animation: cloudWhiteToPurple 8s ease-in-out infinite;
        }
        .cloud-purple-path {
          animation: cloudPurpleShow 8s ease-in-out infinite;
        }
        @keyframes cloudDayScale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes cloudWhiteToPurple {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes cloudPurpleShow {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes sparkle {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
          }
          50% {
            transform: scale(1.5);
            opacity: 1;
            box-shadow: 
              0 0 20px rgba(255, 255, 255, 0.8),
              0 0 40px rgba(135, 206, 250, 0.4),
              0 0 60px rgba(255, 255, 255, 0.2);
          }
        }
      `}</style>
    </div>
  );
}
