'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useGeneration } from '@/components/GenerationProvider';
import { useTheme } from '@/components/ThemeProvider';

interface GenerationProgressProps {
  // 是否强制显示（用于页面返回时恢复显示）
  forceShow?: boolean;
}

/**
 * 新一代生成进度条
 * 
 * 核心设计：
 * 1. 进度持久化 - 切换页面不丢失
 * 2. 防回退 - 进度只增不减
 * 3. 后台同步 - 支持多页面状态同步
 * 4. 平滑动画 - 视觉流畅
 */
export default function GenerationProgress({ forceShow = false }: GenerationProgressProps) {
  const { state: genState } = useGeneration();
  const { mode } = useTheme();
  
  // 显示进度（持久化，只增不减）
  const [displayProgress, setDisplayProgress] = useState(0);
  const [displayMessage, setDisplayMessage] = useState('准备中...');
  const [isVisible, setIsVisible] = useState(false);
  
  // 使用 ref 记录最大值，防止回退
  const maxProgressRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  const animationRef = useRef<number | null>(null);
  
  const isDark = mode === 'dark';
  
  // 核心：同步全局状态到本地显示
  useEffect(() => {
    // 如果全局正在生成或强制显示
    if (genState.isGenerating || forceShow) {
      setIsVisible(true);
      
      // 进度只增不减
      const newProgress = genState.progress;
      if (newProgress > maxProgressRef.current) {
        maxProgressRef.current = newProgress;
        setDisplayProgress(newProgress);
        lastUpdateRef.current = Date.now();
      }
      
      // 更新消息
      if (genState.message) {
        setDisplayMessage(genState.message);
      }
    } else if (!genState.isGenerating && !forceShow) {
      // 生成完成，延迟隐藏
      if (maxProgressRef.current >= 100) {
        setTimeout(() => {
          setIsVisible(false);
          maxProgressRef.current = 0;
        }, 1000);
      }
    }
  }, [genState.isGenerating, genState.progress, genState.message, forceShow]);
  
  // 平滑进度动画
  useEffect(() => {
    if (!isVisible) return;
    
    const animate = () => {
      // 如果长时间没更新，显示一个微弱的脉冲动画表示还在运行
      const timeSinceUpdate = Date.now() - lastUpdateRef.current;
      if (timeSinceUpdate > 2000 && displayProgress < 95) {
        // 模拟微弱增长，给用户反馈
        setDisplayProgress(prev => Math.min(prev + 0.1, maxProgressRef.current + 5));
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, displayProgress]);
  
  if (!isVisible) return null;
  
  return (
    <div className={`w-full rounded-xl p-4 ${
      isDark ? 'bg-white/5' : 'bg-gray-50'
    }`}>
      {/* 头部信息 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* 状态指示器 */}
          <div className={`w-2 h-2 rounded-full ${
            genState.isGenerating 
              ? 'bg-green-500 animate-pulse' 
              : 'bg-blue-500'
          }`} />
          <span className={`text-sm font-medium ${
            isDark ? 'text-white/90' : 'text-gray-800'
          }`}>
            {genState.isGenerating ? '生成中' : '生成完成'}
          </span>
        </div>
        <span className={`text-sm font-bold ${
          isDark ? 'text-white/70' : 'text-gray-600'
        }`}>
          {Math.round(displayProgress)}%
        </span>
      </div>
      
      {/* 进度条 */}
      <div className={`h-3 rounded-full overflow-hidden ${
        isDark ? 'bg-white/10' : 'bg-gray-200'
      }`}>
        <div
          className="h-full rounded-full transition-all duration-500 ease-out relative"
          style={{
            width: `${Math.min(displayProgress, 100)}%`,
            background: isDark
              ? 'linear-gradient(90deg, #a855f7 0%, #ec4899 50%, #a855f7 100%)'
              : 'linear-gradient(90deg, #0ea5e9 0%, #8b5cf6 50%, #0ea5e9 100%)',
            backgroundSize: '200% 100%',
            animation: genState.isGenerating ? 'gradient-shift 2s linear infinite' : 'none',
          }}
        >
          {/* 光泽效果 */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: genState.isGenerating ? 'shimmer 1.5s infinite' : 'none',
            }}
          />
        </div>
      </div>
      
      {/* 状态消息 */}
      <div className={`mt-2 text-xs ${
        isDark ? 'text-white/50' : 'text-gray-500'
      }`}>
        {displayMessage}
      </div>
      
      {/* 阶段指示点 */}
      <div className="flex gap-1 mt-3">
        {['准备', '分析', '生成', '保存'].map((stage, index) => {
          const threshold = (index + 1) * 25;
          const isActive = displayProgress >= threshold;
          const isCurrent = displayProgress >= threshold - 25 && displayProgress < threshold;
          
          return (
            <div
              key={stage}
              className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                isActive 
                  ? (isDark ? 'bg-purple-500' : 'bg-blue-500')
                  : (isDark ? 'bg-white/10' : 'bg-gray-200')
              } ${isCurrent ? 'animate-pulse' : ''}`}
            />
          );
        })}
      </div>
      
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );
}
