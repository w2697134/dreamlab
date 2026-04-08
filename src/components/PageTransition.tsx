'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useNavigation } from '@/components/NavigationProvider';
import { useTheme } from '@/components/ThemeProvider';

// 白天模式加载图片路径
const DAY_LOADING_IMAGE = '/assets/day-loading.png';
// 夜间模式加载图片路径  
const NIGHT_LOADING_IMAGE = '/assets/night-loading.jpeg';

/**
 * 页面跳转加载动画组件
 * 
 * 与左侧栏导航状态同步：
 * - 当用户点击左侧栏菜单时，NavigationProvider 的 isNavigating 变为 true
 * - 本组件监听 isNavigating，显示全屏加载动画
 * - 路由变化后自动结束
 */
export default function PageTransition() {
  const pathname = usePathname();
  const { isNavigating, endNavigation } = useNavigation();
  const { mode } = useTheme();
  
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const progressRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevPathnameRef = useRef(pathname);
  
  // 监听 isNavigating 变化，开始显示动画
  useEffect(() => {
    if (isNavigating && !isVisible) {
      // 开始导航，显示加载动画
      setIsVisible(true);
      setIsExiting(false);
      setProgress(0);
      setDisplayProgress(0);
      progressRef.current = 0;
      
      // 模拟进度增长
      const startTime = Date.now();
      const minDuration = 600;
      
      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const targetProgress = Math.min((elapsed / minDuration) * 100, 85);
        
        progressRef.current = targetProgress;
        setProgress(targetProgress);
        
        if (targetProgress < 85 && isNavigating) {
          animationRef.current = requestAnimationFrame(updateProgress);
        }
      };
      
      animationRef.current = requestAnimationFrame(updateProgress);
    }
  }, [isNavigating, isVisible]);
  
  // 监听路由变化，结束动画
  useEffect(() => {
    // 路径变化且正在导航中
    if (pathname !== prevPathnameRef.current && isNavigating && isVisible) {
      prevPathnameRef.current = pathname;
      
      // 加速到 100%
      progressRef.current = 100;
      setProgress(100);
      
      // 清除动画
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // 延迟后淡出
      exitTimerRef.current = setTimeout(() => {
        setIsExiting(true);
        
        setTimeout(() => {
          setIsVisible(false);
          endNavigation();
        }, 250);
      }, 150);
    }
    
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [pathname, isNavigating, isVisible, endNavigation]);
  
  // 平滑显示进度
  useEffect(() => {
    if (progress > displayProgress) {
      const diff = progress - displayProgress;
      const step = diff * 0.2;
      
      const timer = setTimeout(() => {
        setDisplayProgress(prev => prev + step);
      }, 16);
      
      return () => clearTimeout(timer);
    }
  }, [progress, displayProgress]);
  
  // 清理
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);
  
  if (!isVisible) return null;
  
  const isDark = mode === 'dark';
  const loadingImage = isDark ? NIGHT_LOADING_IMAGE : DAY_LOADING_IMAGE;
  const loadingText = isDark ? '正在进入梦乡...' : '正在唤醒活力...';
  
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(2, 6, 23, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(4px)',
        opacity: isExiting ? 0 : 1,
        transition: 'opacity 0.25s ease-out',
        pointerEvents: 'none',
      }}
    >
      {/* 夜间模式星星装饰 */}
      {isDark && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                backgroundColor: '#7dd3fc',
                animation: `sparkle 1.5s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}
      
      {/* 图片 + 文字 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          borderRadius: 9999,
          padding: '8px 16px',
        }}
      >
        {/* 加载图片 */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'float 2s ease-in-out infinite',
          }}
        >
          <img 
            src={loadingImage}
            alt="Loading"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              // 图片加载失败时隐藏
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        
        {/* 加载文字 */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)',
            letterSpacing: '0.1em',
          }}
        >
          {loadingText}
        </div>
      </div>
      
      {/* 进度条 */}
      <div
        style={{
          width: 160,
          height: 3,
          borderRadius: 2,
          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          overflow: 'hidden',
          marginTop: 16,
        }}
      >
        <div
          style={{
            width: `${displayProgress}%`,
            height: '100%',
            borderRadius: 2,
            background: isDark 
              ? 'linear-gradient(90deg, #a855f7, #ec4899)' 
              : 'linear-gradient(90deg, #0ea5e9, #8b5cf6)',
            transition: 'width 0.1s ease-out',
          }}
        />
      </div>
      
      <style jsx global>{`
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
