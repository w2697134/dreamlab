import { NextRequest, NextResponse } from 'next/server';

// 全局进度存储（用于跨标签页同步进度）
// 注意：在无服务器环境中，这个存储在冷启动时会重置
// 但它可以用于处理标签页切换时的临时状态同步
const progressCache = new Map<string, {
  progress: number;
  message: string;
  stage: string;
  timestamp: number;
  isGenerating: boolean;
}>();

// 定期清理过期数据（保留30分钟前的数据）
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30分钟
  for (const [sessionId, data] of progressCache.entries()) {
    if (now - data.timestamp > maxAge) {
      progressCache.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // 每5分钟检查一次

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return NextResponse.json({
      error: 'sessionId is required',
    }, { status: 400 });
  }
  
  const cached = progressCache.get(sessionId);
  
  if (!cached) {
    return NextResponse.json({
      progress: 0,
      message: '',
      stage: '',
      isGenerating: false,
    });
  }
  
  // 计算从缓存时间到现在过去了多久
  const elapsed = Date.now() - cached.timestamp;
  
  return NextResponse.json({
    progress: cached.progress,
    message: cached.message,
    stage: cached.stage,
    isGenerating: cached.isGenerating,
    elapsed,
  });
}

// 更新进度（供内部使用）
export async function POST(request: NextRequest) {
  try {
    const { sessionId, progress, message, stage, isGenerating } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json({
        error: 'sessionId is required',
      }, { status: 400 });
    }
    
    progressCache.set(sessionId, {
      progress,
      message,
      stage,
      timestamp: Date.now(),
      isGenerating,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      error: 'Invalid request',
    }, { status: 400 });
  }
}
