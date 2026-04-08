'use client';

import { useGeneration } from '@/components/GenerationProvider';
import { useTheme } from '@/components/ThemeProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function GlobalGenerationIndicator() {
  const { state, clearGeneration } = useGeneration();
  const { mode } = useTheme();
  const router = useRouter();
  const [show, setShow] = useState(true);

  // 如果状态完成了，5秒后自动隐藏
  useEffect(() => {
    if (!state.isGenerating && state.generatedImages.length > 0) {
      const timer = setTimeout(() => {
        setShow(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShow(true);
    }
  }, [state.isGenerating, state.generatedImages.length]);

  // 如果没有在生成，也没有完成的结果，不显示
  if (!state.isGenerating && state.generatedImages.length === 0) {
    return null;
  }

  // 如果用户选择隐藏，不显示
  if (!show && !state.isGenerating) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999]">
      <div className={`px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md ${
        mode === 'dark' 
          ? 'bg-gray-900/95 border-white/10' 
          : 'bg-white/95 border-purple-100'
      }`}>
        <div className="flex items-center gap-4">
          {/* 图标 */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            state.isGenerating 
              ? 'bg-gradient-to-br from-purple-500 to-blue-500' 
              : 'bg-gradient-to-br from-green-500 to-teal-500'
          }`}>
            {state.isGenerating ? (
              <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>

          {/* 内容 */}
          <div className="flex flex-col">
            <span className={`text-sm font-medium ${
              mode === 'dark' ? 'text-white' : 'text-gray-800'
            }`}>
              {state.isGenerating ? '梦境正在编织中' : '梦境已编织完成'}
            </span>
            <span className={`text-xs ${
              mode === 'dark' ? 'text-white/60' : 'text-gray-500'
            }`}>
              {state.isGenerating 
                ? `${state.message} (${Math.round(state.progress)}%)` 
                : `${state.generatedImages.length} 张图片已生成`}
            </span>
          </div>

          {/* 进度条 */}
          {state.isGenerating && (
            <div className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-white/20 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          )}

          {/* 查看按钮 */}
          <button
            onClick={() => {
              router.push('/dream');
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'dark'
                ? 'bg-white/10 text-white/80 hover:bg-white/20'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            查看
          </button>

          {/* 关闭按钮 */}
          {!state.isGenerating && (
            <button
              onClick={clearGeneration}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                mode === 'dark'
                  ? 'text-white/40 hover:text-white/70 hover:bg-white/10'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
