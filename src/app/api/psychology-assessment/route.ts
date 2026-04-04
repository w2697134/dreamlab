import { NextRequest, NextResponse } from 'next/server';
import { verifyLocalToken } from '@/lib/local-token';
import { createClient } from '@supabase/supabase-js';

// 保存心理评估结果
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const tokenData = verifyLocalToken(token);
    if (!tokenData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    // 使用 Service Role Key 绕过 RLS
    const client = createClient(
      process.env.COZE_SUPABASE_URL!,
      process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { timeout: 60000 },
      }
    );

    const {
      dream_id,
      collection_id,
      stress_level,
      emotion_state,
      coping_style,
      suggestions,
      answers,
      questions,
    } = await request.json();

    const { data, error } = await client
      .from('psychology_assessments')
      .insert({
        user_id: tokenData.userId,
        dream_id,
        collection_id,
        stress_level,
        emotion_state,
        coping_style,
        suggestions,
        answers,
        questions,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, assessment: data });
  } catch (error) {
    console.error('保存评估结果错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// 获取心理评估结果
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const tokenData = verifyLocalToken(token);
    if (!tokenData) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dreamId = searchParams.get('dream_id');
    const collectionId = searchParams.get('collection_id');

    // 使用 Service Role Key 绕过 RLS
    const client = createClient(
      process.env.COZE_SUPABASE_URL!,
      process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { timeout: 60000 },
      }
    );

    let query = client
      .from('psychology_assessments')
      .select('*')
      .eq('user_id', tokenData.userId);

    if (dreamId) {
      query = query.eq('dream_id', dreamId);
    }
    if (collectionId) {
      query = query.eq('collection_id', collectionId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, assessments: data });
  } catch (error) {
    console.error('获取评估结果错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
