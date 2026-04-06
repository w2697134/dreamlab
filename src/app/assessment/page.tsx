'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import { authFetch, getToken } from '@/lib/auth-token';
import DraggableFixButton from '@/components/ui/DraggableFixButton';
import StarBackground from '@/components/StarBackground';
import GlobalLoading from '@/components/GlobalLoading';

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

// ========== 类型定义 ==========
interface StressQuestion {
  id: number;
  question: string;
  options: string[];
  category: string;
  categoryName: string;
  reverse?: boolean;
  pattern?: 'frequency' | 'behavior' | 'selfEval';
  affects?: Record<string, number>;
}

interface AssessmentResult {
  stressLevel: number;
  stressLabel: string;
  stressDescription: string;
  stressSources: {
    work: number;
    relationship: number;
    emotion: number;
    self: number;
    life: number;
  };
  copingStyle: {
    type: 'active' | 'passive' | 'avoidant';
    label: string;
    description: string;
  };
  emotionState: {
    anxiety: number;
    depression: number;
    resilience: number;
  };
  suggestions: string[];
  personalityInsight: {
    type: string;
    tendency: string;
    description: string;
  };
  dreamAnalysis: {
    summary: string;
    insights: string[];
    stressIndicators: string[];
  };
}

const CATEGORY_NAMES: Record<string, { name: string; icon: string }> = {
  'work': { name: '工作/学习', icon: '💼' },
  'relationship': { name: '人际关系', icon: '👥' },
  'emotion': { name: '情绪状态', icon: '💭' },
  'self': { name: '自我认知', icon: '🎯' },
  'life': { name: '生活压力', icon: '🏠' }
};

// 梦境类型定义
interface Dream {
  id: string;
  imageUrl: string;
  prompt: string;
  date: string;
}

interface DreamCollection {
  id: string;
  title: string;
  coverUrl: string;
  summary?: string;
  imageCount?: number;
  dreams: Dream[];
}

