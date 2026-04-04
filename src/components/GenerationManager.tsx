'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGeneration } from '@/components/GenerationProvider';
import { useToast } from '@/components/Toast';

/**
 * 全局生成任务管理器
 * 
 * 核心功能：后台保持 SSE 连接
 * - 用户切换页面时，生成任务继续在后台运行
 * - 用户返回页面时，自动恢复进度显示
 * - 生成完成时发送全局通知
 */
export default function GenerationManager() {
  const { 
    state, 
    startGeneration,
    updateProgress, 
    addGeneratedImage, 
    finishGeneration, 
    setError,
    cancelGeneration 
  } = useGeneration();
  const { showToast } = useToast();
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);
  const isRunningRef = useRef(false);
  const prevGeneratingRef = useRef(state.isGenerating);
  
  // 生成完成通知
  useEffect(() => {
    if (prevGeneratingRef.current && !state.isGenerating) {
      if (!state.error && state.generatedImages.length > 0) {
        showToast(`✨ 梦境图片生成完成！共 ${state.generatedImages.length} 张`, 'success');
      } else if (state.error) {
        showToast(`生成失败: ${state.error}`, 'error');
      }
    }
    prevGeneratingRef.current = state.isGenerating;
  }, [state.isGenerating, state.error, state.generatedImages.length, showToast]);
  
  // 核心：启动后台生成
  const startBackgroundGeneration = useCallback(async (requestBody: unknown) => {
    // 防止重复启动
    if (isRunningRef.current) {
      console.log('[生成管理器] 已有生成任务在运行');
      return;
    }
    
    isRunningRef.current = true;
    isCancelledRef.current = false;
    
    // 取消之前的连接
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    // 标记开始生成
    startGeneration();
    
    try {
      const response = await fetch('/api/generate-image-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        if (isCancelledRef.current) {
          await reader.cancel();
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          try {
            const event = JSON.parse(line.slice(6));
            
            // 更新进度
            if (event.stage && event.progress !== undefined) {
              updateProgress(event.progress, event.message, event.stage);
            }
            
            // 完成处理
            if (event.stage === 'complete' && event.results) {
              for (const result of event.results) {
                addGeneratedImage({
                  id: `${Date.now()}_${Math.random()}`,
                  imageUrl: result.imageUrl,
                  prompt: result.polishedPrompt || result.originalPrompt,
                  artStyle: result.artStyle,
                });
              }
              finishGeneration();
            }
            
            // 错误处理
            if (event.stage === 'error') {
              setError(event.error || '生成失败');
            }
          } catch (e) {
            console.error('[生成管理器] 解析事件失败:', e);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[生成管理器] 生成被取消');
        cancelGeneration();
      } else {
        console.error('[生成管理器] 生成错误:', error);
        setError(error instanceof Error ? error.message : '生成失败');
      }
    } finally {
      isRunningRef.current = false;
      abortControllerRef.current = null;
    }
  }, [startGeneration, updateProgress, addGeneratedImage, finishGeneration, setError, cancelGeneration]);
  
  // 取消生成
  const handleCancel = useCallback(() => {
    isCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cancelGeneration();
    isRunningRef.current = false;
  }, [cancelGeneration]);
  
  // 暴露到全局
  useEffect(() => {
    window.__generationManager = {
      start: startBackgroundGeneration,
      cancel: handleCancel,
      isGenerating: () => state.isGenerating,
    };
  }, [startBackgroundGeneration, handleCancel, state.isGenerating, state.progress, state.message, state.stage]);
  
  return null;
}

// 全局类型声明
declare global {
  interface Window {
    __generationManager?: {
      start: (requestBody: unknown) => Promise<void>;
      cancel: () => void;
      isGenerating: () => boolean;
    };
  }
}
