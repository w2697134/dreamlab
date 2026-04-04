/**
 * 初始化定时清理任务
 * 在应用启动时调用
 */

import { startCleanupScheduler } from './supabase-storage';

let initialized = false;

export function initCleanupScheduler(): void {
  if (initialized) return;
  if (typeof window !== 'undefined') return; // 只在服务端运行
  
  initialized = true;
  
  // 启动定时清理，每天清理一次（24小时）
  startCleanupScheduler(24);
}

// 自动初始化（服务端）
if (typeof window === 'undefined') {
  initCleanupScheduler();
}
