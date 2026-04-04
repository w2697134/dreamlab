import { NextRequest, NextResponse } from 'next/server';
import { verifyLocalToken, refreshLocalToken, createLocalToken } from '@/lib/local-token';

// 刷新 Token
export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: '缺少 token' },
        { status: 400 }
      );
    }

    // 验证并刷新本地 token
    const data = verifyLocalToken(refreshToken);
    
    if (!data) {
      return NextResponse.json(
        { error: 'Token 无效或已过期' },
        { status: 401 }
      );
    }

    // 生成新的 token
    const newToken = refreshLocalToken(refreshToken);
    
    if (!newToken) {
      return NextResponse.json(
        { error: 'Token 刷新失败' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      accessToken: newToken,
      refreshToken: newToken,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
  } catch (error) {
    console.error('刷新 Token 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
