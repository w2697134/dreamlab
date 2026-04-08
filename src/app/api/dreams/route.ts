import { NextRequest, NextResponse } from 'next/server';
import { verifyLocalToken } from '@/lib/local-token';

// 获取当前用户的梦境列表
export async function GET(request: NextRequest) {
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

    // 查询用户的梦境
    const { data: dreams, error } = await client
      .from('dreams')
      .select('*')
      .eq('user_id', tokenData.userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      dreams: dreams || [],
    });
  } catch (error) {
    console.error('获取梦境错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 创建新梦境
export async function POST(request: NextRequest) {
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

    const { prompt, image_url, video_url, dream_type, art_style } = await request.json();

    if (!prompt || !image_url) {
      return NextResponse.json(
        { error: '梦境描述和图片不能为空' },
        { status: 400 }
      );
    }

    const { data: dream, error } = await client
      .from('dreams')
      .insert({
        user_id: tokenData.userId,
        prompt,
        image_url,
        video_url: video_url || null,
        dream_type: dream_type || 'default',
        art_style: art_style || 'realistic',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '梦境保存成功',
      dream,
    });
  } catch (error) {
    console.error('创建梦境错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
