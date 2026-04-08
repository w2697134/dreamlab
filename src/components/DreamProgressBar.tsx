'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';

interface DreamProgressBarProps {
  progress: number;        // 真实后端进度 0-100
  simulatedProgress: number; // 模拟进度
  message?: string;        // 当前状态消息
  stage?: string;          // 当前阶段
  className?: string;      // 自定义类名
  showCancel?: boolean;    // 是否显示取消按钮
  onCancel?: () => void;   // 取消回调
  isCancelling?: boolean;   // 是否正在取消中
}

// 轮播提示文案 - 介绍小梦的功能
const TIPS = [
  '小梦会记住你写下的每个梦境',
  '点击关键词可切换不同画面风格',
  '上传图片让小梦学习你的喜好',
  '写实、二次元、水彩、油画风格随心切换',
  '要结束梦境时，记得点击完成保存到梦境库哦~',
  '小梦支持图生图，基于参考图创作',
  '心理评估帮你了解梦境背后的情绪',
  '梦境集可将多个梦境串联成故事',
] as const;

export default function DreamProgressBar({
  progress,
  simulatedProgress,
  message = '点击关键词可调整画面风格',
  stage = '',
  className = '',
  showCancel = true,
  onCancel,
  isCancelling = false
}: DreamProgressBarProps) {
  const { mode, isInitialized } = useTheme();
  const displayProgress = Math.max(progress, simulatedProgress);
  
  // 【修复】用 stage === 'complete' 判断真正完成，而不是 progress >= 100
  // 防止后端 saving 阶段(95%)到 complete(100%)之间显示"已完成"
  const isComplete = stage === 'complete' && progress >= 100;
  const isDark = !isInitialized || mode === 'dark';
  
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    hue: number;
  }>>([]);
  const [orbitingDots, setOrbitingDots] = useState<Array<{
    id: number;
    angle: number;
    radius: number;
    size: number;
    speed: number;
  }>>([]);
  const [glowPulse, setGlowPulse] = useState(0);
  const [borderPhase, setBorderPhase] = useState(0);
  const [floatingTexts, setFloatingTexts] = useState<Array<{
    id: number;
    text: string;
    x: number;
    y: number;
    opacity: number;
  }>>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  // 动画引用 - 统一管理
  const orbitAnimationRef = useRef<number | null>(null);
  const glowAnimationRef = useRef<number | null>(null);
  const particleAnimationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textAnimationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const particleSpawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const floatingTextRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const particleIdRef = useRef(0);
  const textIdRef = useRef(0);
  
  // 轮播提示状态
  const [tipIndex, setTipIndex] = useState(0);
  const [tipOpacity, setTipOpacity] = useState(1);
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 进度提示文字
  const progressTexts = [
    '正在将你的想象转化为视觉奇迹...',
    '梦境碎片正在汇聚成形...',
    '光影魔法正在发生...',
    '色彩与情感的碰撞中...',
    '潜意识的画面正在浮现...',
    '让画面更添梦幻色彩...',
    '细节正在被精心雕琢...',
    '接近完成的时刻...',
  ];
  
  const currentText = progressTexts[Math.floor((displayProgress / 100) * progressTexts.length)] || progressTexts[0];

  // 清理所有动画
  const cleanupAnimations = useCallback(() => {
    if (orbitAnimationRef.current !== null) {
      cancelAnimationFrame(orbitAnimationRef.current);
      orbitAnimationRef.current = null;
    }
    if (glowAnimationRef.current !== null) {
      cancelAnimationFrame(glowAnimationRef.current);
      glowAnimationRef.current = null;
    }
    if (particleAnimationRef.current !== null) {
      clearInterval(particleAnimationRef.current);
      particleAnimationRef.current = null;
    }
    if (textAnimationRef.current !== null) {
      clearInterval(textAnimationRef.current);
      textAnimationRef.current = null;
    }
    if (particleSpawnRef.current !== null) {
      clearInterval(particleSpawnRef.current);
      particleSpawnRef.current = null;
    }
    if (floatingTextRef.current !== null) {
      clearInterval(floatingTextRef.current);
      floatingTextRef.current = null;
    }
    if (tipIntervalRef.current !== null) {
      clearInterval(tipIntervalRef.current);
      tipIntervalRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return cleanupAnimations;
  }, [cleanupAnimations]);

  // 轮播提示动画 - 每5秒切换一次，淡入淡出效果
  useEffect(() => {
    if (isComplete) return;
    
    // 每5秒切换一次提示
    tipIntervalRef.current = setInterval(() => {
      // 淡出
      setTipOpacity(0);
      
      // 300ms后切换内容并淡入
      setTimeout(() => {
        setTipIndex(prev => (prev + 1) % TIPS.length);
        setTipOpacity(1);
      }, 300);
    }, 5000);
    
    return () => {
      if (tipIntervalRef.current) {
        clearInterval(tipIntervalRef.current);
        tipIntervalRef.current = null;
      }
    };
  }, [isComplete]);

  // 初始化轨道光点
  useEffect(() => {
    if (!isComplete) {
      const dots = Array.from({ length: 6 }, (_, i) => ({
        id: i,
        angle: (i * 60) + Math.random() * 30,
        radius: 45 + Math.random() * 10,
        size: 3 + Math.random() * 3,
        speed: 0.5 + Math.random() * 0.5,
      }));
      setOrbitingDots(dots);
    }
  }, [isComplete]);

  // 轨道光点动画
  useEffect(() => {
    cleanupAnimations();
    
    if (isComplete) return;
    
    let lastTime = 0;
    const animate = (time: number) => {
      if (time - lastTime > 50) {
        lastTime = time;
        setOrbitingDots(prev => prev.map(dot => ({
          ...dot,
          angle: dot.angle + dot.speed,
        })));
      }
      orbitAnimationRef.current = requestAnimationFrame(animate);
    };
    
    orbitAnimationRef.current = requestAnimationFrame(animate);
  }, [isComplete, cleanupAnimations]);

  // 光晕脉动动画
  useEffect(() => {
    cleanupAnimations();
    
    let time = 0;
    const animate = () => {
      time += 0.02;
      setGlowPulse(Math.sin(time) * 0.5 + 0.5);
      setBorderPhase(prev => (prev + 0.3) % 360);
      glowAnimationRef.current = requestAnimationFrame(animate);
    };
    
    glowAnimationRef.current = requestAnimationFrame(animate);
  }, [cleanupAnimations]);

  // 重置监听 - 当进度归零时清理所有状态
  useEffect(() => {
    if (progress === 0 && simulatedProgress === 0) {
      setParticles([]);
      setFloatingTexts([]);
      setGlowPulse(0);
      console.log('[进度条] 已重置');
    }
  }, [progress, simulatedProgress]);

  // 粒子生成（优化：使用 ref 存储 displayProgress 避免频繁重置 interval）
  const displayProgressRef = useRef(displayProgress);
  displayProgressRef.current = displayProgress;
  
  useEffect(() => {
    if (isComplete || particles.length >= 15) return;
    
    particleSpawnRef.current = setInterval(() => {
      if (particles.length >= 15 || displayProgressRef.current >= 90) return;
      
      setParticles(prev => {
        if (prev.length >= 15) return prev;
        const newParticles = [...prev];
        for (let i = 0; i < 2; i++) {
          if (newParticles.length >= 15) break;
          newParticles.push({
            id: particleIdRef.current++,
            x: Math.random() * displayProgressRef.current,
            y: 50 + Math.random() * 30,
            vx: (Math.random() - 0.3) * 2,
            vy: -Math.random() * 2 - 0.5,
            size: Math.random() * 4 + 2,
            opacity: 0.8,
            hue: 260 + Math.random() * 40,
          });
        }
        return newParticles;
      });
    }, 400);

    return () => {
      if (particleSpawnRef.current) {
        clearInterval(particleSpawnRef.current);
        particleSpawnRef.current = null;
      }
    };
  }, [isComplete, particles.length]); // 移除 displayProgress 依赖

  // 粒子动画
  useEffect(() => {
    particleAnimationRef.current = setInterval(() => {
      setParticles(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            opacity: p.opacity - 0.015,
          }))
          .filter(p => p.opacity > 0 && p.x > 0 && p.x < 100)
      );
    }, 50);

    return () => {
      if (particleAnimationRef.current) {
        clearInterval(particleAnimationRef.current);
        particleAnimationRef.current = null;
      }
    };
  }, []);

  // 完成时清理粒子
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        setParticles([]);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  // 浮动文字
  useEffect(() => {
    if (isComplete) return;
    
    const showFloatingText = () => {
      const texts = ['✨', '💫', '🌟', '⭐', '💭', '🌙', '💜', '🫧'];
      setFloatingTexts(prev => {
        if (prev.length >= 5) return prev;
        return [...prev, {
          id: textIdRef.current++,
          text: texts[Math.floor(Math.random() * texts.length)],
          x: 10 + Math.random() * 80,
          y: 80 + Math.random() * 20,
          opacity: 0,
        }];
      });
    };

    floatingTextRef.current = setInterval(showFloatingText, 800);
    return () => {
      if (floatingTextRef.current) {
        clearInterval(floatingTextRef.current);
        floatingTextRef.current = null;
      }
    };
  }, [isComplete]);

  // 浮动文字动画
  useEffect(() => {
    textAnimationRef.current = setInterval(() => {
      setFloatingTexts(prev => prev.map(t => ({
        ...t,
        y: t.y - 0.5,
        opacity: t.opacity < 1 ? t.opacity + 0.05 : t.opacity - 0.02,
      })).filter(t => t.opacity > 0 && t.y > 20));
    }, 50);

    return () => {
      if (textAnimationRef.current) {
        clearInterval(textAnimationRef.current);
        textAnimationRef.current = null;
      }
    };
  }, []);

  // 动态边框渐变
  const borderGradient = `linear-gradient(
    ${borderPhase}deg,
    rgba(168, 85, 247, ${0.3 + glowPulse * 0.3}),
    rgba(236, 72, 153, ${0.3 + glowPulse * 0.3}),
    rgba(59, 130, 246, ${0.3 + glowPulse * 0.3}),
    rgba(168, 85, 247, ${0.3 + glowPulse * 0.3})
  )`;

  const glowIntensity = 20 + glowPulse * 15;

  const statusText = isComplete ? '梦境已编织完成！' : '梦境编织中...';

  return (
    <div 
      ref={containerRef}
      className={`relative p-6 rounded-3xl overflow-hidden ${className}`}
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.9), rgba(49, 46, 129, 0.8), rgba(30, 27, 75, 0.9))'
          : 'linear-gradient(135deg, rgba(253, 244, 255, 0.95), rgba(237, 233, 254, 0.9), rgba(253, 244, 255, 0.95))',
        boxShadow: `
          0 0 ${glowIntensity}px rgba(168, 85, 247, ${0.2 + glowPulse * 0.15}),
          0 0 ${glowIntensity * 2}px rgba(236, 72, 153, ${0.1 + glowPulse * 0.1}),
          inset 0 0 60px rgba(168, 85, 247, ${0.05 + glowPulse * 0.05})
        `,
        border: `2px solid ${borderGradient}`,
      }}
    >
      {/* 内部背景光效 */}
      <div 
        className="absolute inset-0 overflow-hidden rounded-3xl"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.15) 0%, transparent 50%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.1) 0%, transparent 50%)',
        }}
      />

      {/* 背景星星/光点 */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-twinkle"
            style={{
              left: `${(i * 7 + 3) % 100}%`,
              top: `${(i * 11 + 5) % 100}%`,
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              background: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(168, 85, 247, 0.4)',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* 浮动文字效果 */}
      {floatingTexts.map(t => (
        <div
          key={t.id}
          className="absolute pointer-events-none text-lg"
          style={{
            left: `${t.x}%`,
            top: `${t.y}%`,
            opacity: t.opacity,
            transform: 'translate(-50%, -50%)',
            filter: `blur(${Math.max(0, 1 - t.opacity)}px)`,
          }}
        >
          {t.text}
        </div>
      ))}

      {/* 顶部信息区域 */}
      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          {/* 动态图标区域 - 梦幻魔法阵 */}
          <div className="relative w-14 h-14 flex items-center justify-center">
            {/* 最外层魔法阵 - 六芒星/魔法符文 */}
            <svg 
              className="absolute inset-0 w-full h-full" 
              viewBox="0 0 56 56"
              style={{ animation: 'magicRotate 10s linear infinite' }}
            >
              {/* 外圈魔法符文 */}
              {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                const rad = (angle + borderPhase * 0.3) * Math.PI / 180;
                const x = 28 + 25 * Math.cos(rad);
                const y = 28 + 25 * Math.sin(rad);
                return (
                  <g key={`rune-${i}`} transform={`translate(${x}, ${y})`}>
                    <text
                      x="0"
                      y="0"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="6"
                      fill={i % 2 === 0 ? '#c084fc' : '#f0abfc'}
                      opacity={0.7}
                    >
                      ✦
                    </text>
                  </g>
                );
              })}
              {/* 六芒星线条 */}
              <polygon
                points="28,4 50,43 6,43 28,4"
                fill="none"
                stroke="url(#magicStarGradient)"
                strokeWidth="0.5"
                opacity="0.5"
              />
              <polygon
                points="28,52 50,13 6,13 28,52"
                fill="none"
                stroke="url(#magicStarGradient)"
                strokeWidth="0.5"
                opacity="0.5"
              />
              <defs>
                <linearGradient id="magicStarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="50%" stopColor="#f0abfc" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
            </svg>

            {/* 第二层旋转光环 */}
            <div 
              className="absolute w-11 h-11 rounded-full border border-dashed"
              style={{
                borderColor: `rgba(192, 132, 252, ${0.4 + glowPulse * 0.3})`,
                animation: 'magicRotate 6s linear infinite reverse',
              }}
            />

            {/* 第三层魔法光环 */}
            <div 
              className="absolute w-9 h-9 rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(192, 132, 252, ${0.2 + glowPulse * 0.2}) 0%, transparent 70%)`,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />

            {/* 中心梦境球体 */}
            <div className="relative w-8 h-8">
              {/* 外层魔法光芒 */}
              <div 
                className="absolute -inset-1 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, 
                    rgba(192, 132, 252, ${0.3 + glowPulse * 0.2}), 
                    rgba(240, 171, 252, ${0.3 + glowPulse * 0.2}), 
                    rgba(129, 140, 248, ${0.3 + glowPulse * 0.2}), 
                    rgba(192, 132, 252, ${0.3 + glowPulse * 0.2})
                  )`,
                  animation: 'magicRotate 3s linear infinite',
                  filter: 'blur(4px)',
                }}
              />
              
              {/* 球体主体 */}
              {isComplete ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div 
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-500"
                    style={{ boxShadow: '0 0 15px rgba(52, 211, 153, 0.8)' }}
                  />
                  <svg className="absolute w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* 梦境光球 */}
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, 
                        rgba(255, 255, 255, 0.9) 0%, 
                        rgba(240, 171, 252, 0.8) 30%, 
                        rgba(192, 132, 252, 0.9) 60%, 
                        rgba(129, 140, 248, 0.8) 100%
                      )`,
                      boxShadow: `
                        0 0 ${10 + glowPulse * 8}px rgba(192, 132, 252, 0.8),
                        0 0 ${20 + glowPulse * 15}px rgba(240, 171, 252, 0.4),
                        inset 0 0 10px rgba(255, 255, 255, 0.3)
                      `,
                    }}
                  />
                  {/* 中心星星 */}
                  <svg 
                    className="absolute w-4 h-4 text-white animate-twinkle" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                    style={{ filter: 'drop-shadow(0 0 3px rgba(255, 255, 255, 0.8))' }}
                  >
                    <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
                  </svg>
                </div>
              )}
            </div>

            {/* 漂浮的魔法粒子 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {/* 魔法光点 */}
              {[
                { top: '10%', left: '5%', delay: '0s', size: 2, color: '#c084fc' },
                { top: '80%', left: '90%', delay: '0.3s', size: 1.5, color: '#f0abfc' },
                { top: '15%', left: '85%', delay: '0.6s', size: 2, color: '#818cf8' },
                { top: '75%', left: '10%', delay: '0.9s', size: 1.5, color: '#c084fc' },
                { top: '50%', left: '0%', delay: '1.2s', size: 2, color: '#f0abfc' },
              ].map((particle, i) => (
                <div
                  key={`particle-${i}`}
                  className="absolute rounded-full"
                  style={{
                    top: particle.top,
                    left: particle.left,
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    background: particle.color,
                    boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                    animation: `sparkle 2s ease-in-out infinite ${particle.delay}`,
                  }}
                />
              ))}
              {/* 魔法棒/星星划过 */}
              <div 
                className="absolute"
                style={{
                  top: '20%',
                  right: '-10%',
                  animation: 'shootingStar 4s linear infinite',
                }}
              >
                <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5z"/>
                </svg>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes magicRotate {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.15); opacity: 0.8; }
            }
            @keyframes sparkle {
              0%, 100% { transform: scale(0); opacity: 0; }
              50% { transform: scale(1); opacity: 1; }
            }
            @keyframes shootingStar {
              0% { transform: translateX(0) translateY(0) rotate(45deg); opacity: 0; }
              10% { opacity: 1; }
              90% { opacity: 1; }
              100% { transform: translateX(-80px) translateY(80px) rotate(45deg); opacity: 0; }
            }
          `}</style>

          {/* 文字信息 - 完成时放大显示 */}
          <div>
            {isComplete ? (
              <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                梦境已编织完成！
              </div>
            ) : (
              <>
                <div className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  {statusText}
                </div>
                <div 
                  className={`text-sm mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}
                  style={{ 
                    opacity: tipOpacity, 
                    transition: 'opacity 300ms ease-in-out',
                    minHeight: '1.25rem',
                  }}
                >
                  {TIPS[tipIndex]}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 右侧百分比和状态提示 */}
        <div className="flex items-center gap-4">
          {/* 完成时显示上传提示 */}
          {isComplete ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8">
                  <svg className={`w-8 h-8 ${isDark ? 'text-green-400' : 'text-green-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {/* 上传中旋转效果 */}
                  <div className="absolute inset-0 animate-spin">
                    <svg className={`w-8 h-8 ${isDark ? 'text-green-400' : 'text-green-600'} opacity-30`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    正在上传...
                  </div>
                  <div className={`text-xs ${isDark ? 'text-green-400/60' : 'text-green-500/70'}`}>
                    图片已生成完成
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <span 
                className="text-2xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #ec4899, #3b82f6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {Math.floor(displayProgress)}%
              </span>
              {/* 百分比光环 */}
              <div 
                className="absolute -inset-2 rounded-lg opacity-30 animate-pulse-glow"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.5), rgba(236, 72, 153, 0.5))',
                  filter: 'blur(8px)',
                }}
              />
            </div>
          )}

          {showCancel && onCancel && !isComplete && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                isCancelling
                  ? (isDark ? 'bg-yellow-500/20 text-yellow-400 cursor-not-allowed' : 'bg-yellow-100 text-yellow-600 cursor-not-allowed')
                  : (isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:scale-110' : 'bg-red-100 text-red-500 hover:bg-red-200 hover:scale-110')
              }`}
              title={isCancelling ? '取消中...' : '取消生成'}
            >
              {isCancelling ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm">取消中</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm">取消</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 进度条容器 */}
      <div className="relative">
        {/* 外层发光边框 */}
        <div 
          className="absolute -inset-1 rounded-xl opacity-50"
          style={{
            background: `linear-gradient(90deg, 
              transparent, 
              rgba(168, 85, 247, ${0.3 + glowPulse * 0.3}), 
              rgba(236, 72, 153, ${0.3 + glowPulse * 0.3}), 
              transparent
            )`,
            filter: 'blur(4px)',
          }}
        />

        {/* 进度条背景 */}
        <div 
          ref={progressRef}
          className="relative h-4 rounded-full overflow-hidden backdrop-blur-sm"
          style={{
            background: isDark 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* 进度填充 */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${displayProgress}%` }}
          >
            {/* 渐变背景 */}
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: isComplete
                  ? 'linear-gradient(90deg, #34d399, #10b981, #059669)'
                  : 'linear-gradient(90deg, #a855f7, #ec4899, #f472b6, #a855f7)',
                backgroundSize: '200% 100%',
                animation: isComplete ? 'none' : 'gradientMove 3s linear infinite',
              }}
            />

            {/* 流动高光 */}
            {!isComplete && (
              <div 
                className="absolute inset-0 animate-shimmer"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                }}
              />
            )}

            {/* 内部纹理 */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 10px,
                  rgba(255,255,255,0.1) 10px,
                  rgba(255,255,255,0.1) 20px
                )`,
              }}
            />
          </div>

          {/* 进度条上的粒子效果 */}
          {particles.map(p => (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: `hsla(${p.hue}, 70%, 60%, ${p.opacity})`,
                boxShadow: `0 0 ${p.size * 2}px hsla(${p.hue}, 70%, 60%, ${p.opacity})`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}

          {/* 进度前端光点 - 紧贴彩色进度条 */}
          {/* 只在进度大于5%时显示，避免在进度条开始处显示 */}
          {displayProgress > 5 && (
            <div
              className="absolute top-1/2 w-5 h-5 rounded-full"
              style={{
                left: `${Math.min(displayProgress, 99)}%`,
                transform: 'translate(-50%, -50%)', // 居中于进度条末端
                marginLeft: '0px',
                background: 'radial-gradient(circle, #fff 0%, rgba(255,255,255,0.8) 40%, rgba(168,85,247,0.5) 100%)',
                boxShadow: `
                  0 0 10px rgba(255, 255, 255, 0.8),
                  0 0 20px rgba(168, 85, 247, 0.6),
                  0 0 30px rgba(168, 85, 247, 0.4)
                `,
              }}
            />
          )}
        </div>

        {/* 刻度标记 */}
        <div className="flex justify-between mt-2 px-1">
          {[0, 25, 50, 75, 100].map(point => {
            const isActive = displayProgress >= point;
            return (
              <div key={point} className="flex flex-col items-center">
                <div 
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: isActive 
                      ? (isComplete ? '#34d399' : '#a855f7')
                      : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                    boxShadow: isActive ? `0 0 6px ${isComplete ? '#34d399' : '#a855f7'}` : 'none',
                  }}
                />
                <span 
                  className="text-xs mt-1.5 transition-colors"
                  style={{
                    color: isActive 
                      ? (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)')
                      : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'),
                  }}
                >
                  {point}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部提示文字 */}
      <div 
        className={`text-sm mt-4 text-center transition-all ${
          isComplete ? 'text-green-400' : (isDark ? 'text-white/50' : 'text-gray-500')
        }`}
      >
        {isComplete ? '🎉 恭喜！你的梦境已化为绚丽的画卷' : currentText}
      </div>

      {/* 完成时的庆祝光环 */}
      {isComplete && (
        <div 
          className="absolute inset-0 pointer-events-none rounded-3xl animate-celebrate"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(52, 211, 153, 0.2) 0%, transparent 70%)',
          }}
        />
      )}
    </div>
  );
}
