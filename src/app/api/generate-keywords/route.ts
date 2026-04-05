import { NextRequest, NextResponse } from 'next/server';
import { invokeQwen } from '@/lib/qwen-client';

// 关键词黑名单（不显示的关键词）
const KEYWORD_BLACKLIST: string[] = [
  // 用户反馈的关键词可以添加到这里
];

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json();
    
    if (!keyword) {
      return NextResponse.json({ error: '缺少关键词' }, { status: 400 });
    }

    const messages = [
      {
        role: 'user' as const,
        content: `基于关键词「${keyword}」，发散联想生成30个梦境相关关键词。

【联想方向】
1. 视觉场景（地点、环境、物体）
2. 光影氛围（晨曦、星光、烛光等）
3. 情绪感受（温暖、孤独、恐惧等）
4. 动态元素（漂浮、坠落、流动等）
5. 抽象概念（时间、记忆、梦境等）

【要求】
- 每个关键词2-4个字
- 诗意、有画面感
- 用逗号分隔，直接返回列表
- 不要解释，不要序号
- 不要出现生理不适相关词汇

【示例】

输入：飞翔
输出：云海, 御风, 俯瞰大地, 自由, 翅膀, 气流, 天空, 坠落恐惧, 飘渺, 鸟瞰

输入：森林
输出：迷雾, 古树, 萤火虫, 苔藓, 幽深, 鸟鸣, 精灵, 迷路, 晨雾, 树影

输入：大海
输出：浪潮, 深蓝, 沉没, 月光, 贝壳, 漂流, 远方, 泡沫, 鲸鱼, 盐风

请直接返回关键词（用逗号分隔）：`
      }
    ];

    const response = await invokeQwen(messages, {
      model: 'qwen3.5 9b',
      temperature: 0.9
    });

    // 关键词生成日志已隐藏

    // 解析关键词
    const keywords = response.content
      .split(/[,，、\n]/)
      .map(k => k.trim())
      .filter(k => k.length > 0 && k.length <= 6)
      .filter(k => !KEYWORD_BLACKLIST.some(banned => k.includes(banned)))  // 过滤黑名单
      .slice(0, 30);

    return NextResponse.json({
      success: true,
      keywords,
      provider: response.provider
    });
  } catch (error) {
    console.error('Keyword generation error:', error);
    return NextResponse.json({
      success: false,
      error: '关键词生成失败'
    }, { status: 500 });
  }
}
