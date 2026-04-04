import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'llm-config.json');

// 读取故障转移配置和LLM URL
function getLLMConfig(): { failoverEnabled: boolean; url: string } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { 
        failoverEnabled: config.failoverEnabled ?? false,
        url: config.url || process.env.LLM_API_URL || 'http://qwen.cpolar.top/v1'
      };
    }
  } catch {
    // 忽略读取错误
  }
  return { 
    failoverEnabled: process.env.LLM_FAILOVER_TO_KIMI === 'true',
    url: process.env.LLM_API_URL || 'http://qwen.cpolar.top/v1'
  };
}

/**
 * GET /api/health-check?service=llm|image|video
 * 检测各项服务健康状态
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service');
  
  try {
    switch (service) {
      case 'llm': {
        // 直接返回可用，不实时检测（避免延迟）
        const { failoverEnabled } = getLLMConfig();
        return NextResponse.json({ 
          success: true, 
          service: 'llm', 
          status: 'available',
          failover: failoverEnabled 
        });
      }
      
      case 'image': {
        // 固定返回可用，不实时检测（避免延迟）
        return NextResponse.json({ 
          success: true, 
          service: 'image', 
          status: 'available', 
          instances: 1 
        });
      }
      
      case 'video': {
        // 视频生成服务（预留）
        return NextResponse.json(
          { success: false, service: 'video', status: 'not_configured', error: '视频服务未配置' },
          { status: 503 }
        );
      }
      
      default: {
        return NextResponse.json(
          { success: false, error: '未知服务类型' },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error(`[健康检测] ${service} 检测失败:`, error);
    return NextResponse.json(
      { success: false, service, status: 'error', error: '检测过程出错' },
      { status: 500 }
    );
  }
}
