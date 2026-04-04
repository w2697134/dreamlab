import { NextRequest, NextResponse } from 'next/server';
import { invokeQwen } from '@/lib/qwen-client';

/**
 * 心理压力测评系统
 * - 每道题根据内容和模式影响多个维度
 * - 反向计分防止"全选A得满分"
 * - 颜色分级：危险(>70)=红，临界(>50)=黄，健康(≤50)=绿
 */

interface StressQuestion {
  id: number;
  question: string;
  options: string[];
  category: string;
  categoryName: string;
  reverse?: boolean;
  pattern?: 'frequency' | 'behavior' | 'selfEval';
  // 题目影响的维度权重
  affects?: {
    work?: number;
    relationship?: number;
    emotion?: number;
    self?: number;
    life?: number;
  };
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

const CATEGORIES = ['work', 'relationship', 'emotion', 'self', 'life'];
const CATEGORY_NAMES: Record<string, string> = {
  work: '工作/学习',
  relationship: '人际关系',
  emotion: '情绪状态',
  self: '自我认知',
  life: '生活压力'
};

/**
 * 分析梦境内容，生成题目主题提示
 */
function analyzeDreamThemes(dreamType?: string, keywords?: string[]): string {
  const themes: string[] = [];
  const kw = keywords || [];
  
  // 根据梦境类型
  const typeThemes: Record<string, string> = {
    nightmare: '【噩梦类型】梦境充满紧张、恐惧、危险。题目应围绕焦虑、失控、逃避等主题。',
    sweet: '【美梦类型】梦境温馨、幸福、满足。题目应围绕渴望、缺失、现实落差等主题。',
    fantasy: '【奇幻类型】梦境充满想象、奇异场景。题目应围绕逃避、幻想与现实、自我探索等主题。',
    memory: '【回忆类型】梦境涉及过去的人事物。题目应围绕未完成的情感、遗憾、过去的影响等主题。',
    lucid: '【清醒梦】梦境中有自我意识。题目应围绕自我认知、控制感、元认知等主题。',
    default: '【普通梦境】梦境内容混合。需要根据关键词进一步分析。'
  };
  
  if (dreamType && typeThemes[dreamType]) {
    themes.push(typeThemes[dreamType]);
  }
  
  // 根据关键词
  const keywordThemes: Record<string, string> = {
    '追逐': '【追逐主题】可能反映逃避压力或被追赶的紧迫感 → 题目方向：面对压力时的行为模式',
    '坠落': '【坠落主题】可能反映失控感或自我怀疑 → 题目方向：控制感、自我效能',
    '逃跑': '【逃跑主题】可能反映对某种情境的逃避 → 题目方向：应对方式、回避倾向',
    '迷路': '【迷路主题】可能反映方向感缺失或选择困惑 → 题目方向：决策焦虑、不确定性',
    '迟到': '【迟到主题】可能反映时间焦虑或责任压力 → 题目方向：时间管理、责任感',
    '考试': '【考试主题】可能反映被评价的焦虑 → 题目方向：表现焦虑、自我要求',
    '争吵': '【争吵主题】可能反映人际冲突或压抑的愤怒 → 题目方向：人际矛盾、表达方式',
    '孤独': '【孤独主题】可能反映社交需求未满足 → 题目方向：人际关系、归属感',
    '亲人': '【亲人主题】可能反映家庭情感或依赖 → 题目方向：家庭关系、情感依赖',
    '死亡': '【死亡主题】可能反映对变化的恐惧或某种结束 → 题目方向：转变焦虑、失去感',
    '水': '【水主题】可能反映情绪状态（平静/淹没） → 题目方向：情绪调节、压力承受',
    '火': '【火主题】可能反映愤怒或热情 → 题目方向：情绪表达、压力释放',
    '动物': '【动物主题】可能反映本能或被压抑的欲望 → 题目方向：真实感受、行为模式',
    '孩子': '【孩子主题】可能反映纯真或未成熟的一面 → 题目方向：内心小孩、自我成长',
    '房子': '【房子主题】可能反映自我认知或内心世界 → 题目方向：自我认同、安全感',
    '蛇': '【蛇主题】可能反映恐惧或诱惑 → 题目方向：恐惧应对、诱惑抵抗'
  };
  
  kw.forEach(k => {
    Object.entries(keywordThemes).forEach(([key, theme]) => {
      if (k.includes(key) && !themes.some(t => t.includes(key))) {
        themes.push(theme);
      }
    });
  });
  
  if (themes.length === 0) {
    return '【通用主题】梦境内容较为中性。题目可围绕一般性的压力来源和情绪状态展开。';
  }
  
  return themes.join('\n');
}

/**
 * AI生成个性化题目
 */
async function generateQuestionsWithAI(
  userInput: string,
  dreamType: string,
  keywords: string[],
  generatedImages: string[],
  customHeaders: Record<string, string>,
  polishedPromptCN?: string // 最后一次生成图片的润色描述
): Promise<StressQuestion[]> {
  // 根据梦境内容分析题目主题
  const dreamThemes = analyzeDreamThemes(dreamType, keywords);
  
  // 优先使用润色后的描述（包含AI分析的完整场景）
  const dreamContent = polishedPromptCN || userInput;
  
  const prompt = `你是心理咨询师。你的任务是：分析用户的梦境，然后生成8道与梦境内容紧密相关的心理压力测评题。

## 梦境信息
- 描述：${dreamContent || '无'}
- 用户原始输入：${userInput || '无'}
- 类型：${dreamType || '未指定'}
- 关键词：${keywords?.join('、') || '无'}

## 梦境主题分析（请根据梦境内容选择）
${dreamThemes}

## 核心规则

### 题目必须紧密关联梦境总结内容！
用户的梦境总结描述了："${dreamContent || '一个梦境'}"

**你的任务是**：根据这个具体的梦境场景，生成8道与之直接相关的心理测评题。

### 关联方式（必须遵循）
1. **直接引用梦境元素**：题目中要体现梦境中的具体人物、场景、情绪
2. **从梦境延伸到现实**：问"梦境中的XXX感受，在现实中你是否也..."
3. **探索梦境背后的心理**：根据梦境内容探索压力来源、情绪状态、人际关系等

### 具体示例
如果梦境总结是"一个紫发少女在樱花树下独自练剑，神情专注而略带忧伤":
- ✅ 好题目："梦中那位独自练剑的少女，让你想到自己在追求目标时的状态。你通常..."
- ✅ 好题目："梦境中樱花树下的孤独感，是否也出现在你的现实生活中？"
- ✅ 好题目："梦中少女专注背后的忧伤，你觉得在现实中对应着什么？"
- ❌ 差题目："最近一周你感到情绪平稳吗？"（与梦境无关）

### 反向计分题（至少3道）
- 从梦境的负面情境延伸到现实应对方式
- 例如：梦中感到孤独/恐惧 → 现实中"你会主动寻求帮助吗？"

### 选项设计要求【重要】
1. 选项要体现从梦境到现实的自然过渡
2. 每个选项反映不同的真实心理状态
3. 避免所有题目都是简单的情绪好坏判断

## 输出格式（严格JSON）
[
  {
    "id": 1,
    "question": "题目（与梦境相关，自然流畅）",
    "options": ["描述行为A", "描述行为B", "描述行为C", "描述行为D"],
    "category": "work/relationship/emotion/self/life",
    "categoryName": "对应中文",
    "reverse": false,
    "affects": {"主维度": 1.0, "次要维度": 0.3-0.5}
  }
]

## 重要
- 8道题必须都与梦境总结内容直接相关，每道题都要让用户感受到"这道题是基于我的梦境生成的"
- 禁止生成与梦境无关的通用心理测评题（如"最近一周情绪如何"这种泛泛题目）
- 题目要自然融入梦境元素，不要生硬地套用
- 只返回JSON数组，不要任何解释`;

  const messages = [
    { role: 'system' as const, content: '你是专业的心理咨询师，擅长根据梦境内容生成个性化的心理测评题目。' },
    { role: 'user' as const, content: prompt }
  ];

  console.log('[心理测评] AI生成题目');

  try {
    const { content } = await invokeQwen(messages, {
      temperature: 0.8
    });

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const questions = JSON.parse(jsonMatch[0]);
      const validQuestions = questions.map((q: any) => ({
        ...q,
        // 确保有affects字段，默认影响主维度
        affects: q.affects || { [q.category]: 1.0 }
      }));
      console.log(`[心理测评] AI生成${validQuestions.length}道题`);
      return validQuestions.slice(0, 8);
    }
  } catch (error) {
    console.error('[心理测评] AI生成失败:', error);
  }

