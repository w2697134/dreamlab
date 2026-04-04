'use client';

import { useState, useEffect, useCallback } from 'react';

interface PersistentStateOptions<T> {
  key: string;
  defaultValue: T;
  debounceMs?: number;
}

export function usePersistentState<T>({ 
  key, 
  defaultValue, 
  debounceMs = 500 
}: PersistentStateOptions<T>): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // 检查是否禁用持久化
  const isPersistenceDisabled = DISABLED_PERSISTENCE_KEYS.includes(key);
  
  // 初始化状态 - 从 localStorage 读取（如果未禁用）
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined' || isPersistenceDisabled) {
      return defaultValue;
    }
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`[持久化状态] 恢复 ${key}:`, parsed);
        return parsed;
      }
    } catch (e) {
      console.error(`[持久化状态] 读取 ${key} 失败:`, e);
    }
    return defaultValue;
  });

  // 保存到 localStorage（防抖）- 禁用的 key 不保存
  useEffect(() => {
    if (typeof window === 'undefined' || isPersistenceDisabled) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
        console.log(`[持久化状态] 保存 ${key}`);
      } catch (e) {
        console.error(`[持久化状态] 保存 ${key} 失败:`, e);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [state, key, debounceMs, isPersistenceDisabled]);

  // 清除状态
  const clearState = useCallback(() => {
    setState(defaultValue);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  }, [defaultValue, key]);

  return [state, setState, clearState];
}

// 禁用持久化的 key 列表（这些状态不保存到 localStorage）
const DISABLED_PERSISTENCE_KEYS = [
  // 'dream_generatedImages',  // 生成的图片现在持久化，刷新后保留
  'dream_selectedImages',   // 选中的图片不持久化
];

// 清除所有梦境相关的持久化状态
export function clearAllDreamState() {
  if (typeof window === 'undefined') return;
  
  const keysToRemove = [
    'dream_form_currentPrompt',
    'dream_form_artStyle',
    'dream_form_selectedSceneElements',
    'dream_form_selectedKeywords',
    'dream_form_dreamKeywords',
    'dream_form_hasUserPolished',
    'dream_form_uploadedImages',
    'dream_generatedImages',
    'dream_lastPolishedPrompt',
    'dream_selectedImages',
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log('[持久化状态] 已清除所有梦境表单状态');
}
