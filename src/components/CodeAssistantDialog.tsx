'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CodeAction {
  type: 'read' | 'edit' | 'create' | 'delete';
  filePath: string;
  content?: string;
  description: string;
}

interface CodeAssistantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  position?: { x: number; y: number };
  onPositionChange?: (pos: { x: number; y: number }) => void;
}

// 可拖动 Hook
function useDialogDraggable(initialPosition: { x: number; y: number }) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const hasMovedRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragOffsetRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    hasMovedRef.current = false;
    setIsDragging(true);
  }, [position]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    dragOffsetRef.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
    hasMovedRef.current = false;
    setIsDragging(true);
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragOffsetRef.current.x - position.x;
      const dy = e.clientY - dragOffsetRef.current.y - position.y;
      if (!hasMovedRef.current && Math.sqrt(dx * dx + dy * dy) > 3) {
        hasMovedRef.current = true;
      }
      const newX = Math.max(0, Math.min(window.innerWidth - 600, e.clientX - dragOffsetRef.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 500, e.clientY - dragOffsetRef.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!hasMovedRef.current) {
        const dx = touch.clientX - dragOffsetRef.current.x - position.x;
        const dy = touch.clientY - dragOffsetRef.current.y - position.y;
        if (Math.sqrt(dx * dx + dy * dy) > 3) {
          hasMovedRef.current = true;
        }
      }
      const newX = Math.max(0, Math.min(window.innerWidth - 600, touch.clientX - dragOffsetRef.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 500, touch.clientY - dragOffsetRef.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, position]);

  return {
    position,
    isDragging,
    handleMouseDown,
    handleTouchStart,
  };
}

