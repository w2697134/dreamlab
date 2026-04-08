'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeProvider';

interface LogEntry {
  id: number;
  timestamp: string;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
}

export default function LogConsole() {
  const { mode } = useTheme();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const logIdRef = useRef(0);
  const maxLogs = 100;

  useEffect(() => {
    // 拦截 console 方法
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    const addLog = (type: LogEntry['type'], args: any[]) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      const newLog: LogEntry = {
        id: ++logIdRef.current,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        type,
        message: message.slice(0, 500), // 限制长度
      };

      setLogs(prev => {
        const updated = [...prev, newLog];
        if (updated.length > maxLogs) {
          return updated.slice(-maxLogs);
        }
        return updated;
      });
    };

    console.log = (...args: any[]) => {
      addLog('log', args);
      originalLog.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      addLog('warn', args);
      originalWarn.apply(console, args);
    };

    console.error = (...args: any[]) => {
      addLog('error', args);
      originalError.apply(console, args);
    };

    console.info = (...args: any[]) => {
      addLog('info', args);
      originalInfo.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      default: return 'text-green-400';
    }
  };

  const getLogBgColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'bg-red-500/10';
      case 'warn': return 'bg-yellow-500/10';
      case 'info': return 'bg-blue-500/10';
      default: return 'bg-green-500/10';
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className={`fixed bottom-4 left-4 z-50 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
          mode === 'dark' 
            ? 'bg-gray-800 text-white/70 hover:bg-gray-700 border border-white/10' 
            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 shadow-sm'
        }`}
      >
        📋 显示日志
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 left-4 z-50 rounded-lg overflow-hidden transition-all duration-300 ${
        mode === 'dark' 
          ? 'bg-gray-900/95 border border-white/10 shadow-2xl' 
          : 'bg-white/95 border border-gray-200 shadow-xl'
      }`}
      style={{
        width: isExpanded ? '600px' : '280px',
        height: isExpanded ? '400px' : '36px',
      }}
    >
      {/* 标题栏 */}
      <div
        className={`flex items-center justify-between px-3 py-2 cursor-pointer select-none ${
          mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <span className={`text-xs font-medium ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
            日志控制台
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${mode === 'dark' ? 'bg-white/10 text-white/50' : 'bg-gray-200 text-gray-500'}`}>
            {logs.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isExpanded && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearLogs();
                }}
                className={`p-1 rounded text-xs transition-colors ${
                  mode === 'dark' ? 'hover:bg-white/10 text-white/50' : 'hover:bg-gray-200 text-gray-400'
                }`}
                title="清空日志"
              >
                🗑️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVisible(false);
                }}
                className={`p-1 rounded text-xs transition-colors ${
                  mode === 'dark' ? 'hover:bg-white/10 text-white/50' : 'hover:bg-gray-200 text-gray-400'
                }`}
                title="隐藏"
              >
                ✕
              </button>
            </>
          )}
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''} ${
              mode === 'dark' ? 'text-white/50' : 'text-gray-400'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 日志内容 */}
      {isExpanded && (
        <div className="overflow-auto" style={{ height: 'calc(400px - 36px)' }}>
          {logs.length === 0 ? (
            <div className={`flex items-center justify-center h-full text-xs ${
              mode === 'dark' ? 'text-white/30' : 'text-gray-400'
            }`}>
              暂无日志...
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`text-xs font-mono p-1.5 rounded ${getLogBgColor(log.type)}`}
                >
                  <span className={mode === 'dark' ? 'text-white/40' : 'text-gray-400'}>
                    {log.timestamp}
                  </span>
                  <span className={`ml-2 ${getLogColor(log.type)}`}>
                    [{log.type.toUpperCase()}]
                  </span>
                  <span className={`ml-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