  return getDefaultQuestions();
}

/**
 * 默认题目（与梦境主题相关，每题影响多个维度）
 * 注意：这些题目是通用模板，AI生成时会根据具体梦境定制
 * 选项设计原则：丰富多样，不形成固定规律
 */
function getDefaultQuestions(): StressQuestion[] {
  return [
    // 题1：压力应对类（与追逐/逃跑梦境相关）
    {
      id: 1,
      question: '当生活中出现紧迫的事情需要处理时，你通常会？',
      options: ['立刻行动，有计划地解决', '深吸一口气再开始', '想先休息一下再说', '干脆假装没看见'],
      category: 'emotion',
      categoryName: '情绪状态',
      reverse: false,
      pattern: 'behavior',
      affects: { emotion: 1.0, self: 0.5, work: 0.3 }
    },
    // 题2：控制感类（与坠落/失控梦境相关）
    {
      id: 2,
      question: '你觉得自己的生活节奏在掌控之中吗？',
      options: ['每天都很充实有序', '大部分时间还行', '经常手忙脚乱', '感觉被生活推着走'],
      category: 'self',
      categoryName: '自我认知',
      reverse: false,
      pattern: 'selfEval',
      affects: { self: 1.0, emotion: 0.6, life: 0.4 }
    },
    // 题3：人际冲突类（与争吵梦境相关）
    {
      id: 3,
      question: '当和重要的人发生矛盾时，你会怎么处理？',
      options: ['约个时间好好谈谈', '先冷静几天再处理', '生闷气等对方发现', '发完火又后悔'],
      category: 'relationship',
      categoryName: '人际关系',
      reverse: false,
      pattern: 'behavior',
      affects: { relationship: 1.0, emotion: 0.4, self: 0.3 }
    },
    // 题4：时间焦虑类（与迟到/考试梦境相关）
    {
      id: 4,
      question: '你经常因为时间不够而感到焦虑吗？',
      options: ['偶尔会看看时间', '赶一赶也没关系', 'deadline前会着急', '总觉得来不及了'],
      category: 'work',
      categoryName: '工作/学习',
      reverse: false,
      pattern: 'frequency',
      affects: { work: 1.0, emotion: 0.6, life: 0.3 }
    },
    // 题5：反向题（不倾诉）
    {
      id: 5,
      question: '心里烦闷的时候，你会找人倾诉吗？',
      options: ['会，找信任的人说说', '偶尔会提起', '想找人但又觉得算了', '觉得说了也没人懂'],
      category: 'relationship',
      categoryName: '人际关系',
      reverse: true,
      pattern: 'behavior',
      affects: { relationship: 1.0, emotion: 0.5, self: 0.3 }
    },
    // 题6：自我反思类（与回忆梦/过去相关）
    {
      id: 6,
      question: '你会经常回想过去的事情吗？',
      options: ['很少，生活在当下', '有些事会突然想起', '经常想起以前', '总是不由自主地回忆'],
      category: 'self',
      categoryName: '自我认知',
      reverse: true,
      pattern: 'selfEval',
      affects: { self: 1.0, emotion: 0.5, relationship: 0.3 }
    },
    // 题7：情绪调节类（与情绪类梦境相关）
    {
      id: 7,
      question: '当心情低落时，你通常会怎么调节？',
      options: ['出门散步或运动一下', '看点搞笑视频', '窝着不想动', '吃点好吃的安慰自己'],
      category: 'emotion',
      categoryName: '情绪状态',
      reverse: false,
      pattern: 'behavior',
      affects: { emotion: 1.0, self: 0.4, life: 0.3 }
    },
    // 题8：生活满意度类（与美梦/缺失感相关）
    {
      id: 8,
      question: '醒来后，你经常觉得现实不如梦境美好吗？',
      options: ['梦境和现实都很棒', '偶尔会这么想', '经常有落差感', '醒来会有点失落'],
      category: 'self',
      categoryName: '自我认知',
      reverse: false,
      pattern: 'selfEval',
      affects: { self: 1.0, emotion: 0.6, life: 0.3 }
    }
  ];
}