export function CodeAssistantDialog({ 
  isOpen, 
  onClose, 
  position = { x: 100, y: 80 },
  onPositionChange 
}: CodeAssistantDialogProps) {
  const { mode } = useTheme();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingActions, setPendingActions] = useState<CodeAction[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const draggable = useDialogDraggable(position);

  // 同步位置变化
  useEffect(() => {
    if (draggable.position !== position) {
      onPositionChange?.(draggable.position);
    }
  }, [draggable.position]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 执行代码修改
  const executeActions = async (actions: CodeAction[]) => {
    try {
      const response = await fetch('/api/code-assistant/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions }),
      });

      const data = await response.json();
      
      if (data.success) {
        showToast(`成功执行 ${data.results.length} 个操作！`, 'success');
        let resultMsg = '已完成以下操作：\n\n';
        data.results.forEach((r: { type: string; filePath: string; success: boolean; error?: string }) => {
          if (r.success) {
            resultMsg += `✅ ${r.type}: ${r.filePath}\n`;
          } else {
            resultMsg += `❌ ${r.type}: ${r.filePath} - ${r.error}\n`;
          }
        });
        setMessages(prev => [...prev, { role: 'assistant', content: resultMsg }]);
      } else {
        showToast(data.error || '执行失败', 'error');
        setMessages(prev => [...prev, { role: 'assistant', content: `执行失败: ${data.error}` }]);
      }
    } catch (error) {
      console.error('执行失败:', error);
      showToast('执行失败，请重试', 'error');
    }
    
    setPendingActions([]);
    setShowConfirmDialog(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // 添加空的助手消息占位
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/code-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })).concat([{ role: 'user', content: userMessage }]),
          stream: true,
          enableCodeActions: true, // 启用代码修改功能
        }),
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const decoder = new TextDecoder();
      let fullContent = '';
      let actions: CodeAction[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              // 处理代码操作
              if (parsed.actions) {
                actions = parsed.actions;
              }
              
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: fullContent
                  };
                  return newMessages;
                });
              }
              
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (parseError) {
              // 忽略解析错误，继续处理
            }
          }
        }
      }

      // 如果有代码操作，显示确认对话框
      if (actions.length > 0) {
        setPendingActions(actions);
        setShowConfirmDialog(true);
        
        // 更新消息内容
        fullContent += '\n\n📝 检测到代码修改请求，等待确认...';
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: fullContent
          };
          return newMessages;
        });
      }
    } catch (error) {
      console.error('对话错误:', error);
      showToast('生成失败，请重试', 'error');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[999998] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-2xl mx-4 h-[80vh] max-h-[700px] rounded-2xl flex flex-col shadow-2xl ${
          mode === 'dark' 
            ? 'bg-gray-900 border border-gray-700' 
            : 'bg-white border border-gray-200'
        }`}
        style={{
          position: 'fixed',
          left: draggable.position.x,
          top: draggable.position.y,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 可拖动标题栏 */}
        <div 
          className={`flex items-center justify-between px-6 py-4 border-b cursor-grab active:cursor-grabbing select-none ${
            mode === 'dark' ? 'border-gray-700' : 'border-gray-200'
          } ${draggable.isDragging ? 'opacity-80' : ''}`}
          onMouseDown={draggable.handleMouseDown}
          onTouchStart={draggable.handleTouchStart}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                AI 代码助手
              </h2>
              <p className={`text-xs ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                对话修改项目代码 · 拖动标题栏移动
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className={`p-2 rounded-lg transition-colors ${
                  mode === 'dark'
                    ? 'text-white/60 hover:text-white hover:bg-white/10'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title="清空对话"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                mode === 'dark'
                  ? 'text-white/60 hover:text-white hover:bg-white/10'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 消息区域 */}
        <div className={`flex-1 overflow-y-auto p-6 space-y-4 ${mode === 'dark' ? 'bg-gray-800/30' : 'bg-gray-50/50'}`}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className={`text-lg font-medium mb-2 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                开始对话
              </h3>
              <p className={`text-sm max-w-md mb-4 ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                你可以描述想要的功能、请求修改代码、优化建议等。助手会直接修改代码文件。
              </p>
              <div className={`grid grid-cols-2 gap-2 text-xs ${mode === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                <div className={`px-3 py-2 rounded-lg ${mode === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                  添加用户登录功能
                </div>
                <div className={`px-3 py-2 rounded-lg ${mode === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                  修复首页样式问题
                </div>
                <div className={`px-3 py-2 rounded-lg ${mode === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                  添加深色模式切换
                </div>
                <div className={`px-3 py-2 rounded-lg ${mode === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                  优化图片上传组件
                </div>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-md'
                    : mode === 'dark'
                      ? 'bg-gray-700 text-white rounded-bl-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                }`}
              >
                <div className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${
                  message.role === 'user' ? '' : ''
                }`}>
                  {message.content || (isStreaming && index === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : '')}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 代码修改确认弹窗 */}
        {showConfirmDialog && pendingActions.length > 0 && (
          <div className={`p-4 border-t ${mode === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-100/50'}`}>
            <div className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              检测到 {pendingActions.length} 个代码修改：
            </div>
            <div className={`text-xs mb-3 space-y-1 max-h-32 overflow-y-auto ${
              mode === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`}>
              {pendingActions.map((action, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    action.type === 'create' ? 'bg-green-500/20 text-green-400' :
                    action.type === 'edit' ? 'bg-blue-500/20 text-blue-400' :
                    action.type === 'delete' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {action.type}
                  </span>
                  <span className="truncate">{action.filePath}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setPendingActions([]); setShowConfirmDialog(false); }}
                className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                  mode === 'dark'
                    ? 'bg-white/10 text-white/70 hover:bg-white/20'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                取消
              </button>
              <button
                onClick={() => executeActions(pendingActions)}
                className="flex-1 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                确认执行
              </button>
            </div>
          </div>
        )}

        {/* 输入区域 */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className={`flex items-end gap-3 rounded-xl p-3 ${
            mode === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
          }`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你想要的功能或修改..."
              disabled={isLoading}
              rows={1}
              className={`flex-1 resize-none bg-transparent outline-none text-sm ${
                mode === 'dark' ? 'text-white placeholder-white/40' : 'text-gray-800 placeholder-gray-400'
              } ${isLoading ? 'opacity-50' : ''}`}
              style={{
                maxHeight: '120px',
                minHeight: '24px',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={`p-2.5 rounded-lg transition-all ${
                input.trim() && !isLoading
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : mode === 'dark'
                    ? 'bg-gray-700 text-white/40'
                    : 'bg-gray-200 text-gray-400'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className={`text-xs mt-2 text-center ${mode === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
            按 Enter 发送，Shift + Enter 换行 · 代码修改需要确认
          </p>
        </form>
      </div>
    </div>
  );
}
