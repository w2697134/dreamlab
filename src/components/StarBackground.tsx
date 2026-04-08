'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTheme } from '@/components/ThemeProvider';

interface Star {
  id: number;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  isBlue: boolean;
}

export default function StarBackground() {
  const { mode } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 生成星星数据
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 5,
      isBlue: Math.random() > 0.7,
    }));
  }, []);

  if (!mounted || mode !== 'dark') return null;

  return (
    <>
      {/* 星星 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full"
            style={{
              width: `${star.size}px`,
              height: `${star.size}px`,
              left: `${star.x}%`,
              top: `${star.y}%`,
              background: star.isBlue
                ? 'radial-gradient(circle, #fff, #87ceeb, transparent)'
                : 'radial-gradient(circle, #fff, #f0f8ff, transparent)',
              animation: `starSparkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
              filter: `blur(${star.size * 0.15}px)`,
            }}
          />
        ))}
      </div>

      {/* CSS 动画 */}
      <style jsx global>{`
        @keyframes starSparkle {
          0%, 100% { 
            opacity: 0.3; 
            transform: scale(1); 
          }
          50% { 
            opacity: 1; 
            transform: scale(1.3); 
          }
        }
      `}</style>
    </>
  );
}
