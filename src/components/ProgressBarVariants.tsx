'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';

interface ProgressBarProps {
  progress: number;
  message: string;
  onCancel?: () => void;
}

// 版本1：简约现代风格
export function ProgressBarV1({ progress, message, onCancel }: ProgressBarProps) {
  const { mode } = useTheme();
  
  return (
    <div className={`p-6 rounded-2xl backdrop-blur-xl border ${
      mode === 'dark' 
        ? 'bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-purple-500/20' 
        : 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
          </div>
          <div>
            <h3 className={`font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              正在生成梦境
            </h3>
            <p className={`text-sm ${mode === 'dark' ? 'text-purple-300' : 'text-purple-600'}`}>
              {message}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent`}>
            {Math.floor(progress)}%
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              className={`p-2 rounded-xl transition-all hover:scale-105 ${
                mode === 'dark'
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-red-100 text-red-500 hover:bg-red-200'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* 进度条容器 */}
      <div className="relative">
        {/* 背景轨道 */}
        <div className={`h-4 rounded-full overflow-hidden ${
          mode === 'dark' ? 'bg-white/10' : 'bg-gray-200'
        }`}>
          {/* 进度填充 */}
          <div 
            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-all duration-500 relative overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            {/* 光泽效果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine" />
          </div>
        </div>
        
        {/* 装饰点 */}
        <div className="absolute -top-1 left-0 right-0 flex justify-between px-1">
          {[0, 25, 50, 75, 100].map((point) => (
            <div 
              key={point}
              className={`w-2 h-2 rounded-full transition-all ${
                progress >= point 
                  ? 'bg-purple-500 scale-125' 
                  : mode === 'dark' ? 'bg-white/20' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// 版本2：科技感风格
export function ProgressBarV2({ progress, message, onCancel }: ProgressBarProps) {
  const { mode } = useTheme();
  const [scanLine, setScanLine] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setScanLine(prev => (prev + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className={`p-6 rounded-2xl border-2 font-mono ${
      mode === 'dark' 
        ? 'bg-black/80 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)]' 
        : 'bg-gray-900 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
    }`}>
      {/* 顶部状态栏 */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-cyan-500/30">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
          <span className="text-cyan-400 text-sm tracking-widest uppercase">
            Dream Generation System
          </span>
        </div>
        <div className="text-cyan-400 text-sm">
          v2.0.4
        </div>
      </div>
      
      {/* 主内容区 */}
      <div className="relative">
        {/* 扫描线效果 */}
        <div 
          className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent z-10"
          style={{ top: `${scanLine}%`, transition: 'top 50ms linear' }}
        />
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-cyan-500/70 text-xs uppercase tracking-wider mb-1">
              STATUS
            </div>
            <div className="text-cyan-400 text-sm">
              {message}
            </div>
          </div>
          <div className="text-right">
            <div className="text-cyan-500/70 text-xs uppercase tracking-wider mb-1">
              PROGRESS
            </div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              {String(Math.floor(progress)).padStart(3, '0')}%
            </div>
          </div>
        </div>
        
        {/* 进度条 */}
        <div className="relative">
          {/* 网格背景 */}
          <div className={`h-6 rounded overflow-hidden border border-cyan-500/30 ${
            mode === 'dark' ? 'bg-cyan-950/50' : 'bg-cyan-950/50'
          }`}>
            {/* 网格线 */}
            <div className="absolute inset-0 opacity-20">
              {Array.from({ length: 10 }).map((_, i) => (
                <div 
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-cyan-500"
                  style={{ left: `${i * 10}%` }}
                />
              ))}
            </div>
            
            {/* 进度填充 */}
            <div 
              className="h-full relative transition-all duration-300"
              style={{ width: `${progress}%` }}
            >
              {/* 主填充 */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-600" />
              
              {/* 脉动效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
              
              {/* 边缘光效 */}
              <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/50 to-transparent" />
            </div>
          </div>
          
          {/* 百分比标记 */}
          <div className="flex justify-between mt-2 text-xs text-cyan-500/50 font-mono">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
      
      {/* 底部操作 */}
      {onCancel && (
        <div className="mt-4 pt-4 border-t border-cyan-500/30 flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-all text-sm tracking-wider"
          >
            [ ABORT ]
          </button>
        </div>
      )}
    </div>
  );
}

// 版本3：梦幻风格
export function ProgressBarV3({ progress, message, onCancel }: ProgressBarProps) {
  const { mode } = useTheme();
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);
  
  useEffect(() => {
    // 生成粒子
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 2,
    }));
    setParticles(newParticles);
  }, []);
  
  return (
    <div className={`p-6 rounded-3xl relative overflow-hidden ${
      mode === 'dark' 
        ? 'bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-pink-900/40 border border-white/10' 
        : 'bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 border border-purple-200'
    }`}>
      {/* 背景粒子 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-white/30 animate-float"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>
      
      {/* 光晕效果 */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        {/* 顶部区域 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* 梦幻图标 */}
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <span className="text-2xl animate-spin-slow">✨</span>
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-white/30" />
            </div>
            
            <div>
              <h3 className={`text-xl font-semibold ${
                mode === 'dark' ? 'text-purple-300' : 'text-purple-600'
              }`}>
                梦境生成中
              </h3>
              <p className={`text-sm ${mode === 'dark' ? 'text-purple-200' : 'text-purple-600'}`}>
                {message}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* 百分比显示 */}
            <div className="text-center">
              <div className={`text-4xl font-bold ${
                mode === 'dark' ? 'text-white' : 'text-gray-800'
              }`}>
                {Math.floor(progress)}
              </div>
              <div className={`text-xs ${mode === 'dark' ? 'text-purple-300' : 'text-purple-500'}`}>
                PERCENT
              </div>
            </div>
            
            {/* 取消按钮 */}
            {onCancel && (
              <button
                onClick={onCancel}
                className={`p-3 rounded-2xl transition-all hover:scale-110 ${
                  mode === 'dark'
                    ? 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                    : 'bg-white/60 text-gray-500 hover:bg-white hover:text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* 进度条 */}
        <div className="relative">
          {/* 背景轨道 */}
          <div className={`h-6 rounded-full overflow-hidden ${
            mode === 'dark' ? 'bg-white/10' : 'bg-white/60'
          }`}>
            {/* 波浪背景 */}
            <div className="absolute inset-0 opacity-30">
              <svg className="w-full h-full" viewBox="0 0 400 24" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0.5" />
                    <stop offset="50%" stopColor="#a855f7" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.5" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 12 Q 50 6, 100 12 T 200 12 T 300 12 T 400 12"
                  fill="none"
                  stroke="url(#waveGrad)"
                  strokeWidth="2"
                  className="animate-wave"
                />
              </svg>
            </div>
            
            {/* 进度填充 */}
            <div 
              className="h-full relative transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            >
              {/* 渐变填充 */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              {/* 星光闪烁效果 */}
              <div className="absolute inset-0 overflow-hidden">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-white rounded-full animate-twinkle"
                    style={{
                      left: `${20 + i * 15}%`,
                      top: '30%',
                      animationDelay: `${i * 0.3}s`,
                    }}
                  />
                ))}
              </div>
              
              {/* 彩虹边缘 */}
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white/40 to-transparent" />
            </div>
          </div>
          
          {/* 装饰性云朵 */}
          <div className="absolute -top-8 left-0 right-0 flex justify-between px-4 pointer-events-none">
            <span className="text-2xl opacity-50 animate-bounce" style={{ animationDelay: '0s' }}>☁️</span>
            <span className="text-lg opacity-40 animate-bounce" style={{ animationDelay: '0.3s' }}>⭐</span>
            <span className="text-2xl opacity-50 animate-bounce" style={{ animationDelay: '0.6s' }}>🌙</span>
            <span className="text-lg opacity-40 animate-bounce" style={{ animationDelay: '0.9s' }}>⭐</span>
            <span className="text-2xl opacity-50 animate-bounce" style={{ animationDelay: '1.2s' }}>☁️</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 预览组件 - 同时展示三个版本
export function ProgressBarPreview() {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 0;
        return prev + 1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="space-y-8 p-8">
      <h2 className="text-2xl font-bold text-center mb-8">进度条三版本预览</h2>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3 text-purple-600">版本1：简约现代</h3>
          <ProgressBarV1 
            progress={progress} 
            message="正在生成梦境图片..." 
            onCancel={() => console.log('Cancel')}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-3 text-cyan-600">版本2：科技感</h3>
          <ProgressBarV2 
            progress={progress} 
            message="GENERATING DREAMSCAPE..." 
            onCancel={() => console.log('Cancel')}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-3 text-pink-600">版本3：梦幻风格</h3>
          <ProgressBarV3 
            progress={progress} 
            message="这次生成的图，会悄悄记住你写的文字哦" 
            onCancel={() => console.log('Cancel')}
          />
        </div>
      </div>
    </div>
  );
}
