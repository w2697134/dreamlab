import { NextRequest } from 'next/server';
import { invokeQwen } from '@/lib/qwen-client';

/**
 * 提示词润色 - 分析句子成分，生成中英双语提示词（支持上下文关联）
 */
const POLISH_PROMPT = `You are a professional Stable Diffusion prompt engineer. Generate prompts following EXACT rules below.

## USER STYLE SELECTION (CRITICAL)
User will specify style at the end of input:
- 【二次元】= Anime/Dreamy style  
- 【写实】= Photorealistic/Realistic style
- If NO style specified, DEFAULT to 【二次元】

## OUTPUT FORMAT (STRICT JSON)
{
  "analysis": {
    "subject": "主体分析",
    "action": "动作描述",
    "setting": "场景设定",
    "mood": "氛围描述"
  },
  "positivePromptEN": "60-90 English words, style-specific prefix + content",
  "positivePromptCN": "中文描述字数 = 30 + 用户输入字数×6，封顶100字，允许±5字误差。必须结合上下文历史描述，保持梦境连贯性。", 
  "negativePrompt": ["style-specific negative prompts"],
  "keywords": ["中文关键词"],
  "mood": "中文氛围词",
  "model": "anime | realistic",
  "generationParams": {
    "steps": "30-40",
    "sampler": "DPM++ 2M Karras",
    "cfg_scale": "7-9",
    "resolution": "portrait/landscape",
    "hires_fix": "enabled, 2x upscale",
    "denoising_strength": "0.2-0.4"
  }
}

## STYLE 1: 二次元梦幻风 (Anime/Dreamy)

### When user says 【二次元】:

**positivePromptEN Structure:**
1. Prefix: (masterpiece, best quality:1.2)
2. Subject: 根据用户输入描述主体（人物/物体/场景），detailed features
3. Action: 根据用户输入描述动作或状态
4. Details: 细节描述（服装/颜色/材质等）
5. Scene: background, environment based on user input
6. Atmosphere: dreamy, soft lighting
7. Style: anime style, pastel colors

**FORBIDDEN for 二次元:**
- NO photorealistic, realistic, photograph
- NO skin pores, iris details, hyperrealistic

**negativePrompt (二次元):**
["(worst quality:1.4)", "(low quality:1.4)", "(bad anatomy:1.3)", "(bad hands:1.3)", "(extra fingers:1.2)", "(missing fingers:1.2)", "(deformed:1.2)", "(mutation:1.2)", "(blurry:1.2)", "(watermark:1.2)", "(text:1.2)", "(logo:1.2)", "(ugly:1.2)", "(cropped:1.1)", "(out of frame:1.1)"]

**generationParams (二次元):**
- steps: 30-35 (max 40)
- sampler: DPM++ 2M Karras
- cfg_scale: 7-9
- resolution: portrait 512×768 / landscape 768×512
- hires_fix: enabled, 2x upscale
- denoising_strength: 0.2-0.3

## STYLE 2: 写实人像风 (Photorealistic)

### When user says 【写实】:

**positivePromptEN Structure:**
1. Prefix: (photorealistic, hyperrealistic, real photograph:1.3)
2. Subject: 根据用户输入描述主体，detailed features
3. Details: 根据用户输入描述细节
4. Action: natural pose, expression based on user input
5. Scene: realistic background based on user input
6. Lighting: natural lighting, realistic shadows

**FORBIDDEN for 写实:**
- NO anime, cartoon, illustration, 3d, render, cg
- NO smooth skin, plastic skin, big eyes (anime style)
- NO dreamy, pastel, anime style

**negativePrompt (写实):**
["(worst quality:1.4)", "(low quality:1.4)", "(bad anatomy:1.3)", "(bad hands:1.3)", "(extra fingers:1.2)", "(missing fingers:1.2)", "(deformed:1.2)", "(mutation:1.2)", "(blurry:1.2)", "(watermark:1.2)", "(text:1.2)", "(logo:1.2)", "(ugly:1.2)", "(cropped:1.1)", "(out of frame:1.1)", "(anime:1.5)", "(cartoon:1.5)", "(drawing:1.5)", "(illustration:1.5)", "(3d:1.4)", "(render:1.4)", "(cg:1.4)", "(fake:1.3)", "(smooth skin:1.3)", "(plastic skin:1.3)", "(big eyes:1.2)"]

**generationParams (写实):**
- steps: 35-40
- sampler: DPM++ 2M Karras
- cfg_scale: 7-8
- resolution: portrait 768×1024 / landscape 1024×768
- hires_fix: enabled, 2x upscale
- denoising_strength: 0.3-0.4

## UNIVERSAL RULES

### Word Count (STRICT)
- MINIMUM 40 English words for positivePromptEN
- NEVER less than 30 words
- NEVER exceed 100 words

### Fixed Order (MUST FOLLOW)
1. **Prefix** - style-specific quality tags with weight
2. **Subject Core** - 根据用户输入描述主体（人物/物体/场景）
3. **Details** - detailed features based on user input
4. **Action & Expression** - pose, gesture based on user input
5. **Scene Details** - clothing, colors, materials, environment
6. **Scene Background** - indoor/outdoor based on user input
7. **Lighting & Atmosphere** - style-appropriate lighting

### Weight Syntax
- Use (keyword:1.2) for emphasis
- Use (keyword:1.3) for strong emphasis (prefix only)
- Keep weights in 1.1-1.3 range

### Chinese Description Rules (CRITICAL)
**positivePromptCN is the DREAM DESCRIPTION for USERS to READ:**
- NO SD prompt tags: "1girl", "masterpiece", "best quality", "anime style"
- NO technical terms: "高分辨率", "8K", "超精细"
- Write like a BEAUTIFUL STORY, not a description list
- Use literary language, poetic expressions
- Create atmosphere and emotion
- Make it feel like reading a novel scene

**Writing Style:**
- Use flowing, connected sentences
- Add emotional depth and mood
- Describe the scene as if in a dream
- Use evocative adjectives and metaphors

**Example:**
- WRONG: "1girl, 雷电将军, masterpiece, purple eyes, anime style"
- WRONG: "一位紫发女性，紫色眼睛，穿着和服，站在树下"
- CORRECT: "紫发如瀑的女子静立于纷飞樱花之下，眼眸深邃似藏着雷霆万钧，和服轻扬，仿佛时光在此刻凝固，唯余花香与静谧相伴"

### Facial Features (MUST INCLUDE for both styles)
Always describe: eyes (shape, color, expression), nose, mouth/lips, face shape

## EXAMPLES

### Example 1: 二次元风格
Input: "樱花盛开的庭院，宁静午后"
Output positivePromptEN: "(masterpiece, best quality:1.2), traditional Japanese courtyard garden in full cherry blossom season, delicate pink sakura petals floating in the air, sunlight filtering through branches creating dappled shadows on tatami mats, peaceful afternoon atmosphere, wooden tea house in background, stone lanterns along pathway, serene and tranquil mood, soft pastel colors, anime style, detailed background, dreamy lighting"
Word count: 56 ✓
Output positivePromptCN: "樱花盛开的日式庭院，粉白花瓣随风轻舞，阳光透过枝桠在榻榻米上洒下斑驳光影，午后时光静谧安详，远处茶室掩映在花海中，石灯笼点缀小径，如梦似幻"

### Example 2: 写实风格
Input: "城市夜景，霓虹灯光"
Output positivePromptEN: "(photorealistic, hyperrealistic, real photograph:1.3), bustling city street at night, vibrant neon signs illuminating the scene with colorful lights reflecting on wet pavement after rain, tall skyscrapers with glowing windows, crowds of people walking with umbrellas, street vendors with food carts, atmospheric fog, cinematic composition, professional photography, 8k uhd"
Word count: 52 ✓
Output positivePromptCN: "繁华都市夜景，霓虹灯牌在雨后湿润的路面上投下斑斓倒影，摩天大楼灯火通明，行人撑伞穿梭，街边小贩烟火气弥漫，雾气氤氲中尽显都市魅力"`;
/**
 * 解析AI结果
 */
