'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import DraggableFixButton from '@/components/ui/DraggableFixButton';
import StarBackground from '@/components/StarBackground';
import GlobalLoading from '@/components/GlobalLoading';

interface SelectedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  timestamp: Date;
}

interface FinalVideo {
  url: string;
  timestamp: Date;
}

// 心理测评题目
interface TestQuestion {
  id: number;
  question: string;
  options: string[];
  category: string;
  categoryName: string;
  reverse?: boolean;
  affects?: Record<string, number>; // 题目影响的维度权重
}

// 评估结果
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

// 分类中文名
const categoryNames: Record<string, { name: string; icon: string }> = {
  'work': { name: '工作/学习', icon: '💼' },
  'relationship': { name: '人际关系', icon: '👥' },
  'emotion': { name: '情绪状态', icon: '💭' },
  'self': { name: '自我认知', icon: '🎯' },
  'life': { name: '生活压力', icon: '🏠' }
};

export default function DreamResultPage() {
  const router = useRouter();
  const { mode, toggleMode } = useTheme();
  const { showToast } = useToast();
  const { isDeveloper } = useAuth();
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [finalVideo, setFinalVideo] = useState<FinalVideo | null>(null);
  const [dreamSetName, setDreamSetName] = useState('');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSaveSuccessMsg, setShowSaveSuccessMsg] = useState(false); // 控制保存成功提示显示
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [dreamSummary, setDreamSummary] = useState<string>('');
  const [polishedPromptCN, setPolishedPromptCN] = useState<string>(''); // 最后一次生成图片的润色描述
  const [isNavigatingHome, setIsNavigatingHome] = useState(false);
  
  // 心理测评状态
  const [showTestIntro, setShowTestIntro] = useState(false);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [questionIds, setQuestionIds] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // 保存成功后自动隐藏提示
  useEffect(() => {
    if (saveSuccess) {
      setShowSaveSuccessMsg(true);
      // 3秒后自动隐藏提示
      const timer = setTimeout(() => {
        setShowSaveSuccessMsg(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  useEffect(() => {
    const savedData = localStorage.getItem('dreamResultData');
    if (savedData) {
      const data = JSON.parse(savedData);
      if (data.images) {
        setSelectedImages(data.images.map((img: SelectedImage) => ({
          ...img,
          timestamp: new Date(img.timestamp),
        })));
      }
      if (data.video) {
        setFinalVideo({
          ...data.video,
          timestamp: new Date(data.video.timestamp),
        });
      }
      // 读取润色描述
      console.log('[结果页面] 读取 dreamResultData:', data);
      
      // 从多个来源获取润色描述
      // 1. 首先尝试从 data.polishedPromptCN 获取（合并后的完整描述）
      // 2. 然后尝试从所有 images 中收集并合并
      // 3. 最后使用 userInput
      let finalPolished: string | undefined = data.polishedPromptCN;
      
      if (!finalPolished && data.images?.length > 0) {
        // 从所有图片中收集润色描述
        const allDescriptions = data.images
          .map((img: any) => img.polishedPromptCN)
          .filter(Boolean);
        const uniqueDescriptions = [...new Set(allDescriptions)];
        if (uniqueDescriptions.length > 0) {
          finalPolished = uniqueDescriptions.join('；');
        }
      }
      
      // 如果还是没有，使用 userInput
      if (!finalPolished) {
        finalPolished = data.userInput;
      }
      
      if (finalPolished) {
        console.log('[结果页面] 设置润色描述:', finalPolished.substring(0, 100) + '...');
        setPolishedPromptCN(finalPolished);
      } else {
        console.log('[结果页面] 没有找到润色描述');
      }
      if (data.dreamSetId) {
        setDreamSetName(`梦境 ${new Date().toLocaleDateString('zh-CN')}`);
        
        // 加载已保存的评估结果
        const records = JSON.parse(localStorage.getItem('assessmentRecords') || '{}');
        if (records[data.dreamSetId]) {
          const savedResult = records[data.dreamSetId];
          // 检查 stressSources 是否完整，如果不完整则设为 null 重新计算
          const hasValidStressSources = savedResult.stressSources && 
            Object.values(savedResult.stressSources).some((v) => (v as number) > 0);
          if (hasValidStressSources) {
            setAssessmentResult(savedResult);
          } else {
            // 数据不完整，清除旧数据让用户重新测评
            delete records[data.dreamSetId];
            localStorage.setItem('assessmentRecords', JSON.stringify(records));
          }
        }
      }
    }
    
    // 【关键】检查是否刚从梦境页保存过来，如果是则标记为已保存
    const justSaved = localStorage.getItem('dreamJustSaved');
    if (justSaved === 'true') {
      setSaveSuccess(true);
      // 清除标记，避免刷新后仍然认为已保存
      localStorage.removeItem('dreamJustSaved');
    }
  }, []);

  const handleDeleteImage = (id: string) => {
    setSelectedImages(prev => prev.filter(img => img.id !== id));
  };

  const handleDeleteVideo = () => {
    setFinalVideo(null);
  };

  // AI总结梦境
  const handleSummarizeDream = async () => {
    const validImages = getValidImages();
    if (validImages.length === 0) {
      showToast('没有梦境内容可总结', 'warning');
      return;
    }

    setIsSummarizing(true);
    
    try {
      const prompts = validImages.map(img => img.prompt || '');
      
      const response = await fetch('/api/summarize-dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompts,
          images: validImages.map(img => img.imageUrl)
        }),
      });

      const data = await response.json();
      
      if (data.success && data.summary) {
        setDreamSummary(data.summary);
        showToast('梦境总结完成！', 'success');
      } else {
        showToast(data.error || '总结失败', 'error');
      }
    } catch (error) {
      console.error('总结失败:', error);
      showToast('总结失败，请重试', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // 获取有效图片（过滤空URL）
  const getValidImages = () => selectedImages.filter(img => img.imageUrl);
  
  const handleSave = async () => {
    const validImages = getValidImages();
    if (validImages.length === 0 && !finalVideo) {
      alert('没有可保存的内容');
      return;
    }

    setIsSaving(true);
    
    try {
      // 先尝试AI总结梦境
      let summary = dreamSummary;
      if (!summary && validImages.length > 0) {
        try {
          const prompts = validImages.map(img => img.prompt || '');
          
          const summaryResponse = await fetch('/api/summarize-dream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompts,
              images: validImages.map(img => img.imageUrl)
            }),
          });

          const summaryData = await summaryResponse.json();
          if (summaryData.success && summaryData.summary) {
            summary = summaryData.summary;
            setDreamSummary(summary);
          }
        } catch (summaryError) {
          console.error('AI总结失败，继续保存:', summaryError);
          // 总结失败不影响保存
        }
      }

      // 【关键】保存到 Supabase 数据库
      const token = localStorage.getItem('dreamToken');
      if (token && validImages.length > 0) {
        const dreams = validImages.map(img => ({
          prompt: img.prompt || '梦境描述',
          imageUrl: img.imageUrl,
          dreamType: 'default',
          artStyle: 'realistic',
        }));
        
        const response = await fetch('/api/dream-collections', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: dreamSetName || `梦境 ${new Date().toLocaleDateString('zh-CN')}`,
            dreams,
            summary: summary || polishedPromptCN,
          }),
        });
        
        if (response.ok) {
          console.log('[保存] 已保存到 Supabase 梦境库');
          showToast(summary ? '已保存，AI已为你总结梦境！' : '已保存到梦境库', 'success');
          setIsSaving(false);
          setSaveSuccess(true);
          return;
        } else {
          const errorData = await response.json().catch(() => ({ error: '未知错误' }));
          console.error('[保存] 保存到 Supabase 失败:', errorData);
          showToast(`保存失败: ${errorData.error || response.status}`, 'error');
          // 失败时回退到本地保存
        }
      }
      
      // 未登录或保存失败时，保存到本地
      const dreamSetData = {
        id: Date.now().toString(),
        name: dreamSetName || `梦境 ${new Date().toLocaleDateString('zh-CN')}`,
        createdAt: new Date().toISOString(),
        images: getValidImages().map(img => ({
          id: img.id,
          prompt: img.prompt,
          imageUrl: img.imageUrl,
          timestamp: img.timestamp instanceof Date ? img.timestamp.toISOString() : img.timestamp
        })),
        video: finalVideo ? {
          url: finalVideo.url,
          timestamp: finalVideo.timestamp instanceof Date ? finalVideo.timestamp.toISOString() : finalVideo.timestamp
        } : null,
        summary: summary,
        isLocal: true,
      };
      const existingDreams = JSON.parse(localStorage.getItem('dreamLibrary') || '[]');
      existingDreams.unshift(dreamSetData);
      localStorage.setItem('dreamLibrary', JSON.stringify(existingDreams));
      
      showToast('已保存到本地（未登录或云端保存失败）', 'success');
      setIsSaving(false);
      setSaveSuccess(true);
    } catch (error) {
      console.error('[保存] 保存失败:', error);
      showToast('保存失败，请稍后重试', 'error');
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    router.push('/dream');
  };

  // 开始测试
  const handleStartTest = async () => {
    setShowTestIntro(true);
    setIsLoadingQuestions(true);
    
    try {
      const savedData = localStorage.getItem('dreamResultData');
      const data = savedData ? JSON.parse(savedData) : {};
      
      const response = await fetch('/api/psychology-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: data.userInput || '',
          dreamType: data.dreamType || '',
          keywords: data.keywords || [],
          generatedImages: getValidImages().map(img => img.imageUrl),
          polishedPromptCN: data.polishedPromptCN || data.userInput || '', // 传入润色后的描述
        }),
      });
      
      const result = await response.json();
      console.log('[心理测评] 加载题目:', result.questions?.map((q: any) => ({ id: q.id, category: q.category, affects: q.affects })));
      if (result.success) {
        setTestQuestions(result.questions);
        setQuestionIds(result.questions.map((q: TestQuestion) => q.id));
        setCurrentQuestion(0);
        setUserAnswers([]);
      } else {
        showToast(result.error || '加载测试题失败', 'error');
        setShowTestIntro(false);
      }
    } catch (error) {
      console.error('[心理测评] 加载失败:', error);
      showToast('加载测试题失败，请重试', 'error');
      setShowTestIntro(false);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // 提交测试
  const handleSubmitTest = async () => {
    setIsCalculating(true);
    
    try {
      const savedData = localStorage.getItem('dreamResultData');
      const data = savedData ? JSON.parse(savedData) : {};
      
      console.log('[心理测评] 提交题目:', testQuestions?.map((q: any) => ({ id: q.id, category: q.category, affects: q.affects })));
      
      const response = await fetch('/api/psychology-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: userAnswers,
          questions: testQuestions,
          dreamType: data.dreamType || '',
          keywords: data.keywords || [],
          userInput: data.userInput || '',
        }),
      });
      
      const result = await response.json();
      console.log('[心理测评] 收到结果:', result);
      if (result.success) {
        // 保存评估结果到 assessmentRecords
        const savedData = localStorage.getItem('dreamResultData');
        const data = savedData ? JSON.parse(savedData) : {};
        const dreamSetId = data.dreamSetId || 'default';
        
        const records = JSON.parse(localStorage.getItem('assessmentRecords') || '{}');
        records[dreamSetId] = result.result;
        localStorage.setItem('assessmentRecords', JSON.stringify(records));
        
        setAssessmentResult(result.result);
      } else {
        showToast(result.error || '计算结果失败', 'error');
      }
    } catch (error) {
      console.error('[心理测评] 计算失败:', error);
      showToast('计算结果失败，请重试', 'error');
    } finally {
      setIsCalculating(false);
    }
  };

  // 返回答题页面 - 只关闭结果报告，回到测评答题
  const handleRetakeTest = () => {
    setAssessmentResult(null); // 关闭结果报告
    // 保持测评状态和答题记录，可以继续答题或重新答题
  };

  // 完成测试 - 测评完成后自动保存并退出
  const handleCompleteTest = async () => {
    // 【关键】首先确保心理测评结果保存到 assessmentRecords
    // 从 localStorage 获取 dreamSetId
    const savedData = localStorage.getItem('dreamResultData');
    const data = savedData ? JSON.parse(savedData) : {};
    let dreamSetId = data.dreamSetId;
    
    // 如果已经有测评结果，立即保存到 assessmentRecords
    if (assessmentResult) {
      const records = JSON.parse(localStorage.getItem('assessmentRecords') || '{}');
      
      // 如果还没有 dreamSetId，生成一个临时的
      if (!dreamSetId) {
        dreamSetId = Date.now().toString();
        data.dreamSetId = dreamSetId;
        localStorage.setItem('dreamResultData', JSON.stringify(data));
      }
      
      records[dreamSetId] = assessmentResult;
      localStorage.setItem('assessmentRecords', JSON.stringify(records));
      console.log('[完成测试] 心理测评结果已保存到 assessmentRecords:', dreamSetId);
    }
    
    // 如果还没有保存梦境，先自动保存
    if (!saveSuccess) {
      setIsSaving(true);
      
      try {
        const token = localStorage.getItem('dreamToken');
        const dreamUser = localStorage.getItem('dreamUser');
        const validImages = getValidImages();
        
        // 【修复】优先使用润色后的描述作为 summary
        let finalSummary = polishedPromptCN;
        
        if (!finalSummary && validImages.length > 0) {
          const polishedFromImages = validImages
            .map(img => (img as any).polishedPromptCN)
            .filter(Boolean);
          if (polishedFromImages.length > 0) {
            finalSummary = [...new Set(polishedFromImages)].join('；');
          }
        }
        
        if (!finalSummary) {
          let autoSummary = dreamSummary;
          if (!autoSummary && validImages.length > 0) {
            try {
              const prompts = validImages.map(img => img.prompt || '');
              const summaryResponse = await fetch('/api/summarize-dream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompts, images: validImages.map(img => img.imageUrl) }),
              });
              const summaryData = await summaryResponse.json();
              if (summaryData.success && summaryData.summary) {
                autoSummary = summaryData.summary;
                setDreamSummary(autoSummary);
              }
            } catch (summaryError) {
              console.error('AI总结失败:', summaryError);
            }
          }
          finalSummary = autoSummary;
        }

        if (!token || !dreamUser) {
          // 游客模式
          const dreamSetData = {
            id: dreamSetId,
            name: dreamSetName || `梦境 ${new Date().toLocaleDateString('zh-CN')}`,
            createdAt: new Date().toISOString(),
            images: validImages.map(img => ({
              id: img.id,
              prompt: img.prompt,
              imageUrl: img.imageUrl,
              timestamp: img.timestamp instanceof Date ? img.timestamp.toISOString() : img.timestamp
            })),
            summary: finalSummary,
            assessmentResult: assessmentResult,
            isLocal: true,
          };
          const existingDreams = JSON.parse(localStorage.getItem('dreamLibrary') || '[]');
          existingDreams.unshift(dreamSetData);
          localStorage.setItem('dreamLibrary', JSON.stringify(existingDreams));
          setSaveSuccess(true);
        } else {
          // 已登录用户
          const dreams = validImages.map(img => ({
            prompt: img.prompt || '梦境描述',
            imageUrl: img.imageUrl,
            dreamType: 'default',
            artStyle: 'realistic',
          }));
          
          const saveResponse = await fetch('/api/dream-collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title: dreamSetName || `梦境集 ${new Date().toLocaleDateString('zh-CN')}`, dreams, summary: finalSummary }),
          });
          
          if (saveResponse.ok && assessmentResult) {
            const saveData = await saveResponse.json();
            if (saveData.collection?.id) {
              // 更新 assessmentRecords 使用服务器返回的 ID
              const records = JSON.parse(localStorage.getItem('assessmentRecords') || '{}');
              records[saveData.collection.id] = assessmentResult;
              // 删除临时的 ID
              delete records[dreamSetId];
              localStorage.setItem('assessmentRecords', JSON.stringify(records));
            }
          }
          
          setSaveSuccess(true);
        }
        
        showToast('梦境已保存', 'success');
      } catch (error) {
        console.error('[自动保存] 失败:', error);
        showToast('保存失败', 'error');
      } finally {
        setIsSaving(false);
      }
    } else if (assessmentResult) {
      // 已经保存过梦境，但确保 assessmentRecords 使用正确的 ID
      showToast('评估结果已保存', 'success');
    }
    
    // 重置测评状态并跳转到梦境库
    setAssessmentResult(null);
    setShowTestIntro(false);
    setTestQuestions([]);
    setQuestionIds([]);
    setCurrentQuestion(0);
    setUserAnswers([]);
    
    // 跳转到梦境库
    router.push('/dreams');
  };

  // 获取压力等级颜色（危险=红，临界=黄，健康=绿）
  const getStressColor = (level: number) => {
    if (level > 70) return { 
      bg: 'bg-red-500', 
      text: 'text-red-400', 
      label: '危险',
      stroke: '#ef4444'
    };
    if (level > 50) return { 
      bg: 'bg-yellow-500', 
      text: 'text-yellow-400', 
      label: '临界',
      stroke: '#eab308'
    };
    return { 
      bg: 'bg-green-500', 
      text: 'text-green-400', 
      label: '健康',
      stroke: '#22c55e'
    };
  };

  return (
    <div 
      className={`min-h-screen flex flex-col ${
        mode === 'dark' ? '' : 'bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd]'
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
      {isDeveloper && <DraggableFixButton />}
      
      <header className={`relative z-10 px-4 py-4 border-b ${mode === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/60 border-sky-100/50'}`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={handleContinue}
            className={`flex items-center gap-2 bg-transparent outline-none border-none transition-all duration-300 ${mode === 'dark' ? 'text-white/70 hover:text-sky-300' : 'text-gray-500 hover:text-sky-500'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" />
            </svg>
            <span>继续创作</span>
          </button>
          <h1 className={`text-lg font-light ${mode === 'dark' ? 'text-white/90' : 'text-gray-600'}`}>
            {dreamSetName || '梦境'}
          </h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 relative z-10">
        
        {showSaveSuccessMsg && (
          <div className={`mb-4 p-4 rounded-xl text-center animate-pulse ${
            mode === 'dark' ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-600'
          }`}>
            ✓ 保存成功！
          </div>
        )}

        {/* 图片列表 */}
        {selectedImages.length > 0 && (
          <div className="mb-6">
            {(() => {
              const validImages = selectedImages.filter(img => img.imageUrl);
              return validImages.length > 0 ? (
                <>
                  <h2 className={`text-sm mb-3 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                    图片 {validImages.length} 张
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {validImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.imageUrl}
                          alt=""
                          className="w-full aspect-square object-cover rounded-xl cursor-pointer"
                          onClick={() => setExpandedImage(img.imageUrl)}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <button
                          onClick={() => handleDeleteImage(img.id)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-lg"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : null;
            })()}
          </div>
        )}

        {/* 视频 */}
        {finalVideo && (
          <div className="mb-6">
            <h2 className={`text-sm mb-3 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
              视频
            </h2>
            <div className="relative">
              <div className="aspect-video rounded-xl overflow-hidden bg-black">
                <video src={finalVideo.url} controls className="w-full h-full" />
              </div>
              <button
                onClick={handleDeleteVideo}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-lg"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* 梦境总结区域 - 始终显示润色后的描述 */}
        {(selectedImages.length > 0 || finalVideo) && (
          <div className={`mb-6 p-4 rounded-2xl ${mode === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-sm font-medium ${mode === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                📝 梦境描述
              </h3>
            </div>
            {polishedPromptCN ? (
              <p className={`text-sm leading-relaxed ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                {polishedPromptCN}
              </p>
            ) : dreamSummary ? (
              <p className={`text-sm leading-relaxed ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                {dreamSummary}
              </p>
            ) : (
              <p className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                暂无梦境描述
              </p>
            )}
          </div>
        )}

        {/* 空状态 */}
        {selectedImages.length === 0 && !finalVideo && (
          <div className="text-center py-20">
            <p className={`text-lg ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
              没有可保存的内容
            </p>
            <button
              onClick={handleContinue}
              className={`mt-4 px-6 py-2 rounded-xl ${mode === 'dark' ? 'bg-sky-600 text-white' : 'bg-sky-500 text-white'}`}
            >
              继续创作
            </button>
          </div>
        )}

        {/* 心理测评介绍页 */}
        {showTestIntro && testQuestions.length === 0 && !assessmentResult && (
          <div className={`mt-6 p-6 rounded-2xl ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
            <div className="text-center mb-6">
              <span className="text-5xl">💭</span>
              <h2 className={`text-xl font-medium mt-4 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                心理压力测评
              </h2>
              <p className={`text-sm mt-2 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                了解你最近的心理状态与压力来源
              </p>
            </div>
            
            <div className={`p-4 rounded-xl mb-4 ${mode === 'dark' ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
              <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>
                📋 测评说明
              </h3>
              <ul className={`text-xs space-y-1 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                <li>• 共 12 道选择题</li>
                <li>• 测评你的生活压力来源</li>
                <li>• 分析你的应对方式</li>
                <li>• 提供心理健康建议</li>
              </ul>
            </div>

            <div className={`p-4 rounded-xl mb-6 ${mode === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                🎯 测评维度
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(categoryNames).map(([key, val]) => (
                  <div key={key} className={`p-2 rounded-lg ${mode === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                    <span className="font-medium">{val.icon} {val.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-4 rounded-xl mb-6 ${mode === 'dark' ? 'bg-green-500/10' : 'bg-green-50'}`}>
              <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-green-300' : 'text-green-600'}`}>
                💡 测评收获
              </h3>
              <ul className={`text-xs space-y-1 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                <li>• 了解主要压力来源</li>
                <li>• 认识自己的应对方式</li>
                <li>• 获取个性化建议</li>
                <li>• 辅助性格倾向分析</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTestIntro(false)}
                className={`flex-1 py-3 rounded-xl text-sm ${mode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'}`}
              >
                返回
              </button>
              <button
                onClick={handleStartTest}
                disabled={isLoadingQuestions}
                className={`flex-1 py-3 rounded-xl text-sm font-medium ${mode === 'dark' ? 'bg-sky-500 text-white hover:bg-sky-600' : 'bg-sky-500 text-white hover:bg-sky-600'}`}
              >
                {isLoadingQuestions ? '加载中...' : '开始测评'}
              </button>
            </div>
          </div>
        )}

        {/* 测试题目 */}
        {testQuestions.length > 0 && !assessmentResult && (
          <div className={`mt-6 p-5 rounded-2xl ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`text-sm ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                第 {currentQuestion + 1} / {testQuestions.length} 题
              </div>
              <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 ${mode === 'dark' ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-600'}`}>
                <span>{categoryNames[testQuestions[currentQuestion].category]?.icon}</span>
                <span>{categoryNames[testQuestions[currentQuestion].category]?.name}</span>
              </div>
            </div>
            
            <div className={`h-1.5 rounded-full mb-6 ${mode === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
              <div 
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500 transition-all"
                style={{ width: `${((currentQuestion + 1) / testQuestions.length) * 100}%` }}
              />
            </div>
            
            <div className={`text-base mb-6 ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              {testQuestions[currentQuestion].question}
            </div>
            
            <div className="space-y-3">
              {testQuestions[currentQuestion].options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    const newAnswers = [...userAnswers];
                    newAnswers[currentQuestion] = index;
                    setUserAnswers(newAnswers);
                  }}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    userAnswers[currentQuestion] === index
                      ? (mode === 'dark' ? 'bg-sky-500/40 text-white border-2 border-sky-400' : 'bg-sky-100 text-purple-800 border-2 border-sky-400')
                      : (mode === 'dark' ? 'bg-white/5 text-white/80 border border-white/10 hover:bg-white/10' : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100')
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full mr-3 text-sm font-medium ${
                    userAnswers[currentQuestion] === index
                      ? (mode === 'dark' ? 'bg-sky-500 text-white' : 'bg-sky-500 text-white')
                      : (mode === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-500')
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  {option}
                </button>
              ))}
            </div>
            
            <div className="flex gap-3 mt-6">
              {currentQuestion > 0 && (
                <button
                  onClick={() => setCurrentQuestion(prev => prev - 1)}
                  className={`flex-1 py-3 rounded-xl text-sm ${mode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'}`}
                >
                  上一题
                </button>
              )}
              {currentQuestion < testQuestions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestion(prev => prev + 1)}
                  disabled={userAnswers[currentQuestion] === undefined}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium ${
                    userAnswers[currentQuestion] !== undefined
                      ? (mode === 'dark' ? 'bg-sky-500 text-white' : 'bg-sky-500 text-white')
                      : (mode === 'dark' ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                  }`}
                >
                  下一题
                </button>
              ) : (
                <button
                  onClick={handleSubmitTest}
                  disabled={userAnswers.filter(a => a !== undefined).length < testQuestions.length || isCalculating}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium ${
                    userAnswers.filter(a => a !== undefined).length === testQuestions.length && !isCalculating
                      ? (mode === 'dark' ? 'bg-green-500 text-white' : 'bg-green-500 text-white')
                      : (mode === 'dark' ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                  }`}
                >
                  {isCalculating ? '分析中...' : '查看结果'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 评估结果 */}
        {assessmentResult && (
          <div className={`mt-6 p-6 rounded-2xl ${mode === 'dark' ? 'bg-gradient-to-br from-sky-500/10 to-blue-500/10' : 'bg-gradient-to-br from-sky-50 to-blue-50'}`}>
            <div className="text-center mb-6">
              <h2 className={`text-xl font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                压力评估报告
              </h2>
              <p className={`text-sm mt-2 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                基于你最近的真实状态
              </p>
            </div>

            {/* 压力等级仪表 */}
            <div className={`p-4 rounded-xl mb-6 text-center ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke={mode === 'dark' ? '#ffffff10' : '#e5e7eb'}
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke={getStressColor(assessmentResult.stressLevel).stroke}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${(assessmentResult.stressLevel / 100) * 352} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-bold ${getStressColor(assessmentResult.stressLevel).text}`}>
                    {assessmentResult.stressLevel}
                  </span>
                  <span className={`text-xs ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                    /100
                  </span>
                </div>
              </div>
              <div className={`text-lg font-medium ${getStressColor(assessmentResult.stressLevel).text}`}>
                {assessmentResult.stressLabel}
              </div>
              <p className={`text-xs mt-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                {assessmentResult.stressDescription}
              </p>
            </div>

            {/* 压力来源分析 */}
            <div className={`p-4 rounded-xl mb-4 ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
              <h3 className={`text-sm font-medium mb-3 ${mode === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>
                📊 压力来源分析
              </h3>
              <div className="space-y-3">
                {Object.entries(assessmentResult.stressSources).map(([key, value]) => {
                  // 确保value是有效的数字
                  const safeValue = typeof value === 'number' && !isNaN(value) ? Math.max(0, Math.min(100, value)) : 0;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-6">{categoryNames[key]?.icon}</span>
                      <span className={`text-xs w-16 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                        {categoryNames[key]?.name}
                      </span>
                      <div className={`flex-1 h-2 rounded-full min-w-[4px] ${mode === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                        {safeValue > 0 && (
                          <div
                            className={`h-full rounded-full ${getStressColor(safeValue).bg}`}
                            style={{ width: `${Math.max(safeValue, 3)}%` }}
                          />
                        )}
                      </div>
                      <span className={`text-xs w-8 text-right ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                        {safeValue}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 情绪状态 */}
            <div className={`p-4 rounded-xl mb-4 ${mode === 'dark' ? 'bg-white/5' : 'bg-white/80'}`}>
              <h3 className={`text-sm font-medium mb-3 ${mode === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                💭 情绪状态
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className={`text-lg font-medium ${mode === 'dark' ? 'text-orange-400' : 'text-orange-500'}`}>
                    {assessmentResult.emotionState.anxiety}%
                  </div>
                  <div className={`text-xs ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>焦虑程度</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-medium ${mode === 'dark' ? 'text-sky-400' : 'text-sky-500'}`}>
                    {assessmentResult.emotionState.depression}%
                  </div>
                  <div className={`text-xs ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>抑郁程度</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-medium ${mode === 'dark' ? 'text-green-400' : 'text-green-500'}`}>
                    {assessmentResult.emotionState.resilience}%
                  </div>
                  <div className={`text-xs ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>心理韧性</div>
                </div>
              </div>
            </div>

            {/* 应对方式 */}
            <div className={`p-4 rounded-xl mb-4 ${mode === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
              <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-yellow-300' : 'text-yellow-600'}`}>
                🎯 应对方式：{assessmentResult.copingStyle.label}
              </h3>
              <p className={`text-xs leading-relaxed ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                {assessmentResult.copingStyle.description}
              </p>
            </div>

            {/* 心理健康建议 */}
            <div className={`p-4 rounded-xl mb-4 ${mode === 'dark' ? 'bg-green-500/10' : 'bg-green-50'}`}>
              <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-green-300' : 'text-green-600'}`}>
                💡 心理健康建议
              </h3>
              <ul className="space-y-1">
                {assessmentResult.suggestions.map((s, i) => (
                  <li key={i} className={`text-xs flex items-start gap-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                    <span className="text-green-400">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 性格倾向（辅助） */}
            <div className={`p-4 rounded-xl mb-4 ${mode === 'dark' ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
              <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>
                🧩 性格倾向（基于应对方式）
              </h3>
              <p className={`text-xs font-medium mb-1 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                {assessmentResult.personalityInsight.type} · {assessmentResult.personalityInsight.tendency}
              </p>
              <p className={`text-xs leading-relaxed ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                {assessmentResult.personalityInsight.description}
              </p>
            </div>

            {/* 梦境关联 */}
            {assessmentResult.dreamAnalysis && (
              <div className={`p-4 rounded-xl mb-6 ${mode === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <h3 className={`text-sm font-medium mb-2 ${mode === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                  🌙 梦境关联分析
                </h3>
                <p className={`text-xs mb-2 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                  {assessmentResult.dreamAnalysis.summary}
                </p>
                <div className="space-y-1">
                  {assessmentResult.dreamAnalysis.insights.map((insight, i) => (
                    <p key={i} className={`text-xs flex items-start gap-2 ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
                      <span className="text-blue-400">•</span>
                      <span>{insight}</span>
                    </p>
                  ))}
                </div>
                {assessmentResult.dreamAnalysis.stressIndicators.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {assessmentResult.dreamAnalysis.stressIndicators.map((indicator, i) => (
                      <span key={i} className={`px-2 py-1 rounded text-xs ${mode === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                        {indicator}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRetakeTest}
                disabled={isSaving}
                className={`flex-1 py-3 rounded-xl text-sm ${mode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'}`}
              >
                {isSaving ? '保存中...' : '返回'}
              </button>
              <button
                onClick={handleCompleteTest}
                disabled={isSaving}
                className={`flex-1 py-3 rounded-xl text-sm font-medium ${mode === 'dark' ? 'bg-sky-500 text-white' : 'bg-sky-500 text-white'}`}
              >
                {isSaving ? '保存中...' : '保存并退出'}
              </button>
            </div>
          </div>
        )}

        {/* 保存后显示的操作区 */}
        {!showTestIntro && testQuestions.length === 0 && !assessmentResult && getValidImages().length > 0 && (
          <div className="mt-4 space-y-3">
            {/* 1. 保存按钮 - 始终显示 */}
            {!saveSuccess && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                  mode === 'dark'
                    ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-600 hover:to-blue-600 shadow-lg shadow-sky-500/25'
                    : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-600 hover:to-blue-600 shadow-lg shadow-sky-500/20'
                } disabled:opacity-50`}
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    保存中...
                  </span>
                ) : '一键保存'}
              </button>
            )}

            {/* 2. 心理测评入口 - 始终显示 */}
            <div className={`rounded-2xl overflow-hidden ${mode === 'dark' ? 'bg-gradient-to-br from-sky-500/20 via-blue-500/10 to-sky-500/20' : 'bg-gradient-to-br from-sky-100 via-blue-50 to-sky-100'}`}>
              {/* 顶部装饰条 */}
              <div className="h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-sky-500" />
              
              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  {/* 图标区域 */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${mode === 'dark' ? 'bg-sky-500/20' : 'bg-sky-100'}`}>
                    <span className="text-3xl">🧠</span>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`text-lg font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                      AI心理压力测评
                    </h3>
                    {!saveSuccess ? (
                      <p className={`text-xs mt-0.5 ${mode === 'dark' ? 'text-orange-400' : 'text-orange-500'}`}>
                        ⚠️ 保存梦境后才可进行测评
                      </p>
                    ) : (
                      <p className={`text-xs mt-0.5 ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                        基于你的梦境内容，量身定制专属测评
                      </p>
                    )}
                  </div>
                </div>
                
                {/* 测评特点 */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className={`flex items-center gap-2 text-xs ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">✓</span>
                    <span>个性化题目</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">✓</span>
                    <span>梦境关联分析</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">✓</span>
                    <span>多维度评估</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400">✓</span>
                    <span>专属建议</span>
                  </div>
                </div>
                
                {/* 开始按钮 */}
                <button
                  onClick={handleStartTest}
                  disabled={!saveSuccess || isLoadingQuestions}
                  className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                    saveSuccess
                      ? (mode === 'dark' 
                          ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-600 hover:to-blue-600 shadow-lg shadow-sky-500/25' 
                          : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-600 hover:to-blue-600 shadow-lg shadow-sky-500/20')
                      : (mode === 'dark'
                          ? 'bg-white/10 text-white/30 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                  }`}
                >
                  {isLoadingQuestions ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      加载题目中...
                    </span>
                  ) : saveSuccess ? '开始测评' : '保存后即可测评'}
                </button>
              </div>
            </div>

            {/* 保存/返回首页按钮 */}
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => {
                  if (isNavigatingHome) return;
                  setIsNavigatingHome(true);
                  setTimeout(() => {
                    router.push('/');
                  }, 500);
                }}
                disabled={isNavigatingHome}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  mode === 'dark'
                    ? 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                } disabled:opacity-50`}
              >
                {isNavigatingHome ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>返回中...</span>
                  </>
                ) : (
                  <>
                    <span className="text-base">🏠</span>
                    <span>返回首页</span>
                  </>
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || getValidImages().length === 0}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  getValidImages().length > 0
                    ? (mode === 'dark'
                        ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30'
                        : 'bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200')
                    : (mode === 'dark'
                        ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
                        : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100')
                }`}
              >
                <span className="text-base">{saveSuccess ? '✓' : '💾'}</span>
                <span>{saveSuccess ? '已保存' : '保存'}</span>
              </button>
            </div>

            {/* 3. 查看梦境库按钮 - 保存后显示 */}
            {saveSuccess && (
              <button
                onClick={() => router.push('/dreams')}
                className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                  mode === 'dark'
                    ? 'bg-white/10 text-white/80 hover:bg-white/15 border border-white/10'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                📚 查看梦境库
              </button>
            )}
          </div>
        )}
      </main>

      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            onClick={() => setExpandedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center text-2xl"
          >
            ×
          </button>
        </div>
      )}

    </div>
  );
}