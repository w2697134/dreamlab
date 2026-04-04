import { NextRequest, NextResponse } from 'next/server';
import { interruptAllSDGenerations } from '@/lib/sd-config';

/**
 * POST /api/interrupt-generation
 * 中断所有 SD 实例的生成任务
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[API] 收到中断生成请求');
    
    const results = await interruptAllSDGenerations();
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    return NextResponse.json({
      success: true,
      message: `已中断 ${successCount}/${totalCount} 个实例的生成任务`,
      results,
    });
  } catch (error) {
    console.error('[API] 中断生成出错:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '中断生成失败' 
      },
      { status: 500 }
    );
  }
}