function parseAIResult(aiResult: string, fallback: any) {
  const cleaned = aiResult.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

/**
 * 根据提示词自动选择模型
 */
function autoSelectModel(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes('anime style') || lowerPrompt.includes('anime art')) {
    return 'anime';
  }
  if (lowerPrompt.includes('photorealistic') || lowerPrompt.includes('realistic')) {
    return 'realistic';
  }
  return 'default';
}

/**
 * POST /api/analyze-prompt
 * 提示词润色API - 返回中英双语提示词（支持上下文关联）
 */
export async function POST(request: NextRequest) {
  // 先读取请求体，这样 catch 里也能用
  const body = await request.json();
  const { userInput, uploadedImages, selectedKeywords, contextHistory, artStyle } = body;
  const inputSummary = userInput?.trim() || '';
  
  try {
    const keywordSummary = selectedKeywords?.join('、') || '';
    
    // 检查输入长度（至少2个字符）
    if (inputSummary.length < 2 && keywordSummary.length === 0) {
      console.log('[AI] 输入太短，跳过润色:', inputSummary);
      return new Response(JSON.stringify({
        success: true,
        model: artStyle === 'anime' ? 'anime' : (artStyle === 'realistic' ? 'realistic' : 'default'),
        polishedPrompt: inputSummary || 'dream scene, masterpiece, best quality',
        polishedPromptCN: inputSummary || '梦境场景',
        negativePrompt: ['ugly', 'blurry', 'low quality', 'bad anatomy', 'worst quality'],
        analysis: { 
          subject: inputSummary || '梦境场景', 
          action: '在梦境中', 
          setting: '神秘的梦境空间', 
          mood: '神秘' 
        },
        keywords: selectedKeywords || [],
        mood: '平静',
        provider: 'original',
        warning: '输入太短，使用原始描述'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // 【上下文关联】拼接历史润色后的提示词
    let contextualInput = inputSummary;
    // 支持两种字段名：polishedContexts 或 userInputs（后者存储的是润色后的内容）
    const historyContexts = contextHistory?.polishedContexts || contextHistory?.userInputs;
    if (historyContexts && historyContexts.length > 0) {
      // 取最近3条历史润色描述，用句号连接
      const recentContexts = historyContexts.slice(-3);
      contextualInput = `${recentContexts.join('。')}。${inputSummary}`;
      // 上下文输入日志已精简
    }
    
    console.log('[AI] 输入:', inputSummary.substring(0, 50));

    // 构建上文（历史润色描述）和下文（当前输入）
    const previousContext = historyContexts ? historyContexts.slice(-3).join('。') : '';
    
    // 构建用户选择的关键词提示
    const keywordHint = selectedKeywords && selectedKeywords.length > 0 
      ? `用户选择的关键词（次要，放在提示词末尾，低权重）：${selectedKeywords.join('、')}`
      : '用户未选择额外关键词';
    
    const userContent = `上文："${previousContext || '（无上文）'}"
下文："${inputSummary || '（无下文）'}"
${keywordHint}

请完成以下任务（一次完成）：
1. 先润色下文，理解其句子成分和画面内容
2. 将润色后的下文与上文结合，生成一个连贯的完整场景描述
3. 如果下文提到的人物/物体在上文出现过，保持连续性
4. 如果下文提到的是新的人物/物体（不同性别、名字、描述），将其加入场景，不要与上文人物合并
5. 将用户选择的关键词放在提示词末尾，使用低权重(0.9)或不加权

最终输出要求：生成正向和反向提示词，必须包含中文描述（positivePromptCN）。`;

    // 【修复】循环润色，直到英文提示词单词数>=20或达到最大尝试次数
    const maxPolishAttempts = 5;
    let polishAttempt = 0;
    let analysisResult: any = null;
    let provider = 'unknown';
    
    while (polishAttempt < maxPolishAttempts) {
      polishAttempt++;
      console.log(`[AI分析] 第${polishAttempt}次润色尝试...`);
      
      // 每次重试间隔2秒
      if (polishAttempt > 1) {
        console.log(`[AI分析] 等待2秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const messages = [
        { role: 'system' as const, content: POLISH_PROMPT },
        { role: 'user' as const, content: userContent }
      ];

      try {
        const { content: aiResult, provider: p } = await invokeQwen(messages, {
          temperature: 0.4,
        });
        provider = p || 'unknown';
        
        // 解析结果
        const cleaned = aiResult.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        try {
          analysisResult = JSON.parse(cleaned);
        } catch {
          // 解析失败，继续下一次尝试
          console.warn(`[AI分析] 第${polishAttempt}次解析失败，继续重试...`);
          continue;
        }
        
        // 检查英文提示词单词数
        const wordCount = analysisResult.positivePromptEN ? analysisResult.positivePromptEN.split(/\s+/).length : 0;
        
        // 计算最少词数：max(30, 用户输入词数 × 6)
        const userWordCount = inputSummary ? inputSummary.split(/\s+/).length : 0;
        const minWordCount = Math.max(30, userWordCount * 6);
        
        console.log(`[AI分析] 第${polishAttempt}次润色结果: ${wordCount}个单词, 最少需要: ${minWordCount}`);
        
        // 【日志】输出润色前后对比
        console.log('[润色对比] ==========================================');
        console.log('[润色前] 用户输入:', inputSummary);
        console.log('[润色后] 英文提示词:', analysisResult.positivePromptEN?.substring(0, 100) + '...');
        console.log('[润色后] 中文描述:', analysisResult.positivePromptCN?.substring(0, 100) + '...');
        console.log(`[润色对比] 单词数: ${wordCount} (需要>=${minWordCount})`);
        console.log('[润色对比] ==========================================');
        
        // 如果单词数>=最少词数，成功退出循环
        if (wordCount >= minWordCount) {
          console.log(`[AI分析] 润色成功，单词数满足要求`);
          break;
        }
        
        // 单词数不足，继续下一次尝试
        console.warn(`[AI分析] 单词数不足(${wordCount}<${minWordCount})，继续重试...`);
        
      } catch (error) {
        console.error(`[AI分析] 第${polishAttempt}次调用失败:`, error);
        // 继续下一次尝试
      }
    }
    
    // 如果所有尝试都失败，使用fallback
    if (!analysisResult || !analysisResult.positivePromptEN) {
      console.warn(`[AI分析] ${maxPolishAttempts}次尝试均失败，使用fallback`);
      analysisResult = {
        analysis: { 
          subject: inputSummary || '梦境场景', 
          action: '在梦境中', 
          setting: '神秘的梦境空间', 
          mood: '神秘' 
        },
        positivePromptEN: inputSummary 
          ? `(${inputSummary}), masterpiece, best quality, detailed, artistic composition, beautiful lighting`
          : 'dream scene, masterpiece, best quality, detailed, artistic composition',
        positivePromptCN: inputSummary || '梦境场景',
        negativePrompt: ['ugly', 'blurry', 'low quality', 'bad anatomy', 'worst quality'],
        keywords: selectedKeywords || [],
        mood: '平静',
        model: 'default'
      };
    }
    
    console.log('[AI] 解析: 人物=' + (analysisResult.analysis?.subject?.substring(0, 20) || '无') + ', 模型=' + analysisResult.model);

    // 【修复】确保有中文描述，如果AI返回的是默认描述或空，使用用户输入
    const isDefaultDesc = analysisResult.positivePromptCN?.includes('如梦似幻') || 
                          analysisResult.positivePromptCN?.includes('若隐若现') ||
                          !analysisResult.positivePromptCN;
    if (isDefaultDesc) {
      console.warn('[AI分析] 警告: AI返回默认描述或空，使用用户输入');
      analysisResult.positivePromptCN = inputSummary || '梦境场景';
    }

    // 默认反向提示词
    const defaultNegativePrompt = ['ugly', 'blurry', 'low quality', 'bad anatomy', 'worst quality'];

    // 确保反向提示词至少有5个
    let negativePrompt = analysisResult.negativePrompt || defaultNegativePrompt;
    if (!Array.isArray(negativePrompt)) {
      negativePrompt = defaultNegativePrompt;
    }
    if (negativePrompt.length < 5) {
      negativePrompt = [...negativePrompt, ...defaultNegativePrompt.slice(0, 5 - negativePrompt.length)];
    }

    // 选择模型：优先使用用户选择的艺术风格
    let selectedModel: string;
    if (artStyle === 'anime') {
      selectedModel = 'anime';
    } else if (artStyle === 'realistic' || artStyle === 'watercolor' || artStyle === 'oil') {
      selectedModel = 'realistic';
    } else {
      // 用户未指定或默认，使用 AI 判断
      selectedModel = analysisResult.model || 'default';
      if (!selectedModel || selectedModel === 'default') {
        selectedModel = autoSelectModel(analysisResult.positivePromptEN || '');
      }
    }
    
    const response = {
      success: true,
      model: selectedModel,
      polishedPrompt: analysisResult.positivePromptEN,   // 英文 - 给SD用
      polishedPromptCN: analysisResult.positivePromptCN, // 中文 - 给用户看
      negativePrompt: negativePrompt,                    // 英文 - 给SD用
      analysis: analysisResult.analysis,
      keywords: analysisResult.keywords || selectedKeywords || [],
      mood: analysisResult.mood || '平静',
      provider
    };
    
    // 返回前端日志已精简
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI分析] 错误:', error);
    // 【修复】润色失败时返回原文本+随机提示词
    const randomEnhancements = [
      'masterpiece, best quality, detailed',
      'highly detailed, beautiful lighting, sharp focus',
      'masterpiece, ultra-detailed, cinematic lighting',
      'best quality, detailed, professional artwork',
      'masterpiece, intricate details, soft lighting'
    ];
    const randomEnhance = randomEnhancements[Math.floor(Math.random() * randomEnhancements.length)];
    
    // 给用户原文加上随机增强词
    const enhancedPrompt = inputSummary ? `${inputSummary}, ${randomEnhance}` : randomEnhance;
    
    return new Response(JSON.stringify({
      success: true,
      model: 'anime',
      polishedPrompt: enhancedPrompt,
      polishedPromptCN: inputSummary || '梦境场景',
      negativePrompt: ['ugly', 'blurry', 'low quality', 'bad anatomy', 'worst quality'],
      analysis: { 
        subject: inputSummary || '梦境场景', 
        action: '在梦境中', 
        setting: '神秘的梦境空间', 
        mood: '神秘' 
      },
      keywords: selectedKeywords || [],
      mood: '平静',
      provider: 'fallback'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
