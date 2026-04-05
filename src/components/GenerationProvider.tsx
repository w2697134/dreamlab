'use client';

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';

// ========== 类型定义 ==========
export interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  dreamType?: string;
  artStyle?: string;
}

export interface GenerationState {
  isGenerating: boolean;
  progress: number;
  message: string;
  stage: string;
  generatedImages: GeneratedImage[];
  error: string | null;
  startTime: number | null;
}

interface GenerationContextType {
  state: GenerationState;
  startGeneration: () => void;
  updateProgress: (progress: number, message: string, stage: string) => void;
  addGeneratedImage: (image: GeneratedImage) => void;
  setError: (error: string) => void;
  finishGeneration: () => void;
  cancelGeneration: () => void;
  clearGeneration: () => void;
  startBackgroundGeneration: (requestBody: unknown) => void;
  generationRequest: unknown;
}

// ========== 默认状态 ==========
const initialState: GenerationState = {
  isGenerating: false,
  progress: 0,
  message: '',
  stage: '',
  generatedImages: [],
  error: null,
  startTime: null,
};

// ========== Context 创建 ==========
const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

// ========== Provider 组件 ==========
export function GenerationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GenerationState>(() => {
    // 从 localStorage 恢复状态，保留生成进度
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('generationState');
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('[生成管理器] 恢复之前的状态:', parsed);
          return parsed;
        }
      } catch (e) {
        console.error('[生成管理器] 恢复状态失败:', e);
      }
    }
    return initialState;
  });

  // 保存状态到 localStorage（包含时间戳）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('generationState', JSON.stringify(state));
      localStorage.setItem('generationStateTime', Date.now().toString());
    }
  }, [state]);

  // 组件挂载时检查并清理过期或卡住的状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 如果状态显示正在生成，但实际上已经过了很长时间（超过10分钟），自动清理
      if (state.isGenerating && state.startTime && Date.now() - state.startTime > 600000) {
        console.log('[生成管理器] 检测到卡住的生成状态，自动清理');
        clearGeneration();
      }
    }
  }, []);

  // ========== 方法 ==========
  const startGeneration = () => {
    setState({
      ...initialState,
      isGenerating: true,
      startTime: Date.now(),
    });
  };

  const updateProgress = (progress: number, message: string, stage: string) => {
    setState(prev => ({
      ...prev,
      progress,
      message,
      stage,
    }));
  };

  const addGeneratedImage = (image: GeneratedImage) => {
    setState(prev => ({
      ...prev,
      generatedImages: [...prev.generatedImages, image],
    }));
  };

  const setError = (error: string) => {
    setState(prev => ({
      ...prev,
      error,
      isGenerating: false,
    }));
  };

  const finishGeneration = () => {
    setState(prev => ({
      ...prev,
      isGenerating: false,
      progress: 100,
      message: '生成完成！',
      stage: 'complete',
    }));
  };

  const cancelGeneration = () => {
    setState(prev => ({
      ...prev,
      isGenerating: false,
      message: '已取消',
      stage: 'cancelled',
    }));
  };

  const clearGeneration = () => {
    setState(initialState);
  };

  // 启动后台生成（带请求参数）
  const [generationRequest, setGenerationRequest] = useState<unknown>(null);
  const startBackgroundGeneration = useCallback((requestBody: unknown) => {
    setGenerationRequest(requestBody);
    startGeneration();
  }, [startGeneration]);

  return (
    <GenerationContext.Provider
      value={{
        state,
        startGeneration,
        updateProgress,
        addGeneratedImage,
        setError,
        finishGeneration,
        cancelGeneration,
        clearGeneration,
        startBackgroundGeneration,
        generationRequest,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

// ========== Hook ==========
export function useGeneration() {
  const context = useContext(GenerationContext);
  if (!context) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
}
