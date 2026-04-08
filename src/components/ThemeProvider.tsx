'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  mode: Theme;
  toggleMode: () => void;
  isInitialized: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleMode: () => {},
  isInitialized: false,
});

// 检查用户是否已登录
const checkIsLoggedIn = (): boolean => {
  if (typeof window === 'undefined') return false;
  const savedUser = localStorage.getItem('dreamUser');
  const token = localStorage.getItem('dreamToken');
  return !!(savedUser && token);
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Theme>('dark');
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化主题
  const initTheme = () => {
    const loggedIn = checkIsLoggedIn();
    
    if (loggedIn) {
      // 登录用户：从 localStorage 读取保存的主题偏好
      const saved = localStorage.getItem('dreamMode') as Theme | null;
      if (saved) {
        setMode(saved);
        document.documentElement.setAttribute('data-theme', saved);
      } else {
        // 没有保存的主题，默认使用夜间模式
        setMode('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } else {
      // 游客：强制使用夜间模式
      setMode('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  };

  useEffect(() => {
    initTheme();
    setIsInitialized(true);
    
    // 监听登录状态变化事件
    const handleAuthChange = () => {
      initTheme();
    };
    
    window.addEventListener('authStateChanged', handleAuthChange);
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dreamUser' || e.key === 'dreamToken') {
        initTheme();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('authStateChanged', handleAuthChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleMode = () => {
    const loggedIn = checkIsLoggedIn();
    
    // 游客不允许切换主题（或切换但不保存）
    if (!loggedIn) {
      // 允许切换但不保存，刷新后恢复夜间模式
      const newMode = mode === 'light' ? 'dark' : 'light';
      setMode(newMode);
      document.documentElement.setAttribute('data-theme', newMode);
      return;
    }
    
    // 登录用户：切换并保存主题
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    localStorage.setItem('dreamMode', newMode);
    document.documentElement.setAttribute('data-theme', newMode);
    // 同时设置 cookie，让服务端也能读取
    document.cookie = `dreamMode=${newMode};path=/;max-age=31536000`;
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, isInitialized }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
