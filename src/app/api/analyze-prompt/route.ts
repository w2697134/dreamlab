import { NextRequest } from 'next/server';
import { invokeQwen } from '@/lib/qwen-client';

/**
 * 提示词润色 - 分析句子成分，生成中英双语提示词（支持上下文关联）
 */
const POLISH_PROMPT = `You are a professional Stable Diffusion prompt engineer. Generate prompts following EXACT rules below.

## USER STYLE SELECTION
User will specify style at the end of input:
- 【二次元】= Anime/Dreamy style
- 【写实】= Photorealistic/Realistic style

## OUTPUT FORMAT (STRICT JSON)
{
  "analysis": {
    "subject": "主体分析",
    "action": "动作描述",
    "setting": "场景设定",
    "mood": "氛围描述"
  },
  "positivePromptEN": "60-90 English words, style-specific prefix + content",
  "positivePromptCN": "60-80 Chinese characters, pure visual description, NO SD tags",
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
2. Subject: 1girl/1boy, character name, detailed facial features
3. Action: pose, expression, looking at viewer
4. Outfit: clothing, colors, materials
5. Scene: background, environment
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
2. Subject: 1girl/1boy, detailed facial features
3. Skin Details: MUST INCLUDE skin pores, iris details, realistic skin texture
4. Action: natural pose, expression
5. Outfit: realistic clothing
6. Scene: realistic background
7. Lighting: natural lighting, realistic shadows

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
- EXACTLY 60-90 English words for positivePromptEN
- NEVER exceed 100 words
- ABSOLUTELY NO 200+ word spam

### Fixed Order (MUST FOLLOW)
1. **Prefix** - style-specific quality tags with weight
2. **Subject Core** - 1girl/1boy, character name, age
3. **Facial Features (MUST)** - detailed eyes, nose, mouth, face shape
4. **Action & Expression** - pose, gesture, looking at viewer
5. **Outfit Details** - clothing, colors, materials
6. **Scene Background** - indoor/outdoor, environment
7. **Lighting & Atmosphere** - style-appropriate lighting

### Weight Syntax
- Use (keyword:1.2) for emphasis
- Use (keyword:1.3) for strong emphasis (prefix only)
- Keep weights in 1.1-1.3 range

### Chinese Description Rules (CRITICAL)
**positivePromptCN is for HUMANS to READ:**
- NO SD prompt tags: "1girl", "masterpiece", "best quality", "anime style"
- NO technical terms: "高分辨率", "8K", "超精细"
- ONLY pure visual description
- Describe as telling a story to a friend

**Example:**
- WRONG: "1girl, 雷电将军, masterpiece, purple eyes, anime style"
- CORRECT: "一位紫发女性静立于樱花树下，紫色眼眸深邃，身着传统和服"

### Facial Features (MUST INCLUDE for both styles)
Always describe: eyes (shape, color, expression), nose, mouth/lips, face shape

## EXAMPLES

### Example 1: 二次元风格
Input: "雷电将军 【二次元】"
Output positivePromptEN: "(masterpiece, best quality:1.2), Raiden Shogun from Genshin Impact, 1girl, female, mature adult, large expressive purple eyes with glowing pupils, small delicate nose, soft pink lips, oval face, long flowing purple hair with flower ornaments, traditional Japanese kimono with intricate patterns, standing gracefully, calm serene expression, looking at viewer, cherry blossom garden background, soft pink petals falling, dreamy atmosphere, soft lighting, anime style, pastel colors"
Word count: 78 ✓
Output positivePromptCN: "一位紫发女性静立于樱花树下，紫色眼眸深邃有神，小巧鼻子，柔和嘴唇，身着传统和服，花瓣飘落，氛围宁静优雅，光线柔和"

### Example 2: 写实风格
Input: "雷电将军 【写实】"
Output positivePromptEN: "(photorealistic, hyperrealistic, real photograph:1.3), Raiden Shogun, female, mature adult, detailed face with realistic skin pores, sharp purple eyes with detailed iris texture, small nose, soft natural lips, defined jawline, long purple hair with natural flow, traditional Japanese outfit, standing in natural pose, realistic cherry blossom garden background, natural daylight, realistic shadows, professional photography"
Word count: 65 ✓
Output positivePromptCN: "一位紫发女性站在樱花树下，紫色眼眸深邃，皮肤纹理真实自然，身着传统服饰，背景是真实的花园，自然光线照射"`;
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
  try {
    const { userInput, uploadedImages, selectedKeywords, contextHistory, artStyle } = await request.json();
    
    const inputSummary = userInput?.trim() || '';
    const keywordSummary = selectedKeywords?.join('、') || '';
    
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

    const messages = [
      { role: 'system' as const, content: POLISH_PROMPT },
      { role: 'user' as const, content: userContent }
    ];

    const { content: aiResult, provider } = await invokeQwen(messages, {
      temperature: 0.7,
    });

    console.log(`[AI分析] 使用${provider}完成`);
    // AI原始返回日志已精简

    const fallback = {
      analysis: { 
        subject: inputSummary || '梦境场景', 
        action: '在梦境中', 
        setting: '神秘的梦境空间', 
        mood: '神秘' 
      },
      positivePromptEN: inputSummary || 'dream scene',
      positivePromptCN: inputSummary || '梦境场景',
      negativePrompt: ['ugly', 'blurry', 'low quality', 'bad anatomy', 'worst quality'],
      keywords: selectedKeywords || [],
      mood: '平静',
      model: 'default'
    };
    
    const analysisResult = parseAIResult(aiResult, fallback);
    console.log('[AI] 解析: 人物=' + (analysisResult.analysis?.subject?.substring(0, 20) || '无') + ', 模型=' + analysisResult.model);

    // 确保有中文描述
    if (!analysisResult.positivePromptCN) {
      console.warn('[AI分析] 警告: AI未生成中文描述，使用原始输入');
      analysisResult.positivePromptCN = inputSummary || '梦境场景';
    }

    // 确保反向提示词至少有5个
    let negativePrompt = analysisResult.negativePrompt || fallback.negativePrompt;
    if (!Array.isArray(negativePrompt)) {
      negativePrompt = fallback.negativePrompt;
    }
    if (negativePrompt.length < 5) {
      negativePrompt = [...negativePrompt, ...fallback.negativePrompt.slice(0, 5 - negativePrompt.length)];
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
    return new Response(JSON.stringify({
      success: false,
      error: 'AI分析失败，请稍后重试',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