/**
 * 计算评估结果 - 每题影响多维度
 */
function calculateResult(
  answers: number[],
  questions: StressQuestion[],
  dreamType?: string,
  keywords?: string[],
  userInput?: string
): AssessmentResult {
  
  // 多维度加权计分
  const multiScores: Record<string, number> = {
    work: 0, relationship: 0, emotion: 0, self: 0, life: 0
  };
  const multiWeights: Record<string, number> = {
    work: 0, relationship: 0, emotion: 0, self: 0, life: 0
  };

  let totalStress = 0;
  let avoidantScore = 0;
  let avoidantCount = 0;

  questions.forEach((q, index) => {
    const answer = answers[index];
    
    // 跳过未回答的题目
    if (answer === undefined || answer === null) {
      console.log(`[心理测评] 题目 ${index + 1} 未回答，跳过`);
      return;
    }
    
    // 确保答案在有效范围内 0-3
    const validAnswer = Math.max(0, Math.min(3, Math.round(answer)));
    
    // 计算原始分数
    let rawScore: number;
    if (q.reverse) {
      rawScore = (3 - validAnswer) * 33.33; // 反向：选D得0分，选A得100分
    } else {
      rawScore = validAnswer * 33.33; // 正向：选A得0分，选D得100分
    }

    totalStress += rawScore;

    // 根据affects权重分配到各维度
    const affects = q.affects || { [q.category]: 1.0 };
    Object.entries(affects).forEach(([cat, weight]) => {
      if (weight && weight > 0) {
        multiScores[cat] += rawScore * weight;
        multiWeights[cat] += weight;
      }
    });

    // 回避倾向检测
    if (q.pattern === 'behavior') {
      const isAvoidant = q.reverse 
        ? answer === 3  // 反向题选D(从不)=回避
        : answer === 3; // 正向题选D(从不/完全崩溃)=回避
      if (isAvoidant) avoidantScore += 50;
      avoidantCount++;
    }
  });

  // 计算各维度最终得分（加权平均）
  const stressSources = {
    work: 0, relationship: 0, emotion: 0, self: 0, life: 0
  };
  let maxStress = 0;
  let answeredCount = 0;
  
  CATEGORIES.forEach(cat => {
    if (multiWeights[cat] > 0) {
      stressSources[cat as keyof typeof stressSources] = Math.round(
        multiScores[cat] / multiWeights[cat]
      );
      maxStress = Math.max(maxStress, stressSources[cat as keyof typeof stressSources]);
      answeredCount++;
    }
  });
  
  // 如果没有回答任何题目，设置默认值
  if (answeredCount === 0) {
    console.log('[心理测评] 警告：没有有效答案，使用默认值');
    CATEGORIES.forEach(cat => {
      stressSources[cat as keyof typeof stressSources] = 50; // 默认中等压力
    });
  }

  // 综合压力指数（取加权平均）
  const stressLevel = Math.round(totalStress / questions.length);

  // 压力等级（危险=红，临界=黄，健康=绿）
  let stressLabel: string;
  let stressDescription: string;
  
  if (stressLevel > 70) {
    stressLabel = '危险';
    stressDescription = '你的压力已经很大了，身心都在发出警报。建议认真对待，必要时寻求专业帮助。';
  } else if (stressLevel > 50) {
    stressLabel = '临界';
    stressDescription = '你的压力偏高，可能会影响情绪和状态。建议找到适合自己的减压方式。';
  } else {
    stressLabel = '健康';
    stressDescription = '你目前的状态良好，压力在可承受范围内。继续保持这种平衡。';
  }

  // 应对方式
  const avoidantRatio = avoidantCount > 0 ? avoidantScore / avoidantCount : 0;
  
  let copingStyle;
  if (avoidantRatio > 30) {
    copingStyle = {
      type: 'avoidant' as const,
      label: '回避型',
      description: '你倾向于独自消化问题，不太愿意向人倾诉。短期内能保护自尊，但长期可能积累情绪。'
    };
  } else if (stressLevel > 40) {
    copingStyle = {
      type: 'passive' as const,
      label: '内省型',
      description: '你会通过自我消化来处理压力，有一定的反思能力。但要注意别想太多而陷入负面循环。'
    };
  } else {
    copingStyle = {
      type: 'active' as const,
      label: '主动型',
      description: '你倾向于用健康的方式应对压力，包括倾诉和寻求支持。这有助于长期心理健康。'
    };
  }

  // 情绪状态（基于综合压力，而非只看情绪维度）
  // 即使情绪维度分数低，整体压力高也会影响焦虑/抑郁
  const baseEmotion = Math.max(stressSources.emotion, stressLevel * 0.6);
  const anxiety = Math.min(100, Math.round(baseEmotion * 1.0 + stressLevel * 0.3));
  const depression = Math.min(100, Math.round(baseEmotion * 0.8 + stressLevel * 0.2));
  const resilience = Math.max(0, Math.min(100, Math.round(100 - stressLevel * 0.6 + (100 - avoidantRatio) * 0.4)));

  // 建议
  const suggestions = generateSuggestions(stressLevel, stressSources, copingStyle.type, { anxiety, depression, resilience }, avoidantRatio);

  // 性格倾向
  const personalityInsight = {
    type: copingStyle.type === 'avoidant' ? '内敛型' : copingStyle.type === 'passive' ? '深思型' : '外向型',
    tendency: copingStyle.type === 'avoidant' ? '自我保护' : copingStyle.type === 'passive' ? '内省思考' : '开放沟通',
    description: copingStyle.type === 'avoidant' 
      ? '你习惯独立面对问题，看起来很坚强。但允许自己脆弱并不会让你变得软弱。'
      : copingStyle.type === 'passive'
      ? '你有较强的自我反思能力，但要注意别过度反思变成自我批判。'
      : '你善于表达和沟通，这是很好的资源。同时也要学会独处和与自己对话。'
  };

  // 梦境分析
  const dreamAnalysis = analyzeDreamConnection(dreamType, keywords, userInput, stressSources, copingStyle.type);

  console.log('[心理测评] 结果:', {
    stressLevel,
    stressSources,
    anxiety,
    depression,
    resilience,
    avoidantRatio
  });

  return {
    stressLevel,
    stressLabel,
    stressDescription,
    stressSources,
    copingStyle,
    emotionState: { anxiety, depression, resilience },
    suggestions,
    personalityInsight,
    dreamAnalysis
  };
}

