'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import { authFetch, getToken, refreshAccessToken } from '@/lib/auth-token';
import DraggableFixButton from '@/components/ui/DraggableFixButton';
import StarBackground from '@/components/StarBackground';

// 辅助函数：确保图片URL正确
const getImageUrl = (url: string) => {
  if (!url) return '';
  
  // 清理URL：移除首尾的引号
  let cleanUrl = url.trim();
  if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || 
      (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
    cleanUrl = cleanUrl.slice(1, -1);
  }
  
  console.log('[URL处理] 原始URL:', url);
  console.log('[URL处理] 清理后URL:', cleanUrl);
  
  // 如果已经是完整URL，直接返回
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
    console.log('[URL处理] 已是完整URL');
    return cleanUrl;
  }
  
  // 如果是data URL，直接返回
  if (cleanUrl.startsWith('data:')) {
    console.log('[URL处理] 是data URL');
    return cleanUrl;
  }
  
  console.log('[URL处理] 相对路径，直接返回');
  return cleanUrl;
};

// 评估结果类型
interface AssessmentResult {
  stressLevel: number;
  stressLabel: string;
  timestamp: string;
}

interface Dream {
  id: string;
  prompt: string;
  image_url: string;
  video_url?: string;
  dream_type: string;
  art_style: string;
  created_at: string;
}

interface DreamCollection {
  id: string;
  title: string;
  description: string;
  cover_url: string;
  has_video: boolean;
  image_count: number;
  created_at: string;
  dreams: Dream[];
}

export default function DreamsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { mode, toggleMode } = useTheme();
  const { isDeveloper, isLoggedIn } = useAuth();
