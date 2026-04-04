import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, adjustment, size = '2K' } = await request.json();
    
    if (!imageUrl || !adjustment) {
      return NextResponse.json({ error: '缺少图片或调整指令' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    // 使用图生图功能，在原图基础上进行调整
    const response = await client.generate({
      prompt: adjustment,
      image: imageUrl,
      size,
      watermark: false,
    });

    const helper = client.getResponseHelper(response);

    if (helper.success && helper.imageUrls.length > 0) {
      return NextResponse.json({ 
        success: true,
        imageUrl: helper.imageUrls[0]
      });
    } else {
      return NextResponse.json({ 
        success: false,
        errors: helper.errorMessages 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Image adjustment error:', error);
    return NextResponse.json({ 
      success: false,
      error: '图片调整失败，请稍后重试' 
    }, { status: 500 });
  }
}
