import { NextRequest, NextResponse } from 'next/server';

// AI 梦境总结 API
export async function POST(request: NextRequest) {
  try {
    const { prompts, images } = await request.json();

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { error: '请提供梦境描述' },
        { status: 400 }
      );
    }

    // 构建AI总结Prompt
    const systemPrompt = `你是一个专业的梦境分析师。请根据用户提供的多个梦境描述，生成一个简洁但全面的梦境总结。

要求：
1. 总结长度控制在100-200字之间
2. 涵盖所有梦境的主要元素和主题
3. 语言优美，适合用于心理评估时的梦境描述
4. 突出梦境的情感基调和关键意象
5. 使用中文

请直接返回总结内容，不要有任何额外的说明或格式。`;

    // 合并所有梦境描述
    const allPrompts = prompts.join('\n\n');

    // 调用LLM进行总结
    // 这里我们可以使用项目中已有的AI功能
    try {
      // 构建一个简单的总结，或者调用项目的AI功能
      // 先使用一个基础的总结逻辑，后续可以完善
      const summary = generateDreamSummary(prompts);
      
      return NextResponse.json({
        success: true,
        summary: summary
      });
    } catch (aiError) {
      console.error('AI总结失败:', aiError);
      // 如果AI调用失败，使用简单的总结
      const fallbackSummary = generateFallbackSummary(prompts);
      return NextResponse.json({
        success: true,
        summary: fallbackSummary
      });
    }
  } catch (error) {
    console.error('梦境总结API错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 生成梦境总结的辅助函数
function generateDreamSummary(prompts: string[]): string {
  if (prompts.length === 1) {
    return prompts[0];
  }

  // 提取关键词和主题
  const keywords: string[] = [];
  const emotions: string[] = [];
  
  prompts.forEach(prompt => {
    // 简单的关键词提取
    const words = prompt.split(/[，。！？,.!?\s]+/).filter(w => w.length > 1);
    keywords.push(...words.slice(0, 5));
  });

  // 去重
  const uniqueKeywords = [...new Set(keywords)].slice(0, 10);

  if (prompts.length === 2) {
    return `${prompts[0]}。随后，${prompts[1].length > 50 ? prompts[1].substring(0, 50) + '...' : prompts[1]}`;
  }

  return `这组梦境包含了${prompts.length}个片段，主要元素包括${uniqueKeywords.join('、')}等。整体呈现出丰富的想象力和内心世界的表达。`;
}

// 降级总结函数
function generateFallbackSummary(prompts: string[]): string {
  if (prompts.length === 1) {
    return prompts[0];
  }
  return `包含${prompts.length}个梦境片段的合集，展现了丰富的内心世界和想象力。`;
}
