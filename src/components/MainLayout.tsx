'use client';

import { ReactNode, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useTheme } from '@/components/ThemeProvider';


interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { mode } = useTheme();
  const pathname = usePathname();

  // 监听路由变化，确保每次进入页面都重置 body 样式
  useEffect(() => {
    // 立即重置 body 样式，防止上一个页面的 opacity 设置残留
    document.body.style.transition = 'opacity 0.05s ease-out';
    document.body.style.opacity = '1';
    
    // 动画完成后清除 transition
    const timer = setTimeout(() => {
      document.body.style.transition = '';
    }, 50);
    
    return () => clearTimeout(timer);
  }, [pathname]);

  // 简化背景色设置，使用深色主题
  const bgColor = '#020617';

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      <main 
        className="min-h-screen"
        style={{ 
          paddingLeft: sidebarCollapsed ? 64 : 256,
          backgroundColor: bgColor,
          transition: 'padding-left 0.3s ease'
        }}
      >
        <div className="min-h-full w-full" style={{ backgroundColor: bgColor }}>
          {children}
        </div>
      </main>
      

    </div>
  );
}
