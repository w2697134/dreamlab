import { NextRequest, NextResponse } from 'next/server';
import { VideoGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageUrl, imageUrls, duration = 5 } = await request.json();
    
    // 支持单图或多图
    const urls = imageUrls || (imageUrl ? [imageUrl] : []);
    
    if (!prompt && urls.length === 0) {
      return NextResponse.json({ error: '请提供描述或图片' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new VideoGenerationClient(config, customHeaders);

    const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string }; role?: 'first_frame' }> = [];

    // 使用第一张图片作为首帧
    if (urls.length > 0) {
      content.push({
        type: 'image_url',
        image_url: { url: urls[0] },
        role: 'first_frame',
      });
    }

    if (prompt) {
      content.push({
        type: 'text',
        text: prompt,
      });
    }

    // 视频生成功能暂未实现
    // const response = await client.invoke(...)
    
    // 视频生成功能暂未实现
    return NextResponse.json({ 
      success: false,
      error: '视频生成功能暂未实现，敬请期待',
    }, { status: 501 })
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json({ 
      success: false,
      error: '视频生成失败，请稍后重试' 
    }, { status: 500 });
  }
}
