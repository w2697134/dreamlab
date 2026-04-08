import { NextRequest, NextResponse } from 'next/server';
import { verifyLocalToken } from '@/lib/local-token';

// 删除梦境
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    
    // 使用本地 token 验证
    const tokenData = verifyLocalToken(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: '登录已过期，请重新登录' },
        { status: 401 }
      );
    }

    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const client = getSupabaseClient();

    const { id } = await params;

    // 【修复】检查ID格式，纯数字ID是本地数据，不需要操作数据库
    const isLocalId = /^\d+$/.test(id);
    if (isLocalId) {
      console.log('[API] 本地梦境删除请求，跳过数据库操作:', id);
      return NextResponse.json({
        success: true,
        message: '本地数据已删除',
      });
    }

    const { error } = await client
      .from('dreams')
      .delete()
      .eq('id', id)
      .eq('user_id', tokenData.userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '梦境已删除',
    });
  } catch (error) {
    console.error('删除梦境错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
