'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

// ========== 类型定义 ==========

interface GeneratedImage {
  imageUrl: string;
  selected: boolean;
  sceneElements: string[];
  lightMood: string;
  perspective: string;
  atmosphere: string;
  interpretation?: string;
  keywords?: string[];
  emotionTags?: string[];
  isInterpreting?: boolean;
}

interface UploadedImage {
  id: string;
  dataUrl: string;
  name: string;
}

interface DreamState {
  // 基础输入
  currentPrompt: string;
  artStyle: string;
  selectedKeywords: string[];
  selectedSceneElements: string[];
  
  // 生成状态
  isGenerating: boolean;
  generateProgress: number;
  generateMessage: string;
  generateStage: string;
  
  // 生成结果
  generatedImages: GeneratedImage[];
  
  // 上传图片
  uploadedImages: UploadedImage[];
  
  // 会话信息
  dreamSessionId: string | null;
  sessionImageCount: number;
  
  // 时间戳
  lastUpdated: number;
}

interface DreamStateContextType {
  state: DreamState;
  setState: (newState: Partial<DreamState>) => void;
  resetState: () => void;
  isGenerating: boolean;
}

// ========== 默认状态 ==========

const DEFAULT_STATE: DreamState = {
  currentPrompt: '',
  artStyle: 'default',
  selectedKeywords: [],
  selectedSceneElements: [],
  
  isGenerating: false,
  generateProgress: 0,
  generateMessage: '',
  generateStage: '',
  
  generatedImages: [],
  uploadedImages: [],
  
  dreamSessionId: null,
  sessionImageCount: 0,
  
  lastUpdated: Date.now(),
};

// ========== Context 创建 ==========

const DreamStateContext = createContext<DreamStateContextType | undefined>(undefined);

// ========== Provider 组件 ==========

export function DreamStateProvider({ children }: { children: ReactNode }) {
  const [state, setStateInternal] = useState<DreamState>(() => {
    // 从 localStorage 恢复状态
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dreamState');
        if (saved) {
          const parsed = JSON.parse(saved);
          // 检查状态是否过期（超过1小时就重置）
          if (Date.now() - parsed.lastUpdated < 60 * 60 * 1000) {
            return { ...DEFAULT_STATE, ...parsed };
          }
        }
      } catch (e) {
        console.error('[DreamState] 恢复状态失败:', e);
      }
    }
    return DEFAULT_STATE;
  });

  // 保存到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const toSave = { ...state, lastUpdated: Date.now() };
        localStorage.setItem('dreamState', JSON.stringify(toSave));
      } catch (e) {
        console.error('[DreamState] 保存状态失败:', e);
      }
    }
  }, [state]);

  // 更新状态的方法
  const setState = (newState: Partial<DreamState>) => {
    setStateInternal(prev => ({ ...prev, ...newState }));
  };

  // 重置状态
  const resetState = () => {
    setStateInternal(DEFAULT_STATE);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dreamState');
    }
  };

  return (
    <DreamStateContext.Provider
      value={{
        state,
        setState,
        resetState,
        isGenerating: state.isGenerating,
      }}
    >
      {children}
    </DreamStateContext.Provider>
  );
}

// ========== Hook ==========

export function useDreamState() {
  const context = useContext(DreamStateContext);
  if (context === undefined) {
    throw new Error('useDreamState must be used within a DreamStateProvider');
  }
  return context;
}
