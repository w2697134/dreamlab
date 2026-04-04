import { NextResponse } from 'next/server';

/**
 * 健康检查端点
 * 用于检测服务是否存活
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