/**
 * 梦境关联分析
 */
function analyzeDreamConnection(
  dreamType?: string,
  keywords?: string[],
  userInput?: string,
  stressSources?: { work: number; relationship: number; emotion: number; self: number; life: number },
  copingType?: string
): { summary: string; insights: string[]; stressIndicators: string[] } {
  const insights: string[] = [];
  const stressIndicators: string[] = [];

  const dreamInsights: Record<string, string> = {
    sweet: '温馨梦境可能反映你对被爱和安全的渴望，现实中这部分需求可能还未满足。',
    nightmare: '噩梦通常与积累的焦虑有关，梦境可能在帮你消化白天没来得及处理的压力。',
    fantasy: '奇幻梦境可能反映你想逃离现实压力，或者内心有未被探索的创造力。',
    memory: '回忆梦可能意味着你在处理过去的情感议题，或某些经历还没被完全放下。',
    lucid: '清醒梦可能说明你有较强的自我意识，愿意探索内心世界。',
    default: '梦境是潜意识的语言，你的梦境内容包含值得关注的心理信息。'
  };

  if (dreamType && dreamInsights[dreamType]) {
    insights.push(dreamInsights[dreamType]);
  }

  // 关键词分析
  if (keywords && keywords.length > 0) {
    const stressMap: Record<string, { pattern: string; indicator: string }> = {
      '追逐': { pattern: '追逐场景可能暗示你在逃避什么，或者感到被某种压力追赶。', indicator: '逃避感' },
      '坠落': { pattern: '坠落梦境常与失控感或自我怀疑相关。', indicator: '失控感' },
      '迟到': { pattern: '迟到梦可能反映对截止日期或责任的焦虑。', indicator: '时间焦虑' },
      '迷路': { pattern: '迷路可能暗示你正在经历选择的困惑或方向感的缺失。', indicator: '方向困惑' },
      '考试': { pattern: '考试梦常与被评价的焦虑有关，可能源于现实中的竞争压力。', indicator: '评价焦虑' },
      '争吵': { pattern: '争吵梦境可能反映现实中未解决的人际冲突或压抑的愤怒。', indicator: '人际冲突' },
      '孤独': { pattern: '孤独感出现在梦里，可能意味着现实中你有社交需求未被满足。', indicator: '孤独感' },
      '亲人': { pattern: '涉及亲人的梦境可能反映家庭关系或情感依赖。', indicator: '家庭情感' }
    };

    keywords.forEach(k => {
      Object.entries(stressMap).forEach(([key, value]) => {
        if (k.includes(key) && !stressIndicators.includes(value.indicator)) {
          insights.push(value.pattern);
          stressIndicators.push(value.indicator);
        }
      });
    });
  }

  // 压力来源关联
  if (stressSources) {
    const topStress = Object.entries(stressSources).sort((a, b) => b[1] - a[1])[0];
    
    if (topStress[1] > 60) {
      const correlations: Record<string, string> = {
        work: '你的梦境内容与工作/学习压力有较强关联。试着在生活中找到工作与休息的边界。',
        relationship: '人际关系可能是你压力的主要来源。梦境可能在反映你对关系的担忧或渴望。',
        emotion: '你的情绪状态可能在梦中以隐喻方式呈现。关注情绪，而不是压抑它。',
        self: '自我认同方面的压力可能在梦里出现。试着接纳当下的自己，而不是苛求完美。',
        life: '生活压力可能影响了你的梦境。哪怕是小改变，也比什么都不做要好。'
      };
      if (correlations[topStress[0]]) {
        insights.push(correlations[topStress[0]]);
      }
    }

    if (copingType === 'avoidant' && stressSources.emotion > 40) {
      insights.push('你倾向于回避问题而非面对，梦境中的紧张场景可能是潜意识在提醒你该面对了。');
    }
  }

  return {
    summary: `基于梦境类型「${dreamType || '未指定'}」与测评结果的分析`,
    insights: [...new Set(insights)].slice(0, 4),
    stressIndicators: [...new Set(stressIndicators)].slice(0, 3)
  };
}

