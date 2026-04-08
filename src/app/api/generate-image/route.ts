import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { prompt, size = '2K' } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: '请输入描述内容' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    // 使用 batchGenerate 并行生成 4 张图片
    const requests = [
      { prompt, size, watermark: false },
      { prompt, size, watermark: false },
      { prompt, size, watermark: false },
      { prompt, size, watermark: false },
    ];
    const responses = await client.batchGenerate(requests);
    
    const allImageUrls: string[] = [];
    const allErrors: string[] = [];
    for (const response of responses) {
      const helper = client.getResponseHelper(response);
      if (helper.success && helper.imageUrls.length > 0) {
        allImageUrls.push(helper.imageUrls[0]);
      } else {
        allErrors.push(...helper.errorMessages);
      }
    }

    console.log('Batch generated images count:', allImageUrls.length);

    if (allImageUrls.length > 0) {
      return NextResponse.json({ 
        success: true,
        imageUrls: allImageUrls,
        count: allImageUrls.length
      });
    } else {
      return NextResponse.json({ 
        success: false,
        errors: allErrors 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ 
      success: false,
      error: '图片生成失败，请稍后重试' 
    }, { status: 500 });
  }
}