export default function AssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode, toggleMode } = useTheme();
  const { showToast } = useToast();
  const isInitialLoad = useRef(true); // 标记是否首次加载
  
  // 从 URL 参数获取梦境数据（从梦境页面跳转过来）
  const [polishedPromptCN, setPolishedPromptCN] = useState<string>('');
  
  useEffect(() => {
    const dreamParam = searchParams.get('dream');
    if (dreamParam) {
      try {
        const dreamData = JSON.parse(decodeURIComponent(dreamParam));
        console.log('[评估页面] 从URL获取梦境数据:', dreamData);
        
        // 设置润色后的中文描述（用于生成题目）
        if (dreamData.polishedPromptCN) {
          setPolishedPromptCN(dreamData.polishedPromptCN);
          setDreamInput(dreamData.polishedPromptCN); // 同时设置输入框内容
        } else if (dreamData.prompts && dreamData.prompts.length > 0) {
          setDreamInput(dreamData.prompts[0]);
        }
      } catch (error) {
        console.error('[评估页面] 解析URL参数失败:', error);
      }
    }
  }, [searchParams]);
  
  // 状态
  const [step, setStep] = useState<'input' | 'test' | 'result'>('input');
  const [dreamInput, setDreamInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [showDreamSelector, setShowDreamSelector] = useState(false);
  const [dreamCollections, setDreamCollections] = useState<DreamCollection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [selectedDreamImage, setSelectedDreamImage] = useState<string | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // 测试状态
  const [questions, setQuestions] = useState<StressQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // 结果
  const [result, setResult] = useState<AssessmentResult | null>(null);

  // 加载梦境库
  const loadDreamCollections = async () => {
    try {
      setIsLoadingCollections(true);
      
      // 检查是否有 token
      const token = getToken();
      console.log('[评估页面] 加载梦境库，token:', token ? '存在' : '不存在');
      
      if (!token) {
        console.log('[评估页面] 未登录，跳过加载梦境库');
        setIsLoggedIn(false);
        setIsLoadingCollections(false);
        return;
      }
      
      setIsLoggedIn(true);
      
      const response = await authFetch('/api/dream-collections');
      console.log('[评估页面] API响应状态:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[评估页面] API返回数据:', data);
        if (data.collections) {
          setDreamCollections(data.collections.map((c: any) => ({
            id: c.id,
            title: c.title || `梦境集 ${new Date(c.created_at).toLocaleDateString()}`,
            coverUrl: c.cover_url,
            summary: c.summary, // 保存AI总结
            imageCount: c.image_count || c.dreams?.length || 0,
            dreams: (c.dreams || []).map((d: any) => ({
              id: d.id,
              imageUrl: d.image_url,
              prompt: d.prompt,
              date: d.created_at
            }))
          })));
          console.log('[评估页面] 设置梦境库完成，数量:', data.collections.length);
        }
      } else if (response.status === 401) {
        showToast('请先登录', 'error');
      } else {
        const errorData = await response.json();
        showToast(errorData.error || '加载梦境库失败', 'error');
      }
    } catch (error) {
      console.error('加载梦境库失败:', error);
      showToast('加载梦境库失败', 'error');
    } finally {
      setIsLoadingCollections(false);
    }
  };

  // 检查是否有来自梦境集的上下文
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 【关键】页面加载时自动加载梦境库
      loadDreamCollections();
      
      // 清除旧的心理评估数据
      localStorage.removeItem('assessmentDreamContext');
      localStorage.removeItem('assessmentRecords');
      console.log('[评估页面] 已清除旧的心理评估数据');
      
      const context = localStorage.getItem('assessmentDreamContext');
      if (context && isInitialLoad.current) {
        isInitialLoad.current = false; // 标记已处理过首次加载
        try {
          const data = JSON.parse(context);
          // 检查 context 是否过期（超过24小时）
          const isExpired = data.timestamp && Date.now() - new Date(data.timestamp).getTime() > 24 * 60 * 60 * 1000;
          
          if (isExpired) {
            // 清除过期的 context
            localStorage.removeItem('assessmentDreamContext');
          } else if (data.existingResult) {
            // 有已保存的结果，直接显示
            setResult(data.existingResult);
            setStep('result');
            if (data.collectionId) {
              setCollectionId(data.collectionId);
            }
            // 清除上下文中的已保存结果，避免刷新后重复显示
            delete data.existingResult;
            localStorage.setItem('assessmentDreamContext', JSON.stringify(data));
          } else if (data.source === 'collection' && data.collectionId) {
            setCollectionId(data.collectionId);
            // 优先使用AI总结，如果没有则使用第一个梦境的描述
            if (data.summary) {
              setDreamInput(data.summary);
            } else if (data.dreams && data.dreams.length > 0) {
              setDreamInput(data.dreams[0].prompt);
            }
            // 不再自动设置图片，让用户自己选择是否使用
            console.log('[评估页面] 从梦境集进入，不自动设置图片');
          }
        } catch (error) {
          console.error('[评估页面] 解析上下文失败:', error);
          // 清除无效的上下文
          localStorage.removeItem('assessmentDreamContext');
        }
      }
    }
  }, []);

  // 监听页面离开，提示修改不会保存
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 只有在有输入内容时才提醒
      const hasContent = dreamInput.trim();
      if (hasContent && step === 'input') {
        e.preventDefault();
        e.returnValue = '修改不会保存，确定要离开吗？';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dreamInput, step]);

  // 获取压力颜色
  const getStressColor = (level: number) => {
    if (level > 70) return { bg: 'bg-red-500', text: 'text-red-400', label: '危险', stroke: '#ef4444' };
    if (level > 50) return { bg: 'bg-yellow-500', text: 'text-yellow-400', label: '临界', stroke: '#eab308' };
    return { bg: 'bg-green-500', text: 'text-green-400', label: '健康', stroke: '#22c55e' };
  };

  // 计算心理健康分数（越高越好）- 仅在result存在时计算
  const getMentalHealthScore = () => {
    if (!result) return 50;
    return Math.max(0, Math.min(100, 100 - result.stressLevel));
  };

  // 获取心理健康分数的标签
  const getMentalHealthLabel = (score: number) => {
    if (score > 80) return '优秀';
    if (score > 60) return '良好';
    if (score > 40) return '一般';
    return '需要关注';
  };

  // 获取心理健康分数的描述
  const getMentalHealthDescription = (score: number) => {
    if (score > 80) return '你的心理状态非常好，继续保持！';
    if (score > 60) return '你的心理状态良好，压力在可控范围内。';
    if (score > 40) return '你的心理状态一般，建议适当调整。';
    return '建议关注心理健康，可寻求专业帮助。';
  };

  // 获取心理健康分数颜色
  const getMentalHealthColor = (score: number) => {
    if (score > 80) return { bg: 'bg-green-500', text: 'text-green-400', stroke: '#22c55e' };
    if (score > 60) return { bg: 'bg-blue-500', text: 'text-blue-400', stroke: '#3b82f6' };
    if (score > 40) return { bg: 'bg-yellow-500', text: 'text-yellow-400', stroke: '#eab308' };
    return { bg: 'bg-red-500', text: 'text-red-400', stroke: '#ef4444' };
  };

  // 开始分析并生成题目
  const handleStartAnalysis = async () => {
    if (!dreamInput.trim()) {
      showToast('请输入梦境描述', 'error');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/psychology-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: dreamInput,
          dreamType: 'assessment',
          keywords: [],
          generatedImages: [],
          polishedPromptCN: polishedPromptCN, // 最后一次生成图片的润色描述
        }),
      });

      const data = await response.json();
      
      if (data.success && data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setStep('test');
        setAnswers(new Array(data.questions.length).fill(-1));
      } else {
        showToast(data.error || '生成题目失败，请重试', 'error');
      }
    } catch (error) {
      console.error('分析失败:', error);
      showToast('分析失败，请重试', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 提交测试
  const handleSubmitTest = async () => {
    setIsCalculating(true);
    
    // 添加渐变动画效果
    const progressBar = document.querySelector('.progress-animate');
    if (progressBar) {
      (progressBar as HTMLElement).style.animation = 'progressPulse 5s ease-out forwards';
    }
    
    try {
      const response = await fetch('/api/psychology-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          questions,
          dreamType: 'assessment',
          keywords: [],
          userInput: dreamInput,
          polishedPromptCN, // 最后一次生成图片的润色描述
        }),
      });

      const data = await response.json();
      
      if (data.success && data.result) {
        // 显示进度条到100%的动画（动画5秒后再显示结果）
        await new Promise(resolve => setTimeout(resolve, 4500));
        setResult(data.result);
        setStep('result');
        
        // 保存结果到localStorage（如果有collectionId）
        if (collectionId) {
          const records = JSON.parse(localStorage.getItem('assessmentRecords') || '{}');
          records[collectionId] = data.result; // 保存完整结果
          localStorage.setItem('assessmentRecords', JSON.stringify(records));
        }
      } else {
        showToast(data.error || '计算结果失败', 'error');
      }
    } catch (error) {
      console.error('计算失败:', error);
      showToast('计算结果失败', 'error');
    } finally {
      setIsCalculating(false);
    }
  };

  // 处理从梦境库选择单个梦境
  const handleSelectDream = (dream: Dream, collection?: DreamCollection) => {
    // 如果梦境集有AI总结，优先使用总结（处理字段可能不存在的情况）
    if (collection && 'summary' in collection && (collection as any).summary) {
      setDreamInput((collection as any).summary);
    } else {
      setDreamInput(dream.prompt);
    }
    
    // 保存选中的图片
    if (dream.imageUrl) {
      setSelectedDreamImage(dream.imageUrl);
    }
    
    setShowDreamSelector(false);
  };

  // 处理选择整组梦境
  const handleSelectWholeCollection = (collection: DreamCollection) => {
    // 使用梦境集的AI总结，如果没有则合并所有梦境的描述（处理字段可能不存在的情况）
    if ('summary' in collection && (collection as any).summary) {
      setDreamInput((collection as any).summary);
    } else if (collection.dreams.length > 0) {
      // 合并所有梦境描述
      const combinedPrompt = collection.dreams
        .map(d => d.prompt)
        .filter(Boolean)
        .join('；');
      setDreamInput(combinedPrompt);
    }
    
    // 保存第一张图片作为选中图片
    if (collection.dreams.length > 0 && collection.dreams[0].imageUrl) {
      setSelectedDreamImage(collection.dreams[0].imageUrl);
    }
    
    setShowDreamSelector(false);
  }

  // AI润色梦境描述
  const handlePolishDream = async () => {
    if (!dreamInput.trim()) {
      showToast('请先输入梦境描述', 'error');
      return;
    }

    setIsPolishing(true);
    try {
      const response = await fetch('/api/polish-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: dreamInput
        }),
      });

      const data = await response.json();
      
      if (data.success && data.polished) {
        setDreamInput(data.polished);
        showToast('AI润色完成！', 'success');
      } else {
        showToast(data.error || '润色失败，请重试', 'error');
      }
    } catch (error) {
      console.error('润色失败:', error);
      showToast('润色失败，请重试', 'error');
    } finally {
      setIsPolishing(false);
    }
  };

  // 重新开始
  const handleRestart = () => {
    setStep('input');
    setDreamInput('');
    setQuestions([]);
    setCurrentQuestion(0);
    setAnswers([]);
    setResult(null);
  };

  return (
    <>
      {/* CSS 动画 */}
      <style jsx global>{`
        @keyframes progressPulse {
          0% { width: 0%; }
          70% { width: 90%; }
          85% { width: 95%; }
          95% { width: 98%; }
          100% { width: 100%; }
        }
        .progress-animate {
          animation: progressPulse 5s ease-out forwards;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-bg {
          background: linear-gradient(90deg, #8b5cf6 0%, #3b82f6 50%, #8b5cf6 100%);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }
        }
      `}</style>
      
      <div 
        className={`min-h-screen ${
          mode === 'dark' ? '' : 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd]'
        }`}
        style={{ backgroundColor: mode === 'dark' ? '#020617' : '#f0f9ff' }}
      >
        {/* 星空背景 */}
        <StarBackground />
        
        {/* 全局加载遮罩 */}
        <GlobalLoading isOpen={isAnalyzing} text={mode === 'dark' ? 'AI分析梦境中...' : 'AI分析梦境中...'} />
        
        <button
          onClick={toggleMode}
          className="fixed top-4 right-4 w-14 h-14 rounded-full flex items-center justify-center text-2xl z-50 transition-all duration-300 shadow-lg"
          style={{ background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)' }}
        >
          {mode === 'light' ? '🌙' : '☀️'}
        </button>
        {mode === 'dark' && <DraggableFixButton />}
      
      {/* 头部 */}
      <header className={`px-4 py-4 border-b ${mode === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/60 border-sky-100/50'}`}>
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              const hasContent = dreamInput.trim();
              if (hasContent && step === 'input') {
                if (window.confirm('您有未保存的内容，确定要离开吗？')) {
                  localStorage.removeItem('assessmentDreamContext');
                  router.back();
                }
              } else {
                localStorage.removeItem('assessmentDreamContext');
                router.back();
              }
            }}
            className={`flex items-center gap-2 ${mode === 'dark' ? 'text-white/70 hover:text-sky-300' : 'text-gray-500 hover:text-sky-500'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>返回</span>
          </button>
          <h1 className={`text-lg font-light ${mode === 'dark' ? 'text-white/90' : 'text-gray-600'}`}>
            心理压力测评
          </h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        
        {/* ========== 步骤1：输入梦境 ========== */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* 标题 */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center">
                <span className="text-3xl">🧠</span>
              </div>
              <h2 className={`text-xl font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                AI心理压力测评
              </h2>
              <p className={`text-sm mt-1 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                基于你的梦境内容，AI实时分析并生成专属题目
              </p>
            </div>

            {/* 横向布局的输入区域 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 左侧：梦境描述输入 */}
              <div className={`p-4 rounded-2xl ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-sm font-medium ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                    描述你的梦境
                  </label>
                  {/* AI润色按钮 */}
                  {dreamInput.trim() && (
                    <button
                      onClick={handlePolishDream}
                      disabled={isPolishing}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        mode === 'dark'
                          ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
                          : 'bg-sky-100 text-sky-600 hover:bg-sky-200'
                      } disabled:opacity-50 flex items-center gap-1`}
                    >
                      {isPolishing ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          润色中...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          AI润色
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  value={dreamInput}
                  onChange={(e) => setDreamInput(e.target.value)}
                  placeholder="请描述你印象深刻的梦境，比如：梦到在天空中飞翔，周围是紫色的云..."
                  rows={6}
                  className={`w-full p-3 rounded-xl text-sm resize-none transition-colors ${
                    mode === 'dark'
                      ? 'bg-white/5 text-white placeholder-white/30 border border-white/10 focus:border-sky-500'
                      : 'bg-gray-50 text-gray-800 placeholder-gray-400 border border-gray-200 focus:border-sky-500'
                  } focus:outline-none`}
                />
              </div>

              {/* 右侧：图片选择和上传 */}
              <div className="space-y-4 h-full">
                {/* 从梦境库选择 */}
                <div className={`p-4 rounded-2xl h-full flex flex-col ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
                  <label className={`block text-sm font-medium mb-2 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                    从梦境库选择
                  </label>
                  {selectedDreamImage ? (
                    <div className="flex-1 relative rounded-xl overflow-hidden group">
                      <img 
                        src={getImageUrl(selectedDreamImage)} 
                        alt="选中的梦境"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <button
                          onClick={() => {
                            loadDreamCollections();
                            setShowDreamSelector(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-4 py-2 rounded-lg bg-sky-500 text-white text-sm"
                        >
                          更换图片
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        loadDreamCollections();
                        setShowDreamSelector(true);
                      }}
                      className={`flex-1 w-full rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${
                        mode === 'dark'
                          ? 'border-sky-500/30 hover:border-sky-500 text-sky-300/70 hover:text-sky-300'
                          : 'border-sky-300 hover:border-sky-500 text-sky-500/70 hover:text-sky-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span className="text-sm">选择梦境图片</span>
                    </button>
                  )}
                </div>


              </div>
            </div>

            {/* 开始按钮 */}
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
              className={`w-full py-4 rounded-2xl font-medium text-lg transition-all ${
                mode === 'dark'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-600 hover:to-blue-600 shadow-lg shadow-sky-500/25'
                  : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-600 hover:to-blue-600 shadow-lg shadow-sky-500/20'
              } disabled:opacity-50`}
            >
              {isAnalyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI分析梦境中...
                </span>
              ) : '开始分析'}
            </button>
          </div>
        )}

        {/* ========== 步骤2：答题 ========== */}
        {step === 'test' && questions.length > 0 && (
          <div className="space-y-6">
            {/* 进度 */}
            <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                  第 {currentQuestion + 1} / {questions.length} 题
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  mode === 'dark' ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-600'
                }`}>
                  {CATEGORY_NAMES[questions[currentQuestion].category]?.icon} {CATEGORY_NAMES[questions[currentQuestion].category]?.name}
                </span>
              </div>
              <div className={`h-2 rounded-full ${mode === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                <div
                  className={`h-full rounded-full transition-all ${
                    isCalculating 
                      ? 'shimmer-bg progress-animate' 
                      : 'bg-gradient-to-r from-sky-500 to-blue-500'
                  }`}
                  style={{ width: isCalculating ? '100%' : `${((currentQuestion + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 题目 */}
            <div className={`p-6 rounded-2xl ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
              <p className={`text-lg mb-6 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                {questions[currentQuestion].question}
              </p>

              <div className="space-y-3">
                {questions[currentQuestion].options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      const newAnswers = [...answers];
                      newAnswers[currentQuestion] = index;
                      setAnswers(newAnswers);
                    }}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      answers[currentQuestion] === index
                        ? (mode === 'dark' ? 'bg-sky-500/40 text-white border-2 border-sky-400' : 'bg-sky-100 text-purple-800 border-2 border-sky-400')
                        : (mode === 'dark' ? 'bg-white/5 text-white/80 border border-white/10 hover:bg-white/10' : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100')
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full mr-3 text-sm font-medium ${
                      answers[currentQuestion] === index
                        ? (mode === 'dark' ? 'bg-sky-500 text-white' : 'bg-sky-500 text-white')
                        : (mode === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-500')
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* 导航按钮 */}
            <div className="flex gap-3">
              {currentQuestion > 0 && (
                <button
                  onClick={() => setCurrentQuestion(prev => prev - 1)}
                  className={`flex-1 py-3 rounded-xl ${mode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'}`}
                >
                  上一题
                </button>
              )}
              {currentQuestion < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestion(prev => prev + 1)}
                  disabled={answers[currentQuestion] === -1}
                  className={`flex-1 py-3 rounded-xl font-medium ${
                    answers[currentQuestion] !== -1
                      ? (mode === 'dark' ? 'bg-sky-500 text-white' : 'bg-sky-500 text-white')
                      : (mode === 'dark' ? 'bg-white/10 text-white/30' : 'bg-gray-200 text-gray-400')
                  } disabled:cursor-not-allowed`}
                >
                  下一题
                </button>
              ) : (
                <button
                  onClick={handleSubmitTest}
                  disabled={answers.filter(a => a !== -1).length < questions.length || isCalculating}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    isCalculating
                      ? 'shimmer-bg text-white cursor-wait'
                      : answers.filter(a => a !== -1).length === questions.length
                        ? (mode === 'dark' ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-green-500 text-white hover:bg-green-600')
                        : (mode === 'dark' ? 'bg-white/10 text-white/30' : 'bg-gray-200 text-gray-400')
                  } disabled:cursor-not-allowed`}
                >
                  {isCalculating ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      正在解析你的心理状态...
                    </span>
                  ) : '查看结果'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========== 步骤3：结果 ========== */}
        {step === 'result' && result && (
          <div className="space-y-4">
            {/* 标题 */}
            <div className="text-center mb-6">
              <h2 className={`text-xl font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                心理健康评估报告
              </h2>
              <p className={`text-sm mt-1 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                基于你的梦境分析生成
              </p>
            </div>

            {/* 仪表盘 - 心理健康分数，越高越好 */}
            <div className={`p-6 rounded-2xl text-center ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
              <div className="relative w-36 h-36 mx-auto mb-4">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="72" cy="72" r="64" stroke={mode === 'dark' ? '#ffffff10' : '#e5e7eb'} strokeWidth="14" fill="none" />
                  <circle
                    cx="72" cy="72" r="64"
                    stroke={getMentalHealthColor(getMentalHealthScore()).stroke}
                    strokeWidth="14"
                    fill="none"
                    strokeDasharray={`${(getMentalHealthScore() / 100) * 402} 402`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-bold ${getMentalHealthColor(getMentalHealthScore()).text}`}>
                    {getMentalHealthScore()}
                  </span>
                  <span className={`text-sm ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>/100</span>
                </div>
              </div>
              <div className={`text-xl font-medium ${getMentalHealthColor(getMentalHealthScore()).text}`}>
                {getMentalHealthLabel(getMentalHealthScore())}
              </div>
              <p className={`text-sm mt-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                {getMentalHealthDescription(getMentalHealthScore())}
              </p>
            </div>

            {/* 压力来源 - 修复数据显示 */}
            <div className={`p-5 rounded-2xl ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
              <h3 className={`text-sm font-medium mb-4 ${mode === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>
                📊 压力来源分析
              </h3>
              <div className="space-y-3">
                {result.stressSources && Object.entries(result.stressSources).map(([key, value]) => {
                  // 确保value是有效的数字
                  const safeValue = typeof value === 'number' && !isNaN(value) ? Math.max(0, Math.min(100, value)) : 0;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-6">{CATEGORY_NAMES[key]?.icon}</span>
                      <span className={`text-xs w-16 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                        {CATEGORY_NAMES[key]?.name}
                      </span>
                      <div className={`flex-1 h-2 rounded-full ${mode === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                        {safeValue > 0 && (
                          <div
                            className={`h-full rounded-full ${getStressColor(safeValue).bg}`}
                            style={{ width: `${safeValue}%` }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 情绪状态 - 显示百分比 */}
            <div className={`p-5 rounded-2xl ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
              <h3 className={`text-sm font-medium mb-3 ${mode === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                💭 情绪状态
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${mode === 'dark' ? 'text-orange-400' : 'text-orange-500'}`}>
                    {result.emotionState?.anxiety ?? 0}%
                  </div>
                  <div className={`text-xs ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                    焦虑程度 ({result.emotionState?.anxiety > 70 ? '较高' : result.emotionState?.anxiety > 40 ? '中等' : '正常'})
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${mode === 'dark' ? 'text-sky-400' : 'text-sky-500'}`}>
                    {result.emotionState?.depression ?? 0}%
                  </div>
                  <div className={`text-xs ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                    抑郁倾向 ({result.emotionState?.depression > 70 ? '较高' : result.emotionState?.depression > 40 ? '中等' : '正常'})
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${mode === 'dark' ? 'text-green-400' : 'text-green-500'}`}>
                    {result.emotionState?.resilience ?? 0}%
                  </div>
                  <div className={`text-xs ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                    心理韧性 ({result.emotionState?.resilience > 70 ? '很强' : result.emotionState?.resilience > 40 ? '良好' : '一般'})
                  </div>
                </div>
              </div>
            </div>

            {/* 应对方式 */}
            <div className={`p-5 rounded-2xl ${mode === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
              <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-yellow-300' : 'text-yellow-600'}`}>
                🎯 应对方式：{result.copingStyle.label}
              </h3>
              <p className={`text-sm leading-relaxed ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                {result.copingStyle.description}
              </p>
            </div>

            {/* 建议 */}
            <div className={`p-5 rounded-2xl ${mode === 'dark' ? 'bg-green-500/10' : 'bg-green-50'}`}>
              <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-green-300' : 'text-green-600'}`}>
                💡 建议
              </h3>
              <ul className="space-y-1">
                {result.suggestions.map((s, i) => (
                  <li key={i} className={`text-sm flex items-start gap-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                    <span className="text-green-400">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 梦境分析 */}
            {result.dreamAnalysis && result.dreamAnalysis.insights.length > 0 && (
              <div className={`p-5 rounded-2xl ${mode === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                  🌙 梦境关联分析
                </h3>
                <p className={`text-sm mb-2 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                  {result.dreamAnalysis.summary}
                </p>
                <div className="space-y-1">
                  {result.dreamAnalysis.insights.map((insight, i) => (
                    <p key={i} className={`text-sm flex items-start gap-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                      <span className="text-blue-400">•</span>
                      <span>{insight}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* 重新测试 */}
            <button
              onClick={handleRestart}
              className={`w-full py-3 rounded-xl ${mode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'}`}
            >
              重新测评
            </button>
          </div>
        )}
      </main>

      {/* 梦境库选择弹窗 */}
      {showDreamSelector && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black/80 backdrop-blur-sm">
          {/* 头部 */}
          <div className={`px-4 py-4 border-b ${mode === 'dark' ? 'bg-gray-900 border-white/10' : 'bg-white border-gray-200'}`}>
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <button
                onClick={() => setShowDreamSelector(false)}
                className={`flex items-center gap-2 ${mode === 'dark' ? 'text-white/70 hover:text-sky-300' : 'text-gray-500 hover:text-sky-500'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>关闭</span>
              </button>
              <h1 className={`text-lg font-light ${mode === 'dark' ? 'text-white/90' : 'text-gray-600'}`}>
                从梦境库选择
              </h1>
              <div className="w-16" />
            </div>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-5xl mx-auto">
              {!isLoggedIn ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="text-5xl mb-4">🔒</div>
                  <p className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                    请先登录后查看梦境库
                  </p>
                  <button
                    onClick={() => {
                      setShowDreamSelector(false);
                      router.push('/profile');
                    }}
                    className={`mt-6 px-6 py-3 text-white rounded-xl ${
                      mode === 'dark'
                        ? 'bg-gradient-to-r from-sky-600 to-blue-600'
                        : 'bg-gradient-to-r from-sky-400 to-blue-400'
                    }`}
                  >
                    去登录
                  </button>
                </div>
              ) : isLoadingCollections ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-10 h-10 rounded-full border-4 border-sky-500/30 border-t-sky-500 animate-spin mb-4" />
                  <p className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                    加载中...
                  </p>
                </div>
              ) : dreamCollections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="text-5xl mb-4">💭</div>
                  <p className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                    还没有保存的梦境
                  </p>
                  <button
                    onClick={() => {
                      setShowDreamSelector(false);
                      router.push('/dream');
                    }}
                    className={`mt-6 px-6 py-3 text-white rounded-xl ${
                      mode === 'dark'
                        ? 'bg-gradient-to-r from-sky-600 to-blue-600'
                        : 'bg-gradient-to-r from-sky-400 to-blue-400'
                    }`}
                  >
                    去创建梦境
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {dreamCollections.map((collection) => (
                    <div 
                      key={collection.id}
                      className={`rounded-2xl overflow-hidden ${
                        mode === 'dark' 
                          ? 'bg-white/5 border border-white/10' 
                          : 'bg-white/80 border border-sky-100'
                      }`}
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                            {collection.title}
                          </h3>
                          <button
                            onClick={() => handleSelectWholeCollection(collection)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              mode === 'dark'
                                ? 'bg-sky-600 text-white hover:bg-sky-700'
                                : 'bg-sky-500 text-white hover:bg-sky-600'
                            }`}
                          >
                            选择整组
                          </button>
                        </div>
                        <p className={`text-xs mb-3 ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                          共 {collection.imageCount || collection.dreams.length} 张图片
                          {(collection as any).summary && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                              已总结
                            </span>
                          )}
                        </p>
                        <div className="grid grid-cols-6 gap-3">
                          {collection.dreams.map((dream) => (
                            <div 
                              key={dream.id}
                              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group hover:ring-2 hover:ring-sky-500 transition-all"
                              onClick={() => handleSelectDream(dream, collection)}
                              title="点击选择单个梦境"
                            >
                              {dream.imageUrl ? (
                                <img 
                                  src={getImageUrl(dream.imageUrl)} 
                                  alt={dream.prompt}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    console.error('[评估页面] 图片加载失败 URL:', dream.imageUrl);
                                    console.error('[评估页面] 处理后URL:', getImageUrl(dream.imageUrl));
                                    console.error('[评估页面] naturalWidth:', img.naturalWidth, 'naturalHeight:', img.naturalHeight);
                                    
                                    // 如果图片加载失败，显示一个占位符
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
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
