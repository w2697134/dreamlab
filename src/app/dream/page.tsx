'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { useGeneration } from '@/components/GenerationProvider';
import { usePersistentState, clearAllDreamState } from '@/hooks/usePersistentState';
import { checkHealthWithCache, prefetchHealthStatus } from '@/lib/health-check-cache';
import DraggableFixButton from '@/components/ui/DraggableFixButton';
import DreamProgressBar from '@/components/DreamProgressBar';
import StarBackground from '@/components/StarBackground';
import GlobalLoading from '@/components/GlobalLoading';

// ========== 常见角色词库 ==========
const CHARACTER_DATABASE: Record<string, {
  englishName: string;
  source: string;
  description: string;
  keyFeatures?: string[];
}> = {
  // 熊出没 - 拟人化熊
  '熊大': { 
    englishName: 'Xiong Da', 
    source: 'Boonie Bears', 
    description: 'anthropomorphic brown bear, walks upright like human, talks and expresses emotions like human, strong muscular build, kind intelligent eyes, red nose, brown fur, wears a friendly confident expression',
    keyFeatures: ['anthropomorphic', 'upright walking', 'human-like expressions', 'talking bear']
  },
  '熊二': { 
    englishName: 'Xiong Er', 
    source: 'Boonie Bears', 
    description: 'anthropomorphic brown bear, walks upright like human, talks and expresses emotions like human, chubby round build, silly cute expression, loves to eat, slower but kind-hearted',
    keyFeatures: ['anthropomorphic', 'upright walking', 'human-like expressions', 'chubby', 'food lover']
  },
  '光头强': { 
    englishName: 'Guang Tou Qiang', 
    source: 'Boonie Bears', 
    description: 'bald man, wears orange hard hat, wears blue work clothes, logger, interacts with talking bears'
  },
  
  // 哆啦A梦 - 拟人化机器猫
  '哆啦A梦': { 
    englishName: 'Doraemon', 
    source: 'Doraemon', 
    description: 'anthropomorphic blue robotic cat, walks upright like human, talks and expresses emotions like human, round chubby body, red ball nose, big white face, bell on red collar, magical 4D pocket on belly, no ears (eaten by mice), loves dorayaki, friendly cute expression',
    keyFeatures: ['anthropomorphic', 'upright walking', 'human-like expressions', 'robotic cat', 'magical pocket', 'blue body', 'red nose']
  },
  '大雄': { 
    englishName: 'Nobita', 
    source: 'Doraemon', 
    description: 'boy with glasses, wears blue school uniform, clumsy, kind-hearted'
  },
  '静香': { 
    englishName: 'Shizuka', 
    source: 'Doraemon', 
    description: 'girl with pink dress, kind and gentle'
  },
  
  // 国产神话
  '哪吒': { 
    englishName: 'Nezha', 
    source: 'Chinese mythology', 
    description: 'mythological young boy, red hair ribbon, fire wheels under feet, spear in hand, lotus flower pattern on clothes, fiery golden eyes, powerful and heroic'
  },
  '孙悟空': { 
    englishName: 'Sun Wukong', 
    source: 'Journey to the West', 
    description: 'anthropomorphic monkey, Monkey King, golden hair, golden headband, Ruyi Jingu Bang staff, fiery golden eyes, monkey face and features, wears golden armor, powerful and rebellious',
    keyFeatures: ['anthropomorphic', 'monkey features', 'golden hair', 'golden headband']
  },
  '猪八戒': { 
    englishName: 'Zhu Bajie', 
    source: 'Journey to the West', 
    description: 'anthropomorphic pig demon, pig face and features, big round belly, wears monk robe, nine-toothed rake weapon, loves food, lazy but kind',
    keyFeatures: ['anthropomorphic', 'pig features', 'big belly']
  },
  '唐僧': { 
    englishName: 'Tang Sanzang', 
    source: 'Journey to the West', 
    description: 'Buddhist monk, wears kasaya robe, holds monk staff, kind and compassionate expression'
  },
  
  // 原神
  '雷电将军': { 
    englishName: 'Raiden Shogun', 
    source: 'Genshin Impact', 
    description: 'long purple hair, purple eyes, electro motifs, traditional Japanese outfit'
  },
  '八重神子': { 
    englishName: 'Yae Miko', 
    source: 'Genshin Impact', 
    description: 'pink-purple gradient hair, white fox ears, violet eyes, shrine maiden outfit'
  },
  '钟离': { 
    englishName: 'Zhongli', 
    source: 'Genshin Impact', 
    description: 'brown hair, amber eyes, Geo motifs, formal suit'
  },
  '温迪': { 
    englishName: 'Venti', 
    source: 'Genshin Impact', 
    description: 'green hair, twin braids, Anemo motifs, bard outfit'
  },
  '胡桃': { 
    englishName: 'Hu Tao', 
    source: 'Genshin Impact', 
    description: 'brown hair with red highlights, red eyes, Pyro motifs, funeral parlor director outfit'
  },
};

// ========== 类型定义 ==========

interface SelectedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  timestamp: Date | string;
  sceneElements: string[];
  lightMood: string;
  perspective: string;
  atmosphere: string;
}

interface GeneratedImage {
  imageUrl: string;
  selected: boolean;
  sceneElements: string[];
  lightMood: string;
  perspective: string;
  atmosphere: string;
  interpretation?: string; // AI解读（包含关键词+解读+情绪标签）
  keywords?: string[]; // 提取的关键词
  emotionTags?: string[]; // 情绪标签
  isInterpreting?: boolean; // 是否正在解读
  polishedPrompt?: string; // AI润色后的英文正向提示词（给SD用）
  polishedPromptCN?: string; // AI润色后的中文描述（给用户看）
  negativePrompt?: string[]; // AI分析的反向提示词（给SD用，不显示给用户）
}

interface UploadedImage {
  id: string;
  dataUrl: string; // base64 格式
  name: string;
}

// ========== 配置常量 ==========

const sceneElementOptions = [
  '河流', '湖泊', '海洋', '森林', '草原', '山川', 
  '天空', '云端', '城市', '村庄', '废墟', '花园',
  '室内', '宫殿', '洞穴', '沙滩'
];

const lightMoodOptions = [
  { id: 'dawn', name: '晨曦', desc: '柔和清新的早晨光线' },
  { id: 'noon', name: '正午', desc: '明亮强烈的日光' },
  { id: 'dusk', name: '黄昏', desc: '温暖浪漫的夕阳' },
  { id: 'night', name: '夜晚', desc: '神秘深邃的月光星光' },
  { id: 'twilight', name: '暮色', desc: '渐变的蓝紫暮光' },
];

const perspectiveOptions = [
  { id: 'close', name: '近景', desc: '细节特写' },
  { id: 'medium', name: '中景', desc: '人物与环境平衡' },
  { id: 'far', name: '远景', desc: '广阔视野' },
  { id: 'birds', name: '鸟瞰', desc: '俯视全景' },
  { id: 'worm', name: '仰视', desc: '向上视角' },
];

const atmosphereOptions = [
  { id: 'peaceful', name: '宁静', desc: '平静祥和' },
  { id: 'mysterious', name: '神秘', desc: '神秘未知' },
  { id: 'warm', name: '温馨', desc: '温暖亲切' },
  { id: 'melancholy', name: '忧郁', desc: '淡淡的忧伤' },
  { id: 'magical', desc: '充满魔力', name: '魔幻' },
  { id: 'lonely', name: '孤独', desc: '寂静空旷' },
  { id: 'horror', name: '惊悚', desc: '令人不安' },
  { id: 'ethereal', name: '空灵', desc: '超凡脱俗' },
];

// 艺术风格 - 简化为3种，水彩/油画通过提示词在写实模型中实现
const artStyles = [
  { id: 'default', name: '默认', desc: 'AI自动适配风格', icon: '✨' },
  { id: 'realistic', name: '写实', desc: '照片级逼真细腻', icon: '📷' },
  { id: 'anime', name: '二次元', desc: '梦幻唯美、高品质插画风', icon: '🎨' },
  { id: 'watercolor', name: '水彩', desc: '柔和通透、艺术感', icon: '💧' },
  { id: 'oil', name: '油画', desc: '厚重质感、古典美', icon: '🖼️' },
];

const defaultDreamKeywords = [
  '漂浮', '飞行', '坠落', '追逐', '迷失',
  '森林', '海洋', '星空', '城市', '废墟',
  '童年', '故人', '温暖', '孤独',
  '变形', '时间循环', '镜中世界',
];

// ========== 增强型提示词词典 ==========

const qualityEnhancers = [
  '8K超高清', '照片级真实感', '电影级构图', '戏剧性光影',
  '辛烷值渲染', '虚幻引擎5', '体积光渲染', '焦散效果',
  '景深虚化', 'HDR渲染', '细腻纹理', '全局光照',
  '光线追踪', '色彩分级', '电影感色调', '梦幻散景',
];

const emotionEnhancers = {
  nightmare: [
    '阴森恐怖', '压迫感', '扭曲变形', '不祥预感', 
    '诡异阴影', '黑暗侵蚀', '失真扭曲', '噩梦般压抑',
    '血红光芒', '腐烂质感', '裂痕纹理', '不安蠕动'
  ],
  sweet: [
    '柔和温暖', '棉花糖质感', '梦幻泡泡', '蜜糖色调',
    '天鹅绒质感', '花瓣飘落', '柔焦光晕', '彩虹渐变',
    '珍珠光泽', '金色光芒', '薰衣草紫', '少女粉红'
  ],
  fantasy: [
    '魔法粒子', '星辰飘落', '彩虹桥', '精灵光芒',
    '传送门', '时空裂缝', '水晶球', '魔法阵',
    '发光的藤蔓', '浮空岛屿', '独角兽', '龙之焰'
  ],
  memory: [
    '褪色照片质感', '怀旧颗粒', '时光倒流', '泛黄边框',
    '模糊记忆', '褪色色彩', '旧时光', '老电影效果',
    '褪色胶片', '记忆碎片', '光斑效果', '岁月痕迹'
  ],
  lucid: [
    '超清晰细节', '水晶般透明', '意识觉醒', '时间静止',
    '慢动作', '漂浮感', '悬浮粒子', '几何光阵',
    '脉动光环', '能量波纹', '维度裂缝', '清醒边缘'
  ],
  prophetic: [
    '神秘符号', '未来碎片', '命运之线', '预言光环',
    '时间裂缝', '水晶球映像', '塔罗牌意象', '星象轨迹',
    '命运交织', '冥冥指引', '未知预示', '天启之光'
  ],
  recurring: [
    '似曾相识', '循环往复', '时间漩涡', '记忆重叠',
    '重复图案', '无尽回廊', '莫比乌斯环', '因果循环',
    '原地打转', '永恒瞬间', '重复的错觉', '轮回印记'
  ],
  default: [
    '朦胧美感', '意境深远', '光影交错', '层次丰富',
    '氛围感强', '情绪浓郁', '超现实美感', '梦境般的',
    '神秘感', '诗意画面', '艺术感', '视觉冲击力'
  ],
};

const sceneEnhancers = {
  '河流': ['波光粼粼', '水面倒影', '水流漩涡', '雾气缭绕', '金色水面'],
  '湖泊': ['镜面反射', '晨雾弥漫', '芦苇摇曳', '倒影清晰', '水天一色'],
  '海洋': ['浪花翻涌', '深邃蔚蓝', '贝壳散落', '珊瑚礁', '海底光线'],
  '森林': ['迷雾森林', '阳光穿透', '树影婆娑', '苔藓覆盖', '精灵微光'],
  '草原': ['风吹草动', '云影移动', '野花点缀', '远山轮廓', '天际线'],
  '山川': ['云海翻腾', '雪山巍峨', '瀑布飞溅', '奇峰怪石', '云雾缭绕'],
  '天空': ['流星划过', '极光舞动', '星辰满天', '彩虹横跨', '云彩翻涌'],
  '云端': ['云海翻腾', '光芒万丈', '天庭之门', '祥云缭绕', '神圣光芒'],
  '城市': ['霓虹闪烁', '灯火阑珊', '孤独街道', '玻璃幕墙', '赛博朋克'],
  '村庄': ['炊烟袅袅', '宁静祥和', '石板小路', '老树昏鸦', '田园风光'],
  '废墟': ['断壁残垣', '藤蔓缠绕', '神秘遗迹', '岁月侵蚀', '鬼火幽光'],
  '花园': ['繁花似锦', '蝴蝶翩翩', '喷泉雕塑', '曲径通幽', '花香四溢'],
  '室内': ['柔和灯光', '窗帘飘动', '书架林立', '壁炉火焰', '温馨角落'],
  '宫殿': ['金碧辉煌', '水晶吊灯', '大理石柱', '壁画浮雕', '华丽帷幔'],
  '洞穴': ['钟乳石林', '地下河流', '发光矿石', '蝙蝠群飞', '神秘回声'],
  '沙滩': ['金色沙滩', '贝壳散落', '海浪轻拍', '夕阳余晖', '脚印延伸'],
};

const perspectiveEnhancers = {
  'close': ['皮肤纹理清晰', '睫毛分明', '呼吸可见', '细节毕现', '毛孔可见'],
  'medium': ['半身入镜', '环境呼应', '人物姿态', '表情丰富', '氛围完整'],
  'far': ['视野开阔', '气势磅礴', '层次分明', '天际无限', '意境悠远'],
  'birds': ['上帝视角', '一览无余', '图案美感', '几何构图', '宏观视野'],
  'worm': ['仰望苍穹', '压迫震撼', '高大巍峨', '头晕目眩', '仰视敬畏'],
};

const lightEnhancers = {
  'dawn': ['金色光芒', '朝霞满天', '露珠闪烁', '薄雾轻笼', '第一缕阳光'],
  'noon': ['强烈日光', '阳光直射', '明亮刺眼', '影子短小', '炎热气息'],
  'dusk': ['橘红晚霞', '落日余晖', '倦鸟归巢', '华灯初上', '温暖柔和'],
  'night': ['银色月光', '星空璀璨', '萤火虫舞', '夜风轻拂', '静谧深邃'],
  'twilight': ['蓝紫色调', '魔幻时刻', '明暗交界', '神秘氛围', '过渡美感'],
};

// ========== 主组件 ==========

