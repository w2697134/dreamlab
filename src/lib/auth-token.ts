// Token 管理工具（支持本地 Token）

const TOKEN_KEY = 'dreamToken';
const REFRESH_TOKEN_KEY = 'dreamRefreshToken';

// Token 检测定时器
let tokenMonitorInterval: ReturnType<typeof setInterval> | null = null;
const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000; // 每5分钟检测一次

interface TokenInfo {
  userId: string;
  username: string;
  expiresAt: number;
  isExpired: boolean;
  isExpiringSoon: boolean; // 即将过期（1小时内）
}

/**
 * 获取 access token
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 保存 access token
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * 获取 refresh token
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * 保存 refresh token
 */
export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * 清除所有 token
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem('dreamUser');
}

/**
 * 解码本地 token 获取信息
 */
export function decodeToken(token: string): { userId: string; username: string; expiresAt: number } | null {
  try {
    const [payload] = token.split('.');
    if (!payload) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());
    return { 
      userId: data.userId, 
      username: data.username,
      expiresAt: data.expiresAt 
    };
  } catch {
    return null;
  }
}

/**
 * 获取 token 状态信息
 */
export function getTokenInfo(): TokenInfo | null {
  const token = getToken();
  if (!token) return null;
  
  const decoded = decodeToken(token);
  if (!decoded) return null;
  
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  return {
    userId: decoded.userId,
    username: decoded.username,
    expiresAt: decoded.expiresAt,
    isExpired: now > decoded.expiresAt,
    isExpiringSoon: !!(now > decoded.expiresAt - oneHour && now <= decoded.expiresAt),
  };
}

/**
 * 检查 token 是否有效
 */
export function isTokenValid(): boolean {
  const token = getToken();
  if (!token) return false;
  
  const info = getTokenInfo();
  if (!info) return false;
  
  return !info.isExpired;
}

/**
 * 刷新 access token（使用本地 token）
 */
export async function refreshAccessToken(): Promise<boolean> {
  const token = getToken();
  if (!token) {
    console.log('[Token] 无 token，跳过刷新');
    return false;
  }

  try {
    // 先检查 token 是否已过期，如果已过期则跳过刷新直接清理
    const info = getTokenInfo();
    if (info?.isExpired) {
      console.log('[Token] Token 已过期，清理状态');
      clearTokens();
      // 通知页面刷新登录状态
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('authStateChanged'));
      }
      return false;
    }

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: token }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.log('[Token] 刷新失败:', data.error);
      // 刷新失败不直接清理，等待定时检测再次确认
      return false;
    }

    const data = await response.json();
    
    if (data.accessToken) {
      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      console.log('[Token] 刷新成功');
    }
    
    return true;
  } catch (error) {
    console.error('[Token] 刷新异常:', error);
    return false;
  }
}

/**
 * 带自动刷新的 fetch 封装
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  let response = await fetch(url, { ...options, headers });

  // 如果返回 401，尝试刷新 token
  if (response.status === 401) {
    console.log('[Token] API 返回 401，尝试刷新...');
    const refreshed = await refreshAccessToken();
    
    if (refreshed) {
      const newToken = getToken();
      const newHeaders = {
        ...options.headers,
        ...(newToken ? { 'Authorization': `Bearer ${newToken}` } : {}),
      };
      response = await fetch(url, { ...options, headers: newHeaders });
    }
  }

  return response;
}

/**
 * 启动 token 定时检测
 * 检测频率：每5分钟一次
 * - 如果 token 即将过期（1小时内），提前刷新
 * - 如果 token 已过期，清理状态
 */
export function startTokenMonitor(): void {
  if (typeof window === 'undefined') return;
  
  // 避免重复启动
  if (tokenMonitorInterval) {
    clearInterval(tokenMonitorInterval);
  }
  
  const check = async () => {
    const info = getTokenInfo();
    if (!info) {
      // 没有 token，不需要检测
      return;
    }
    
    if (info.isExpired) {
      console.log('[Token] 检测到 token 已过期，清理状态');
      clearTokens();
      window.dispatchEvent(new CustomEvent('authStateChanged'));
      return;
    }
    
    if (info.isExpiringSoon) {
      console.log('[Token] Token 即将过期，提前刷新');
      await refreshAccessToken();
    }
  };
  
  // 立即检测一次
  check();
  
  // 启动定时检测
  tokenMonitorInterval = setInterval(check, TOKEN_CHECK_INTERVAL);
  console.log('[Token] 定时检测已启动，每5分钟检测一次');
}

/**
 * 停止 token 定时检测
 */
export function stopTokenMonitor(): void {
  if (tokenMonitorInterval) {
    clearInterval(tokenMonitorInterval);
    tokenMonitorInterval = null;
    console.log('[Token] 定时检测已停止');
  }
}

/**
 * 登录时调用，重置 token 状态
 */
export function onLogin(): void {
  // 登录后启动定时检测
  startTokenMonitor();
}

/**
 * 退出登录时调用
 */
export function onLogout(): void {
  stopTokenMonitor();
  clearTokens();
}
