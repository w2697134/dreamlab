import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();

    console.log('[清空梦境] 开始清空所有梦境数据...');

    // 1. 删除所有梦境
    const { error: dreamsError } = await client
      .from('dreams')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录

    if (dreamsError) {
      console.error('[清空梦境] 删除梦境失败:', dreamsError);
      return NextResponse.json(
        { error: '删除梦境失败', details: dreamsError.message },
        { status: 500 }
      );
    }

    // 2. 删除所有梦境集
    const { error: collectionsError } = await client
      .from('dream_collections')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录

    if (collectionsError) {
      console.error('[清空梦境] 删除梦境集失败:', collectionsError);
      return NextResponse.json(
        { error: '删除梦境集失败', details: collectionsError.message },
        { status: 500 }
      );
    }

    // 3. 删除所有梦境会话
    const { error: sessionsError } = await client
      .from('dream_sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录

    if (sessionsError) {
      console.error('[清空梦境] 删除梦境会话失败:', sessionsError);
      // 这个失败不影响主要功能，继续执行
    }

    console.log('[清空梦境] 所有梦境数据已清空！');

    return NextResponse.json({
      success: true,
      message: '所有梦境数据已清空！',
    });
  } catch (error) {
    console.error('[清空梦境] 清空失败:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