export default function DreamPage() {
  const router = useRouter();
  const { mode, toggleMode } = useTheme();
  const { isDeveloper, isLoggedIn, user: authUser } = useAuth();
  const { showToast } = useToast();
  const { 
    state: genState, 
    state,
    startGeneration, 
    updateProgress, 
    addGeneratedImage, 
    setError, 
    finishGeneration,
    clearGeneration 
  } = useGeneration();
  
  // 清理动画的useEffect
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  // 页面挂载时标记初始化完成（保留生成的图片）
  useEffect(() => {
    // 检查是否是从结果页返回
    const isReturning = sessionStorage.getItem('isReturningToDream');
    if (isReturning) {
      console.log('[梦境页面] 从结果页返回，恢复状态');
      // 清除返回标志，避免重复恢复
      sessionStorage.removeItem('isReturningToDream');
    }
    
    const timer = setTimeout(() => setIsPageReady(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  // 【后台生成支持】同步全局生成状态到本地
  useEffect(() => {
    // 如果全局正在生成，同步到本地显示
    if (genState.isGenerating) {
      setIsGenerating(true);
      setGenerateProgress(genState.progress);
      setGenerateMessage(genState.message);
      setGenerateStage(genState.stage);
    }
  }, [genState.isGenerating, genState.progress, genState.message, genState.stage]);
  
  // 使用持久化状态 - 表单数据在页面跳转后保留
  const [artStyle, setArtStyle] = usePersistentState({ key: 'dream_form_artStyle', defaultValue: 'default' });
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [currentPrompt, setCurrentPrompt] = usePersistentState({ key: 'dream_form_currentPrompt', defaultValue: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = usePersistentState<GeneratedImage[]>({ key: 'dream_generatedImages', defaultValue: [], debounceMs: 100 });
  const [lastPolishedPrompt, setLastPolishedPrompt] = usePersistentState<string>({ key: 'dream_lastPolishedPrompt', defaultValue: '', debounceMs: 100 }); // 润色后的英文提示词
  const [lastPolishedPromptCN, setLastPolishedPromptCN] = usePersistentState<string>({ key: 'dream_lastPolishedPromptCN', defaultValue: '', debounceMs: 100 }); // 润色后的中文描述
  const [isPageReady, setIsPageReady] = useState(false); // 页面初始化完成标记
  const [selectedImages, setSelectedImages] = usePersistentState<SelectedImage[]>({ key: 'dream_selectedImages', defaultValue: [] });
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [adjustImageUrl, setAdjustImageUrl] = useState<string | null>(null);
  const [adjustmentText, setAdjustmentText] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [moodAnalysis, setMoodAnalysis] = useState<{
    overall: string;
    colorTendency: string;
    moodLevel: number;
    stressLevel: number;
    keywords: string[];
    suggestions: string;
  } | null>(null);
  const [isAnalyzingMood, setIsAnalyzingMood] = useState(false);
  const [showMoodPanel, setShowMoodPanel] = useState(false);
  const [contextHistory, setContextHistory] = usePersistentState<{
    sceneElements: string[];
    lightMood: string;
    perspective: string;
    atmosphere: string;
    lastPrompt: string;
    userInputs: string[]; // 记录用户所有输入
    generatedImages: string[]; // 记录生成的图片URL
    selectedKeywords: string[]; // 记录选择的关键词
    dreamSequence: number; // 梦境片段序号
  } | null>({ key: 'dream_contextHistory', defaultValue: null });
  const [selectedSceneElements, setSelectedSceneElements] = usePersistentState<string[]>({ key: 'dream_form_selectedSceneElements', defaultValue: [] });
  const [dreamKeywords, setDreamKeywords] = usePersistentState<string[]>({ key: 'dream_form_dreamKeywords', defaultValue: defaultDreamKeywords });
  const [selectedKeywords, setSelectedKeywords] = usePersistentState<string[]>({ key: 'dream_form_selectedKeywords', defaultValue: [] });
  const [isRefreshingKeywords, setIsRefreshingKeywords] = useState(false);
  const [showRiverAnimation, setShowRiverAnimation] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [hasUserPolished, setHasUserPolished] = usePersistentState<boolean>({ key: 'dream_form_hasUserPolished', defaultValue: false });
  const [showStyleVariantSelector, setShowStyleVariantSelector] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showErrorReport, setShowErrorReport] = useState(false);
  const [errorReport, setErrorReport] = useState('');
  const [preloadedKeywords, setPreloadedKeywords] = useState<string[] | null>(null); // 预加载的关键词
  const [userInteracted, setUserInteracted] = useState(false); // 用户是否点击过关键词
  const [generateProgress, setGenerateProgress] = useState(0); // 生成进度
  const [generateMessage, setGenerateMessage] = useState(''); // 生成状态消息
  const [generateStage, setGenerateStage] = useState(''); // 当前阶段
  const [displayProgress, setDisplayProgress] = useState(0); // 平滑过渡后的显示进度
  const [isCancelling, setIsCancelling] = useState(false); // 是否正在取消中
  const [showProgressComplete, setShowProgressComplete] = useState(false); // 进度条完成显示状态
  const [isFinishing, setIsFinishing] = useState(false); // 是否正在完成创作
  const [autoSave, setAutoSave] = useState(true); // 自动保存开关
  const [showFunctionMenu, setShowFunctionMenu] = useState(false); // 功能集菜单显示状态
  const [dreamSessionId, setDreamSessionId] = useState<string | null>(null); // 梦境会话ID
  const [sessionImageCount, setSessionImageCount] = useState<number>(0); // 会话中已生成的图片数
  const [skipSecondPolish, setSkipSecondPolish] = useState(true); // 跳过第二次润色，直接使用第一次润色结果
  const [showDeleteDraftConfirm, setShowDeleteDraftConfirm] = useState(false); // 删除草稿确认弹窗
  const [isDeletingDraft, setIsDeletingDraft] = useState(false); // 删除草稿加载状态
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false); // 未保存提醒弹窗
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null); // 待处理的导航
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // 是否有未保存的更改
  const [isNavigatingHome, setIsNavigatingHome] = useState(false); // 是否正在跳转首页
  const [isModelSwitching, setIsModelSwitching] = useState(false); // 是否正在切换模型
  const initialStateRef = useRef<any>(null); // 初始状态用于比较
  
  // 进度保护：使用 ref 追踪当前最大进度，防止进度条回退
  const maxProgressRef = useRef(0);
  
  // 页面加载时从全局状态恢复进度（切换页面时）
  useEffect(() => {
    console.log('[页面恢复] 检查全局状态:', state.isGenerating, state.progress, state.generatedImages?.length);
    
    // 恢复进度（切换页面时）
    if (state.isGenerating && state.progress > 0) {
      console.log('[页面恢复] 从全局状态恢复进度:', state.progress);
      setIsGenerating(true);
      setGenerateProgress(state.progress);
      setGenerateMessage(state.message || '正在生成...');
      setGenerateStage(state.stage);
      setDisplayProgress(state.progress);
      setSimulatedProgress(state.progress);
      targetProgressRef.current = state.progress;
      maxProgressRef.current = state.progress;
    }
    
    // 恢复生成的图片
    if (state.generatedImages && state.generatedImages.length > 0) {
      console.log('[页面恢复] 从全局状态恢复图片:', state.generatedImages.length);
      const newImages = state.generatedImages.map((img: any, index: number) => ({
        ...img,
        selected: false,
        sceneElements: [] as string[],
        lightMood: 'balanced' as const,
        perspective: 'eye-level' as const,
        atmosphere: 'mysterious' as const,
        interpretation: '',
        isInterpreting: false,
        polishedPrompt: img.prompt,
        polishedPromptCN: img.prompt,
        negativePrompt: [] as string[],
      }));
      setGeneratedImages(newImages);
    }
  }, []);
  
  // 监听全局状态变化，同步进度和图片（页面切换后保持更新）
  useEffect(() => {
    console.log('[全局状态监听]', state.isGenerating, state.progress, state.stage, state.generatedImages?.length);
    
    // 同步生成的图片
    if (state.generatedImages && state.generatedImages.length > 0) {
      const newImages = state.generatedImages.map((img: any, index: number) => ({
        ...img,
        selected: false,
        sceneElements: [] as string[],
        lightMood: 'balanced' as const,
        perspective: 'eye-level' as const,
        atmosphere: 'mysterious' as const,
        interpretation: '',
        isInterpreting: false,
        polishedPrompt: img.prompt,
        polishedPromptCN: img.prompt,
        negativePrompt: [] as string[],
      }));
      setGeneratedImages(newImages);
    }
    
    if (state.isGenerating) {
      setGenerateProgress(state.progress);
      setGenerateMessage(state.message);
      setGenerateStage(state.stage);
      setDisplayProgress(state.progress);
      setSimulatedProgress(state.progress);
      targetProgressRef.current = state.progress;
      maxProgressRef.current = Math.max(maxProgressRef.current, state.progress);
      
      // 生成完成时关闭进度条（进度100或有图片生成完成）
      if (state.progress >= 100 || state.generatedImages.length > 0) {
        console.log('[全局状态] 生成完成，关闭进度条');
        setTimeout(() => {
          setIsGenerating(false);
        }, 1000);
      }
    }
  }, [state.progress, state.message, state.stage, state.isGenerating, state.generatedImages]);
  
  // 取消状态：用于 SSE 循环中检查是否已取消
  const isCancelledRef = useRef(false);
  
  // 模型切换状态：用于 SSE 循环中检查是否正在切换模型
  const isModelSwitchingRef = useRef(false);
  
  // 平滑填充动画相关状态
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastRealProgressRef = useRef(0); // 记录最后一次真实进度
  const fillStartTimeRef = useRef<number | null>(null);
  const displayAnimationRef = useRef<number | null>(null); // 显示进度动画引用
  const currentDisplayRef = useRef(0); // 当前显示进度（用于动画）
  
  // 【新设计】平滑追赶算法：差距越大，速度越快
  const targetProgressRef = useRef(0); // 目标进度（后端实际进度）
  const displayProgressRef = useRef(0); // 当前显示进度
  const lastUpdateTimeRef = useRef(0); // 上次更新时间
  
  const setSafeProgress = (progress: number) => {
    // 更新目标进度
    targetProgressRef.current = progress;
    maxProgressRef.current = progress;
    lastUpdateTimeRef.current = Date.now();
    
    // 更新全局状态
    updateProgress(progress, generateMessage, generateStage);
    
    // 只在进度大于0时启动动画，避免0%时显示白点
    if (!animationRef.current && progress > 0) {
      startSmoothChase();
    }
  };
  
  // 【速度限制】每秒最少3%，最快15%（按60fps计算）
  const MIN_SPEED = 3 / 60;   // 0.05%/帧 = 每秒3%
  const MAX_SPEED = 15 / 60;  // 0.25%/帧 = 每秒15%
  
  const startSmoothChase = () => {
    const animate = () => {
      const target = targetProgressRef.current;
      const current = displayProgressRef.current;
      const diff = target - current;
      
      // 【移除95%暂停】改为平滑追赶，不再卡住
      
      // 【追赶机制】差距越大速度越快，但限制在2%~10%/秒
      // diff=1: speed=0.4, diff=3: speed=0.9, 但限制在 0.033~0.167/帧
      const baseSpeed = Math.abs(diff) * 0.2 + 0.2;
      const clampedSpeed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, baseSpeed));
      const speed = Math.sign(diff) * Math.min(clampedSpeed, Math.abs(diff));
      
      // 更新显示进度
      let newProgress = current + speed;
      newProgress = Math.max(0, Math.min(100, newProgress));
      
      // 接近目标时直接对齐
      if (Math.abs(target - newProgress) < 0.1) {
        newProgress = target;
      }
      
      displayProgressRef.current = newProgress;
      setDisplayProgress(newProgress);
      setSimulatedProgress(newProgress);
      
      // 如果3秒内没有新进度更新，且已对齐目标，停止动画
      const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
      const isAligned = Math.abs(target - newProgress) < 0.01;
      
      if (isAligned && timeSinceLastUpdate > 3000) {
        animationRef.current = null;
      } else {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };
  
  // 平滑填充动画函数 - 持续前进版本（支持减速因子）
  const startSmoothFill = (startProgress: number, speedMultiplier: number = 1) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    const animationStartTime = performance.now();
    let lastUpdateTime = 0;
    const updateThreshold = 33; // 约30fps，降低更新频率
    
    // 分段速度：整体更均匀，前半段稍慢确保细腻感（乘以减速因子）
    const getFillSpeed = (current: number): number => {
      const baseSpeed = (
        current < 20 ? 2.5 :   // 0-20%：每秒2.5%（稍慢，细腻）
        current < 40 ? 3 :     // 20-40%：每秒3%
        current < 60 ? 3.5 :   // 40-60%：每秒3.5%
        current < 80 ? 4 :     // 60-80%：每秒4%
        current < 95 ? 5 :     // 80-95%：每秒5%
        6                       // 95%以上：每秒6%（最后加速完成）
      );
      return baseSpeed * speedMultiplier; // 应用减速因子
    };
    
    let accumulatedProgress = startProgress;
    
    const animate = (timestamp: number) => {
      const elapsed = (timestamp - animationStartTime) / 1000;
      // 计算应该到达的进度
      const targetProgress = Math.min(startProgress + elapsed * getFillSpeed(accumulatedProgress), 100);
      
      // 平滑过渡到目标
      const step = (targetProgress - accumulatedProgress) * 0.12;
      accumulatedProgress = Math.min(accumulatedProgress + step, targetProgress);
      
      // 减少状态更新频率
      if (timestamp - lastUpdateTime > updateThreshold) {
        lastUpdateTime = timestamp;
        setDisplayProgress(accumulatedProgress);
        currentDisplayRef.current = accumulatedProgress;
      }
      
      if (accumulatedProgress < 99.5) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
        // 确保到达100%
        setDisplayProgress(100);
        currentDisplayRef.current = 100;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };
  
  // 图片上传相关
  // 【修复】上传图片不持久化，避免生成后还保留
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const inputTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const userInteractedRef = useRef(false); // 用于定时器中检查最新值
  const preloadedKeywordsRef = useRef<string[] | null>(null); // 用于定时器中访问预加载的关键词
  const lastInputRef = useRef<string>(''); // 用于比较输入是否真的变化了
  
  // 用于 beforeunload 保存最新状态
  const autoSaveRef = useRef(autoSave);
  const currentPromptRef = useRef(currentPrompt);
  const selectedKeywordsRef = useRef(selectedKeywords);
  const selectedSceneElementsRef = useRef(selectedSceneElements);
  const artStyleRef = useRef(artStyle);
  const dreamKeywordsRef = useRef(dreamKeywords);
  const generatedImagesRef = useRef(generatedImages);
  const selectedImagesRef = useRef(selectedImages);
  const uploadedImagesRef = useRef(uploadedImages);
  const polishedPromptCNRef = useRef<string | undefined>(undefined); // 保存中文描述供回调使用
  const negativePromptRef = useRef<string[] | undefined>(undefined); // 保存反向提示词供回调使用

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 停止动画
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);
  
  // 手动保存草稿的包装函数（调用外部saveDraft）
  const handleManualSaveDraft = async () => {
    await saveDraft({
      currentPrompt,
      selectedKeywords,
      selectedSceneElements,
      uploadedImages,
      generatedImages,
      selectedImages,
      artStyle,
    }, authUser?.id);
    showToast('草稿已保存！', 'success');
  };
  
  // 同步 refs
  useEffect(() => { autoSaveRef.current = autoSave; }, [autoSave]);
  useEffect(() => { currentPromptRef.current = currentPrompt; }, [currentPrompt]);
  
  // 【修复】同步 lastInputRef，防止刷新后输入被拦截
  useEffect(() => { lastInputRef.current = currentPrompt; }, [currentPrompt]);
  useEffect(() => { selectedKeywordsRef.current = selectedKeywords; }, [selectedKeywords]);
  useEffect(() => { selectedSceneElementsRef.current = selectedSceneElements; }, [selectedSceneElements]);
  useEffect(() => { artStyleRef.current = artStyle; }, [artStyle]);
  useEffect(() => { dreamKeywordsRef.current = dreamKeywords; }, [dreamKeywords]);
  useEffect(() => { generatedImagesRef.current = generatedImages; }, [generatedImages]);
  useEffect(() => { selectedImagesRef.current = selectedImages; }, [selectedImages]);
  useEffect(() => { uploadedImagesRef.current = uploadedImages; }, [uploadedImages]);
  
  // 组件挂载时从 localStorage 恢复会话状态
  useEffect(() => {
    const savedSessionId = localStorage.getItem('dreamSessionId');
    const savedImageCount = localStorage.getItem('dreamSessionImageCount');
    
    if (savedSessionId) {
      setDreamSessionId(savedSessionId);
    }
    if (savedImageCount) {
      setSessionImageCount(parseInt(savedImageCount, 10));
    }
    
    // 【注意】generatedImages 由 usePersistentState 管理，不需要在这里恢复
    // 全局生成状态只在需要时同步（如后台生成）
  }, []);

  // ===== 草稿保存和恢复机制 =====
  // 记录上一次的用户ID，用于检测用户切换
  const lastUserIdRef = useRef<string | null | undefined>(undefined);
  
  // 组件挂载或用户登录状态变化时恢复草稿
  useEffect(() => {
    const currentUserId = authUser?.id;
    const isUserSwitch = lastUserIdRef.current !== undefined && lastUserIdRef.current !== currentUserId;
    
    // 如果用户切换了（登录/注销/换账号），只重置非持久化状态
    // currentPrompt, artStyle, generatedImages 由 usePersistentState 管理，保持用户输入
    if (isUserSwitch) {
      console.log('[草稿] 用户切换，重置非持久化状态');
      setSelectedKeywords([]);
      setSelectedSceneElements([]);
      setUploadedImages([]);
      // 【修复】用户切换时不重置 generatedImages 和 selectedImages，让它们由 usePersistentState 管理
      // setGeneratedImages([]);
      // setSelectedImages([]);
    }
    
    lastUserIdRef.current = currentUserId;
    
    const loadDraft = async () => {
      const draft = await restoreDraft(currentUserId);
      if (draft) {
        console.log('[草稿] 恢复草稿:', currentUserId ? `用户${currentUserId}` : '匿名');
        // 只有 draft 有值时才覆盖，保留 usePersistentState 的值作为 fallback
        // 【注意】generatedImages, lastPolishedPrompt, selectedImages 由 usePersistentState 管理，不从草稿恢复
        if (draft.currentPrompt) setCurrentPrompt(draft.currentPrompt);
        if (draft.selectedKeywords?.length) setSelectedKeywords(draft.selectedKeywords);
        if (draft.selectedSceneElements?.length) setSelectedSceneElements(draft.selectedSceneElements);
        if (draft.uploadedImages?.length) setUploadedImages(draft.uploadedImages);
        // 【修复】selectedImages 由 usePersistentState 管理，不从草稿恢复
        // if (draft.selectedImages?.length) setSelectedImages(draft.selectedImages);
        if (draft.artStyle && draft.artStyle !== 'default') setArtStyle(draft.artStyle);
      } else {
        // 如果没有草稿，只重置非持久化状态
        // currentPrompt, artStyle, generatedImages, lastPolishedPrompt, selectedImages 由 usePersistentState 管理，不要在这里重置
        if (!isUserSwitch) {
          setSelectedKeywords([]);
          setSelectedSceneElements([]);
          setUploadedImages([]);
          // 【修复】selectedImages 由 usePersistentState 管理，不重置
          // setSelectedImages([]);
        }
      }
      
      // 保存初始状态（延迟一点，等状态都更新完）
      setTimeout(() => {
        saveInitialState();
      }, 500);
    };
    loadDraft();
  }, [authUser?.id]);

  // 保存初始状态
  const saveInitialState = () => {
    initialStateRef.current = {
      currentPrompt,
      selectedKeywords,
      selectedSceneElements,
      uploadedImages,
      generatedImages,
      selectedImages,
      artStyle,
    };
  };

  // 检查是否有未保存的更改
  const checkUnsavedChanges = useCallback(() => {
    if (!initialStateRef.current) return false;
    
    const initial = initialStateRef.current;
    return (
      currentPrompt !== initial.currentPrompt ||
      JSON.stringify(selectedKeywords) !== JSON.stringify(initial.selectedKeywords) ||
      JSON.stringify(selectedSceneElements) !== JSON.stringify(initial.selectedSceneElements) ||
      uploadedImages.length !== initial.uploadedImages.length ||
      generatedImages.length !== initial.generatedImages.length ||
      selectedImages.length !== initial.selectedImages.length ||
      artStyle !== initial.artStyle
    );
  }, [
    currentPrompt,
    selectedKeywords,
    selectedSceneElements,
    uploadedImages,
    generatedImages,
    selectedImages,
    artStyle,
  ]);

  // 更新未保存状态
  useEffect(() => {
    setHasUnsavedChanges(checkUnsavedChanges());
  }, [checkUnsavedChanges]);

  // 手动保存草稿后重置初始状态
  const handleManualSaveDraftWithReset = async () => {
    await handleManualSaveDraft();
    saveInitialState();
    setHasUnsavedChanges(false);
  };

  // 监听所有状态变化，自动保存草稿（当autoSave开启时）
  useEffect(() => {
    if (!autoSave) return;
    
    // 减少防抖时间，更快响应
    const saveTimer = setTimeout(async () => {
      try {
        await saveDraft({
          currentPrompt,
          selectedKeywords,
          selectedSceneElements,
          uploadedImages,
          generatedImages,
          selectedImages,
          artStyle,
        }, authUser?.id);
        
        // 自动保存后，更新初始状态，这样就不会认为有未保存的更改了
        saveInitialState();
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('[草稿] 自动保存失败:', error);
      }
    }, 300); // 减少到0.3秒，更快保存

    return () => clearTimeout(saveTimer);
  }, [
    currentPrompt,
    selectedKeywords,
    selectedSceneElements,
    uploadedImages,
    generatedImages,
    selectedImages,
    artStyle,
    autoSave,
    authUser?.id
  ]);

  // ===== 草稿保存和恢复机制结束 =====

  // 页面跳转函数
  const delayedNavigate = (href: string) => {
    router.push(href);
  };

  // 监听侧边栏导航事件（移除了系统弹窗，只保留应用内弹窗，且自动保存开启时不弹窗）
  useEffect(() => {
    const handleNavigationAttempt = (e: any) => {
      // 自动保存开启时，保存后再跳转
      if (autoSave) {
        // 立即保存并等待完成
        saveDraft({
          currentPrompt,
          selectedKeywords,
          selectedSceneElements,
          uploadedImages,
          generatedImages,
          selectedImages,
          artStyle,
        }, authUser?.id).then(() => {
          // 保存完成后跳转（带延时）
          delayedNavigate(e.detail.href);
        });
      } 
      // 自动保存关闭时，检查是否有未保存的更改
      else if (hasUnsavedChanges) {
        setPendingNavigation(e.detail.href);
        setShowUnsavedConfirm(true);
      } else {
        delayedNavigate(e.detail.href);
      }
    };

    window.addEventListener('dream:navigation-attempt', handleNavigationAttempt as EventListener);
    
    // 页面卸载前保存草稿（使用 ref 获取最新值）
    const handleBeforeUnload = () => {
      if (autoSaveRef.current) {
        // 使用 sendBeacon 确保请求发出
        const draftData = {
          currentPrompt: currentPromptRef.current,
          selectedKeywords: selectedKeywordsRef.current,
          selectedSceneElements: selectedSceneElementsRef.current,
          uploadedImages: uploadedImagesRef.current,
          generatedImages: generatedImagesRef.current,
          selectedImages: selectedImagesRef.current,
          artStyle: artStyleRef.current,
          timestamp: Date.now(),
        };
        const userId = authUser?.id;
        navigator.sendBeacon('/api/dream-draft', JSON.stringify({ userId, draft: draftData }));
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('dream:navigation-attempt', handleNavigationAttempt as EventListener);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [autoSave, hasUnsavedChanges, authUser?.id]);
  
  const abortControllerRef = useRef<AbortController | null>(null); // 用于取消请求

  const buildPromptWithStyle = (basePrompt: string, styleVariant: {
    lightMood: string;
    perspective: string;
    atmosphere: string;
    sceneElements?: string[];
    lastPrompt?: string;
  }) => {
    // 直接使用用户原始输入，不添加额外润色词
    let finalPrompt = basePrompt;

    // 【场景关联】合并历史图片的prompt描述，实现内容级关联
    if (styleVariant.lastPrompt && styleVariant.lastPrompt.trim()) {
      // 提取历史prompt的核心内容（去掉风格参数部分）
      const historicalCore = styleVariant.lastPrompt
        .split('，')
        .filter(part => 
          !part.includes('光线') && 
          !part.includes('视角') && 
          !part.includes('氛围') &&
          !part.includes('场景包含') &&
          !part.includes('风格')
        )
        .join('，');
      
      if (historicalCore.trim()) {
        finalPrompt += `，继续描绘${historicalCore}`;
      }
    }

    // 只添加光线氛围（用户选择的）
    const lightMoodInfo = lightMoodOptions.find(l => l.id === styleVariant.lightMood);
    if (lightMoodInfo) {
      finalPrompt += `，${lightMoodInfo.name}光线`;
    }

    // 只添加视角（用户选择的）
    const perspectiveInfo = perspectiveOptions.find(p => p.id === styleVariant.perspective);
    if (perspectiveInfo) {
      finalPrompt += `，${perspectiveInfo.name}视角`;
    }

    // 只添加氛围（用户选择的）
    const atmosphereInfo = atmosphereOptions.find(a => a.id === styleVariant.atmosphere);
    if (atmosphereInfo) {
      finalPrompt += `，${atmosphereInfo.name}氛围`;
    }

    // 只添加场景元素（用户选择的）
    if (styleVariant.sceneElements && styleVariant.sceneElements.length > 0) {
      finalPrompt += `，场景包含${styleVariant.sceneElements.join('、')}`;
    }

    // 添加风格（用户选择的）- 简化后只有写实和二次元需要添加提示词
    switch (artStyle) {
      case 'realistic':
        finalPrompt += `，写实风格，照片级画质，真实摄影，自然光影，电影级质感，专业摄影，f/1.8光圈，浅景深，真实皮肤纹理，自然色彩，真实环境`;
        break;
      case 'anime':
        finalPrompt += `，二次元风格，动漫插画`;
        break;
      default:
        // 默认风格不添加额外提示词，让AI自动判断
        break;
    }

    return finalPrompt;
  };

  // AI解读梦境 - 以用户输入为主，每张图片传入自己的独特信息
  const interpretDream = async (
    prompt: string, 
    imageData: { lightMood: string; perspective: string; atmosphere: string }
  ): Promise<{ interpretation: string; keywords?: string[]; emotionTags?: string[] }> => {
    try {
      // 构建用户原始输入（优先使用用户输入的文字）
      const userDescription = currentPrompt.trim() || selectedKeywords.join('、');
      
      const response = await fetch('/api/interpret-dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          userDescription, // 用户原始输入
          uploadedImages: uploadedImages.map(img => img.dataUrl), // 用户上传的图片
          lightMood: imageData.lightMood,
          perspective: imageData.perspective,
          atmosphere: imageData.atmosphere,
        }),
      });
      
      const data = await response.json();
      if (data.success && data.interpretation) {
        // 直接使用 API 返回的关键词和情绪标签
        return { 
          interpretation: data.interpretation, 
          keywords: data.keywords || [], 
          emotionTags: data.emotionTags || [] 
        };
      }
      return { interpretation: '梦境解读生成中...' };
    } catch (error) {
      console.error('解读失败:', error);
      return { interpretation: '梦境解读暂时不可用' };
    }
  };

  // 取消生成
  const handleCancelGenerate = async () => {
    // 防止重复取消
    if (!isGenerating || isCancelling) return;
    
    console.log('[生成] 用户取消生成');
    setIsCancelling(true); // 显示"取消中"状态
    
    // 设置取消标记，阻止处理任何后续结果
    isCancelledRef.current = true;
    
    // 调用 abort 停止 SSE 请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null; // 重置，下次生成时重新创建
    }
    
    // 【新增】调用后端 API 中断 SD 生成
    try {
      console.log('[生成] 正在中断 SD 生成任务...');
      const response = await fetch('/api/interrupt-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const result = await response.json();
        console.log('[生成] SD 中断结果:', result);
      }
    } catch (error) {
      console.error('[生成] 调用中断 API 失败:', error);
      // 不影响前端状态重置，继续执行
    }
    
    // 停止所有动画
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (displayAnimationRef.current) {
      cancelAnimationFrame(displayAnimationRef.current);
      displayAnimationRef.current = null;
    }
    
    // 重置所有状态
    setShowProgressComplete(false);
    setIsGenerating(false);
    setGenerateProgress(0);
    setSimulatedProgress(0);
    setDisplayProgress(0);
    currentDisplayRef.current = 0;
    maxProgressRef.current = 0;
    setGenerateMessage('');
    setGenerateStage('');
    
    // 重置生成的图片（本地 + 全局 + 草稿），防止刷新后恢复
    setGeneratedImages([]);
    clearGeneration(); // 重置全局状态
    
    // 重置草稿中的图片
    saveDraft({
      currentPrompt,
      selectedKeywords,
      selectedSceneElements,
      uploadedImages,
      generatedImages: [], // 重置图片
      selectedImages: [],
      artStyle,
    }, authUser?.id);
    
    // 重置取消状态
    setTimeout(() => {
      setIsCancelling(false);
      isCancelledRef.current = false; // 重置取消标记
    }, 500);
  };

  // 预处理用户输入，检查常见角色
  const preprocessUserInput = (input: string) => {
    let processedInput = input;
    let detectedCharacters: string[] = [];
    let characterDescriptions: string[] = [];
    
    // 检查每个角色
    for (const [charName, charData] of Object.entries(CHARACTER_DATABASE)) {
      if (input.includes(charName)) {
        detectedCharacters.push(charName);
        characterDescriptions.push(charData.description);
        // 在用户输入中标记角色，帮助AI识别
        const markedName = `${charName}(${charData.englishName} from ${charData.source})`;
        processedInput = processedInput.replace(new RegExp(charName, 'g'), markedName);
      }
    }
    
    // 给AI添加额外的提示，强调拟人化特征
    if (detectedCharacters.length > 0) {
      processedInput = `${processedInput}\n\n【重要提示】请确保准确描绘以上角色的特征，特别是：${characterDescriptions.join('；')}`;
    }
    
    return { processedInput, detectedCharacters };
  };

  const handleGenerateImages = async () => {
    console.log('[生成] handleGenerateImages 被调用, artStyle:', artStyle, 'currentPrompt:', currentPrompt);
    
    // 检查登录状态 - 游客不能生成图片
    if (!isLoggedIn) {
      showToast('请先登录后再生成图片', 'warning');
      setErrorReport('未登录：生成图片需要先登录账户');
      setShowErrorReport(true);
      return;
    }
    
    if ((!currentPrompt.trim() && selectedKeywords.length === 0) || isGenerating) return;

    // 【先显示进度条】让用户立即看到反馈
    const startTime = Date.now();
    const MIN_PROGRESS_DURATION = 1200; // 最少显示1.2秒
    
    setIsGenerating(true);
    setShowProgressComplete(false);
    setGeneratedImages([]);
    setGenerateProgress(0);
    setSimulatedProgress(0);
    setDisplayProgress(0);
    currentDisplayRef.current = 0;
    displayProgressRef.current = 0;
    targetProgressRef.current = 0;
    maxProgressRef.current = 0;
    setIsModelSwitching(false);
    isModelSwitchingRef.current = false;
    setGenerateMessage('这次生成的图，会悄悄记住你写的文字哦');
    setGenerateStage('start');
    
    // 【严格跟随后端】等待后端 SSE 推送真实进度，不前端模拟
    
    // 启动全局生成状态
    startGeneration();

    // 超时处理 - 如果超过60秒没完成，显示提示
    let timeoutRef: ReturnType<typeof setTimeout>;
    timeoutRef = setTimeout(() => {
      if (isGenerating) {
        setGenerateMessage('要重新开始吗？重置会切断联系哦');
      }
    }, 60000);

    // 不使用前端模拟进度，直接使用后端SSE返回的真实进度
    
    // 预检查健康状态（使用缓存）
    prefetchHealthStatus().catch(() => {});

    try {
      const isImg2ImgMode = uploadedImages.length > 0;
      
      // ===== 创建/获取梦境会话（后台，不阻塞）=====
      let currentSessionId = dreamSessionId;
      if (!currentSessionId && isLoggedIn && authUser?.id) {
        const token = localStorage.getItem('dreamToken');
        if (token) {
          fetch('/api/dream-session', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              userId: authUser.id,
              title: currentPrompt.substring(0, 50) || '梦境创作',
              prompt: currentPrompt,
              imageUrl: uploadedImages[0]?.dataUrl || '',
            }),
          }).then(async (res) => {
            const sessionData = await res.json();
            if (sessionData.session) {
              setDreamSessionId(sessionData.session.id);
              setSessionImageCount(1);
              localStorage.setItem('dreamSessionId', sessionData.session.id);
              localStorage.setItem('dreamSessionCount', '1');
            }
          }).catch(err => {
            console.error('[后台] 创建会话失败:', err);
          });
        }
      }
      
      // ===== 预处理用户输入 =====
      const { processedInput, detectedCharacters } = preprocessUserInput(currentPrompt);
      if (detectedCharacters.length > 0) {
        console.log('[生成] 检测到角色:', detectedCharacters);
      }
      
      // ===== AI智能分析（始终执行）=====
      let analyzedPrompt = processedInput;
      let suggestedModel = artStyle === 'default' ? null : artStyle;
      let negativePrompt: string[] | undefined; // AI分析的反向提示词
      let polishedPromptCN: string | undefined; // 中文描述（给用户看）
      
      console.log('[生成] 当前artStyle:', artStyle, '执行AI分析');
      
      // 始终执行AI分析，获取润色后的提示词和反向提示词
      // 默认风格时，等待AI分析完成，使用分析结果
      setGenerateMessage('点一点上面的词，给下一张图一点灵感呀');
      setGenerateStage('analyzing');
      setGenerateProgress(10);
      
      try {
        const analyzeRes = await fetch('/api/analyze-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userInput: processedInput,
            uploadedImages: uploadedImages.map(img => img.dataUrl),
            selectedKeywords,
            isImg2Img: isImg2ImgMode,
            contextHistory, // 【上下文关联】传递历史记录（userInputs中存储的是润色后的描述）
            artStyle, // 【风格选择】传递用户选择的艺术风格
          }),
        });
        
        const analyzeData = await analyzeRes.json();
        console.log('[AI分析] 返回数据:', JSON.stringify(analyzeData, null, 2));
        
        if (analyzeData.success) {
          console.log('[AI分析] 完成，推荐风格:', analyzeData.model);
          // 使用润色后的英文正向提示词（给SD用）
          analyzedPrompt = analyzeData.polishedPrompt || processedInput;
          // 保存中文描述（给用户看）- 如果没有中文描述，用英文或原始输入
          polishedPromptCN = analyzeData.polishedPromptCN || analyzeData.analysis?.subject || processedInput;
          // 保存到 ref 供回调函数使用
          polishedPromptCNRef.current = polishedPromptCN;
          negativePromptRef.current = analyzeData.negativePrompt;
          // 保存反向提示词（给SD用，不显示给用户）
          negativePrompt = analyzeData.negativePrompt;
          suggestedModel = analyzeData.model || 'default';
          console.log('[AI分析] 中文描述:', polishedPromptCN);
          console.log('[AI分析] 英文提示词:', analyzedPrompt);
        } else {
          console.error('[AI分析] API返回失败:', analyzeData.error);
          // API返回失败，使用原始输入作为中文描述
          polishedPromptCN = processedInput;
        }
      } catch (err) {
        console.error('[AI分析] 请求失败:', err);
        // 分析失败时继续使用原始输入
        polishedPromptCN = processedInput;
      }

      // ===== 步骤2：构建提示词 =====
      let finalPrompt = !analyzedPrompt.trim() && selectedKeywords.length > 0
        ? selectedKeywords.join('、')
        : analyzedPrompt;
      
      if (!finalPrompt.trim()) {
        finalPrompt = '梦境，幻想，抽象艺术';
      }
      
      const keywordsToAdd = selectedKeywords.filter(k => !finalPrompt.includes(k));
      if (keywordsToAdd.length > 0) {
        finalPrompt = `${finalPrompt}，${keywordsToAdd.join('、')}`;
      }
      
      const polishedPrompt = finalPrompt;
      console.log('[生成] 最终提示词:', polishedPrompt);

      // ===== 步骤3：发送到生成API =====
      setGenerateMessage('传张照片叭，梦会在上面继续生长呢');
      setGenerateStage('preparing');
      setGenerateProgress(15);
      
      // 构建关联提示词，结合之前的梦境内容
      let promptWithStyle = polishedPrompt;
      if (contextHistory && contextHistory.userInputs.length > 0) {
        // 有历史梦境，构建关联
        const previousThemes = contextHistory.selectedKeywords.slice(0, 5).join('、');
        const sequenceNum = contextHistory.dreamSequence + 1;
        promptWithStyle = `梦境第${sequenceNum}幕：${polishedPrompt}。延续之前的梦境主题（${previousThemes}），与之前的画面形成连贯的故事情节。`;
      }
      
      console.log('[生成] 场景关联提示词:', promptWithStyle);
      
      const requestData = {
        polishedPrompt: promptWithStyle,
        count: 2,
        artStyle: suggestedModel || artStyle,
        negativePrompt: negativePrompt, // AI分析的反向提示词
      };
      
      abortControllerRef.current = new AbortController();
      const token = localStorage.getItem('dreamToken');
      
      const response = await fetch('/api/generate-image-batch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(requestData),
        signal: abortControllerRef.current.signal,
      });

      // 检查响应状态
      if (!response.ok) {
        console.error('[生成失败] HTTP错误:', response.status);
        let errorMsg = '图片生成失败';
        if (response.status === 429) {
          errorMsg = 'API调用频率超限，请稍后重试';
        } else if (response.status === 403) {
          errorMsg = 'API权限受限，请检查配置';
        } else if (response.status >= 500) {
          errorMsg = '服务暂时不可用，请稍后重试';
        }
        showToast(errorMsg, 'error');
        setErrorReport(`HTTP ${response.status}: ${errorMsg}`);
        setShowErrorReport(true);
        setShowProgressComplete(false);
        setIsGenerating(false);
        setIsCancelling(false);
        maxProgressRef.current = 0;
        setGenerateProgress(0);
        return;
      }

      setGenerateStage('generating');
      setGenerateMessage('正在生成图片...');
      
      // 重置取消标记
      isCancelledRef.current = false;

      // 读取 SSE 流
      const reader = response.body?.getReader();
      if (!reader) {
        showToast('响应读取失败', 'error');
        setShowProgressComplete(false);
        setIsGenerating(false);
        setIsCancelling(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let finalData: { success: boolean; results?: Array<{ imageUrl: string; polishedPrompt?: string }>; error?: string } | null = null;
      let completedCount = 0;
      const totalImages = 2; // 固定生成2张

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          // 如果已取消，直接关闭 reader 并退出
          if (isCancelledRef.current) {
            console.log('[SSE] 已取消，关闭连接并退出');
            reader.cancel().catch(() => {});
            return;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              
              // 更新阶段和消息
              if (event.stage) {
                setGenerateStage(event.stage);
              }
              if (event.message) {
                setGenerateMessage(event.message);
              }
              // 同时更新全局状态
              updateProgress(generateProgress, event.message || generateMessage, event.stage || generateStage);
              
              // 【重要】所有阶段都更新进度，确保进度条能正常显示
              if (typeof event.progress === 'number' && event.progress >= 0) {
                console.log('[SSE进度]', event.progress, event.message);
                setSafeProgress(event.progress);
              }
              
              // 【模型切换】检测并处理模型切换事件
              if (event.modelSwitching === true) {
                console.log('[进度条] 检测到模型切换，减速15%');
                setIsModelSwitching(true);
                isModelSwitchingRef.current = true;
              } else if (event.modelSwitching === false && event.stage === 'modelSwitched') {
                console.log('[进度条] 模型切换完成，恢复正常速度');
                setIsModelSwitching(false);
                isModelSwitchingRef.current = false;
              }
              
              // 根据后端阶段微调进度
              if (event.stage === 'complete' && event.results) {
                // 如果已取消，不处理任何结果，直接关闭连接
                if (isCancelledRef.current) {
                  console.log('[SSE] 已取消，忽略完成事件并关闭连接');
                  reader.cancel().catch(() => {});
                  return;
                }
                
                // 【新设计】完成时显示100%，延迟后淡出
                setSafeProgress(100);
                setGenerateMessage('如果梦做完了，点完成把它藏进回忆叭');
                setGenerateStage('complete');
                const completedResults = event.results; // 保存到局部变量
                const returnedPolishedPrompt = event.polishedPrompt || lastPolishedPrompt; // 获取后端返回的润色提示词
                finalData = { success: true, results: completedResults };
                
                // 延迟关闭进度条，让用户看到100%完成状态（缩短到1秒）
                setTimeout(() => {
                  setIsGenerating(false);
                  setIsCancelling(false);
                  
                  // 【关键】进度条消失后100ms再显示图片，避免"挤上来"
                  setTimeout(() => {
                    // 设置本地图片状态
                    const newImages: GeneratedImage[] = completedResults.map((result: any, index: number) => ({
                      imageUrl: result.imageUrl,
                      selected: false,
                      sceneElements: [],
                      lightMood: 'balanced',
                      perspective: 'eye-level',
                      atmosphere: 'mysterious',
                      interpretation: '',
                      isInterpreting: false,
                      polishedPrompt: returnedPolishedPrompt, // 英文 - 给SD用
                      polishedPromptCN: polishedPromptCNRef.current, // 中文 - 给用户看（从ref获取）
                      negativePrompt: negativePromptRef.current, // 反向提示词（从ref获取）
                    }));
                    setGeneratedImages(newImages);
                    
                    // 同时添加到全局状态
                    completedResults.forEach((result: any, index: number) => {
                      addGeneratedImage({
                        id: `gen-${Date.now()}-${index}`,
                        imageUrl: result.imageUrl,
                        prompt: result.polishedPrompt || currentPrompt,
                        artStyle: suggestedModel || artStyle,
                      });
                    });
                    
                    // 【保留上传图片】生成成功后保留上传图片，方便用户继续参考生成
                    // setUploadedImages([]);
                    
                    // 标记全局生成为完成
                    finishGeneration();
                  }, 100);
                }, 1000);
              } else if (event.stage === 'generated') {
                // 单张完成，直接使用后端返回的进度
                if (typeof event.progress === 'number') {
                  setSafeProgress(event.progress);
                }
              } else if (event.stage === 'error') {
                // 错误 - 进度条立即消失
                const errorMsg = event.error || event.message || '图片生成失败';
                finalData = { success: false, error: errorMsg };
                console.log('[SSE错误]', event);
                
                // 停止动画并隐藏进度条
                if (animationRef.current) {
                  cancelAnimationFrame(animationRef.current);
                  animationRef.current = null;
                }
                setShowProgressComplete(false);
                setIsGenerating(false);
                setIsCancelling(false);
                setGenerateProgress(0);
                setSimulatedProgress(0);
                setDisplayProgress(0);
                setGenerateMessage('');
                setGenerateStage('');
                
                // 显示错误
                showToast(errorMsg, 'error');
                setErrorReport(errorMsg);
                setShowErrorReport(true);
                
                // 标记全局生成失败
                finishGeneration();
                
                // 标记已取消，退出循环
                isCancelledRef.current = true;
                return;
              } else if (event.stage === 'warning') {
                // 警告（单张失败），继续但不处理
              }
            } catch (parseError) {
              console.error('[SSE解析错误]', parseError);
            }
          }
        }
      }

      // 如果已取消，不处理任何结果
      if (isCancelledRef.current) {
        console.log('[生成] SSE循环结束，已取消，忽略结果');
        clearTimeout(timeoutRef);
        setShowProgressComplete(false);
        setIsGenerating(false);
        setIsCancelling(false);
        return;
      }

      // 如果超时但已有结果，使用已有的
      if (!finalData && completedCount > 0) {
        setSafeProgress(100);
      }

      if (finalData?.success && finalData.results && finalData.results.length > 0) {
        showToast('正在解读梦境...', 'info');
        // 保存润色后的提示词（取第一张图的）
        const polishedPrompt = finalData.results[0]?.polishedPrompt || currentPrompt;
        setLastPolishedPrompt(polishedPrompt);
        // 保存中文描述（从ref获取）
        setLastPolishedPromptCN(polishedPromptCNRef.current || currentPrompt);
        // 【简化】不再使用styleVariants，统一使用基础参数
        const newImages = finalData.results.map((result: { imageUrl: string, polishedPrompt?: string }) => ({
          imageUrl: result.imageUrl,
          selected: false,
          sceneElements: [],
          lightMood: 'balanced',
          perspective: 'eye-level',
          atmosphere: 'mysterious',
          interpretation: '',
          isInterpreting: true,
        }));
        setGeneratedImages(newImages);
        
        // 【记录梦境上下文】生成完成后保存润色后的提示词，用于后续关联
        const prevHistory = contextHistory || {
          sceneElements: [],
          lightMood: 'balanced',
          perspective: 'eye-level',
          atmosphere: 'mysterious',
          lastPrompt: '',
          userInputs: [],
          generatedImages: [],
          selectedKeywords: [],
          dreamSequence: 0,
        };
        // 保存润色后的中文描述到 userInputs，用于上下文关联
        const polishedContext = polishedPromptCN || currentPrompt;
        setContextHistory({
          ...prevHistory,
          lastPrompt: polishedPrompt,
          userInputs: [...prevHistory.userInputs, polishedContext],
          generatedImages: [...prevHistory.generatedImages, ...newImages.map((img: GeneratedImage) => img.imageUrl)],
          selectedKeywords: [...new Set([...prevHistory.selectedKeywords, ...selectedKeywords])],
          dreamSequence: prevHistory.dreamSequence + 1,
        });
        
        // 自动解读每个梦境 - 使用统一参数
        newImages.forEach(async (img: GeneratedImage, index: number) => {
          const result = finalData!.results![index];
          const imgPrompt = result?.polishedPrompt || currentPrompt;
          
          const imgData = {
            prompt: imgPrompt,
            lightMood: 'balanced',
            perspective: 'eye-level',
            atmosphere: 'mysterious',
          };
          
          const interpretationResult = await interpretDream(imgPrompt, imgData);
          setGeneratedImages(prev => prev.map((item, i) => 
            i === index ? { 
              ...item, 
              interpretation: interpretationResult.interpretation, 
              keywords: interpretationResult.keywords,
              emotionTags: interpretationResult.emotionTags,
              isInterpreting: false 
            } : item
          ));
        });
        
        // 更重置会话历史
        console.log('[调试] currentSessionId:', currentSessionId);
        console.log('[调试] finalData:', finalData);
        if (currentSessionId && finalData!.results && finalData!.results.length > 0) {
          try {
            const token = localStorage.getItem('dreamToken');
            if (token) {
              for (let i = 0; i < finalData!.results!.length; i++) {
                const result = finalData!.results![i];
                const prompt = result?.polishedPrompt || currentPrompt;
                
                await fetch('/api/dream-session', {
                  method: 'PATCH',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    sessionId: currentSessionId,
                    prompt: prompt,
                    imageUrl: result.imageUrl,
                  }),
                });
              }
              setSessionImageCount(prev => prev + finalData!.results!.length);
              // 持久化到 localStorage
              localStorage.setItem('dreamSessionImageCount', String(sessionImageCount + finalData!.results!.length));
              console.log(`[会话] 已更新会话历史，sessionId: ${currentSessionId}`);
            }
          } catch (sessionError) {
            console.error('[会话] 更新会话历史失败:', sessionError);
          }
        }
        
        // 生成成功后重置润色标记
        setHasUserPolished(false);
        // 保留上传的图片，方便继续使用
        
      } else {
        const errorMsg = finalData?.error || '图片生成失败';
        showToast(errorMsg, 'error');
        setErrorReport(errorMsg);
        setShowErrorReport(true);
        console.error('[生成失败] 错误信息:', finalData);
      }
    } catch (error: unknown) {
      // 检查是否是用户取消的
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[生成] 请求已取消');
        // 不显示错误消息，因为用户主动取消
        setShowProgressComplete(false);
        setIsGenerating(false);
        setIsCancelling(false);
        maxProgressRef.current = 0;
        setGenerateProgress(0);
        setGenerateStage('');
        
        return;
      }
      const errorMessage = error instanceof Error ? error.message : '网络错误，请检查网络连接';
      showToast('网络错误，请重试', 'error');
      setErrorReport(`网络请求失败: ${errorMessage}`);
      setShowErrorReport(true);
      console.error('[网络错误]', error);
      // 重置进度
      setShowProgressComplete(false);
      setIsGenerating(false);
      setIsCancelling(false);
      maxProgressRef.current = 0;
      setGenerateProgress(0);
      setGenerateMessage('');
      setGenerateStage('');
      
    } finally {
      // 清除超时定时器
      clearTimeout(timeoutRef);
      // 清除 abort controller
      abortControllerRef.current = null;
      
      // 生成完成后清除持久化状态（可选：如果用户想保留草稿可以注释掉）
      // clearAllDreamState();
    }
  };

  // 批量添加所有生成的图片
  const handleSelectAllImages = () => {
    if (generatedImages.length === 0) return;

    // 组合 prompt 和已选关键词
    const finalPrompt = selectedKeywords.length > 0 
      ? `${currentPrompt || ''}${selectedKeywords.join('、')}`
      : currentPrompt;

    const newSelectedImages: SelectedImage[] = generatedImages.map((img, index) => ({
      id: `${Date.now()}-${index}`,
      prompt: finalPrompt || '梦境描述',
      imageUrl: img.imageUrl,
      timestamp: new Date(),
      sceneElements: img.sceneElements,
      lightMood: img.lightMood,
      perspective: img.perspective,
      atmosphere: img.atmosphere,
    }));

    // 设置上下文（保存当前提示词用于场景关联）
    if (generatedImages.length > 0) {
      setContextHistory(prev => ({
        sceneElements: [],
        lightMood: 'balanced',
        perspective: 'eye-level',
        atmosphere: 'mysterious',
        lastPrompt: finalPrompt,
        userInputs: prev?.userInputs || [],
        generatedImages: prev?.generatedImages || [],
        selectedKeywords: prev?.selectedKeywords || [],
        dreamSequence: prev?.dreamSequence || 0,
      }));
    }

    // 添加到已选列表
    setSelectedImages([...selectedImages, ...newSelectedImages]);
    
    // 重置生成列表和输入，准备继续创作
    setGeneratedImages([]);
    setLastPolishedPrompt('');
    setLastPolishedPromptCN('');
    setCurrentPrompt('');
    setSelectedKeywords([]);
    
    showToast(`已添加 ${newSelectedImages.length} 张图片，可以继续创作了`, 'success');
  };

  const handleSelectImage = (generatedImage: GeneratedImage) => {
    // 组合 prompt 和已选关键词
    const finalPrompt = selectedKeywords.length > 0 
      ? `${currentPrompt || ''}${selectedKeywords.join('、')}`
      : currentPrompt;
    
    const newSelected: SelectedImage = {
      id: Date.now().toString(),
      prompt: finalPrompt || '梦境描述',
      imageUrl: generatedImage.imageUrl,
      timestamp: new Date(),
      sceneElements: generatedImage.sceneElements,
      lightMood: generatedImage.lightMood,
      perspective: generatedImage.perspective,
      atmosphere: generatedImage.atmosphere,
    };

    // 保存当前提示词用于场景关联
    setContextHistory(prev => ({
      sceneElements: [],
      lightMood: 'balanced',
      perspective: 'eye-level',
      atmosphere: 'mysterious',
      lastPrompt: finalPrompt,
      userInputs: prev?.userInputs || [],
      generatedImages: prev?.generatedImages || [],
      selectedKeywords: prev?.selectedKeywords || [],
      dreamSequence: prev?.dreamSequence || 0,
    }));

    setSelectedImages([...selectedImages, newSelected]);
    setGeneratedImages([]);
    setLastPolishedPrompt('');
    setLastPolishedPromptCN('');
    setCurrentPrompt('');
    setSelectedKeywords([]); // 重置已选关键词
  };

  const handleRegenerate = () => {
    setGeneratedImages([]);
    handleGenerateImages();
  };

  const handleRemoveImage = (id: string) => {
    setSelectedImages(selectedImages.filter(img => img.id !== id));
  };

  // 处理图片上传
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    
    try {
      for (const file of Array.from(files)) {
        // 限制文件类型
        if (!file.type.startsWith('image/')) {
          showToast('请上传图片文件', 'warning');
          continue;
        }
        
        // 限制文件大小（5MB）
        if (file.size > 5 * 1024 * 1024) {
          showToast('图片大小不能超过5MB', 'warning');
          continue;
        }

        // 转换为 base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // 添加到上传列表
        const newImage: UploadedImage = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 8),
          dataUrl: base64,
          name: file.name,
        };
        
        setUploadedImages(prev => [...prev, newImage]);
        showToast('图片上传成功', 'success');
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      showToast('图片上传失败', 'error');
    } finally {
      setIsUploadingImage(false);
      // 重置 input 以允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 移除已上传的图片
  const handleRemoveUploadedImage = (id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  };

  const handleContinueAdd = () => {
    if (selectedImages.length > 0) {
      setCurrentPrompt('');
      setGeneratedImages([]);
    }
  };

  const handleInputChange = useCallback((text: string) => {
    // 如果内容没变化，不做任何事
    if (text === lastInputRef.current) {
      return;
    }
    lastInputRef.current = text; // 更新上一次的输入
    
    setCurrentPrompt(text);
    
    // 清除所有相关定时器，防止重复触发
    if (inputTimerRef.current) {
      clearTimeout(inputTimerRef.current);
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (preloadTimerRef.current) {
      clearTimeout(preloadTimerRef.current);
    }
    if (autoRefreshTimerRef.current) {
      clearTimeout(autoRefreshTimerRef.current);
    }

    setIsTyping(true);
    setShowRiverAnimation(true);
    console.log('[输入] 输入变化:', text || '(空)');
    
    // 用户停止输入500ms后才刷新关键词（防抖）
    inputTimerRef.current = setTimeout(() => {
      console.log('[输入] 用户停止输入，获取新关键词:', text || '(空)');
      setShowRiverAnimation(false);
      
      // 有内容用内容，无内容用默认"梦境"
      const keyword = text.trim() || '梦境';
      fetchRelatedKeywords(keyword);
      
      // 刷新后重新启动自动刷新定时器
      startAutoRefreshTimer();
    }, 500);
    
    debounceTimerRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 300);
  }, []);

  const fetchRelatedKeywords = async (keyword: string, retryCount = 0) => {
    console.log('[关键词] 正在获取关键词:', keyword, retryCount > 0 ? `(第${retryCount + 1}次尝试)` : '');
    setIsRefreshingKeywords(true);
    setShowRiverAnimation(true);
    setDreamKeywords([]); // 重置原有关键词
    
    const MAX_RETRIES = 2; // 最多重试2次
    
    try {
      const response = await fetch('/api/generate-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      
      const data = await response.json();
      console.log('[关键词] 获取结果:', data);
      
      if (data.success && data.keywords && data.keywords.length > 0) {
        setDreamKeywords(data.keywords);
        setUserInteracted(false); // 重置用户交互状态
        startAutoRefreshTimer(); // 启动自动刷新定时器
      } else if (retryCount < MAX_RETRIES) {
        // 失败但还有重试次数，延迟后重试
        console.log(`[关键词] 获取失败，${MAX_RETRIES - retryCount}秒后重试...`);
        setTimeout(() => {
          fetchRelatedKeywords(keyword, retryCount + 1);
        }, 1000); // 1秒后重试
        return; // 不执行 finally 里的关闭 loading
      } else {
        // 重试次数用完，使用默认关键词
        console.log('[关键词] 重试次数用完，使用默认关键词');
        setDreamKeywords(defaultDreamKeywords);
        showToast('网络波动，使用默认关键词', 'warning');
      }
    } catch (error) {
      console.error('[关键词] 获取失败:', error);
      
      if (retryCount < MAX_RETRIES) {
        // 失败但还有重试次数，延迟后重试
        console.log(`[关键词] 网络错误，${MAX_RETRIES - retryCount}秒后重试...`);
        setTimeout(() => {
          fetchRelatedKeywords(keyword, retryCount + 1);
        }, 1000); // 1秒后重试
        return; // 不执行 finally 里的关闭 loading
      } else {
        // 重试次数用完，使用默认关键词
        console.log('[关键词] 重试次数用完，使用默认关键词');
        setDreamKeywords(defaultDreamKeywords);
        showToast('网络波动，使用默认关键词', 'warning');
      }
    } finally {
      // 只有在不重试时才关闭 loading
      if (retryCount >= MAX_RETRIES) {
        setIsRefreshingKeywords(false);
        setShowRiverAnimation(false);
      }
    }
  };

  // 预加载关键词（第2秒开始请求，带重试）
  const preloadKeywords = async (retryCount = 0) => {
    const MAX_RETRIES = 2;
    
    // 基于当前输入或最后选择的关键词进行预加载
    const currentInput = currentPromptRef.current?.trim();
    const lastKeyword = selectedKeywordsRef.current[selectedKeywordsRef.current.length - 1];
    const keywordToUse = currentInput || lastKeyword || '梦境';
    
    console.log('[预加载] 第2秒，基于关键词预加载:', keywordToUse, retryCount > 0 ? `(第${retryCount + 1}次尝试)` : '');
    try {
      const response = await fetch('/api/generate-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keywordToUse }),
      });
      const data = await response.json();
      if (data.success && data.keywords) {
        setPreloadedKeywords(data.keywords);
        preloadedKeywordsRef.current = data.keywords; // 同步到 ref
        console.log('[预加载] 关键词已准备好:', data.keywords);
      } else if (retryCount < MAX_RETRIES) {
        // 失败但还有重试次数
        console.log(`[预加载] 失败，1秒后重试...`);
        setTimeout(() => preloadKeywords(retryCount + 1), 1000);
      }
    } catch (error) {
      console.error('[预加载] 失败:', error);
      if (retryCount < MAX_RETRIES) {
        console.log(`[预加载] 网络错误，1秒后重试...`);
        setTimeout(() => preloadKeywords(retryCount + 1), 1000);
      }
    }
  };

  // 应用预加载的关键词
  const applyPreloadedKeywords = () => {
    const keywords = preloadedKeywordsRef.current;
    if (keywords && keywords.length > 0) {
      console.log('[自动刷新] 应用预加载的关键词:', keywords);
      setDreamKeywords(keywords);
      setPreloadedKeywords(null);
      preloadedKeywordsRef.current = null;
      startAutoRefreshTimer(); // 重新启动定时器
    } else {
      // 如果没有预加载成功，基于当前输入重新请求
      const currentInput = currentPromptRef.current?.trim();
      const lastKeyword = selectedKeywordsRef.current[selectedKeywordsRef.current.length - 1];
      const keywordToUse = currentInput || lastKeyword || '梦境';
      console.log('[自动刷新] 无预加载关键词，基于当前输入重新请求:', keywordToUse);
      fetchRelatedKeywords(keywordToUse);
    }
  };

  // 启动自动刷新定时器
  const startAutoRefreshTimer = () => {
    // 如果千问故障转移中（使用Kimi），禁用自动刷新
    const isFailoverActive = typeof window !== 'undefined' && sessionStorage.getItem('llm_failover_active') === 'true';
    if (isFailoverActive) {
      console.log('[自动刷新] 千问不可用，使用Kimi备用，禁用自动刷新');
      return;
    }

    // 清除旧的定时器
    if (preloadTimerRef.current) {
      clearTimeout(preloadTimerRef.current);
    }
    if (autoRefreshTimerRef.current) {
      clearTimeout(autoRefreshTimerRef.current);
    }

    // 重置交互状态
    userInteractedRef.current = false;

    // 第15秒重新生成关键词（基于当前输入）
    autoRefreshTimerRef.current = setTimeout(() => {
      if (!userInteractedRef.current) {
        const currentInput = currentPromptRef.current?.trim();
        const lastKeyword = selectedKeywordsRef.current[selectedKeywordsRef.current.length - 1];
        const keywordToUse = currentInput || lastKeyword || '梦境';
        console.log('[自动刷新] 第15秒，重新生成关键词:', keywordToUse);
        fetchRelatedKeywords(keywordToUse);
      }
    }, 15000);
  };

  // 组件挂载时启动定时器
  useEffect(() => {
    // 启动自动刷新定时器
    startAutoRefreshTimer();
    
    return () => {
      // 清理定时器
      if (preloadTimerRef.current) {
        clearTimeout(preloadTimerRef.current);
      }
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clearDreamPageState = () => {
    sessionStorage.removeItem('dreamPageState');
  };

  const handlePolishText = async () => {
    if ((!currentPrompt.trim() && selectedKeywords.length === 0) || isPolishing) return;

    setIsPolishing(true);
    setHasUserPolished(true);
    try {
      // 如果没有文字但有标签，使用标签作为内容
      const polishContent = !currentPrompt.trim() && selectedKeywords.length > 0
        ? selectedKeywords.join('、')
        : currentPrompt;
      
      const response = await fetch('/api/polish-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: polishContent,
          context: contextHistory?.lastPrompt || '',
          artStyle: artStyleRef.current === 'default' ? 'anime' : artStyleRef.current
        }),
      });

      const data = await response.json();
      if (data.success && data.polished) {
        setCurrentPrompt(data.polished);
        // 润色后保留已选标签
        fetchRelatedKeywords(data.polished);
      }
    } catch (error) {
      console.error('Failed to polish text:', error);
    } finally {
      setIsPolishing(false);
    }
  };

  const handleGenerateVideo = async () => {
    // 检查登录状态
    if (!isLoggedIn) {
      showToast('请先登录后再生成视频', 'warning');
      setErrorReport('未登录：生成视频需要先登录账户');
      setShowErrorReport(true);
      return;
    }
    
    if (selectedImages.length < 2) {
      showToast('至少需要2张图片才能生成视频', 'warning');
      return;
    }

    setIsGeneratingVideo(true);
    showToast('正在串联梦境生成视频...', 'info');

    try {
      const imageUrls = selectedImages.map(img => img.imageUrl);
      
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls }),
      });

      const data = await response.json();

      if (data.success && data.videoUrl) {
        setCurrentVideo(data.videoUrl);
        showToast('视频生成完成！', 'success');
      } else {
        showToast(data.error || '视频生成失败', 'error');
      }
    } catch (error) {
      showToast('网络错误，请重试', 'error');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const addKeyword = (keyword: string) => {
    // 添加到已选标签列表（如果未选中）
    if (!selectedKeywords.includes(keyword)) {
      const newKeywords = [...selectedKeywords, keyword];
      setSelectedKeywords(newKeywords);
    }
    // 点击关键词后刷新相关推荐，并重置自动刷新计时器
    fetchRelatedKeywords(keyword);
  };

  const removeSelectedKeyword = async (keyword: string) => {
    const newKeywords = selectedKeywords.filter(k => k !== keyword);
    setSelectedKeywords(newKeywords);
  };

  const handleOpenAdjust = (imageUrl: string) => {
    setAdjustImageUrl(imageUrl);
    setAdjustmentText('');
  };

  const handleAdjustImage = async () => {
    if (!adjustImageUrl || !adjustmentText.trim() || isAdjusting) return;

    setIsAdjusting(true);
    showToast('正在调整画面...', 'info');

    try {
      const response = await fetch('/api/adjust-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: adjustImageUrl,
          adjustment: adjustmentText 
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        setAdjustImageUrl(data.imageUrl);
        setAdjustmentText('');
        showToast('调整完成！', 'success');
      } else {
        showToast(data.error || '图片调整失败', 'error');
      }
    } catch (error) {
      showToast('网络错误，请重试', 'error');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleAnalyzeMood = async (imageUrl: string) => {
    setIsAnalyzingMood(true);
    setMoodAnalysis(null);
    setShowMoodPanel(true);

    try {
      const response = await fetch('/api/analyze-mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });

      const data = await response.json();

      if (data.success && data.analysis) {
        setMoodAnalysis(data.analysis);
      } else {
        setMoodAnalysis({
          overall: '分析中...',
          colorTendency: '未知',
          moodLevel: 5,
          stressLevel: 5,
          keywords: ['待分析'],
          suggestions: data.error || '分析失败，请重试'
        });
      }
    } catch (error) {
      setMoodAnalysis({
        overall: '网络错误',
        colorTendency: '未知',
        moodLevel: 5,
        stressLevel: 5,
        keywords: ['分析失败'],
        suggestions: '请检查网络连接'
      });
    } finally {
      setIsAnalyzingMood(false);
    }
  };

  const handleUseAdjustedImage = () => {
    if (adjustImageUrl) {
      const dummyImage: GeneratedImage = {
        imageUrl: adjustImageUrl,
        selected: false,
        sceneElements: [],
        lightMood: 'dawn',
        perspective: 'medium',
        atmosphere: 'peaceful',
      };
      handleSelectImage(dummyImage);
      setAdjustImageUrl(null);
    }
  };

  // 下载图片到本地
  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('已保存到本地', 'success');
    } catch (error) {
      console.error('下载图片失败:', error);
      showToast('保存失败，请重试', 'error');
    }
  };

  const handleFinishAndViewResult = async () => {
    if (selectedImages.length === 0) {
      showToast('请先添加图片到梦境片段', 'warning');
      return;
    }
    
    // 防止重复点击
    if (isFinishing) return;
    setIsFinishing(true);
    showToast('正在保存梦境...', 'info');

    // 标记为从梦境页进入结果页（用于返回时恢复状态）
    sessionStorage.setItem('isReturningToDream', 'true');

    // 准备结果数据
    const dreamSetId = Date.now().toString();
    
    // 【修复】直接使用 ref 中的值，避免 usePersistentState 的防抖延迟
    const finalPolishedPromptCN = polishedPromptCNRef.current || lastPolishedPromptCN || currentPrompt;
    
    const resultData = {
      dreamSetId,
      images: selectedImages.map(img => ({
        ...img,
        timestamp: img.timestamp instanceof Date ? img.timestamp.toISOString() : img.timestamp
      })),
      video: currentVideo ? {
        url: currentVideo,
        timestamp: new Date().toISOString()
      } : null,
      userInput: currentPrompt,
      keywords: selectedKeywords,
      polishedPromptCN: finalPolishedPromptCN, // 最后一次润色的中文描述（用于心理测评）
    };
    
    localStorage.setItem('dreamResultData', JSON.stringify(resultData));
    
    // 【完成创作 = 删除草稿】重置所有草稿数据
    setGeneratedImages([]);
    setLastPolishedPrompt('');
    setLastPolishedPromptCN('');
    setCurrentPrompt('');
    setSelectedKeywords([]);
    setSelectedSceneElements([]);
    setUploadedImages([]);
    setSelectedImages([]);
    setContextHistory(null);
    
    // 【关键】同步清除 localStorage 中的上下文历史，避免防抖延迟导致的问题
    localStorage.removeItem('dream_contextHistory');
    
    // 删除本地草稿存储
    await deleteDraft(authUser?.id);
    
    // 重置完成状态
    setIsFinishing(false);
    
    // 【关键】同步保存到 Supabase 数据库（梦境库）
    try {
      const token = localStorage.getItem('dreamToken');
      
      // 合并生成的图片和上传的图片（上传的图片放在后面）
      const generatedImagesList = selectedImages.filter(img => img.imageUrl);
      const uploadedImagesList = uploadedImages.map(img => ({
        id: img.id,
        prompt: '用户上传的参考图',
        imageUrl: img.dataUrl, // base64 格式
        timestamp: new Date().toISOString(),
        sceneElements: [],
        lightMood: 'balanced',
        perspective: 'eye-level',
        atmosphere: 'natural',
      }));
      
      // 合并：先生成的图片，后上传的图片
      const allImages = [...generatedImagesList, ...uploadedImagesList];
      
      if (allImages.length > 0 && token) {
        const dreams = allImages.map(img => ({
          prompt: img.prompt || currentPrompt || '梦境描述',
          imageUrl: img.imageUrl,
          dreamType: 'default',
          artStyle: artStyle || 'realistic',
        }));
        
        const response = await fetch('/api/dream-collections', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: `梦境 ${new Date().toLocaleDateString('zh-CN')}`,
            dreams,
            summary: finalPolishedPromptCN,
          }),
        });
        
        if (response.ok) {
          console.log('[完成创作] 已保存到 Supabase 梦境库');
          // 【关键】标记已保存，避免结果页重复保存
          localStorage.setItem('dreamJustSaved', 'true');
        } else {
          console.error('[完成创作] 保存到 Supabase 失败:', await response.text());
        }
      }
    } catch (error) {
      console.error('[完成创作] 保存到 Supabase 出错:', error);
    }
    
    // 先跳转到结果页（不等待上传）
    router.push('/dream/result');
  };
  
  return (
    <>
      {/* CSS 动画样式 */}
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
      
      <div 
        className={`min-h-screen flex flex-col relative ${
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
      {/* 全局加载遮罩 */}
      <GlobalLoading isOpen={isNavigatingHome} text={mode === 'dark' ? '正在返回...' : '正在返回...'} />
      
      {/* 可拖动修复工具按钮 */}
      {isDeveloper && (
        <DraggableFixButton />
      )}
      
      {/* 顶部 */}
      <header className={`relative z-10 px-4 py-4 border-b ${mode === 'dark' ? 'bg-black/20 border-white/5' : 'bg-white/60 border-sky-100/50'}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              if (isNavigatingHome) return;
              
              if (hasUnsavedChanges) {
                setPendingNavigation('/');
                setShowUnsavedConfirm(true);
              } else {
                setIsNavigatingHome(true);
                // 跳转前设置返回标志
                sessionStorage.setItem('isReturningToDream', 'true');
                // 直接跳转
                router.push('/');
              }
            }}
            className={`flex items-center gap-2 bg-transparent outline-none border-none transition-all duration-300 ${mode === 'dark' ? 'text-white/70 hover:text-sky-300' : 'text-gray-500 hover:text-sky-500'} ${isNavigatingHome ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isNavigatingHome ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            )}
            <span>{isNavigatingHome ? '返回中...' : '返回'}</span>
          </button>
          <h1 className={`text-xl font-light tracking-widest ${mode === 'dark' ? 'text-white/90' : 'text-gray-600'}`}>忆梦空间</h1>
          <div className="w-16" />
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 relative z-10">
        
        {/* 艺术风格选择 */}
        <div className="mb-4 mt-2">
          <div
            onClick={() => setShowStyleSelector(!showStyleSelector)}
            className={`w-full backdrop-blur-sm rounded-2xl p-4 border transition-all shadow-sm cursor-pointer ${
              mode === 'dark' 
                ? 'bg-white/10 border-white/10 hover:border-sky-500/50' 
                : 'bg-white/80 border-sky-100 hover:border-sky-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {artStyle === 'anime' ? (
                  <img src="/pikachu-icon.png" alt="" className="w-8 h-8 object-contain" />
                ) : (
                  <span className="text-2xl">{artStyles.find(s => s.id === artStyle)?.icon || '🎨'}</span>
                )}
                <div className="text-left">
                  <div className={mode === 'dark' ? 'text-white/90' : 'text-gray-700'}>{artStyles.find(s => s.id === artStyle)?.name}</div>
                  <div className={mode === 'dark' ? 'text-white/50 text-sm' : 'text-gray-400 text-sm'}>{artStyles.find(s => s.id === artStyle)?.desc}</div>
                </div>
              </div>
              <svg className={`w-5 h-5 transition-transform ${showStyleSelector ? 'rotate-180' : ''} ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {showStyleSelector && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {artStyles.map(style => (
                <button
                  key={style.id}
                  onClick={() => { setArtStyle(style.id); setShowStyleSelector(false); }}
                  className={`p-3 rounded-xl border transition-all ${
                    artStyle === style.id
                      ? mode === 'dark' ? 'border-sky-500 bg-sky-500/20' : 'border-sky-300 bg-sky-50'
                      : mode === 'dark' ? 'border-white/10 bg-white/10 hover:border-sky-500/50' : 'border-sky-100 bg-white/80 hover:border-sky-200'
                  }`}
                >
                  {style.id === 'anime' ? (
                    <img src="/pikachu-icon.png" alt="" className="w-8 h-8 mx-auto mb-1 object-contain" />
                  ) : (
                    <div className="text-xl mb-1">{style.icon}</div>
                  )}
                  <div className={`text-sm ${mode === 'dark' ? 'text-white/90' : 'text-gray-600'}`}>{style.name}</div>
                  <div className={`text-xs truncate ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>{style.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 梦境心理预览 - 独立区块 */}
        {selectedImages.length > 0 && (
          <div className={`mb-4 p-4 rounded-2xl ${
            mode === 'dark' 
              ? 'bg-gradient-to-r from-sky-500/10 to-blue-500/10 border border-sky-500/20' 
              : 'bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧠</span>
                <div>
                  <div className={`text-sm font-medium ${mode === 'dark' ? 'text-white/90' : 'text-gray-700'}`}>
                    梦境心理预览
                  </div>
                  <div className={`text-xs ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                    {selectedImages.length}张图 · 探索潜意识
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (selectedImages.length > 0) {
                    const targetUrl = `/assessment?dream=${encodeURIComponent(JSON.stringify({
                      images: selectedImages.map(img => img.imageUrl),
                      prompts: selectedImages.map(img => img.prompt),
                      polishedPromptCN: lastPolishedPromptCN, // 最后一次润色的中文描述
                      timestamp: new Date().toISOString()
                    }))}`;
                    
                    // 直接跳转到深度分析页面
                    router.push(targetUrl);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  mode === 'dark'
                    ? 'bg-sky-500/30 text-sky-300 hover:bg-sky-500/50'
                    : 'bg-sky-100 text-sky-600 hover:bg-sky-200'
                }`}
              >
                深度分析 →
              </button>
            </div>
          </div>
        )}

        {/* 已选图片列表 */}
        {selectedImages.length > 0 && (
          <div className={`mb-6 p-4 rounded-2xl backdrop-blur-sm border ${mode === 'dark' ? 'bg-white/10 border-white/10' : 'bg-white/80 border-sky-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-lg font-light ${mode === 'dark' ? 'text-white/90' : 'text-gray-700'}`}>
                梦境片段 ({selectedImages.length})
              </h2>
              {selectedImages.length >= 2 && !currentVideo && (
                <button
                  onClick={handleGenerateVideo}
                  disabled={isGeneratingVideo}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:shadow-purple-900/50'
                      : 'bg-gradient-to-r from-sky-400 to-blue-400 text-white hover:shadow-sky-200'
                  } ${isGeneratingVideo ? 'opacity-50' : ''}`}
                >
                  {isGeneratingVideo ? '🎬 生成中...' : '🎬 生成视频'}
                </button>
              )}
            </div>

            
            <div className="flex gap-3 overflow-x-auto pb-2">
              {selectedImages.map((img, index) => (
                <div key={img.id} className="relative flex-shrink-0 group">
                  <img
                    src={img.imageUrl}
                    alt={`梦境片段 ${index + 1}`}
                    className="w-24 h-24 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setEnlargedImage(img.imageUrl)}
                  />
                  <button
                    onClick={() => handleRemoveImage(img.id)}
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      mode === 'dark' ? 'bg-red-500/80 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    ×
                  </button>
                  <div className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-xs ${
                    mode === 'dark' ? 'bg-black/50 text-white' : 'bg-white/80 text-gray-700'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenAdjust(img.imageUrl)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        mode === 'dark' ? 'bg-sky-500/80 text-white' : 'bg-sky-400 text-white'
                      }`}
                      title="调整画面"
                    >
                      🎨
                    </button>
                    <button
                      onClick={() => handleAnalyzeMood(img.imageUrl)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        mode === 'dark' ? 'bg-blue-500/80 text-white' : 'bg-blue-400 text-white'
                      }`}
                      title="心理状态分析"
                    >
                      🧠
                    </button>
                  </div>
                </div>
              ))}
              
              {generatedImages.length === 0 && !isGenerating && (
                <button
                  onClick={handleContinueAdd}
                  className={`flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                    mode === 'dark' 
                      ? 'border-white/20 text-white/50 hover:border-sky-400 hover:text-sky-300' 
                      : 'border-sky-200 text-sky-400 hover:border-sky-400'
                  }`}
                >
                  <span className="text-2xl">+</span>
                  <span className="text-xs">继续添加</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 当前视频 */}
        {currentVideo && (
          <div className={`mb-6 p-4 rounded-2xl backdrop-blur-sm border ${mode === 'dark' ? 'bg-white/10 border-white/10' : 'bg-white/80 border-sky-100'}`}>
            <h2 className={`text-lg font-light mb-3 ${mode === 'dark' ? 'text-white/90' : 'text-gray-700'}`}>梦境视频</h2>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
              <video
                src={currentVideo}
                controls
                autoPlay
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-3 mt-3">
              <a
                href={currentVideo}
                download="dream-video.mp4"
                className={`flex-1 py-2 text-center rounded-xl text-sm ${
                  mode === 'dark'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                    : 'bg-gradient-to-r from-sky-400 to-blue-400 text-white'
                }`}
              >
                📥 下载视频
              </a>
              <button
                onClick={handleFinishAndViewResult}
                className={`flex-1 py-2 text-center rounded-xl text-sm font-medium ${
                  mode === 'dark'
                    ? 'bg-white/10 text-white/80 hover:bg-white/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ✨ 完成创作
              </button>
            </div>
            {/* 返回首页/继续创作 */}
            <div className="flex gap-3 mt-3">
              <Link
                href="/"
                className={`flex-1 py-2 text-center rounded-xl text-sm transition-colors ${
                  mode === 'dark'
                    ? 'text-white/60 hover:text-white/80'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                🏠 返回首页
              </Link>
              <button
                onClick={() => {
                  // 继续创作：重置选择状态，保留生成的内容
                  setSelectedImages([]);
                }}
                className={`flex-1 py-2 text-center rounded-xl text-sm transition-colors ${
                  mode === 'dark'
                    ? 'text-white/60 hover:text-white/80'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                ✨ 继续创作
              </button>
            </div>
          </div>
        )}

        {/* 输入区域 */}
        <div className={`rounded-2xl p-3 sm:p-4 backdrop-blur-sm border ${mode === 'dark' ? 'bg-white/10 border-white/10' : 'bg-white/80 border-sky-100'}`}>
          {/* 动态关键词 - 单行显示 */}
          <div className="mb-3 h-10 overflow-hidden">
            {dreamKeywords.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {dreamKeywords.map((keyword, index) => (
                  <button
                    key={index}
                    onClick={() => addKeyword(keyword)}
                    className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
                      mode === 'dark'
                        ? 'bg-white/10 text-white/70 hover:bg-sky-500/30'
                        : 'bg-gray-100 text-gray-600 hover:bg-sky-100'
                    }`}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            ) : showRiverAnimation && (
              <div className="flex flex-col items-center justify-center h-full">
                <p className={`text-sm mb-2 ${mode === 'dark' ? 'text-sky-300' : 'text-sky-500'}`}>
                  正在联想关键词...
                </p>
                <svg className="w-full max-w-md h-12" viewBox="0 0 400 48" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={mode === 'dark' ? '#818cf8' : '#a78bfa'} stopOpacity="0" />
                      <stop offset="30%" stopColor={mode === 'dark' ? '#a5b4fc' : '#c4b5fd'} stopOpacity="1" />
                      <stop offset="70%" stopColor={mode === 'dark' ? '#a5b4fc' : '#c4b5fd'} stopOpacity="1" />
                      <stop offset="100%" stopColor={mode === 'dark' ? '#818cf8' : '#a78bfa'} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* 脑电波波浪 */}
                  <path
                    d="M0 24 
                       Q 10 20, 20 24 T 40 24 
                       Q 50 16, 60 24 T 80 24
                       Q 90 28, 100 24 T 120 24
                       Q 130 20, 140 24 T 160 24
                       Q 170 28, 180 24 T 200 24
                       Q 210 18, 220 24 T 240 24
                       Q 250 30, 260 24 T 280 24
                       Q 290 22, 300 24 T 320 24
                       Q 330 26, 340 24 T 360 24
                       Q 370 20, 380 24 T 400 24"
                    fill="none"
                    stroke="url(#waveGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="animate-pulse"
                  />
                  {/* 第二层波浪 - 错位 */}
                  <path
                    d="M0 24 
                       Q 15 28, 30 24 T 70 24
                       Q 85 20, 100 24 T 140 24
                       Q 155 26, 170 24 T 210 24
                       Q 225 22, 240 24 T 280 24
                       Q 295 28, 310 24 T 350 24
                       Q 365 26, 380 24 T 400 24"
                    fill="none"
                    stroke={mode === 'dark' ? '#6366f1' : '#8b5cf6'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.5"
                    className="animate-pulse"
                    style={{ animationDelay: '100ms' }}
                  />
                </svg>
              </div>
            )}
          </div>

          {/* 已选关键词标签 - 单行紧凑显示，空时显示装饰 */}
          <div className="mb-2 h-10 overflow-hidden">
            {selectedKeywords.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {selectedKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 ${
                      mode === 'dark'
                        ? 'bg-sky-500/30 text-sky-200'
                        : 'bg-sky-100 text-sky-600'
                    }`}
                  >
                    {keyword}
                    <button
                      onClick={() => removeSelectedKeyword(keyword)}
                      className={`ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs hover:opacity-70 ${
                        mode === 'dark' ? 'bg-white/20' : 'bg-sky-200'
                      }`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              /* 空状态装饰 - 移动端响应式 */
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 py-2 opacity-70">
                {/* 第一行/组 */}
                <div className="flex items-center justify-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-2 animate-pulse" style={{ animationDelay: '0ms' }}>
                    <span className="text-xl">🌙</span>
                    <span className={`text-sm ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>点击上方标签添加</span>
                  </div>
                  <div className={`hidden sm:block w-1 h-1 rounded-full ${mode === 'dark' ? 'bg-white/30' : 'bg-gray-300'}`} />
                  <div className="flex items-center gap-2 animate-pulse" style={{ animationDelay: '200ms' }}>
                    <span className="text-xl">✨</span>
                    <span className={`text-sm ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>或直接输入描述</span>
                  </div>
                </div>
                {/* 第二行/组 - 仅桌面端显示 */}
                <div className={`hidden sm:flex items-center gap-2 animate-pulse`} style={{ animationDelay: '400ms' }}>
                  <div className={`w-1 h-1 rounded-full ${mode === 'dark' ? 'bg-white/30' : 'bg-gray-300'}`} />
                  <span className="text-xl">🎨</span>
                  <span className={`text-sm ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>AI 将为你生成画面</span>
                </div>
              </div>
            )}
          </div>

          {/* 已上传图片预览区域 */}
          {(uploadedImages.length > 0 || true) && (
            <div className="mb-3">
              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {/* 上下两行布局：上面留空，下面上传图片 */}
              <div className="flex flex-col gap-2">
                {/* 第二行：上传图片 */}
                <div className="flex items-center justify-between">
                  {/* 上传图片 */}
                  <div 
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => !isUploadingImage && fileInputRef.current?.click()}
                  >
                    {/* 上传图标 */}
                    <svg 
                      className={`w-5 h-5 flex-shrink-0 ${mode === 'dark' ? 'text-sky-300' : 'text-sky-600'}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="17,8 12,3 7,8" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className={`text-sm ${mode === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>
                      {uploadedImages.length > 0 ? `已上传 ${uploadedImages.length} 张图片` : '点击上传图片'}
                    </span>
                  </div>
                </div>
              </div>
              {/* 已上传图片列表 */}
              {uploadedImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {uploadedImages.map((img) => (
                    <div key={img.id} className="relative flex-shrink-0 group">
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="w-24 h-24 object-cover rounded-xl"
                      />
                      <button
                        onClick={() => handleRemoveUploadedImage(img.id)}
                        className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                          mode === 'dark' ? 'bg-red-500/80 text-white' : 'bg-red-500 text-white'
                        }`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 输入框和图片上传按钮 */}
          <div className="flex gap-2">
            <textarea
              value={currentPrompt}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="描述你的梦境..."
              rows={2}
              className={`flex-1 p-3 sm:p-4 rounded-xl border outline-none resize-none transition-colors text-base ${
                mode === 'dark' 
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-100 placeholder:text-sky-300/50 focus:border-sky-400/50' 
                  : 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-sky-300'
              }`}
            />
          </div>

          {/* 保存按钮、恢复默认、自动保存在同一行 */}
          <div className="flex items-center justify-end mt-2">
            {/* 右侧：重置按钮 */}
            <div className="flex flex-col gap-1 items-end">
              <button
                onClick={() => setShowDeleteDraftConfirm(true)}
                className={`w-full px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  mode === 'dark'
                    ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                    : 'bg-green-100 text-green-600 hover:bg-green-200'
                }`}
                title="重置当前梦境，释放内存，重新开始"
              >
                重置
              </button>
              
              {/* 提示 */}
              <div className={`text-[10px] ${mode === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
                清除关联，开始新梦境
              </div>
            </div>
          </div>

          {/* 生成图片和完成按钮 */}
          <div className="flex gap-2 mt-3 sm:mt-4">
            {/* 生成图片按钮 */}
            <button
              onClick={handleGenerateImages}
              disabled={(currentPrompt.trim() === '' && selectedKeywords.length === 0 && uploadedImages.length === 0) || isGenerating}
              className={`flex-1 py-3 sm:py-2 rounded-xl font-medium text-sm transition-all active:scale-95 ${
                mode === 'dark'
                  ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:shadow-purple-900/50 active:from-sky-700 active:to-blue-700 active:shadow-lg'
                  : 'bg-gradient-to-r from-sky-400 to-blue-400 text-white hover:shadow-sky-200 active:from-sky-500 active:to-blue-500 active:shadow-lg'
              } disabled:opacity-50`}
            >
              {isGenerating ? '⏳ 生成中...' : (isLoggedIn ? (uploadedImages.length > 0 ? '🎨 图生图' : '🌟 生成图片') : '🔒 登录后生成')}
            </button>

            {/* 完成按钮 */}
            <button
              onClick={handleFinishAndViewResult}
              disabled={selectedImages.length === 0}
              className={`flex-1 py-4 sm:py-3 rounded-xl font-medium text-base transition-all shadow-md ${
                selectedImages.length > 0
                  ? (mode === 'dark'
                      ? 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-500/30'
                      : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/30')
                  : (mode === 'dark'
                      ? 'bg-gray-700/50 text-gray-500 border border-gray-600/30 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed')
              }`}
            >
              ✨ 完成
            </button>
          </div>

          {/* 生成进度 - 生成中显示，完成后淡出 */}
          {isGenerating && (
            <DreamProgressBar
              progress={displayProgress}
              simulatedProgress={simulatedProgress}
              message={generateMessage || '这次生成的图，会悄悄记住你写的文字哦'}
              stage={generateStage}
              showCancel={true}
              onCancel={handleCancelGenerate}
              isCancelling={isCancelling}
              className="mt-4"
            />
          )}
          
          {/* 润色进度 */}
          {isPolishing && (
            <div className={`mt-4 p-4 rounded-2xl backdrop-blur-md border ${
              mode === 'dark' 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 border-green-500 border-t-transparent animate-spin ${mode === 'dark' ? 'border-t-white/50' : ''}`} />
                <span className={`text-sm ${mode === 'dark' ? 'text-green-300' : 'text-green-600'}`}>
                  正在润色描述...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 候选图片 - 页面初始化完成后才显示，防止闪现旧数据 */}
        {isPageReady && generatedImages.length > 0 && (
          <div className="mt-6">
            {/* 提示文字 - 更显眼，无边框 */}
            <div className={`flex items-center justify-between mb-5 px-4 py-3 rounded-xl ${
              mode === 'dark' 
                ? 'bg-gradient-to-r from-sky-600/20 via-indigo-600/20 to-pink-600/20' 
                : 'bg-gradient-to-r from-sky-100 via-indigo-100 to-pink-100'
            }`}>
              <p className={`text-xl font-bold ${
                mode === 'dark' 
                  ? 'text-white/90' 
                  : 'bg-gradient-to-r from-sky-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent'
              }`}>
                ✨ 选择一张最符合你心意的画面 ↓
              </p>
              {generatedImages.length > 0 && (
                <button
                  onClick={handleSelectAllImages}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-green-500/40'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-green-500/30'
                  }`}
                >
                  📥 全部添加 {generatedImages.length > 1 ? `(${generatedImages.length})` : ''}
                </button>
              )}
            </div>
            {/* 自适应网格：图片多就小，少就大 */}
            <div className={`grid gap-4 ${
              generatedImages.length === 1 
                ? 'grid-cols-1' 
                : generatedImages.length === 2 
                  ? 'grid-cols-2' 
                  : generatedImages.length <= 4 
                    ? 'grid-cols-2' 
                    : 'grid-cols-2 sm:grid-cols-3'
            }`}>
              {generatedImages.map((img, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <div 
                    className={`relative rounded-2xl overflow-hidden group cursor-pointer transition-all duration-150 ${
                      mode === 'dark' 
                        ? 'hover:ring-2 hover:ring-sky-400/30 active:ring-4 active:ring-sky-400 active:shadow-[0_0_20px_rgba(56,189,248,0.5)]' 
                        : 'hover:ring-2 hover:ring-sky-300/50 active:ring-4 active:ring-sky-400 active:shadow-[0_0_20px_rgba(56,189,248,0.4)]'
                    } ${
                      generatedImages.length === 1 ? 'aspect-video' : 'aspect-square'
                    }`}
                    onClick={() => handleSelectImage(img)}
                  >
                    {/* 加载占位动画 */}
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-sky-500/20 via-indigo-500/20 to-pink-500/20" />
                    {/* 加载中心百分比 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`text-center ${mode === 'dark' ? 'text-white' : 'text-gray-700'}`}>
                        <div className="text-4xl font-bold bg-gradient-to-r from-sky-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent animate-pulse">
                          100%
                        </div>
                        <div className={`text-sm mt-1 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                          已加载
                        </div>
                      </div>
                    </div>
                    {/* 实际图片 */}
                    <img
                      src={img.imageUrl}
                      alt={`选项 ${index + 1}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 pointer-events-none"
                      onLoad={(e) => {
                        e.currentTarget.classList.remove('opacity-0');
                        e.currentTarget.classList.add('opacity-100');
                        e.currentTarget.previousElementSibling?.classList.add('hidden');
                      }}
                    />
                    {/* 悬停时的提示 */}
                    <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 ${
                      mode === 'dark' ? 'bg-gradient-to-t from-black/60 via-black/30 to-transparent' : 'bg-gradient-to-t from-black/40 via-black/20 to-transparent'
                    }`}>
                      <div className={`px-4 py-2 rounded-full text-sm font-bold transform transition-transform group-hover:scale-110 ${
                        mode === 'dark' 
                          ? 'bg-sky-500/80 text-white shadow-lg shadow-sky-500/30' 
                          : 'bg-sky-400 text-white shadow-lg shadow-sky-400/30'
                      }`}>
                        ✓ 点击选中
                      </div>
                    </div>
                  </div>
                  
                  {/* 导出梦境按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(img.imageUrl, `梦境绘卷-${index + 1}-${Date.now()}.png`);
                    }}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                      mode === 'dark'
                        ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30'
                        : 'bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200'
                    }`}
                  >
                    💾 导出梦境
                  </button>
                </div>
              ))}
            </div>
            
            {/* 公共提示词区域 - 显示润色后的中文描述 */}
            {lastPolishedPromptCN && (
              <div className={`mt-4 p-4 rounded-xl ${
                mode === 'dark' ? 'bg-white/5 text-white/80' : 'bg-sky-50 text-sky-700'
              }`}>
                <span className="font-medium opacity-70">梦境描述：</span>
                <p className="mt-1 text-sm">{lastPolishedPromptCN}</p>
              </div>
            )}
            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              className={`w-full mt-4 py-2 rounded-xl text-sm transition-colors ${
                mode === 'dark'
                  ? 'bg-white/10 text-white/70 hover:bg-white/20'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              🔄 换一组试试
            </button>
          </div>
        )}
      </main>

      {/* 未保存提醒弹窗 */}
      {showUnsavedConfirm && (
        <>
          {/* 遮罩层 */}
          <div 
            className="fixed inset-0 bg-black/50 z-[9998]"
            onClick={() => setShowUnsavedConfirm(false)}
          />
          
          {/* 确认面板 - 更好看的设计 */}
          <div
            className={`fixed rounded-3xl shadow-2xl overflow-hidden z-[9999] ${
              mode === 'dark' 
                ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-sky-500/30' 
                : 'bg-gradient-to-br from-white via-sky-50 to-white border border-sky-200/50'
            }`}
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 400 }}
          >
            {/* 顶部装饰条 */}
            <div className="h-1 bg-gradient-to-r from-sky-500 via-pink-500 to-blue-500" />
            
            {/* 标题栏 */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400/20 via-orange-500/20 to-red-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              
              <h2 className={`text-xl font-bold text-center mb-2 ${
                mode === 'dark' ? 'text-white' : 'text-gray-800'
              }`}>
                有未保存的更改
              </h2>
              
              <p className={`text-sm text-center leading-relaxed ${
                mode === 'dark' ? 'text-white/70' : 'text-gray-600'
              }`}>
                你当前的梦境内容还没有保存，确定要离开吗？
              </p>
            </div>

            {/* 内容区域 */}
            <div className="px-6 pb-6">
              <div className={`p-4 rounded-2xl mb-6 ${
                mode === 'dark' 
                  ? 'bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 border border-yellow-500/20' 
                  : 'bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 border border-yellow-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className={`text-sm ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                    保存后可以随时回来继续编辑你的梦境
                  </p>
                </div>
              </div>
              
              {/* 操作按钮 - 垂直排列，更好看 */}
              <div className="space-y-3">
                {/* 保存并离开 */}
                <button
                  onClick={async () => {
                    await handleManualSaveDraftWithReset();
                    setShowUnsavedConfirm(false);
                    if (pendingNavigation) {
                      // 触发一个事件告诉Sidebar保持导航动画
                      window.dispatchEvent(new CustomEvent('dream:navigation-confirmed'));
                      delayedNavigate(pendingNavigation);
                    }
                  }}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:shadow-sky-500/25'
                      : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:shadow-sky-200'
                  }`}
                >
                  💾 保存并离开
                </button>
                
                {/* 不保存离开 */}
                <button
                  onClick={() => {
                    setShowUnsavedConfirm(false);
                    if (pendingNavigation) {
                      // 触发一个事件告诉Sidebar保持导航动画
                      window.dispatchEvent(new CustomEvent('dream:navigation-confirmed'));
                      delayedNavigate(pendingNavigation);
                    }
                  }}
                  className={`w-full py-3 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    mode === 'dark'
                      ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  🗑️ 不保存，直接离开
                </button>
                
                {/* 取消 */}
                <button
                  onClick={() => {
                    setShowUnsavedConfirm(false);
                    setPendingNavigation(null);
                  }}
                  className={`w-full py-3 rounded-xl font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    mode === 'dark'
                      ? 'bg-transparent text-white/50 hover:text-white/70'
                      : 'bg-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  取消，继续编辑
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 删除草稿确认弹窗 */}
      {showDeleteDraftConfirm && (
        <>
          {/* 遮罩层 */}
          <div 
            className="fixed inset-0 bg-black/50 z-[9999]"
            onClick={() => {
              if (!isDeletingDraft) {
                setShowDeleteDraftConfirm(false);
              }
            }}
          />
          
          {/* 确认面板 */}
          <div
            className={`fixed rounded-2xl shadow-2xl overflow-hidden z-[10000] ${
              mode === 'dark' 
                ? 'bg-gradient-to-b from-gray-900 to-gray-800 border border-blue-500/30' 
                : 'bg-gradient-to-b from-white to-blue-50 border border-blue-200/50'
            }`}
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 380 }}
          >
            {/* 标题栏 */}
            <div
              className={`flex items-center justify-between px-5 py-4 border-b ${
                mode === 'dark' ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-100 bg-blue-50/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400/20 to-blue-600/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <span className={`font-semibold text-base ${mode === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  重置草稿
                </span>
              </div>
              <button
                onClick={() => {
                  setShowDeleteDraftConfirm(false);
                  setIsDeletingDraft(false);
                }}
                disabled={isDeletingDraft}
                className={`p-2 rounded-xl transition-all ${
                  isDeletingDraft
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-105'
                } ${
                  mode === 'dark' ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 内容区域 */}
            <div className="p-6">
              <div className={`mb-6 p-4 rounded-xl ${
                mode === 'dark' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'
              }`}>
                <p className={`text-sm leading-relaxed ${mode === 'dark' ? 'text-white/90' : 'text-gray-700'}`}>
                  将删除云端保存的草稿图片和数据库记录，释放存储空间。此操作不可恢复。
                </p>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteDraftConfirm(false);
                    setIsDeletingDraft(false); // 重置加载状态
                  }}
                  disabled={isDeletingDraft}
                  className={`flex-1 py-2.5 text-sm rounded-xl transition-all font-medium ${
                    isDeletingDraft
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:scale-105'
                  } ${
                    mode === 'dark'
                      ? 'bg-white/10 text-white/80 hover:bg-white/20'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    setIsDeletingDraft(true); // 开始加载
                    
                    try {
                      // 1. 先删除云端数据（图片 + 数据库记录）
                      const imageUrls = generatedImages.map(img => img.imageUrl).filter(url => url && !url.startsWith('data:'));
                      if (imageUrls.length > 0) {
                        try {
                          const response = await fetch('/api/delete-draft', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ imageUrls }),
                          });
                          const result = await response.json();
                          if (result.success) {
                            console.log('[删除草稿] 云端数据已清理:', result.message);
                          }
                        } catch (error) {
                          console.error('[删除草稿] 清理云端数据失败:', error);
                        }
                      }
                      
                      // 2. 删除本地草稿
                      await deleteDraft(authUser?.id);
                      
                      // 3. 重置本地状态（包括上下文历史）
                      setCurrentPrompt('');
                      setSelectedKeywords([]);
                      setSelectedSceneElements([]);
                      setUploadedImages([]);
                      setGeneratedImages([]);
                      setSelectedImages([]);
                      setContextHistory(null); // 【关键】清除上下文历史，避免影响新会话
                      
                      // 【关键】同步清除 localStorage 中的上下文历史，避免防抖延迟导致的问题
                      localStorage.removeItem('dream_contextHistory');
                      
                      setShowDeleteDraftConfirm(false);
                      showToast('草稿已删除', 'success');
                    } finally {
                      setIsDeletingDraft(false); // 结束加载
                    }
                  }}
                  disabled={isDeletingDraft}
                  className={`flex-1 py-2.5 text-sm rounded-xl transition-all font-semibold shadow-lg ${
                    isDeletingDraft
                      ? 'opacity-70 cursor-not-allowed'
                      : 'hover:scale-105'
                  } ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                  }`}
                >
                  {isDeletingDraft ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      删除中...
                    </span>
                  ) : (
                    '确认删除'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 图片放大 */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <img
            src={enlargedImage}
            alt="放大预览"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            onClick={() => setEnlargedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors text-2xl"
          >
            ×
          </button>
        </div>
      )}

      {/* 图片调整面板 */}
      {adjustImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-2xl p-6 ${mode === 'dark' ? 'bg-[#1a1030] border border-white/10' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-700'}`}>调整画面</h3>
              <button
                onClick={() => setAdjustImageUrl(null)}
                className={`${mode === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                ✕
              </button>
            </div>
            
            <img src={adjustImageUrl} alt="调整预览" className="w-full aspect-square object-cover rounded-xl mb-4" />
            
            <input
              type="text"
              value={adjustmentText}
              onChange={(e) => setAdjustmentText(e.target.value)}
              placeholder="例如：让光线更柔和、颜色更暖一些"
              className={`w-full px-4 py-3 rounded-xl border outline-none mb-4 ${
                mode === 'dark' 
                  ? 'bg-white/10 border-white/20 text-white placeholder:text-white/40' 
                  : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setAdjustImageUrl(null)}
                className={`flex-1 py-3 rounded-xl ${
                  mode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'
                }`}
              >
                取消
              </button>
              <button
                onClick={handleAdjustImage}
                disabled={!adjustmentText.trim() || isAdjusting}
                className={`flex-1 py-3 rounded-xl font-medium ${
                  mode === 'dark'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                    : 'bg-gradient-to-r from-sky-400 to-blue-400 text-white'
                } disabled:opacity-50`}
              >
                {isAdjusting ? '调整中...' : '确认调整'}
              </button>
            </div>
            
            <button
              onClick={handleUseAdjustedImage}
              className={`w-full mt-3 py-2 rounded-xl text-sm ${
                mode === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'
              }`}
            >
              使用调整后的图片
            </button>
          </div>
        </div>
      )}

      {/* 心理状态分析面板 */}
      {showMoodPanel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 ${mode === 'dark' ? 'bg-[#1a1030] border border-white/10' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-medium ${mode === 'dark' ? 'text-white' : 'text-gray-700'}`}>🧠 心理状态分析</h3>
              <button
                onClick={() => setShowMoodPanel(false)}
                className={`${mode === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                ✕
              </button>
            </div>
            
            {isAnalyzingMood ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4 animate-pulse">🧠</div>
                <p className={mode === 'dark' ? 'text-white/60' : 'text-gray-500'}>正在分析中...</p>
              </div>
            ) : moodAnalysis ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <div className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>整体氛围</div>
                  <div className={`text-lg font-medium mt-1 ${mode === 'dark' ? 'text-white' : 'text-gray-700'}`}>{moodAnalysis.overall}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>色彩倾向</div>
                    <div className={`text-lg font-medium mt-1 ${mode === 'dark' ? 'text-white' : 'text-gray-700'}`}>{moodAnalysis.colorTendency}</div>
                  </div>
                  <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>情绪指数</div>
                    <div className={`text-lg font-medium mt-1 ${mode === 'dark' ? 'text-white' : 'text-gray-700'}`}>{moodAnalysis.moodLevel}/10</div>
                  </div>
                </div>
                
                <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <div className={`text-sm ${mode === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>关键词</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {moodAnalysis.keywords.map((kw, i) => (
                      <span key={i} className={`px-2 py-1 rounded-full text-xs ${
                        mode === 'dark' ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-600'
                      }`}>{kw}</span>
                    ))}
                  </div>
                </div>
                
                <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-sky-50'}`}>
                  <div className={`text-sm ${mode === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>💡 建议</div>
                  <div className={`mt-1 ${mode === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>{moodAnalysis.suggestions}</div>
                </div>
              </div>
            ) : (
              <p className={`text-center py-8 ${mode === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>分析失败</p>
            )}
          </div>
        </div>
      )}

      {/* 错误报告弹窗 */}
      {showErrorReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${
            errorReport.includes('未登录') 
              ? mode === 'dark' 
                ? 'bg-gradient-to-b from-[#1a1030] to-[#2d1f4e] border border-sky-500/30' 
                : 'bg-white border border-sky-100'
              : mode === 'dark'
                ? 'bg-red-900/30 border border-red-500/30'
                : 'bg-white border border-red-100'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-medium ${
                errorReport.includes('未登录')
                  ? mode === 'dark' ? 'text-sky-300' : 'text-sky-600'
                  : mode === 'dark' ? 'text-red-400' : 'text-red-600'
              }`}>
                {errorReport.includes('未登录') ? '🌙 梦境之门已开启' : '⚠️ 生成失败'}
              </h3>
              <button
                onClick={() => setShowErrorReport(false)}
                className={`${mode === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                ✕
              </button>
            </div>
            
            <div className={`p-4 rounded-xl mb-4 ${
              errorReport.includes('未登录')
                ? mode === 'dark' ? 'bg-sky-500/10' : 'bg-sky-50'
                : mode === 'dark' ? 'bg-black/20' : 'bg-gray-50'
            }`}>
              <p className={`text-sm ${mode === 'dark' ? 'text-white/80' : 'text-gray-600'}`}>
                {errorReport}
              </p>
            </div>
            
            {errorReport.includes('未登录') ? (
              <div className={`p-4 rounded-xl ${mode === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                <p className={`text-xs mb-3 ${mode === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>登录后可以</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎨</span>
                    <span className={`text-sm ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>生成梦境图片和视频</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">☁️</span>
                    <span className={`text-sm ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>保存梦境到云端</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🧠</span>
                    <span className={`text-sm ${mode === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>保存图片并进行心理评估</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`text-xs ${mode === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                可能原因：<br/>
                • API 调用频率超限（请稍后再试）<br/>
                • 网络连接不稳定<br/>
                • 服务暂时不可用
              </div>
            )}
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowErrorReport(false)}
                className={`flex-1 py-3 rounded-xl text-sm transition-colors ${
                  mode === 'dark' ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                稍后再说
              </button>
              {errorReport.includes('未登录') ? (
                <button
                  onClick={() => {
                    setShowErrorReport(false);
                    // 跳转到登录页面
                    router.push('/profile');
                  }}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all hover:shadow-lg ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:shadow-sky-500/25'
                      : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:shadow-sky-200'
                  }`}
                >
                  ✨ 立即登录
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowErrorReport(false);
                    handleRegenerate();
                  }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                    mode === 'dark'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white'
                      : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:shadow-sky-200'
                  }`}
                >
                  🔄 重试
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}

// 草稿保存函数 - 调用后端API（带用户ID）
// 草稿保存到本地 localStorage
const saveDraft = async (state: any, userId?: string | null) => {
  try {
    const draftData = {
      currentPrompt: state.currentPrompt,
      selectedKeywords: state.selectedKeywords,
      selectedSceneElements: state.selectedSceneElements,
      uploadedImages: state.uploadedImages,
      generatedImages: state.generatedImages,
      selectedImages: state.selectedImages,
      artStyle: state.artStyle,
      timestamp: Date.now(),
    };
    
    // 保存到本地 localStorage
    const key = userId ? `dream_draft_${userId}` : 'dream_draft_anonymous';
    localStorage.setItem(key, JSON.stringify(draftData));
    console.log('[草稿] 已保存到本地:', userId ? `用户${userId}` : '匿名');
  } catch (error) {
    console.error('[草稿] 保存失败:', error);
  }
};

// 草稿恢复函数 - 从本地 localStorage 读取
const restoreDraft = async (userId?: string | null) => {
  try {
    const key = userId ? `dream_draft_${userId}` : 'dream_draft_anonymous';
    const draftJson = localStorage.getItem(key);
    
    if (draftJson) {
      const draft = JSON.parse(draftJson);
      console.log('[草稿] 从本地读取到草稿:', userId ? `用户${userId}` : '匿名');
      return draft;
    }
  } catch (error) {
    console.error('[草稿] 恢复失败:', error);
  }
  return null;
};

// 删除草稿函数 - 删除本地 localStorage
const deleteDraft = async (userId?: string | null) => {
  try {
    const key = userId ? `dream_draft_${userId}` : 'dream_draft_anonymous';
    localStorage.removeItem(key);
    console.log('[草稿] 已从本地删除:', userId ? `用户${userId}` : '匿名');
  } catch (error) {
    console.error('[草稿] 删除失败:', error);
  }
};