function generateSuggestions(
  stressLevel: number,
  sources: Record<string, number>,
  copingType: string,
  emotions: { anxiety: number; depression: number; resilience: number },
  avoidantRatio: number
): string[] {
  const suggestions: string[] = [];

  // 基础建议
  if (stressLevel > 70) {
    suggestions.push('压力较大，建议认真对待。可以考虑找心理咨询师聊聊');
    suggestions.push('尝试每天留出10分钟完全放空');
  } else if (stressLevel > 50) {
    suggestions.push('压力中等，建议找到适合自己的放松方式');
    suggestions.push('保持规律运动，散步也好过久坐不动');
  } else {
    suggestions.push('状态不错，继续保持');
    suggestions.push('偶尔检视自己，别等压力累积才处理');
  }

  // 回避倾向
  if (avoidantRatio > 30 || copingType === 'avoidant') {
    suggestions.push('可以先从写日记开始，把想法写下来也是一种表达');
  }

  // 维度建议
  if (sources.work > 60) suggestions.push('工作压力突出，试着设定更清晰的工作边界');
  if (sources.relationship > 60) suggestions.push('人际关系有困扰，尝试主动表达感受而非猜测');
  if (sources.emotion > 60) suggestions.push('情绪波动明显，试试深呼吸或冥想');
  if (sources.self > 60) suggestions.push('自我评价偏低，试着列出最近做成的事');
  if (sources.life > 60) suggestions.push('生活压力较大，考虑哪些是可以放下的');

  // 情绪建议
  if (emotions.anxiety > 70) suggestions.push('焦虑程度较高，建议系统学习放松技巧');
  if (emotions.depression > 60) suggestions.push('有些抑郁倾向值得关注，建议寻求专业评估');
  if (emotions.resilience < 30) suggestions.push('心理韧性偏弱，从小目标开始重建自信');

  return [...new Set(suggestions)].slice(0, 5);
}

export async function POST(request: NextRequest) {
  try {
    const { 
      userInput, dreamType, keywords, generatedImages,
      answers, questions: savedQuestions,
      polishedPromptCN // 最后一次生成图片的润色描述
    } = await request.json();

    if (answers && Array.isArray(answers) && savedQuestions) {
      console.log('[心理测评] 计算结果:', { answers, questionCount: savedQuestions.length });
      const result = calculateResult(answers, savedQuestions, dreamType, keywords, userInput);
      console.log('[心理测评] 计算完成:', { stressSources: result.stressSources, stressLevel: result.stressLevel });
      return NextResponse.json({ success: true, result });
    }

    const questions = await generateQuestionsWithAI(
      userInput, dreamType, keywords || [], generatedImages || {}, {}, polishedPromptCN
    );

    return NextResponse.json({
      success: true, questions, totalQuestions: questions.length,
      instructions: '请根据你最近的真实状态作答。题目包含正向和反向计分，无需刻意选择某个选项。'
    });

  } catch (error) {
    console.error('心理测评错误:', error);
    return NextResponse.json({ success: false, error: '测评服务暂时不可用' }, { status: 500 });
  }
}
