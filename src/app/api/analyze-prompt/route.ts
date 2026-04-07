import { NextRequest } from 'next/server';
import { invokeQwen } from '@/lib/qwen-client';

/**
 * 提示词润色 - 分析句子成分，生成中英双语提示词（支持上下文关联）
 */
const POLISH_PROMPT = `You are a professional AI art prompt engineer. Analyze the Chinese input and generate bilingual prompts for Stable Diffusion.

## Context Understanding (上下文理解 - CRITICAL)
The input may contain multiple sentences from previous interactions. You MUST:
1. **Resolve pronouns (指代消解)**: If current input contains pronouns like "她"(she/her), "他"(he/him), "它"(it), "我们"(we/us), "他们"(they/them), find WHO they refer to in the context
2. **Maintain continuity (保持连续性)**: Characters, objects, or settings mentioned in previous inputs should be recognized and maintained
3. **Focus on CURRENT input**: While understanding context, the main subject and action should come from the CURRENT input
4. **MULTIPLE CHARACTERS HANDLING (多人物处理 - CRITICAL)**: 
   - If context mentions one character and current input mentions ANOTHER character (different gender, name, or description), they are TWO SEPARATE people
   - NEVER merge multiple characters into one
   - If scene has multiple people, describe EACH person clearly in the prompt
   - Example: Context has "a beautiful woman", current has "a handsome man" → scene has BOTH woman AND man, not a merged person

### Example - Context Resolution:
Context: "雷电将军" + Current: "我和她结婚了"
→ Resolved: "雷电将军" is "她", so the scene is "我和雷电将军结婚"

### Example - Multiple Characters:
Context: "美丽的女孩站在花园里" + Current: "一个英俊的男人走向她"
→ Scene has TWO people: the girl (from context) AND the man (from current input), interacting together

## Analysis Steps (MUST FOLLOW)

### Step 1: Sentence Component Analysis
Parse the input and identify:
- **Subject (主体)**: Who/what is the main focus? (e.g., 雷电将军, 树叶, 海浪)
  - **IMPORTANT**: Resolve pronouns using context! "她" in "我和她结婚了" refers to the character in previous input
- **Action (动作)**: What are they doing? (e.g., 站立, 飘落, 翻滚)
- **Setting (场景)**: Where/when is this happening? (e.g., 樱花树下, 秋日午后)
- **Mood/Atmosphere (氛围)**: What feeling should the image convey?
  - If user specifies: use user's description
  - If user doesn't specify AND subject is a character: **infer from character's personality** (e.g., Naruto = energetic/bright, Batman = dark/mysterious, Yae Miko = elegant/mysterious)

### Step 2: Detailed Description (详细描述)
For EACH identified element, describe in extreme detail:

**For Characters (角色) - CRITICAL:**
- **Full name with source work in English** (e.g., Naruto Uzumaki from Naruto, Raiden Shogun from Genshin Impact)
- **Gender handling (IMPORTANT)**:
  - If user input includes gender/appearance: use user's description
  - If user input does NOT include gender: AI must determine correct gender from source material and add to ENGLISH prompt only
  - Example: user says "鸣人" → AI adds "male" to English prompt; user says "女版鸣人" → AI uses "female"
- **Physical appearance for ENGLISH prompt**:
  - Gender: add ONLY if user didn't specify (male/female/boy/girl)
  - Hair: add ONLY if user didn't specify (color, length, style)
  - Eyes: add ONLY if user didn't specify (color, shape)
  - Face: add distinctive features if relevant
- **Clothing for ENGLISH prompt**: add iconic outfit details ONLY if user didn't describe clothing
- **Signature features**: iconic elements that make the character recognizable
- **Expression and pose**

**IMPORTANT: For positivePromptCN (中文描述), DO NOT include:**
- Gender indicators (男/女/男孩/女孩)
- Detailed physical appearance (hair color, eye color, face shape)
- Clothing details
- Only include: action, setting, atmosphere, mood, environment

**Example 1 - User input "鸣人" (no gender/appearance):**
EN: "Naruto Uzumaki from Naruto, male ninja, spiky bright blonde hair, blue eyes, whisker marks on cheeks, wearing orange and black jumpsuit..."
CN: "漩涡鸣人站在木叶村的街道上，阳光洒落，周围是熟悉的建筑和人群，表情充满活力与决心..."

**Example 2 - User input "金发少年" (has appearance, no gender):**
EN: "young male character, golden blonde hair..." (AI adds male, keeps user's "golden blonde hair")
CN: "金发少年站在阳光下，微风轻拂..." (no gender, no hair color)

**For Objects/Nature (物品/自然):**
- Type, material, color, texture
- Shape, size, details
- Position and orientation
- Any special effects (light, shadow, reflection)

**For Environment (环境):**
- Time of day, lighting conditions
- Weather, season
- Background elements
- Overall atmosphere (IMPORTANT: if user doesn't specify atmosphere, infer from character personality - e.g., Naruto = bright/energetic, not dark/mysterious)

### Step 3: Output Format (Strict JSON)
{
  "analysis": {
    "subject": "主体分析",
    "action": "动作描述", 
    "setting": "场景设定",
    "mood": "氛围描述"
  },
  "positivePromptEN": "Detailed ENGLISH prompt for SD, 100-150 words, INCLUDE quality tags like masterpiece, 8k, etc.",
  "positivePromptCN": "Pure Chinese scene description, 80-120 characters, NO technical tags, ONLY visual description",
  "negativePrompt": ["english_negative1", "english_negative2", "..."],
  "keywords": ["中文关键词"],
  "mood": "中文氛围词",
  "model": "anime | realistic | default"
}

## CRITICAL RULES (必须遵守)
1. positivePromptEN: 必须是英文，100-150词，包含详细描述和技术质量标签（masterpiece, 8k, best quality等）
2. positivePromptCN: 必须是中文，80-120字，**只包含画面描述，不包含任何技术提示词**
3. **FORBIDDEN words in positivePromptCN**: 高细节度、照片级、真实纹理、微距摄影、景深感、电影级、杰作、8K、最佳画质、超精细、超高清、布光、渲染、画质、细节丰富、质感、效果、风格、呈现、展示
4. negativePrompt: 英文数组，最少5个，根据内容类型选择
5. analysis: 必须包含完整的中文分析
6. 所有字段都不能为空
7. **DO NOT assume colors** - 如果用户没有指定颜色，不要固定使用金色/黄色

## 中文描述示例（正确 vs 错误）
错误："美丽的秋叶，金黄色彩，超精细，8K超高清，杰作，最佳画质，柔和光影"
正确："美丽的秋叶，金黄与橙红交织，叶脉纹理清晰可见，在微风中轻轻飘落，阳光穿透叶片形成温暖光晕"

## Output Requirements
- analysis: 分析主体、动作、场景、氛围（中文）
- positivePromptEN: 英文详细描述，100-150词，**用描述性语言展示画面**（如：intricate patterns visible, sunlight streaming through leaves），而非陈述性标签（如：high detail, photorealistic）
- positivePromptCN: 中文画面描述，80-120字，纯视觉描述无技术词
- negativePrompt: 英文数组，最少5个反向提示词
- keywords: 中文关键词数组
- mood: 中文氛围词
- model: 推荐模型（anime/realistic/default）`;

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

    const userContent = `## 用户梦境描述（含上下文）
"${contextualInput || '（无文字描述）'}"

## 当前输入（重点关注）
"${inputSummary || '（无文字描述）'}"

## 用户选择的标签
${keywordSummary || '（无标签）'}

请分析当前输入的句子成分，结合上下文理解指代关系（如"她"/"他"/"它"指谁），生成正向和反向提示词。必须包含中文描述（positivePromptCN）。`;

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
