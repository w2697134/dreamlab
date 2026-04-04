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

    // 使用千问模型生成视频描述（千问暂不支持视频生成，返回描述文本）
    const response = await (client as any).invoke([
      { role: 'system', content: '你是一个视频生成助手。请根据用户提供的图片和描述，生成一个视频创意描述。' },
      { role: 'user', content: prompt || '根据图片生成视频' }
    ], {
      model: 'qwen3.5 9b',
      temperature: 0.7,
    });
    
    // 千问不支持视频生成，返回模拟响应
    const mockResponse = {
      videoUrl: null,
      message: '千问模型暂不支持视频生成功能，仅返回文本描述：' + response.content
    };

    // 千问不支持视频生成，返回提示信息
    return NextResponse.json({ 
      success: false,
      error: '千问模型暂不支持视频生成功能，请使用其他视频生成服务',
      message: mockResponse.message
    }, { status: 501 })
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json({ 
      success: false,
      error: '视频生成失败，请稍后重试' 
    }, { status: 500 });
  }
}