const [collections, setCollections] = useState<DreamCollection[]>([]);
  const [assessmentRecords, setAssessmentRecords] = useState<Record<string, AssessmentResult>>({});
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [enlargedVideo, setEnlargedVideo] = useState<{videoUrl: string, imageUrl: string} | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{type: 'collection' | 'dream', id: string, collectionId?: string} | null>(null);
  const [authError, setAuthError] = useState(false);
  const [hasOrphanDreams, setHasOrphanDreams] = useState(false);
  const [showAssessmentDetail, setShowAssessmentDetail] = useState<string | null>(null); // 查看评估详情的梦境集ID

  // 加载评估记录
  const loadAssessmentRecords = () => {
    const records = localStorage.getItem('assessmentRecords');
    if (records) {
      setAssessmentRecords(JSON.parse(records));
    }
  };

  useEffect(() => {
    // 页面加载时检查 token
    const token = getToken();
    if (!token && isLoggedIn) {
      // UI显示已登录但token丢失，尝试刷新
      console.log('[梦境库] 检测到登录状态但token丢失，尝试刷新...');
      refreshAccessToken().then(refreshed => {
        if (refreshed) {
          fetchCollections();
        } else {
          setAuthError(true);
        }
      });
    } else {
      fetchCollections();
    }
    
    // 检查是否有孤立梦境
    checkOrphanDreams();
    
    // 加载评估记录
    loadAssessmentRecords();
  }, []);

  const fetchCollections = async () => {
    const token = getToken();
    
    // 【修复】同时加载本地梦境（无论是否登录）
    const localDreams = localStorage.getItem('dreamLibrary');
    let localCollections: DreamCollection[] = [];
    if (localDreams) {
      try {
        const parsed = JSON.parse(localDreams);
        localCollections = parsed.map((item: any) => ({
          id: item.id,
          title: item.name,
          cover_url: item.images?.[0]?.imageUrl,
          image_count: item.images?.length || 0,
          created_at: item.createdAt,
          dreams: item.images?.map((img: any) => ({
            id: img.id,
            image_url: img.imageUrl,
            prompt: img.prompt,
            created_at: img.timestamp
          })) || [],
          isLocal: true,
        }));
        console.log('[梦境库] 加载本地梦境:', localCollections.length);
      } catch (e) {
        console.error('[梦境库] 解析本地数据失败:', e);
      }
    }
    
    if (!token) {
      console.log('[梦境库] 未登录，只显示本地数据');
      setCollections(localCollections);
      setAuthError(true);
      return;
    }

    try {
      console.log('[梦境库] 开始获取云端梦境集...');
      const response = await authFetch('/api/dream-collections');

      if (response.status === 401) {
        console.log('[梦境库] 401未授权');
        setAuthError(true);
        setCollections(localCollections); // 显示本地数据
        return;
      }

      setAuthError(false);

      if (!response.ok) {
        console.log('[梦境库] 响应失败:', response.status);
        setCollections(localCollections); // 显示本地数据
        return;
      }

      const data = await response.json();
      console.log('[梦境库] 获取到的云端数据:', data);
      // 合并云端数据和本地数据
      const cloudCollections = data.collections || [];
      setCollections([...localCollections, ...cloudCollections]);
    } catch (error) {
      console.error('获取梦境集失败:', error);
      setCollections(localCollections); // 显示本地数据
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    // 【修复】支持删除本地梦境（未登录用户）- 只有未登录用户才走本地删除逻辑
    const token = getToken();
    if (!token) {
      const localDreams = localStorage.getItem('dreamLibrary');
      if (localDreams) {
        try {
          const parsed = JSON.parse(localDreams);
          const filtered = parsed.filter((item: any) => item.id !== collectionId);
          localStorage.setItem('dreamLibrary', JSON.stringify(filtered));
          setCollections(prev => prev.filter(c => c.id !== collectionId));
          setExpandedCollection(null);
          showToast('梦境集已删除', 'success');
          setShowDeleteConfirm(false);
          setDeleteTarget(null);
          return;
        } catch (e) {
          console.error('[梦境库] 删除本地数据失败:', e);
        }
      }
      
      showToast('请先登录', 'warning');
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      return;
    }
    
    // 云端删除（登录用户）
    try {
      const response = await authFetch(`/api/dream-collections?collectionId=${collectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        showToast(data.error || '删除失败', 'error');
        setShowDeleteConfirm(false);
        setDeleteTarget(null);
        return;
      }

      setCollections(prev => prev.filter(c => c.id !== collectionId));
      setExpandedCollection(null);
      showToast('梦境集已删除', 'success');
    } catch (error) {
      showToast('删除出错，请重试', 'error');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  // 恢复孤立梦境
  const handleRecoverOrphanDreams = async () => {
    const token = getToken();
    if (!token) {
      showToast('请先登录', 'warning');
      return;
    }

    try {
      const response = await authFetch('/api/dream-collections/recover', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        showToast(data.error || '恢复失败', 'error');
        return;
      }

      const data = await response.json();
      if (data.recoveredCount > 0) {
        showToast(`成功恢复 ${data.recoveredCount} 个梦境`, 'success');
        setHasOrphanDreams(false);
        // 刷新列表
        fetchCollections();
      } else {
        showToast(data.message || '没有需要恢复的数据', 'info');
      }
    } catch (error) {
      showToast('恢复出错，请重试', 'error');
    }
  };

  // 检查是否有孤立梦境
  const checkOrphanDreams = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await authFetch('/api/dream-collections/recover');
      if (response.ok) {
        const data = await response.json();
        setHasOrphanDreams(data.hasOrphanDreams || false);
      }
    } catch {
      // 忽略错误
    }
  };

  const handleDeleteDream = async (dreamId: string, collectionId: string) => {
    const token = getToken();
    if (!token) {
      showToast('请先登录', 'warning');
      return;
    }

    try {
      const response = await authFetch(`/api/dreams/${dreamId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        showToast(data.error || '删除失败', 'error');
        return;
      }

      // 更新本地状态
      setCollections(prev => prev.map(c => {
        if (c.id === collectionId) {
          const newDreams = c.dreams.filter(d => d.id !== dreamId);
          return {
            ...c,
            dreams: newDreams,
            image_count: newDreams.length,
            cover_url: newDreams[0]?.image_url || c.cover_url,
            has_video: newDreams.some(d => d.video_url),
          };
        }
        return c;
      }).filter(c => c.image_count > 0)); // 如果集里没有图片了，移除该集

      showToast('梦境已删除', 'success');
    } catch (error) {
      showToast('删除出错，请重试', 'error');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'collection') {
      handleDeleteCollection(deleteTarget.id);
    } else {
      handleDeleteDream(deleteTarget.id, deleteTarget.collectionId!);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 获取梦境类型中文名
  const getDreamTypeName = (type: string) => {
    const types: Record<string, string> = {
      default: '🌟 默认',
      sweet: '🌙 美梦',
      nightmare: '👁️ 噩梦',
      fantasy: '✨ 奇幻',
      memory: '💭 回忆',
      lucid: '🌀 清醒梦',
    };
    return types[type] || types.default;
  };

  // 获取评估状态
  const getAssessmentStatus = (collection: DreamCollection) => {
    // 优先从 assessmentRecords 获取
    if (assessmentRecords[collection.id]) {
      return assessmentRecords[collection.id];
    }
    // 本地梦境可能直接存储在对象中
    const localData = localStorage.getItem('dreamLibrary');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        const localItem = parsed.find((item: any) => item.id === collection.id);
        if (localItem?.assessmentResult) {
          return localItem.assessmentResult;
        }
      } catch (e) {
        console.error('[梦境库] 解析本地数据失败:', e);
      }
    }
    return null;
  };

  // 获取评估按钮文本
  const getAssessmentButton = (collection: DreamCollection) => {
    const record = getAssessmentStatus(collection);
    if (record) {
      return { text: `查看评估 (${record.stressLabel})`, isAssessed: true };
    }
    return { text: '立刻去评估', isAssessed: false };
  };

  return (
    <div 
      className={`min-h-screen flex flex-col relative transition-colors duration-500 ${
        mode === 'dark' 
          ? '' 
          : 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd]'
      }`}
      style={{ backgroundColor: mode === 'dark' ? '#020617' : '#f0f9ff' }}
    >
      {/* 星空背景 */}
      <StarBackground />
      
      <button
        onClick={toggleMode}
        className="fixed top-4 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl z-50 transition-all duration-300 shadow-lg"
        style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)' }}
      >
        {mode === 'light' ? '🌙' : '☀️'}
      </button>
      {/* 可拖动修复工具按钮 */}
      {isDeveloper && (
        <DraggableFixButton />
      )}
      
      {/* 顶部 */}
      <header className={`relative z-10 px-4 py-4 border-b ${mode === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/60 border-sky-100/50'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className={`bg-transparent outline-none border-none transition-all duration-300 ${mode === 'dark' ? 'text-white/70 hover:text-sky-300' : 'text-gray-500 hover:text-sky-500'}`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className={`text-xl font-light tracking-widest ${mode === 'dark' ? 'text-white/90' : 'text-gray-600'}`}>梦境库</h1>
          <div className="w-12" />
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 relative z-10 pb-32">
        {authError ? (
          // Token失效提示
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-6">🔐</div>
            <p className={`text-lg mb-2 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
              未登录
            </p>
            <p className={`text-sm mb-6 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
              请登录以查看您的梦境库
            </p>
            <button
              onClick={() => router.push('/?login=true')}
              className={`px-6 py-3 text-white rounded-xl ${
                mode === 'dark'
                  ? 'bg-gradient-to-r from-sky-600 to-blue-600'
                  : 'bg-gradient-to-r from-sky-400 to-blue-400'
              }`}
            >
              登录
            </button>
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-6">💭</div>
            {hasOrphanDreams ? (
              <>
                <p className={mode === 'dark' ? 'text-white/70' : 'text-gray-600'}>
                  检测到可恢复的梦境数据
                </p>
                <button
                  onClick={handleRecoverOrphanDreams}
                  className={`mt-6 px-6 py-3 text-white rounded-xl ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-green-600 to-teal-600'
                      : 'bg-gradient-to-r from-green-400 to-teal-400'
                  }`}
                >
                  恢复梦境数据
                </button>
              </>
            ) : (
              <>
                <p className={mode === 'dark' ? 'text-white/50' : 'text-gray-400'}>
                  还没有保存的梦境
                </p>
                <button
                  onClick={() => router.push('/dream')}
                  className={`mt-6 px-6 py-3 text-white rounded-xl ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600'
                      : 'bg-gradient-to-r from-sky-400 to-blue-400'
                  }`}
                >
                  创建第一个梦境
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 统计信息 */}
            <div className={`flex items-center justify-between mb-6 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
              <span className="text-sm">共 {collections.length} 个梦境集</span>
              <span className="text-sm">{collections.reduce((acc, c) => acc + c.image_count, 0)} 张图片/视频</span>
            </div>

            {/* 梦境集列表 */}
            {collections.map((collection, index) => {
              const isExpanded = expandedCollection === collection.id;
              
              return (
                <div 
                  key={collection.id}
                  className={`rounded-2xl overflow-hidden transition-all ${
                    mode === 'dark' 
                      ? 'bg-white/5 border border-white/10' 
                      : 'bg-white/80 border border-sky-100 shadow-sm'
                  }`}
                >
                  {/* 梦境集头部 */}
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedCollection(isExpanded ? null : collection.id)}
                  >
                    <div className="flex items-start gap-4">
                      {/* 封面图 */}
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                        {collection.cover_url ? (
                          <img 
                            src={getImageUrl(collection.cover_url)} 
                            alt={collection.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              console.error('[梦境库] 封面图加载失败 URL:', collection.cover_url);
                              console.error('[梦境库] 处理后URL:', getImageUrl(collection.cover_url));
                              console.error('[梦境库] naturalWidth:', img.naturalWidth, 'naturalHeight:', img.naturalHeight);
                              
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const placeholder = document.createElement('div');
                                placeholder.className = 'w-full h-full flex items-center justify-center bg-gray-700';
                                placeholder.innerHTML = `
                                  <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                `;
                                parent.appendChild(placeholder);
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-700">
                            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {collection.has_video && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* 信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            mode === 'dark' 
                              ? 'bg-sky-500/20 text-sky-300' 
                              : 'bg-sky-100 text-sky-600'
                          }`}>
                            第 {collections.length - index} 集
                          </span>
                          {collection.has_video && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              mode === 'dark' 
                                ? 'bg-red-500/20 text-red-300' 
                                : 'bg-red-100 text-red-500'
                            }`}>
                              🎬 含视频
                            </span>
                          )}
                          {/* 评估状态标签 */}
                          {(() => {
                            const status = getAssessmentStatus(collection);
                            if (status) {
                              const labelClass = status.stressLevel > 70 
                                ? 'bg-red-500/20 text-red-300' 
                                : status.stressLevel > 50 
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : 'bg-green-500/20 text-green-300';
                              return (
                                <span 
                                  className={`text-xs px-2 py-0.5 rounded-full ${labelClass} cursor-pointer hover:opacity-80`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAssessmentDetail(collection.id);
                                  }}
                                  title="点击查看评估详情"
                                >
                                  🧠 已评估 · {status.stressLabel}
                                </span>
                              );
                            }
                            return (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                mode === 'dark' 
                                  ? 'bg-gray-500/20 text-gray-400' 
                                  : 'bg-gray-100 text-gray-400'
                              }`}>
                                未评估
                              </span>
                            );
                          })()}
                        </div>
                        <h3 className={`font-medium mt-1 truncate ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                          {collection.title || `梦境集 ${formatDate(collection.created_at)}`}
                        </h3>
                        <p className={`text-sm mt-1 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                          {collection.image_count} 张 · {formatDate(collection.created_at)}
                        </p>
                      </div>
                      
                      {/* 展开/收起箭头 */}
                      <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* 展开内容 - 梦境列表 */}
                  {isExpanded && (
                    <div className={`border-t ${mode === 'dark' ? 'border-white/10' : 'border-sky-100'}`}>
                      <div className="p-4 grid grid-cols-3 gap-2">
                        {collection.dreams.map((dream) => (
                          <div 
                            key={dream.id}
                            className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
                            onClick={() => {
                              if (dream.video_url) {
                                setEnlargedVideo({ videoUrl: dream.video_url, imageUrl: dream.image_url });
                              } else {
                                setEnlargedImage(dream.image_url);
                              }
                            }}
                          >
                            {dream.image_url ? (
                              <img 
                                src={getImageUrl(dream.image_url)} 
                                alt={dream.prompt}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  console.error('[梦境库] 梦境图片加载失败 URL:', dream.image_url);
                                  console.error('[梦境库] 处理后URL:', getImageUrl(dream.image_url));
                                  console.error('[梦境库] naturalWidth:', img.naturalWidth, 'naturalHeight:', img.naturalHeight);
                                  
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'w-full h-full flex flex-col items-center justify-center bg-gray-700';
                                    placeholder.innerHTML = `
                                      <svg class="w-8 h-8 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      <span class="text-xs text-gray-500">图片</span>
                                    `;
                                    parent.appendChild(placeholder);
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-700">
                                <svg className="w-8 h-8 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs text-gray-500">图片</span>
                              </div>
                            )}
                            
                            {/* 视频标识 */}
                            {dream.video_url && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-sky-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                              </div>
                            )}
                            
                            {/* 删除按钮 */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ type: 'dream', id: dream.id, collectionId: collection.id });
                                setShowDeleteConfirm(true);
                              }}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500 hover:text-white"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            
                            {/* 梦境类型标签 */}
                            <div className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded bg-black/50 text-white/80">
                              {getDreamTypeName(dream.dream_type).split(' ')[0]}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* 梦境集操作 */}
                      <div className={`px-4 pb-4 flex gap-2 ${mode === 'dark' ? 'border-t border-white/5' : 'border-t border-sky-50'}`}>
                        {(() => {
                          const btnInfo = getAssessmentButton(collection);
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (btnInfo.isAssessed) {
                                  // 已评估，查看结果
                                  const record = getAssessmentStatus(collection);
                                  if (record) {
                                    const assessmentData: any = {
                                      source: 'collection',
                                      collectionId: collection.id,
                                      dreams: collection.dreams.map(d => ({
                                        id: d.id,
                                        imageUrl: d.image_url,
                                        prompt: d.prompt,
                                        date: d.created_at
                                      })),
                                      existingResult: record,
                                      timestamp: new Date().toISOString()
                                    };
                                    // 只有当summary字段存在时才添加
                                    if ('summary' in collection && (collection as any).summary) {
                                      assessmentData.summary = (collection as any).summary;
                                    }
                                    localStorage.setItem('assessmentDreamContext', JSON.stringify(assessmentData));
                                  }
                                  router.push('/assessment');
                                } else {
                                  // 未评估，去评估
                                  const assessmentData: any = {
                                    source: 'collection',
                                    collectionId: collection.id,
                                    dreams: collection.dreams.map(d => ({
                                      id: d.id,
                                      imageUrl: d.image_url,
                                      prompt: d.prompt,
                                      date: d.created_at
                                    })),
                                    timestamp: new Date().toISOString()
                                  };
                                  // 只有当summary字段存在时才添加
                                  if ('summary' in collection && (collection as any).summary) {
                                    assessmentData.summary = (collection as any).summary;
                                  }
                                  localStorage.setItem('assessmentDreamContext', JSON.stringify(assessmentData));
                                  router.push('/assessment');
                                }
                              }}
                              className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                                btnInfo.isAssessed
                                  ? mode === 'dark'
                                    ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                                    : 'bg-gradient-to-r from-green-400 to-teal-400 text-white'
                                  : mode === 'dark'
                                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                                    : 'bg-gradient-to-r from-sky-400 to-blue-400 text-white'
                              }`}
                            >
                              🧠 {btnInfo.text}
                            </button>
                          );
                        })()}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ type: 'collection', id: collection.id });
                            setShowDeleteConfirm(true);
                          }}
                          className={`px-4 py-2 rounded-xl text-sm ${
                            mode === 'dark'
                              ? 'bg-white/10 text-white/60 hover:bg-red-500/20 hover:text-red-300'
                              : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500'
                          }`}
                        >
                          🗑️ 删除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 底部提示 */}
      {collections.length > 0 && (
        <div className={`fixed bottom-0 left-0 right-0 p-4 z-20 ${
          mode === 'dark'
            ? 'bg-gradient-to-t from-[#1a1030] via-[#1a1030]/95 to-transparent'
            : 'bg-gradient-to-t from-[#F3F0F7] via-[#F3F0F7]/95 to-transparent'
        }`}>
          <div className="max-w-4xl mx-auto text-center">
            <p className={`text-sm ${mode === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
              点击梦境集展开查看详情，或进行心理评估
            </p>
          </div>
        </div>
      )}

      {/* 图片放大查看 */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img 
              src={enlargedImage} 
              alt="放大查看" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-12 right-0 text-white/80 hover:text-white text-2xl"
            >
              ✕ 关闭
            </button>
          </div>
        </div>
      )}

      {/* 视频播放 */}
      {enlargedVideo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setEnlargedVideo(null)}
        >
          <div className="relative max-w-5xl w-full">
            <video
              src={enlargedVideo.videoUrl}
              poster={enlargedVideo.imageUrl}
              controls
              autoPlay
              className="w-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setEnlargedVideo(null)}
              className="absolute -top-12 right-0 text-white/80 hover:text-white text-2xl"
            >
              ✕ 关闭
            </button>
          </div>
        </div>
      )}

      {/* 评估详情弹窗 */}
      {showAssessmentDetail && (() => {
        const record = assessmentRecords[showAssessmentDetail];
        if (!record) return null;
        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAssessmentDetail(null)}
          >
            <div 
              className={`w-full max-w-md rounded-2xl p-6 ${mode === 'dark' ? 'bg-gray-900/95 border border-white/10' : 'bg-white/95 border border-sky-100 shadow-xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  🧠 心理评估报告
                </h3>
                <button 
                  onClick={() => setShowAssessmentDetail(null)}
                  className={`text-sm px-3 py-1 rounded-full ${mode === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-500'}`}
                >
                  关闭
                </button>
              </div>
              
              <div className="space-y-4">
                {/* 压力等级 */}
                <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <div className="text-sm opacity-60 mb-1">压力等级</div>
                  <div className={`text-2xl font-bold ${
                    record.stressLevel > 70 ? 'text-red-400' : 
                    record.stressLevel > 50 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {record.stressLabel} ({record.stressLevel}%)
                  </div>
                </div>
                
                {/* 评估时间 */}
                <div className={`p-3 rounded-xl text-sm ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <span className="opacity-60">评估时间：</span>
                  <span>{new Date(record.timestamp).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-2xl p-6 text-center ${mode === 'dark' ? 'bg-gray-900/95 border border-white/10' : 'bg-white/95 border border-sky-100 shadow-xl'}`}>
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${mode === 'dark' ? 'bg-red-500/20' : 'bg-red-100'}`}>
              <span className="text-3xl">🗑️</span>
            </div>
            <h3 className={`text-xl font-medium mb-2 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              {deleteTarget?.type === 'collection' ? '确定删除整个梦境集？' : '确定删除这张梦境？'}
            </h3>
            <p className={`text-sm mb-6 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
              {deleteTarget?.type === 'collection' ? '集内所有图片和视频都将被删除' : '删除后将无法恢复'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${mode === 'dark' ? 'bg-white/10 text-white/80 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-red-500 to-pink-500 text-white hover:shadow-lg transition-all"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
