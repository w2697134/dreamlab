/**
 * 初始化定时任务
 * 在应用启动时调用
 */

import { startCleanupScheduler } from './supabase-storage';
import { startModelCheckTimer } from './sd-config';

let initialized = false;

export function initSchedulers(): void {
  if (initialized) return;
  if (typeof window !== 'undefined') return; // 只在服务端运行
  
  initialized = true;
  
  // 启动定时清理，每天清理一次（24小时）
  startCleanupScheduler(24);
  
  // 启动SD模型定时检查
  startModelCheckTimer();
}

// 自动初始化（服务端运行时）
if (typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'nodejs') {
  // 构建时跳过，运行时执行
  initSchedulers();
}
