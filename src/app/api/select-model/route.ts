import { NextRequest, NextResponse } from 'next/server';
import { invokeLLM } from '@/lib/llm-client';

// 延迟函数 - 降低API调用速率
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MODEL_SELECT_PROMPT = `You are an AI art style analyzer. Choose the best SD model for the user's input.

【CRITICAL - DEFAULT TO ANYTHING V5】
- 90% of cases should use **Anything V5**
- Only use other models if explicitly requested

【Models】
1. **Anything V5.0** (DEFAULT & RECOMMENDED)
   - Use for: anime, manga, game characters, cute girls, ANY anime style
   - This is the BEST model for anime, use this 90% of the time

2. **Dreamlike Diffusion 1.0** (ONLY IF EXPLICITLY ASKED FOR ARTISTIC)
   - Use for: artistic illustration, concept art, abstract atmosphere ONLY
   - Do NOT use for anime characters

3. **Realistic Vision V2.0** (ONLY IF EXPLICITLY ASKED FOR REALISTIC)
   - Use for: real people, photos, portraits ONLY
   - Do NOT use for anime

【RULES - EXTREMELY IMPORTANT】
1. **ANY anime/manga/game character → Anything V5** (NO EXCEPTIONS)
2. **ANY cute girl/beautiful woman → Anything V5**
3. **Uncertain → Anything V5** (DEFAULT)
4. **ONLY use other models if user EXPLICITLY asks for "realistic" or "artistic" or "photo"**

【OUTPUT JSON ONLY】
{
  "model": "anythingV5",
  "reason": "Using Anything V5 for anime style"
}`;

export async function POST(request: NextRequest) {
  try {
    const { userInput, selectedKeywords = [] } = await request.json();
    
    if (!userInput?.trim() && selectedKeywords.length === 0) {
      return NextResponse.json({
        model: 'anythingV5',
        modelName: 'Anything V5.0',
        modelFile: 'anything-v5.safetensors',
        reason: 'No input, default to Anything V5'
      });
    }

    const combinedInput = `${userInput || ''} ${selectedKeywords.join(' ')}`.trim();

    // 添加延迟降低API调用速率
    await delay(200);

    let response;
    try {
      response = await invokeLLM([
        { role: 'system', content: MODEL_SELECT_PROMPT },
        { role: 'user', content: `User input: "${combinedInput}"\n\nChoose the best model (output JSON only):` }
      ]);
    } catch (error) {
      console.error('[模型选择] 千问调用失败:', error);
      // 返回默认模型
      return NextResponse.json({
        success: true,
        model: 'anythingV5',
        modelName: 'Anything V5.0',
        modelFile: 'anything-v5.safetensors',
        reason: 'AI analysis failed, default to Anything V5'
      });
    }

    let result = response.content.trim();
    result = result.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    
    let analysis;
    try {
      analysis = JSON.parse(result);
    } catch {
      // 解析失败，默认Anything V5
      analysis = {
        model: 'anythingV5',
        reason: 'AI analysis failed, default to Anything V5'
      };
    }

    // 映射到模型文件
    const modelMap: Record<string, { name: string; file: string }> = {
      anythingV5: {
        name: 'Anything V5.0',
        file: 'anything-v5.safetensors'
      },
      dreamlikeDiffusion: {
        name: 'Dreamlike Diffusion 1.0',
        file: 'dreamlikeDiffusion10_10.ckpt'
      },
      realisticVision: {
        name: 'Realistic Vision V2.0',
        file: 'Realistic_Vision_V2.0-fp16-no-ema.safetensors'
      }
    };

    const selectedModel = modelMap[analysis.model] || modelMap.anythingV5;

    return NextResponse.json({
      success: true,
      model: analysis.model,
      modelName: selectedModel.name,
      modelFile: selectedModel.file,
      reason: analysis.reason
    });
  } catch (error) {
    console.error('Model selection error:', error);
    return NextResponse.json({
      success: false,
      model: 'anythingV5',
      modelName: 'Anything V5.0',
      modelFile: 'anything-v5.safetensors',
      reason: 'Analysis failed, default to Anything V5'
    });
  }
}
