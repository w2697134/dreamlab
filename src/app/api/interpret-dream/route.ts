import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

const INTERPRET_PROMPT = `你是梦境图像分析师，你的任务是：
1. 根据用户描述和画面参数，生成独特的画面解读
2. 每张图片的光线、视角、氛围不同，解读也要不同
3. 提取的关键词必须来自用户的原始描述

【画面参数说明】
- 光线：晨曦(dawn)、正午(noon)、黄昏(dusk)、夜晚(night)、暮色(twilight)
- 视角：近景(close)、中景(medium)、远景(far)、鸟瞰(birds)、仰视(worm)
- 氛围：宁静(peaceful)、神秘(mysterious)、温馨(warm)、忧郁(melancholy)、魔幻(magical)、孤独(lonely)、空灵(ethereal)

【核心原则】
- 关键词必须从用户输入中提取，保持真实性
- 解读必须与用户描述的内容和画面参数相关
- 不同光线/氛围的图片，解读角度要不同
- 不要添加用户没有提到的元素

【输出格式】
必须包含以下三个部分：

## 梦境关键词
[列出用户描述中的核心元素，包括：场景、人物、物品、颜色、光线等，用 | 分隔]

## 画面解读
[基于用户描述和画面参数解读其心理意义，50字以内，要体现画面特色]

## 情绪标签
[基于用户描述和画面氛围推断的情绪，不超过3个，用 | 分隔]

【规则】
1. 噩梦→负面情绪：恐惧、焦虑、不安、压迫
2. 美梦→正面情绪：平静、幸福、温馨、期待
3. 奇幻梦→神秘、惊奇、超现实
4. 直接输出，无标题格式，每部分用空行分隔`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, lightMood, perspective, atmosphere, userDescription, uploadedImages } = await request.json();
    
    // 用户原始输入优先
    const userInput = userDescription || prompt;
    const hasUploadedImage = uploadedImages && uploadedImages.length > 0;
    
    if (!userInput && !hasUploadedImage) {
      return NextResponse.json({ error: '缺少用户描述' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const client = new LLMClient(new Config(), customHeaders);

    // 光线名称映射
    const lightMoodNames: Record<string, string> = {
      dawn: '晨曦',
      noon: '正午',
      dusk: '黄昏',
      night: '夜晚',
      twilight: '暮色',
      midnight: '午夜'
    };
    
    // 氛围名称映射
    const atmosphereNames: Record<string, string> = {
      peaceful: '宁静',
      mysterious: '神秘',
      warm: '温馨',
      melancholy: '忧郁',
      magical: '魔幻',
      lonely: '孤独',
      ethereal: '空灵',
      surreal: '超现实'
    };
    
    // 视角名称映射
    const perspectiveNames: Record<string, string> = {
      close: '近景特写',
      medium: '中景',
      far: '远景',
      birds: '鸟瞰视角',
      worm: '仰视视角'
    };

    // 构建用户内容 - 以用户输入为主，结合画面参数
    let userContent = `【用户原始描述】\n${userInput}\n`;
    
    if (hasUploadedImage) {
      userContent += `\n【参考图片】用户上传了 ${uploadedImages.length} 张图片作为参考`;
    }
    
    // 加入每张图片独特的画面参数
    if (lightMood) {
      userContent += `\n【这张图的光线】${lightMoodNames[lightMood] || lightMood}`;
    }
    if (atmosphere) {
      userContent += `\n【这张图的氛围】${atmosphereNames[atmosphere] || atmosphere}`;
    }
    if (perspective) {
      userContent += `\n【这张图的视角】${perspectiveNames[perspective] || perspective}`;
    }
    
    // 强调解读要结合画面参数
    userContent += `\n\n请根据【用户原始描述】和【画面参数】（光线、氛围、视角）生成独特的画面解读。`;
    userContent += `\n如果光线是夜晚，解读要体现夜色氛围；如果氛围是神秘，解读要突出神秘感。`;

    console.log('[梦境解读] 用户输入:', userInput);
    console.log('[梦境解读] 画面参数:', { lightMood, perspective, atmosphere });

    const messages = [
      { role: 'system' as const, content: INTERPRET_PROMPT },
      { role: 'user' as const, content: userContent }
    ];

    // 使用 AbortController 实现真正的超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25秒超时
    
    let response;
    try {
      response = await client.invoke(messages, {
        model: 'qwen3.5 9b',
        temperature: 0.7,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    
    if (response.content) {
      // 从返回内容中解析关键词
      const content = response.content.trim();
      const keywords: string[] = [];
      const emotionTags: string[] = [];
      
      // 提取梦境关键词部分
      const keywordMatch = content.match(/梦境关键词[\s\S]*?(?=画面解读|$)/i);
      if (keywordMatch) {
        const kwText = keywordMatch[0]
          .replace(/梦境关键词/gi, '')
          .replace(/[#*]/g, '')
          .trim();
        // 按 | 分隔提取
        const parts = kwText.split(/[|]/).map(s => s.trim()).filter(Boolean);
        keywords.push(...parts);
      }
      
      // 提取情绪标签
      const emotionMatch = content.match(/情绪标签[\s\S]*?$/i);
      if (emotionMatch) {
        const emText = emotionMatch[0]
          .replace(/情绪标签/gi, '')
          .replace(/[#*]/g, '')
          .trim();
        const parts = emText.split(/[|]/).map(s => s.trim()).filter(Boolean);
        emotionTags.push(...parts);
      }
      
      console.log('[梦境解读] 解读结果:', content.substring(0, 100) + '...');
      
      return NextResponse.json({ 
        success: true,
        interpretation: content,
        keywords: keywords.slice(0, 6),
        emotionTags: emotionTags.slice(0, 3)
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: '解读生成失败' 
    }, { status: 500 });
  } catch (error: any) {
    console.error('Dream interpretation error:', error);
    
    // 超时错误返回 504
    if (error.message?.includes('超时')) {
      return NextResponse.json({ 
        success: false, 
        error: '解读服务响应超时，请稍后重试',
        interpretation: '梦境解读暂时不可用，请稍后重试',
        keywords: [],
        emotionTags: []
      }, { status: 504 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: '解读服务暂时不可用',
      interpretation: '梦境解读服务暂时不可用',
      keywords: [],
      emotionTags: []
    }, { status: 500 });
  }
}
