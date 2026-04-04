'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  RefreshCw, 
  Trash2, 
  Play, 
  Pause, 
  Filter, 
  Terminal,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

type LogType = 'app' | 'console' | 'dev';

interface LogData {
  logs: string[];
  total: number;
  returned: number;
  logType: LogType;
  lastUpdated: string;
  error?: string;
}

export default function DevConsolePage() {
  const router = useRouter();
  const { mode, toggleMode } = useTheme();
  const [activeLog, setActiveLog] = useState<LogType>('app');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState('');
  const [lineCount, setLineCount] = useState(100);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载日志
  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: activeLog,
        lines: lineCount.toString(),
        filter
      });
      
      const response = await fetch(`/api/dev-logs?${params}`);
      const data: LogData = await response.json();
      
      if (data.logs) {
        setLogs(data.logs);
        setLastUpdated(data.lastUpdated || new Date().toISOString());
      }
    } catch (error) {
      console.error('[DevConsole] 加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 清空日志
  const clearLogs = async () => {
    if (!confirm('确定要清空日志吗？')) return;
    
    try {
      const response = await fetch(`/api/dev-logs?type=${activeLog}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadLogs();
      }
    } catch (error) {
      console.error('[DevConsole] 清空日志失败:', error);
    }
  };

  // 自动刷新
  useEffect(() => {
    loadLogs();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadLogs, 5000); // 每5秒刷新，降低延迟
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeLog, filter, lineCount, autoRefresh]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current && autoRefresh) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // 解析日志行获取级别
  const getLogLevel = (line: string): 'info' | 'warn' | 'error' | 'log' => {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('exception')) return 'error';
    if (lower.includes('warn') || lower.includes('warning')) return 'warn';
    if (lower.includes('info')) return 'info';
    return 'log';
  };

  // 检测是否为梦境生成开始的日志
  const isGenerationStart = (line: string): boolean => {
    const lower = line.toLowerCase();
    return (
      lower.includes('开始生成') ||
      lower.includes('生成图片') || 
      lower.includes('[生成]') ||
      lower.includes('生成第') ||
      lower.includes('生图')
    );
  };

  // 格式化日志行
  const formatLogLine = (line: string) => {
    try {
      // 尝试解析JSON格式日志
      const parsed = JSON.parse(line);
      if (parsed.message) {
        return {
          level: getLogLevel(parsed.level || parsed.message),
          content: parsed.message,
          timestamp: parsed.timestamp ? new Date(parsed.timestamp).toLocaleTimeString() : null
        };
      }
    } catch {
      // 不是JSON格式，直接处理
    }
    
    return {
      level: getLogLevel(line),
      content: line,
      timestamp: null
    };
  };

  // 下载日志
  const downloadLogs = () => {
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeLog}-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className={`min-h-screen text-gray-100 ${mode === 'dark' ? '' : 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd]'}`}
      style={{ backgroundColor: mode === 'dark' ? '#020617' : '#f0f9ff' }}
    >
      <button
        onClick={toggleMode}
        className="fixed top-4 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl z-50 transition-all duration-300 shadow-lg"
        style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)' }}
      >
        {mode === 'light' ? '🌙' : '☀️'}
      </button>
      {/* 顶部导航 */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-purple-400" />
              <h1 className="text-xl font-bold">开发者控制台</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">自动刷新 (5秒)</span>
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={loadLogs}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              手动刷新
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadLogs}
              className="text-gray-400 hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              下载
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={clearLogs}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              清空
            </Button>
            <span className="text-xs text-gray-500">
              💡 觉得延迟高？关闭自动刷新，用「手动刷新」按钮
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
          {/* 统计卡片 */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                总日志行数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">{logs.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                当前日志类型
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400 uppercase">{activeLog}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                错误数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">
                {logs.filter(l => getLogLevel(l) === 'error').length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-500" />
                最后更新
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-purple-400">
                {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '-'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Tabs value={activeLog} onValueChange={(v) => setActiveLog(v as LogType)}>
                <TabsList className="bg-gray-800">
                  <TabsTrigger value="app">应用日志</TabsTrigger>
                  <TabsTrigger value="console">控制台日志</TabsTrigger>
                  <TabsTrigger value="dev">开发日志</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="过滤日志..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-64 bg-gray-800 border-gray-700"
                  />
                </div>
                <select
                  value={lineCount}
                  onChange={(e) => setLineCount(parseInt(e.target.value))}
                  className="bg-gray-800 border-gray-700 rounded px-3 py-1.5 text-sm"
                >
                  <option value={50}>50行</option>
                  <option value={100}>100行</option>
                  <option value={200}>200行</option>
                  <option value={500}>500行</option>
                  <option value={1000}>1000行</option>
                </select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* 日志内容区域 */}
            <div
              ref={scrollRef}
              className="h-[60vh] overflow-y-auto bg-gray-950 rounded-lg p-3 font-mono text-xs"
            >
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Terminal className="w-12 h-12 mb-4 opacity-50" />
                  <p>暂无日志数据</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {logs.map((line, index) => {
                    const { level, content, timestamp } = formatLogLine(line);
                    const isGenStart = isGenerationStart(line);
                    const levelColors = {
                      info: 'text-blue-400',
                      warn: 'text-yellow-400',
                      error: 'text-red-400',
                      log: 'text-gray-300'
                    };
                    
                    return (
                      <div
                        key={index}
                        className={`flex items-start gap-1.5 py-0.5 rounded px-1 ${
                          isGenStart 
                            ? 'bg-green-500/20 border-l-2 border-green-500 text-green-300' 
                            : `${levelColors[level]} hover:bg-gray-900/50`
                        }`}
                      >
                        <span className={`flex-shrink-0 w-16 ${isGenStart ? 'text-green-400' : 'text-gray-500'}`}>
                          {timestamp || `#${index}`}
                        </span>
                        {isGenStart && (
                          <span className="flex-shrink-0">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-500/30 text-green-300 border border-green-500/50">
                              🚀 生成开始
                            </span>
                          </span>
                        )}
                        <span className="break-all leading-relaxed">{content}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
