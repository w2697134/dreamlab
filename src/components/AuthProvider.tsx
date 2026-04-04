'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { startTokenMonitor, stopTokenMonitor, clearTokens } from '@/lib/auth-token';

// 开发者账号列表（用户名）
const DEVELOPER_ACCOUNTS = [
  'admin',
  'developer',
  'fire',
  'dev',
  'dream',
  '11111',
];

interface User {
  id: string;
  username: string;
  nickname?: string;
  isDeveloper?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isDeveloper: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshAuth: () => void;
  forceRefresh: () => void; // 强制刷新状态
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  isDeveloper: false,
  login: async () => false,
  logout: () => {},
  refreshAuth: () => {},
  forceRefresh: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [version, setVersion] = useState(0); // 用于强制刷新

  // 从 localStorage 读取登录状态
  const checkAuth = useCallback(() => {
    const savedUser = localStorage.getItem('dreamUser');
    const token = localStorage.getItem('dreamToken');
    
    if (savedUser && token) {
      try {
        const userData = JSON.parse(savedUser);
        // 判断是否为开发者
        const isDeveloper = DEVELOPER_ACCOUNTS.includes(userData.username);
        setUser({ ...userData, isDeveloper });
        return true;
      } catch {
        clearTokens();
        setUser(null);
      }
    } else {
      setUser(null);
    }
    return false;
  }, []);

  // 强制刷新状态
  const forceRefresh = useCallback(() => {
    setVersion(v => v + 1);
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const isLoggedIn = checkAuth();
    
    // 如果已登录，启动 token 定时检测
    if (isLoggedIn) {
      startTokenMonitor();
    }
    
    // 监听 storage 事件（其他标签页的登录状态变化）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dreamUser' || e.key === 'dreamToken') {
        checkAuth();
        const stillLoggedIn = !!localStorage.getItem('dreamUser') && !!localStorage.getItem('dreamToken');
        if (stillLoggedIn) {
          startTokenMonitor();
        } else {
          stopTokenMonitor();
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // 监听自定义事件（同一标签页的登录状态变化）
    const handleAuthChange = () => {
      checkAuth();
      const stillLoggedIn = !!localStorage.getItem('dreamUser') && !!localStorage.getItem('dreamToken');
      if (stillLoggedIn) {
        startTokenMonitor();
      } else {
        stopTokenMonitor();
      }
    };
    
    window.addEventListener('authStateChanged', handleAuthChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChanged', handleAuthChange);
      stopTokenMonitor();
    };
  }, [checkAuth]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('登录失败:', data.error);
        return false;
      }

      // 保存 token
      if (data.accessToken) {
        localStorage.setItem('dreamToken', data.accessToken);
        localStorage.setItem('dreamRefreshToken', data.refreshToken || data.accessToken);
      }

      // 保存用户数据
      const userData: User = {
        id: data.user.id,
        username: data.user.username,
        nickname: data.user.nickname,
        isDeveloper: DEVELOPER_ACCOUNTS.includes(data.user.username),
      };

      localStorage.setItem('dreamUser', JSON.stringify(userData));
      
      // 更新状态（关键步骤）
      setUser(userData);
      setVersion(v => v + 1);

      // 启动 token 定时检测
      startTokenMonitor();
      
      // 触发状态变化事件，让其他组件同步
      window.dispatchEvent(new CustomEvent('authStateChanged'));
      return true;
    } catch (error) {
      console.error('登录请求失败:', error);
      return false;
    }
  };

  const logout = () => {
    // 清除状态（关键步骤）
    setUser(null);
    setVersion(v => v + 1);
    stopTokenMonitor();
    clearTokens();
    
    // 触发状态变化事件
    window.dispatchEvent(new CustomEvent('authStateChanged'));
  };

  const refreshAuth = () => {
    checkAuth();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoggedIn: !!user, 
      isDeveloper: user?.isDeveloper || false,
      login, 
      logout, 
      refreshAuth,
      forceRefresh
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
