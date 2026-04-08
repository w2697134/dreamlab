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
Input: "雷电将军 【二次元】"
Output positivePromptEN: "(masterpiece, best quality:1.2), Raiden Shogun from Genshin Impact, 1girl, female, mature adult, large expressive purple eyes with glowing pupils, small delicate nose, soft pink lips, oval face, long flowing purple hair with flower ornaments, traditional Japanese kimono with intricate patterns, standing gracefully, calm serene expression, looking at viewer, cherry blossom garden background, soft pink petals falling, dreamy atmosphere, soft lighting, anime style, pastel colors"
Word count: 78 ✓
Output positivePromptCN: "紫发如瀑的女子静立于纷飞樱花之下，眼眸深邃似藏着雷霆万钧，和服轻扬间流露威严与优雅，花瓣飘落如雨，仿佛时光在此刻凝固，唯余花香与静谧相伴"

### Example 2: 写实风格
Input: "雷电将军 【写实】"
Output positivePromptEN: "(photorealistic, hyperrealistic, real photograph:1.3), Raiden Shogun, female, mature adult, detailed face with realistic skin pores, sharp purple eyes with detailed iris texture, small nose, soft natural lips, defined jawline, long purple hair with natural flow, traditional Japanese outfit, standing in natural pose, realistic cherry blossom garden background, natural daylight, realistic shadows, professional photography"
Word count: 65 ✓
Output positivePromptCN: "紫发女子伫立于樱花树下，眼眸深邃如潭，肌肤纹理细腻真实，阳光透过花瓣洒落，在和服上投下斑驳光影，仿佛一幅静谧的东方画卷"`;
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
      
      const messages = [
        { role: 'system' as const, content: POLISH_PROMPT },
        { role: 'user' as const, content: userContent }
      ];

      try {
        const { content: aiResult, provider: p } = await invokeQwen(messages, {
          temperature: 0.7,
        });
        provider = p;
        
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
        console.log(`[AI分析] 第${polishAttempt}次润色结果: ${wordCount}个单词`);
        
        // 【日志】输出润色前后对比
        console.log('[润色对比] ==========================================');
        console.log('[润色前] 用户输入:', inputSummary);
        console.log('[润色后] 英文提示词:', analysisResult.positivePromptEN?.substring(0, 100) + '...');
        console.log('[润色后] 中文描述:', analysisResult.positivePromptCN?.substring(0, 100) + '...');
        console.log(`[润色对比] 单词数: ${wordCount} (需要>=20)`);
        console.log('[润色对比] ==========================================');
        
        // 如果单词数>=20，成功退出循环
        if (wordCount >= 20) {
          console.log(`[AI分析] 润色成功，单词数满足要求`);
          break;
        }
        
        // 单词数不足，继续下一次尝试
        console.warn(`[AI分析] 单词数不足(${wordCount}<20)，继续重试...`);
        
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

    // 【修复】确保有中文描述，优先使用用户输入，而不是固定默认描述
    if (!analysisResult.positivePromptCN) {
      console.warn('[AI分析] 警告: AI未生成中文描述，使用用户输入');
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
