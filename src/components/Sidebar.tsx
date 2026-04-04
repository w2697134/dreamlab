'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { useNavigation } from '@/components/NavigationProvider';


interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  showOnlyDeveloper?: boolean;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { mode } = useTheme();
  const { isDeveloper } = useAuth();
  const { showToast } = useToast();
  const { startNavigation } = useNavigation();
  const [navigatingItem, setNavigatingItem] = useState<string | null>(null);
  
  // AI 模型配置弹窗
  const [showSDSettings, setShowSDSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'llm' | 'image' | 'video'>('llm');
  const [tabLoading, setTabLoading] = useState<'llm' | 'image' | 'video' | null>(null);
  
  // SD 配置相关 - 支持多SD
  const [sdInstances, setSdInstances] = useState<any[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string>('default');
  const [isLoading, setIsLoading] = useState(false);
  
  // 添加新SD实例的表单
  const [newSDName, setNewSDName] = useState('');
  const [newSDUrl, setNewSDUrl] = useState('');
  const [newSDSpecialty, setNewSDSpecialty] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // 删除确认弹窗
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<string | null>(null);
  
  // LLM删除确认弹窗
  const [showLlmDeleteConfirm, setShowLlmDeleteConfirm] = useState(false);
  
  // 服务健康状态
  const [healthStatus, setHealthStatus] = useState<{ llm: boolean; image: boolean }>({ llm: false, image: false });
  
  // 检查服务健康状态
  useEffect(() => {
    const checkHealth = async () => {
      const { prefetchHealthStatus } = await import('@/lib/health-check-cache');
      await prefetchHealthStatus();
      // 简化显示，实际状态在生成时检查
      setHealthStatus({ llm: true, image: true });
    };
    checkHealth();
    // 每30秒刷新一次
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // 大语言模型配置
  const [llmConfig, setLlmConfig] = useState({
    name: '千问 (Qwen)',
    url: 'http://qwen.cpolar.top/v1',
    model: 'qwen3.5 9b',
    isAvailable: false,
  });
  const [newLlmUrl, setNewLlmUrl] = useState('');
  const [newLlmModel, setNewLlmModel] = useState('');
  const [isEditingLlm, setIsEditingLlm] = useState(false);

  // LLM故障转移配置
  const [failoverConfig, setFailoverConfig] = useState({
    failoverEnabled: false,
    primaryProvider: 'qwen',
    backupProvider: 'kimi',
  });
  const [loadingFailover, setLoadingFailover] = useState(false);

  // 加载 SD 配置
  const loadSDConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sd-config?action=check-all');
      const data = await response.json();
      if (data.success) {
        setSdInstances(data.instances || []);
        setActiveInstanceId(data.activeInstanceId || '');
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 打开SD设置时加载配置
  useEffect(() => {
    if (showSDSettings) {
      loadSDConfig();
      // 加载LLM配置
      fetch('/api/llm-config')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.config) {
            setFailoverConfig(data.config);
            // 加载LLM配置（如果有）
            if (data.config.name) {
              setLlmConfig({
                name: data.config.name,
                url: data.config.url,
                model: data.config.model,
                isAvailable: data.config.isAvailable || false,
              });
            }
          }
        })
        .catch(console.error);
    }
  }, [showSDSettings, loadSDConfig]);

  // 当路径变化时清除导航状态，除非用户确认了导航
  useEffect(() => {
    let navigationConfirmed = false;
    
    const handleConfirmed = () => {
      navigationConfirmed = true;
    };
    
    window.addEventListener('dream:navigation-confirmed', handleConfirmed);
    
    return () => {
      window.removeEventListener('dream:navigation-confirmed', handleConfirmed);
      if (!navigationConfirmed) {
        setNavigatingItem(null);
      }
    };
  }, [pathname]);

  // 切换活动SD实例
  const handleSetActive = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sd-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-active', id }),
      });
      const data = await response.json();
      if (data.success) {
        showToast('已切换SD实例！', 'success');
        setSdInstances(data.instances || []);
        setActiveInstanceId(data.activeInstanceId);
      } else {
        showToast(data.error || '切换失败', 'error');
      }
    } catch {
      showToast('切换失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 添加新SD实例
  const handleAddSD = async () => {
    if (!newSDSpecialty || !newSDUrl.trim()) {
      showToast('请选择风格类型并填写地址', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/sd-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'add', 
          name: newSDName.trim() || (newSDSpecialty === 'anime' ? '二次元实例' : '写实实例'), 
          url: newSDUrl.trim(),
          specialty: newSDSpecialty,
        }),
      });
      const data = await response.json();
      if (data.success) {
        showToast('SD实例已添加！', 'success');
        // 重新加载配置以确保状态同步
        await loadSDConfig();
        setNewSDName('');
        setNewSDUrl('');
        setNewSDSpecialty('');
        setShowAddForm(false);
      } else {
        showToast(data.error || '添加失败', 'error');
      }
    } catch {
      showToast('添加失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 删除SD实例 - 显示确认弹窗
  const handleDeleteSD = (id: string) => {
    setInstanceToDelete(id);
    setShowDeleteConfirm(true);
  };

  // 确认删除SD实例
  const confirmDeleteSD = async () => {
    if (!instanceToDelete) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sd-config?id=${encodeURIComponent(instanceToDelete)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        showToast('SD实例已删除！', 'success');
        // 重新加载配置以确保状态同步
        await loadSDConfig();
      } else {
        showToast(data.error || '删除失败', 'error');
      }
    } catch {
      showToast('删除失败', 'error');
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
      setInstanceToDelete(null);
    }
  };

  // 保存故障转移配置
  const saveFailoverConfig = async (enabled: boolean) => {
    setLoadingFailover(true);
    try {
      const response = await fetch('/api/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failoverEnabled: enabled }),
      });
      if (response.ok) {
        setFailoverConfig(prev => ({ ...prev, failoverEnabled: enabled }));
        showToast(enabled ? '故障转移已开启' : '故障转移已关闭', 'success');
      } else {
        showToast('保存失败', 'error');
      }
    } catch (error) {
      showToast('保存失败', 'error');
    } finally {
      setLoadingFailover(false);
    }
  };

  // 测试单个SD连接
  const handleTestSD = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sd-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', id }),
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.isAvailable ? 'SD连接正常！' : 'SD连接失败！', data.isAvailable ? 'success' : 'error');
        setSdInstances(data.instances || []);
        setActiveInstanceId(data.activeInstanceId);
      } else {
        showToast(data.error || '测试失败', 'error');
      }
    } catch {
      showToast('测试失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const sidebarItems: SidebarItem[] = [
    {
      id: 'home',
      label: '首页',
      href: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'dream',
      label: '梦境生成',
      href: '/dream',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'dreams',
      label: '梦境库',
      href: '/dreams',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'assessment',
      label: '心理评估',
      href: '/assessment',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C7.5 2 4 5 4 9c0 2.5 1.5 4.5 3 5.5V20h10v-5.5c1.5-1 3-3 3-5.5 0-4-3.5-7-8-7z"/>
          <path d="M9 9h.01"/>
          <path d="M12 9h.01"/>
          <path d="M15 9h.01"/>
          <path d="M9 12h.01"/>
          <path d="M15 12h.01"/>
        </svg>
      ),
    },
    {
      id: 'profile',
      label: '我的',
      href: '/profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    return pathname === href;
  };

  const bgColor = mode === 'dark' ? '#111827' : '#ffffff';
  const borderColor = mode === 'dark' ? '#1f2937' : '#e5e7eb';

  return (
    <>
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* AI 模型配置弹窗 */}
      {showSDSettings && (
        <>
          {/* 遮罩层 */}
          <div 
            className="fixed inset-0 bg-black/50 z-[999998]"
            onClick={() => setShowSDSettings(false)}
          />
          
          {/* 配置面板 */}
          <div
            className={`fixed rounded-2xl shadow-2xl overflow-hidden z-[999999] ${
              mode === 'dark' 
                ? 'bg-gray-900 border border-gray-700' 
                : 'bg-white border border-gray-200'
            }`}
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 420, maxHeight: '80vh' }}
          >
            {/* 标题栏 */}
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${
                mode === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${mode === 'dark' ? 'bg-purple-500/20' : 'bg-sky-500/20'}`}>
                  <svg className={`w-4 h-4 ${mode === 'dark' ? 'text-purple-400' : 'text-sky-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                </div>
                <span className={`font-medium text-sm ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  AI 模型配置
                </span>
              </div>
              
              {/* 刷新按钮 */}
              <div className="flex items-center gap-2">
                {isLoading && (
                  <span className={`text-xs ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                    刷新中...
                  </span>
                )}
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    if (activeTab === 'image') {
                      await loadSDConfig();
                    } else if (activeTab === 'llm') {
                      try {
                        const response = await fetch(`${llmConfig.url}/models`, { method: 'GET' });
                        const isAvailable = response.ok;
                        setLlmConfig({ ...llmConfig, isAvailable });
                        showToast(isAvailable ? '大语言模型连接正常' : '大语言模型连接失败', isAvailable ? 'success' : 'error');
                      } catch {
                        setLlmConfig({ ...llmConfig, isAvailable: false });
                        showToast('大语言模型连接失败', 'error');
                      }
                    }
                    setIsLoading(false);
                  }}
                  disabled={isLoading}
                  className={`p-1.5 rounded-lg transition-all ${
                    isLoading 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-white/10'
                  } ${mode === 'dark' ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <svg 
                    className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                
                <button
                  onClick={() => setShowSDSettings(false)}
                  className={`p-1.5 rounded-lg transition-colors hover:bg-white/10 ${
                    mode === 'dark' ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 标签切换 */}
            <div className={`flex gap-1 p-2 border-b ${mode === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-100 bg-gray-50/30'}`}>
              <button
                onClick={() => {
                  if (activeTab !== 'llm') {
                    setActiveTab('llm');
                    setTabLoading('llm');
                    // 模拟加载延迟
                    setTimeout(() => setTabLoading(null), 300);
                  }
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'llm'
                    ? mode === 'dark'
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'bg-sky-100 text-sky-600'
                    : mode === 'dark'
                      ? 'text-white/50 hover:text-white/70'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tabLoading === 'llm' ? (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3"/>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="0 10 60"/>
                  </svg>
                ) : '📝'}
                大语言
              </button>
              <button
                onClick={() => {
                  if (activeTab !== 'image') {
                    setActiveTab('image');
                    setTabLoading('image');
                    // 加载图片模型配置
                    loadSDConfig().finally(() => setTabLoading(null));
                  }
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'image'
                    ? mode === 'dark'
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'bg-pink-100 text-pink-600'
                    : mode === 'dark'
                      ? 'text-white/50 hover:text-white/70'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tabLoading === 'image' ? (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3"/>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="0 10 60"/>
                  </svg>
                ) : '🎨'}
                图片
              </button>
              <button
                onClick={() => {
                  if (activeTab !== 'video') {
                    setActiveTab('video');
                    setTabLoading('video');
                    // 模拟加载延迟
                    setTimeout(() => setTabLoading(null), 300);
                  }
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'video'
                    ? mode === 'dark'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-purple-100 text-purple-600'
                    : mode === 'dark'
                      ? 'text-white/50 hover:text-white/70'
                      : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tabLoading === 'video' ? (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3"/>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="0 10 60"/>
                  </svg>
                ) : '🎬'}
                视频
              </button>
            </div>

            {/* 内容区域 */}
            <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '50vh' }}>
              {/* 大语言模型配置 */}
              {activeTab === 'llm' && (
                <div className="space-y-3">
                  {/* LLM 实例列表 */}
                  <div className="space-y-2">
                    {llmConfig.name ? (
                      <div className={`p-4 rounded-xl border transition-all ${
                        mode === 'dark' 
                          ? 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]' 
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              llmConfig.isAvailable
                                ? 'bg-green-500 animate-pulse'
                                : 'bg-red-500'
                            }`} />
                            <span className={`font-medium text-sm ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                              {llmConfig.name}
                            </span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            mode === 'dark' ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'
                          }`}>
                            {llmConfig.model}
                          </span>
                        </div>
                        
                        <div className={`text-xs font-mono mb-3 p-1.5 rounded ${mode === 'dark' ? 'bg-black/30 text-white/60' : 'bg-white text-gray-600'}`}>
                          {llmConfig.url}
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              setIsLoading(true);
                              try {
                                const response = await fetch(`${llmConfig.url}/models`, { method: 'GET' });
                                const isAvailable = response.ok;
                                setLlmConfig({ ...llmConfig, isAvailable });
                                showToast(isAvailable ? '大语言模型连接正常' : '大语言模型连接失败', isAvailable ? 'success' : 'error');
                              } catch {
                                setLlmConfig({ ...llmConfig, isAvailable: false });
                                showToast('大语言模型连接失败', 'error');
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                            disabled={isLoading}
                            className={`flex-1 py-2 text-xs rounded-lg transition-all font-medium ${
                              isLoading
                                ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                : (mode === 'dark' 
                                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30' 
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200')
                            }`}
                          >
                            🔍 测试
                          </button>
                          <button
                            onClick={() => setShowLlmDeleteConfirm(true)}
                            disabled={isLoading}
                            className={`py-2 px-4 text-xs rounded-lg transition-all font-medium ${
                              isLoading
                                ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                : (mode === 'dark' 
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' 
                                    : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200')
                            }`}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-6 rounded-xl border-2 border-dashed text-center ${
                        mode === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="text-2xl mb-2">📝</div>
                        <p className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                          暂无大语言模型配置
                        </p>
                        <p className={`text-xs mt-1 ${mode === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
                          点击下方按钮添加
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 编辑表单 */}
                  {isEditingLlm && (
                    <div className={`p-4 rounded-xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="space-y-3">
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                            API 地址
                          </label>
                          <input
                            type="text"
                            value={newLlmUrl}
                            onChange={(e) => setNewLlmUrl(e.target.value)}
                            placeholder="http://qwen.cpolar.top/v1"
                            className={`w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all ${
                              mode === 'dark'
                                ? 'bg-black/30 text-white placeholder-white/30 border border-white/10 focus:border-sky-500 focus:bg-black/40'
                                : 'bg-white text-gray-800 placeholder-gray-400 border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                            模型 ID
                          </label>
                          <input
                            type="text"
                            value={newLlmModel}
                            onChange={(e) => setNewLlmModel(e.target.value)}
                            placeholder="qwen3.5 9b"
                            className={`w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all ${
                              mode === 'dark'
                                ? 'bg-black/30 text-white placeholder-white/30 border border-white/10 focus:border-sky-500 focus:bg-black/40'
                                : 'bg-white text-gray-800 placeholder-gray-400 border border-gray-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100'
                            }`}
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setIsEditingLlm(false)}
                            className={`flex-1 py-2.5 text-sm rounded-lg transition-all font-medium ${
                              mode === 'dark'
                                ? 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            取消
                          </button>
                          <button
                            onClick={async () => {
                              setIsLoading(true);
                              try {
                                const response = await fetch('/api/llm-config', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    name: llmConfig.name || '千问 (Qwen)',
                                    url: newLlmUrl || llmConfig.url,
                                    model: newLlmModel || llmConfig.model,
                                  }),
                                });
                                const data = await response.json();
                                if (data.success) {
                                  setLlmConfig({
                                    ...llmConfig,
                                    url: newLlmUrl || llmConfig.url,
                                    model: newLlmModel || llmConfig.model,
                                  });
                                  setIsEditingLlm(false);
                                  showToast('配置已保存', 'success');
                                } else {
                                  showToast(data.error || '保存失败', 'error');
                                }
                              } catch {
                                showToast('保存失败', 'error');
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                            disabled={isLoading}
                            className={`flex-1 py-2.5 text-sm rounded-lg transition-all font-medium ${
                              isLoading
                                ? 'bg-gray-500/50 text-white/50 cursor-not-allowed'
                                : (mode === 'dark'
                                    ? 'bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-500/20'
                                    : 'bg-sky-500 text-white hover:bg-sky-600 shadow-lg shadow-sky-500/20')
                            }`}
                          >
                            {isLoading ? '保存中...' : '保存配置'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 故障转移开关 */}
                  <div className={`p-3 rounded-xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`font-medium text-sm ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                          🔄 故障转移
                        </h3>
                        <p className={`text-xs mt-0.5 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                          千问失败时自动切换到Kimi
                        </p>
                      </div>
                      <button
                        onClick={() => saveFailoverConfig(!failoverConfig.failoverEnabled)}
                        disabled={loadingFailover}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                          failoverConfig.failoverEnabled
                            ? 'bg-green-500'
                            : mode === 'dark'
                              ? 'bg-white/20'
                              : 'bg-gray-300'
                        } ${loadingFailover ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-out"
                          style={{ transform: failoverConfig.failoverEnabled ? 'translateX(20px)' : 'translateX(0)' }}
                        />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${mode === 'dark' ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'}`}>
                        主:千问
                      </span>
                      <span className={mode === 'dark' ? 'text-white/40' : 'text-gray-400'}>→</span>
                      <span className={`px-1.5 py-0.5 rounded ${
                        failoverConfig.failoverEnabled
                          ? mode === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                          : mode === 'dark' ? 'bg-white/10 text-white/40' : 'bg-gray-200 text-gray-400'
                      }`}>
                        备:Kimi {failoverConfig.failoverEnabled ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>

                  {/* 添加配置按钮 */}
                  {!isEditingLlm && (
                    <button
                      onClick={() => {
                        setNewLlmUrl(llmConfig.url);
                        setNewLlmModel(llmConfig.model);
                        setIsEditingLlm(true);
                      }}
                      className={`w-full py-3 text-sm rounded-xl border-2 border-dashed transition-all font-medium ${
                        mode === 'dark'
                          ? 'border-white/10 text-white/60 hover:border-sky-500/50 hover:text-sky-400 hover:bg-sky-500/10'
                          : 'border-gray-300 text-gray-600 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50'
                      }`}
                    >
                      + 添加配置
                    </button>
                  )}
                </div>
              )}

              {/* 视频模型配置 */}
              {activeTab === 'video' && (
                <div className="space-y-3">
                  {/* 视频实例列表 */}
                  <div className="space-y-2">
                    <div className={`p-4 rounded-xl border transition-all ${
                      mode === 'dark' 
                        ? 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]' 
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full bg-red-500`} />
                          <span className={`font-medium text-sm ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                            视频生成模型
                          </span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          mode === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
                        }`}>
                          开发中
                        </span>
                      </div>
                      
                      <div className={`text-xs font-mono mb-3 p-1.5 rounded ${mode === 'dark' ? 'bg-black/30 text-white/60' : 'bg-white text-gray-600'}`}>
                        未配置
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          disabled
                          className={`flex-1 py-2 text-xs rounded-lg transition-all font-medium cursor-not-allowed ${
                            mode === 'dark' 
                              ? 'bg-blue-500/10 text-blue-400/50 border border-blue-500/20' 
                              : 'bg-blue-50/50 text-blue-600/50 border border-blue-200/50'
                          }`}
                        >
                          🔍 测试
                        </button>
                        <button
                          disabled
                          className={`py-2 px-4 text-xs rounded-lg transition-all font-medium cursor-not-allowed ${
                            mode === 'dark' 
                              ? 'bg-red-500/10 text-red-400/50 border border-red-500/20' 
                              : 'bg-red-50/50 text-red-600/50 border border-red-200/50'
                          }`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 添加配置按钮（禁用状态） */}
                  <button
                    disabled
                    className={`w-full py-3 text-sm rounded-xl border-2 border-dashed transition-all font-medium cursor-not-allowed ${
                      mode === 'dark'
                        ? 'border-white/5 text-white/30'
                        : 'border-gray-200 text-gray-400'
                    }`}
                  >
                    + 添加配置
                  </button>
                </div>
              )}

              {/* 图片模型配置 */}
              {activeTab === 'image' && (
                <div className="space-y-3">
                  {/* SD 实例列表 */}
                  <div className="space-y-2">
                    {sdInstances.length === 0 ? (
                      <div className={`p-6 rounded-xl border-2 border-dashed text-center ${
                        mode === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="text-2xl mb-2">🎨</div>
                        <p className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                          暂无图片模型实例
                        </p>
                        <p className={`text-xs mt-1 ${mode === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
                          点击下方按钮添加
                        </p>
                      </div>
                    ) : (
                      sdInstances.map((instance) => (
                        <div
                          key={instance.id}
                          className={`p-4 rounded-xl border transition-all ${
                            mode === 'dark' 
                              ? 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]' 
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                instance.isAvailable
                                  ? 'bg-green-500 animate-pulse'
                                  : 'bg-red-500'
                              }`} />
                              <span className={`font-medium text-sm ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                {instance.name}
                              </span>
                            </div>

                          </div>
                          
                          <div className={`text-xs font-mono mb-3 p-1.5 rounded ${mode === 'dark' ? 'bg-black/30 text-white/60' : 'bg-white text-gray-600'}`}>
                            {instance.url}
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleTestSD(instance.id)}
                              disabled={isLoading}
                              className={`flex-1 py-2 text-xs rounded-lg transition-all font-medium ${
                                isLoading
                                  ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                  : (mode === 'dark' 
                                      ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30' 
                                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200')
                              }`}
                            >
                              🔍 测试
                            </button>
                            <button
                              onClick={() => handleDeleteSD(instance.id)}
                              disabled={isLoading}
                              className={`py-2 px-4 text-xs rounded-lg transition-all font-medium ${
                                isLoading
                                  ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                                  : (mode === 'dark' 
                                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' 
                                      : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200')
                              }`}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 添加新SD实例表单 */}
                  {showAddForm ? (
                    <div className={`p-4 rounded-xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="space-y-3">
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                            风格类型
                          </label>
                          <select
                            value={newSDSpecialty}
                            onChange={(e) => {
                              const specialty = e.target.value;
                              setNewSDSpecialty(specialty);
                              // 自动设置实例名称
                              setNewSDName(specialty === 'anime' ? '二次元实例' : '写实实例');
                            }}
                            className={`w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all ${
                              mode === 'dark'
                                ? 'bg-black/30 text-white border border-white/10 focus:border-pink-500 focus:bg-black/40'
                                : 'bg-white text-gray-800 border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100'
                            }`}
                          >
                            <option value="">选择风格...</option>
                            <option value="realistic">写实 - 照片级逼真</option>
                            <option value="anime">二次元 - 动漫插画</option>
                          </select>
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                            API 地址
                          </label>
                          <input
                            type="text"
                            value={newSDUrl}
                            onChange={(e) => setNewSDUrl(e.target.value)}
                            placeholder="http://textimage.cpolar.top"
                            className={`w-full px-3 py-2.5 text-sm rounded-lg outline-none transition-all ${
                              mode === 'dark'
                                ? 'bg-black/30 text-white placeholder-white/30 border border-white/10 focus:border-pink-500 focus:bg-black/40'
                                : 'bg-white text-gray-800 placeholder-gray-400 border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100'
                            }`}
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => {
                              setShowAddForm(false);
                              setNewSDName('');
                              setNewSDUrl('');
                              setNewSDSpecialty('');
                            }}
                            disabled={isLoading}
                            className={`flex-1 py-2.5 text-sm rounded-lg transition-all font-medium ${
                              mode === 'dark'
                                ? 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            取消
                          </button>
                          <button
                            onClick={handleAddSD}
                            disabled={isLoading}
                            className={`flex-1 py-2.5 text-sm rounded-lg transition-all font-medium ${
                              isLoading
                                ? (mode === 'dark' ? 'bg-pink-500/30 text-white/50 cursor-not-allowed' : 'bg-pink-300 text-white cursor-not-allowed')
                                : (mode === 'dark' ? 'bg-pink-600 text-white hover:bg-pink-500 shadow-lg shadow-pink-500/20' : 'bg-pink-500 text-white hover:bg-pink-600 shadow-lg shadow-pink-500/20')
                            }`}
                          >
                            {isLoading ? '⏳ 添加中...' : '✓ 确认添加'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddForm(true)}
                      disabled={isLoading}
                      className={`w-full py-3 text-sm rounded-xl border-2 border-dashed transition-all font-medium ${
                        isLoading
                          ? 'border-gray-500/20 text-gray-400 cursor-not-allowed'
                          : (mode === 'dark'
                              ? 'border-white/10 text-white/60 hover:border-pink-500/50 hover:text-pink-400 hover:bg-pink-500/10'
                              : 'border-gray-300 text-gray-600 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50')
                      }`}
                    >
                      + 添加 SD 实例
                    </button>
                  )}

                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* SD删除确认弹窗 */}
      {showDeleteConfirm && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[999998]"
            onClick={() => setShowDeleteConfirm(false)}
          />
          
          <div
            className={`fixed rounded-2xl shadow-2xl overflow-hidden z-[999999] ${
              mode === 'dark' 
                ? 'bg-gray-900 border border-gray-700' 
                : 'bg-white border border-gray-200'
            }`}
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 320 }}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${
                mode === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className={`font-medium text-sm ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  确认删除
                </span>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={`p-1.5 rounded-lg transition-colors hover:bg-white/10 ${
                  mode === 'dark' ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <p className={`text-sm mb-4 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                确定要删除这个SD实例吗？此操作无法撤销。
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isLoading}
                  className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                    mode === 'dark'
                      ? 'bg-white/10 text-white/70 hover:bg-white/20'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteSD}
                  disabled={isLoading}
                  className={`flex-1 py-2 text-sm rounded-lg transition-colors font-medium ${
                    isLoading
                      ? 'bg-red-500/50 text-white/50 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isLoading ? '删除中...' : '删除'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* LLM删除确认弹窗 */}
      {showLlmDeleteConfirm && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[999998]"
            onClick={() => setShowLlmDeleteConfirm(false)}
          />
          
          <div
            className={`fixed rounded-2xl shadow-2xl overflow-hidden z-[999999] ${
              mode === 'dark' 
                ? 'bg-gray-900 border border-gray-700' 
                : 'bg-white border border-gray-200'
            }`}
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 320 }}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b ${
                mode === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <span className={`font-medium text-sm ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  确认删除
                </span>
              </div>
              <button
                onClick={() => setShowLlmDeleteConfirm(false)}
                className={`p-1.5 rounded-lg transition-colors hover:bg-white/10 ${
                  mode === 'dark' ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <p className={`text-sm mb-4 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                确定要删除这个大语言模型配置吗？此操作无法撤销。
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLlmDeleteConfirm(false)}
                  disabled={isLoading}
                  className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
                    mode === 'dark'
                      ? 'bg-white/10 text-white/70 hover:bg-white/20'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const response = await fetch('/api/llm-config', {
                        method: 'DELETE',
                      });
                      const data = await response.json();
                      if (data.success) {
                        setLlmConfig({
                          name: '',
                          url: '',
                          model: '',
                          isAvailable: false,
                        });
                        setShowLlmDeleteConfirm(false);
                        showToast('配置已删除', 'success');
                      } else {
                        showToast(data.error || '删除失败', 'error');
                      }
                    } catch {
                      showToast('删除失败', 'error');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className={`flex-1 py-2 text-sm rounded-lg transition-colors font-medium ${
                    isLoading
                      ? 'bg-red-500/50 text-white/50 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isLoading ? '删除中...' : '删除'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 侧边栏主体 */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          width: collapsed ? 64 : 256,
          zIndex: 20,
          backgroundColor: bgColor,
          borderRight: `1px solid ${borderColor}`,
          transition: 'width 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
      >
        {/* Logo区域 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 16,
            paddingRight: 16,
            backgroundColor: bgColor,
            borderBottom: `1px solid ${borderColor}`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #a855f7, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <span style={{ color: 'white', fontSize: 18 }}>🌙</span>
            </div>
            {!collapsed && (
              <span style={{
                fontWeight: 'bold',
                fontSize: 18,
                color: mode === 'dark' ? '#ffffff' : '#1f2937',
                whiteSpace: 'nowrap'
              }}>
                忆梦空间
              </span>
            )}
          </div>
        </div>

        {/* 导航菜单区域 */}
        <nav
          style={{
            flex: 1,
            paddingTop: 16,
            paddingBottom: 16,
            paddingLeft: 8,
            paddingRight: 8,
            overflowY: collapsed ? 'hidden' : 'auto',
            overflowX: 'hidden',
            backgroundColor: bgColor
          }}
        >
          {sidebarItems.map((item) => {
            if (item.showOnlyDeveloper && !isDeveloper) {
              return null;
            }

            const active = isActive(item.href);
            const isNavigating = navigatingItem === item.id;

            const handleClick = (e: React.MouseEvent) => {
              if (!active) {
                // 触发全局导航加载状态
                startNavigation();
                setNavigatingItem(item.id);
              }
            };

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={handleClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 10,
                  paddingBottom: 10,
                  borderRadius: 8,
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  backgroundColor: active 
                    ? (mode === 'dark' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.15)')
                    : 'transparent',
                  color: active
                    ? (mode === 'dark' ? '#c4b5fd' : '#0284c7')
                    : (mode === 'dark' ? '#9ca3af' : '#4b5563'),
                  borderWidth: active ? 1 : 0,
                  borderStyle: active ? 'solid' : 'none',
                  borderColor: active
                    ? (mode === 'dark' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(56, 189, 248, 0.3)')
                    : 'transparent',
                  position: 'relative',
                  width: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = mode === 'dark' ? '#1f2937' : '#f0f9ff';
                    e.currentTarget.style.color = mode === 'dark' ? '#ffffff' : '#0369a1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = mode === 'dark' ? '#9ca3af' : '#4b5563';
                  }
                }}
              >
                {isNavigating ? (
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg 
                      style={{ 
                        width: 20, 
                        height: 20, 
                        animation: 'spin 0.6s linear infinite'
                      }} 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke={mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'} 
                        strokeWidth="2" 
                        fill="none"
                      />
                      <circle 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke={mode === 'dark' ? '#a855f7' : '#0ea5e9'} 
                        strokeWidth="2" 
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray="0 10 60"
                      />
                    </svg>
                  </span>
                ) : (
                  <span style={{ color: active ? (mode === 'dark' ? '#a855f7' : '#0ea5e9') : 'inherit', flexShrink: 0 }}>
                    {item.icon}
                  </span>
                )}
                {!collapsed && (
                  <span style={{ 
                    fontWeight: 500, 
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    opacity: isNavigating ? 0.6 : 1,
                    transition: 'opacity 0.2s ease'
                  }}>
                    {isNavigating ? '跳转中...' : item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 开发者工具区域 */}
        <div style={{ 
          borderTop: `1px solid ${borderColor}`, 
          backgroundColor: bgColor,
          overflowX: 'hidden',
          width: '100%'
        }}>
          {/* SD API 配置 */}
          <button
            onClick={() => setShowSDSettings(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: collapsed ? '10px 12px' : '10px 12px',
              margin: collapsed ? '0 8px' : '4px 8px',
              borderRadius: 8,
              width: 'calc(100% - 16px)',
              border: 'none',
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              backgroundColor: 'transparent',
              color: mode === 'dark' ? '#9ca3af' : '#4b5563',
              position: 'relative',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = mode === 'dark' ? '#1f2937' : '#f3f4f6';
              e.currentTarget.style.color = mode === 'dark' ? '#ffffff' : '#111827';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = mode === 'dark' ? '#9ca3af' : '#4b5563';
            }}
          >
            <span style={{ flexShrink: 0 }}>
              <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            </span>
            {!collapsed && (
              <span style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap' }}>
                SD 配置
              </span>
            )}
          </button>
          
          {/* 服务状态指示器 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: collapsed ? '10px 12px' : '10px 12px',
              margin: collapsed ? '0 8px' : '4px 8px',
              borderRadius: 8,
              width: 'calc(100% - 16px)',
              backgroundColor: 'transparent',
              color: mode === 'dark' ? '#9ca3af' : '#4b5563',
            }}
          >
            <span style={{ flexShrink: 0 }}>
              <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </span>
            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap' }}>
                  服务状态
                </span>
                <span style={{ fontSize: 11, opacity: 0.7, whiteSpace: 'nowrap' }}>
                  <span style={{ color: healthStatus.llm ? '#10b981' : '#ef4444' }}>● LLM</span>
                  {' '}
                  <span style={{ color: healthStatus.image ? '#10b981' : '#ef4444' }}>● SD</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 收起/展开按钮 */}
        <div
          style={{
            padding: collapsed ? 4 : 8,
            borderTop: `1px solid ${borderColor}`,
            backgroundColor: bgColor
          }}
        >
          <button
            onClick={onToggle}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              color: mode === 'dark' ? '#9ca3af' : '#6b7280',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = mode === 'dark' ? '#1f2937' : '#f3f4f6';
              e.currentTarget.style.color = mode === 'dark' ? '#ffffff' : '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = mode === 'dark' ? '#9ca3af' : '#6b7280';
            }}
          >
            {collapsed ? (
              <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg style={{ width: 20, height: 20 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            )}
            {!collapsed && (
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                收起侧边栏
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
