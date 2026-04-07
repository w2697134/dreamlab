import { NextRequest } from 'next/server';
import { invokeQwen } from '@/lib/qwen-client';

/**
 * 提示词润色 - 分析句子成分，生成中英双语提示词（支持上下文关联）
 */
const POLISH_PROMPT = `You are a professional Stable Diffusion prompt engineer. Generate prompts following EXACT rules below.

## OUTPUT FORMAT (STRICT JSON)
{
  "analysis": {
    "subject": "主体分析",
    "action": "动作描述",
    "setting": "场景设定", 
    "mood": "氛围描述"
  },
  "positivePromptEN": "60-90 English words ONLY, direct copy-paste to SD",
  "positivePromptCN": "60-80 Chinese characters, visual description only",
  "negativePrompt": ["(worst quality:1.4)", "(low quality:1.4)", "(bad anatomy:1.3)", "(bad hands:1.3)", "(extra fingers:1.2)", "(missing fingers:1.2)", "(deformed:1.2)", "(mutation:1.2)", "(blurry:1.2)", "(watermark:1.2)", "(text:1.2)", "(logo:1.2)", "(ugly:1.2)", "(cropped:1.1)", "(out of frame:1.1)"],
  "keywords": ["中文关键词"],
  "mood": "中文氛围词",
  "model": "anime | realistic | default",
  "generationParams": {
    "steps": "30-35 (max 40)",
    "sampler": "DPM++ 2M Karras",
    "cfg_scale": "7-9",
    "resolution": "portrait 512x768 / landscape 768x512",
    "hires_fix": "enabled, 2x upscale",
    "denoising_strength": "0.2-0.3"
  }
}

## POSITIVE PROMPT RULES (MUST FOLLOW)

### Word Count (STRICT)
- EXACTLY 60-90 English words
- NEVER exceed 100 words
- ABSOLUTELY NO 200+ word spam

### Fixed Order (MUST FOLLOW)
1. **(LoRA trigger:1.2)** - If using LoRA, put trigger word first with weight
2. **Subject Core** - 1girl/1boy, character name, age, body type
3. **Action & Expression** - pose, gesture, facial expression, looking at viewer
4. **Outfit Details** - clothing, accessories, colors, materials
5. **Scene Background** - indoor/outdoor, environment details
6. **Lighting & Atmosphere** - soft lighting, dreamy glow, golden hour
7. **Quality Tags** - masterpiece, best quality, ultra-detailed
8. **Style Tags** - anime style, dreamy atmosphere, pastel colors

### Weight Syntax (Optional)
- Use (keyword:1.2) for emphasis
- Use (keyword:0.8) to reduce
- Keep weights subtle (1.1-1.3 range)

### Content Rules
- DEFAULT: dreamy atmosphere, anime aesthetic, soft pastel tones
- NO realistic/hardcore effects unless requested
- NO redundant or meaningless words
- NO repetition
- Delete AI-ineffective fluff

### Facial Features (MUST INCLUDE)
Always describe: eyes (shape, color, expression), nose, mouth/lips, face shape
Example: "large expressive purple eyes, small delicate nose, soft pink lips, oval face"

## NEGATIVE PROMPT (FIXED - NEVER CHANGE)
["(worst quality:1.4)", "(low quality:1.4)", "(bad anatomy:1.3)", "(bad hands:1.3)", "(extra fingers:1.2)", "(missing fingers:1.2)", "(deformed:1.2)", "(mutation:1.2)", "(blurry:1.2)", "(watermark:1.2)", "(text:1.2)", "(logo:1.2)", "(ugly:1.2)", "(cropped:1.1)", "(out of frame:1.1)"]

## GENERATION PARAMS (FIXED - NEVER CHANGE)
- Steps: 30-35 (max 40 for complex scenes)
- Sampler: DPM++ 2M Karras
- CFG Scale: 7-9
- Resolution: Portrait 512×768 / Landscape 768×512
- Hires Fix: ON, 2x upscale
- Denoising: 0.2-0.3

## EXAMPLES

### Example 1: Character Portrait
Input: "雷电将军"
Output positivePromptEN: "(Raiden Shogun from Genshin Impact:1.15), 1girl, female, mature adult, tall slender figure, large expressive purple eyes with glowing pupils, small delicate nose, soft pink lips, oval face with sharp jawline, long flowing purple hair with flower ornaments, traditional Japanese kimono with intricate patterns, standing gracefully, calm serene expression, looking at viewer, cherry blossom garden background, soft pink petals falling, dreamy atmosphere, soft lighting, masterpiece, best quality, ultra-detailed, anime style, pastel colors"
Word count: 78 ✓

### Example 2: Action Scene  
Input: "女孩在雨中奔跑"
Output positivePromptEN: "1girl, young female, teenage girl, large bright amber eyes filled with determination, small straight nose, slightly open mouth breathing heavily, round soft face, long wet dark hair flowing behind, school uniform soaked by rain, running forward dynamically, arms pumping, rain droplets splashing, urban street background at night, neon lights reflecting on wet pavement, dramatic lighting, emotional atmosphere, masterpiece, best quality, detailed, anime style, cinematic composition"
Word count: 71 ✓

## CRITICAL RULES
1. EXACTLY 60-90 English words for positivePromptEN
2. EXACTLY 60-80 Chinese characters for positivePromptCN
3. FIXED order: LoRA → Subject → Action → Outfit → Scene → Lighting → Quality → Style
4. MUST include detailed facial features
5. DEFAULT style: dreamy, anime, pastel - NO realistic unless requested
6. NEVER exceed word limits
7. NEVER add extra negative prompts beyond the fixed list
8. generationParams must be exactly as specified, never change values`;
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
    
    const userContent = `上文："${previousContext || '（无上文）'}"
下文："${inputSummary || '（无下文）'}"

请完成以下任务（一次完成）：
1. 先润色下文，理解其句子成分和画面内容
2. 将润色后的下文与上文结合，生成一个连贯的完整场景描述
3. 如果下文提到的人物/物体在上文出现过，保持连续性
4. 如果下文提到的是新的人物/物体（不同性别、名字、描述），将其加入场景，不要与上文人物合并

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
