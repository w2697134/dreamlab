'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';

// ==================== 类型定义 ====================

interface LLMConfig {
  id: string;
  name: string;
  url: string;
  model: string;
  isAvailable: boolean;
}

interface SDConfig {
  id: string;
  name: string;
  url: string;
  specialty: string;
  fixedModelFile: string;
  fixedModelName: string;
  isAvailable: boolean;
}

interface VideoConfig {
  id: string;
  name: string;
  url: string;
  model: string;
  isAvailable: boolean;
}

// ==================== 组件 ====================

export default function SDManagerPage() {
  const { mode } = useTheme();
  const { showToast } = useToast();
  
  // 三个服务的配置
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [sdConfigs, setSdConfigs] = useState<SDConfig[]>([]);
  const [videoConfig, setVideoConfig] = useState<VideoConfig | null>(null);
  
  // LLM故障转移配置
  const [failoverConfig, setFailoverConfig] = useState({
    failoverEnabled: false,
    primaryProvider: 'qwen',
    backupProvider: 'kimi',
  });
  const [loadingFailover, setLoadingFailover] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'llm' | 'image' | 'video'>('llm');

  // 加载所有配置
  const loadConfigs = async () => {
    try {
      setLoading(true);
      
      // 从 localStorage 读取配置（或从 API 获取）
      const savedLlm = localStorage.getItem('llmConfig');
      const savedSds = localStorage.getItem('sdConfigs');
      const savedVideo = localStorage.getItem('videoConfig');
      
      if (savedLlm) {
        setLlmConfig(JSON.parse(savedLlm));
      } else {
        // 默认千问配置
        setLlmConfig({
          id: 'default-llm',
          name: '千问 (Qwen)',
          url: 'http://qwen.cpolar.top/v1',
          model: 'qwen3.5 9b',
          isAvailable: false,
        });
      }
      
      if (savedSds) {
        setSdConfigs(JSON.parse(savedSds));
      } else {
        setSdConfigs([]);
      }
      
      if (savedVideo) {
        setVideoConfig(JSON.parse(savedVideo));
      } else {
        setVideoConfig(null);
      }
      
      // 同时加载 SD 实例列表
      const response = await fetch('/api/sd-config');
      if (response.ok) {
        const data = await response.json();
        // 将 SD 实例转换为 SDConfig 格式
        const sdList: SDConfig[] = (data.instances || []).map((inst: any) => ({
          id: inst.id,
          name: inst.name,
          url: inst.url,
          specialty: inst.specialty || 'anime',
          fixedModelFile: inst.fixedModelFile || '',
          fixedModelName: inst.fixedModelName || '待配置',
          isAvailable: inst.isAvailable || false,
        }));
        setSdConfigs(sdList);
      }
      
      // 加载故障转移配置
      const failoverRes = await fetch('/api/llm-config');
      if (failoverRes.ok) {
        const data = await failoverRes.json();
        if (data.success && data.config) {
          setFailoverConfig(data.config);
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      showToast('加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  // 保存配置到 localStorage
  const saveLlmConfig = (config: LLMConfig) => {
    localStorage.setItem('llmConfig', JSON.stringify(config));
    setLlmConfig(config);
    showToast('大语言模型配置已保存', 'success');
  };

  const saveVideoConfig = (config: VideoConfig) => {
    localStorage.setItem('videoConfig', JSON.stringify(config));
    setVideoConfig(config);
    showToast('视频模型配置已保存', 'success');
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

  // 检查服务可用性
  const checkLLMAvailability = async () => {
    if (!llmConfig) return;
    try {
      const response = await fetch(`${llmConfig.url}/models`, { method: 'GET' });
      const isAvailable = response.ok;
      const newConfig = { ...llmConfig, isAvailable };
      setLlmConfig(newConfig);
      localStorage.setItem('llmConfig', JSON.stringify(newConfig));
      showToast(isAvailable ? '大语言模型可用' : '大语言模型不可用', isAvailable ? 'success' : 'error');
    } catch {
      const newConfig = { ...llmConfig, isAvailable: false };
      setLlmConfig(newConfig);
      localStorage.setItem('llmConfig', JSON.stringify(newConfig));
      showToast('大语言模型不可用', 'error');
    }
  };

  const checkSDAvailability = async (id: string) => {
    try {
      const response = await fetch('/api/sd-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', id }),
      });
      if (response.ok) {
        await loadConfigs();
        showToast('检查完成', 'success');
      }
    } catch (error) {
      showToast('检查失败', 'error');
    }
  };

  const checkVideoAvailability = async () => {
    if (!videoConfig) return;
    // 视频服务检查（预留）
    showToast('视频模型检查功能预留', 'warning');
  };

  // 删除 SD 实例
  const deleteSDInstance = async (id: string) => {
    if (!confirm('确定要删除这个图片模型实例吗？')) return;
    try {
      const response = await fetch(`/api/sd-config?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await loadConfigs();
        showToast('删除成功', 'success');
      }
    } catch (error) {
      showToast('删除失败', 'error');
    }
  };

  // 添加 SD 实例
  const [showAddSDModal, setShowAddSDModal] = useState(false);
  const [newSDName, setNewSDName] = useState('');
  const [newSDUrl, setNewSDUrl] = useState('');
  const [newSDSpecialty, setNewSDSpecialty] = useState('anime');

  const addSDInstance = async () => {
    if (!newSDName.trim() || !newSDUrl.trim()) {
      showToast('请填写名称和URL', 'warning');
      return;
    }
    try {
      const response = await fetch('/api/sd-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          name: newSDName.trim(),
          url: newSDUrl.trim(),
          specialty: newSDSpecialty,
        }),
      });
      if (response.ok) {
        await loadConfigs();
        setShowAddSDModal(false);
        setNewSDName('');
        setNewSDUrl('');
        setNewSDSpecialty('anime');
        showToast('添加成功', 'success');
      }
    } catch (error) {
      showToast('添加失败', 'error');
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${mode === 'dark' ? 'bg-[#020617]' : 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd]'}`}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className={mode === 'dark' ? 'text-white' : 'text-gray-800'}>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-8 ${mode === 'dark' ? 'bg-[#020617]' : 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd]'}`}>
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold mb-2 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            AI 模型配置
          </h1>
          <p className={mode === 'dark' ? 'text-white/60' : 'text-gray-500'}>
            配置你的大语言模型、图片生成模型和视频生成模型
          </p>
        </div>

        {/* 标签切换 */}
        <div className={`flex gap-2 mb-6 p-1 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'llm'
                ? mode === 'dark'
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'bg-sky-100 text-sky-600'
                : mode === 'dark'
                  ? 'text-white/60 hover:text-white/80'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-2">📝</span>
            1. 大语言模型
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'image'
                ? mode === 'dark'
                  ? 'bg-pink-500/20 text-pink-400'
                  : 'bg-pink-100 text-pink-600'
                : mode === 'dark'
                  ? 'text-white/60 hover:text-white/80'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-2">🎨</span>
            2. 图片模型
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'video'
                ? mode === 'dark'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-purple-100 text-purple-600'
                : mode === 'dark'
                  ? 'text-white/60 hover:text-white/80'
                  : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-2">🎬</span>
            3. 视频模型
          </button>
        </div>

        {/* 大语言模型配置 */}
        {activeTab === 'llm' && (
          <div className={`p-6 rounded-2xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className={`text-xl font-bold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  大语言模型配置
                </h2>
                <p className={`text-sm mt-1 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                  用于文本润色、关键词生成、梦境分析等
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${llmConfig?.isAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>

            {llmConfig ? (
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                    模型名称
                  </label>
                  <input
                    type="text"
                    value={llmConfig.name}
                    onChange={(e) => setLlmConfig({ ...llmConfig, name: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      mode === 'dark'
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                    API URL
                  </label>
                  <input
                    type="text"
                    value={llmConfig.url}
                    onChange={(e) => setLlmConfig({ ...llmConfig, url: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border font-mono text-sm ${
                      mode === 'dark'
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-800'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                    模型 ID
                  </label>
                  <input
                    type="text"
                    value={llmConfig.model}
                    onChange={(e) => setLlmConfig({ ...llmConfig, model: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl border ${
                      mode === 'dark'
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-gray-50 border-gray-200 text-gray-800'
                    }`}
                  />
                </div>

                {/* 故障转移开关 */}
                <div className={`p-4 rounded-xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        🔄 故障转移 (Failover)
                      </h3>
                      <p className={`text-sm mt-1 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                        千问不可用时自动切换到 Kimi
                      </p>
                    </div>
                    <button
                      onClick={() => saveFailoverConfig(!failoverConfig.failoverEnabled)}
                      disabled={loadingFailover}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
                        failoverConfig.failoverEnabled
                          ? 'bg-green-500'
                          : mode === 'dark'
                            ? 'bg-white/20'
                            : 'bg-gray-300'
                      } ${loadingFailover ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-200 ease-out"
                        style={{ transform: failoverConfig.failoverEnabled ? 'translateX(28px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs">
                    <span className={`px-2 py-1 rounded ${mode === 'dark' ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'}`}>
                      主: 千问
                    </span>
                    <span className={mode === 'dark' ? 'text-white/40' : 'text-gray-400'}>→</span>
                    <span className={`px-2 py-1 rounded ${
                      failoverConfig.failoverEnabled
                        ? mode === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                        : mode === 'dark' ? 'bg-white/10 text-white/40' : 'bg-gray-200 text-gray-400'
                    }`}>
                      备: Kimi {failoverConfig.failoverEnabled ? '✓' : '✗'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => saveLlmConfig(llmConfig)}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      mode === 'dark'
                        ? 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30'
                        : 'bg-sky-100 text-sky-600 hover:bg-sky-200'
                    }`}
                  >
                    保存配置
                  </button>
                  <button
                    onClick={checkLLMAvailability}
                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                      mode === 'dark'
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    检查可用性
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className={mode === 'dark' ? 'text-white/50' : 'text-gray-500'}>
                  暂无配置
                </p>
              </div>
            )}
          </div>
        )}

        {/* 图片模型配置 */}
        {activeTab === 'image' && (
          <div className="space-y-4">
            <div className={`p-6 rounded-2xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={`text-xl font-bold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    图片生成模型配置
                  </h2>
                  <p className={`text-sm mt-1 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                    Stable Diffusion 实例，用于生成梦境图片
                  </p>
                </div>
                <button
                  onClick={() => setShowAddSDModal(true)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                      : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                  }`}
                >
                  + 添加实例
                </button>
              </div>

              {/* SD 实例列表 */}
              <div className="space-y-3">
                {sdConfigs.map((sd) => (
                  <div
                    key={sd.id}
                    className={`p-4 rounded-xl border ${
                      mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${sd.isAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <div className={`font-semibold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                            {sd.name}
                          </div>
                          <div className={`text-sm font-mono ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                            {sd.url}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              sd.specialty === 'anime' ? 'bg-pink-500/20 text-pink-400' :
                              sd.specialty === 'realistic' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-sky-500/20 text-sky-400'
                            }`}>
                              {sd.specialty === 'anime' ? '🎨 二次元' :
                               sd.specialty === 'realistic' ? '📷 写实' : sd.specialty}
                            </span>
                            <span className={`text-xs ${mode === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                              {sd.fixedModelName}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => checkSDAvailability(sd.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            mode === 'dark'
                              ? 'text-white/40 hover:text-white/70 hover:bg-white/10'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          }`}
                          title="检查可用性"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteSDInstance(sd.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            mode === 'dark'
                              ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20'
                              : 'text-red-500 hover:text-red-600 hover:bg-red-100'
                          }`}
                          title="删除"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {sdConfigs.length === 0 && (
                  <div className={`text-center py-8 rounded-xl border ${
                    mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <p className={mode === 'dark' ? 'text-white/50' : 'text-gray-500'}>
                      暂无图片模型实例，点击上方按钮添加
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 添加 SD 实例弹窗 */}
            {showAddSDModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className={`p-6 rounded-2xl w-full max-w-md ${mode === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
                  <h2 className={`text-xl font-bold mb-4 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    添加图片模型实例
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                        实例名称
                      </label>
                      <input
                        type="text"
                        value={newSDName}
                        onChange={(e) => setNewSDName(e.target.value)}
                        placeholder="例如：本地SD"
                        className={`w-full px-4 py-3 rounded-xl border ${
                          mode === 'dark'
                            ? 'bg-white/10 border-white/20 text-white placeholder-white/40'
                            : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
                        }`}
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                        SD URL
                      </label>
                      <input
                        type="text"
                        value={newSDUrl}
                        onChange={(e) => setNewSDUrl(e.target.value)}
                        placeholder="例如：http://localhost:7860"
                        className={`w-full px-4 py-3 rounded-xl border font-mono text-sm ${
                          mode === 'dark'
                            ? 'bg-white/10 border-white/20 text-white placeholder-white/40'
                            : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'
                        }`}
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                        专长风格
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewSDSpecialty('anime')}
                          className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                            newSDSpecialty === 'anime'
                              ? 'border-pink-500 bg-pink-500/20 text-pink-400'
                              : mode === 'dark' ? 'border-white/20 text-white/70 hover:border-white/40' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          🎨 二次元
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewSDSpecialty('realistic')}
                          className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                            newSDSpecialty === 'realistic'
                              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                              : mode === 'dark' ? 'border-white/20 text-white/70 hover:border-white/40' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          📷 写实
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => setShowAddSDModal(false)}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                          mode === 'dark'
                            ? 'bg-white/10 text-white/70 hover:bg-white/20'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        取消
                      </button>
                      <button
                        onClick={addSDInstance}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                          mode === 'dark'
                            ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                            : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                        }`}
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 视频模型配置 */}
        {activeTab === 'video' && (
          <div className={`p-6 rounded-2xl border ${mode === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className={`text-xl font-bold ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  视频生成模型配置
                </h2>
                <p className={`text-sm mt-1 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                  用于将图片生成视频（功能预留）
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                开发中
              </span>
            </div>

            <div className={`p-8 rounded-xl border-2 border-dashed text-center ${
              mode === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <div className="text-4xl mb-4">🚧</div>
              <h3 className={`text-lg font-medium mb-2 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                视频生成功能预留
              </h3>
              <p className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                此功能将在后续版本中添加，敬请期待
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
