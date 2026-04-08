import { NextRequest, NextResponse } from 'next/server';
import { verifyLocalToken } from '@/lib/local-token';

/**
 * GET: 检查是否有孤立梦境
 * POST: 恢复孤立梦境
 */
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

    const userId = tokenData.userId;
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const client = getSupabaseClient();

    // 查找孤立的梦境（没有关联梦境集的）
    const { data: orphanDreams, error } = await client
      .from('dreams')
      .select('id, prompt, created_at')
      .is('collection_id', null)
      .eq('user_id', userId);

    if (error) {
      console.error('查询孤立梦境失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hasOrphanDreams: orphanDreams && orphanDreams.length > 0,
      orphanCount: orphanDreams?.length || 0,
      orphans: orphanDreams || [],
    });
  } catch (error) {
    console.error('检查孤立梦境失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

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

    const userId = tokenData.userId;
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const client = getSupabaseClient();

    // 查找孤立的梦境（没有关联梦境集的）
    const { data: orphanDreams, error: queryError } = await client
      .from('dreams')
      .select('*')
      .is('collection_id', null)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('查询孤立梦境失败:', queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!orphanDreams || orphanDreams.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '没有需要恢复的梦境数据',
        recovered: 0 
      });
    }

    // 创建新的梦境集
    const { data: newCollection, error: collectionError } = await client
      .from('dream_collections')
      .insert({
        user_id: userId,
        title: `已恢复的梦境 (${new Date().toLocaleDateString('zh-CN')})`,
        description: '从孤立梦境数据恢复',
        cover_url: orphanDreams[0]?.image_url,
        image_count: orphanDreams.length,
      })
      .select()
      .single();

    if (collectionError) {
      console.error('创建恢复梦境集失败:', collectionError);
      return NextResponse.json({ error: collectionError.message }, { status: 500 });
    }

    // 更新梦境数据，关联到新的梦境集
    const dreamIds = orphanDreams.map((d: any) => d.id);
    const { error: updateError } = await client
      .from('dreams')
      .update({ collection_id: newCollection.id })
      .in('id', dreamIds);

    if (updateError) {
      console.error('更新梦境关联失败:', updateError);
      // 回滚：删除刚创建的梦境集
      await client.from('dream_collections').delete().eq('id', newCollection.id);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[恢复] 成功恢复 ${orphanDreams.length} 个梦境到新梦境集 ${newCollection.id}`);

    return NextResponse.json({
      success: true,
      message: `成功恢复 ${orphanDreams.length} 个梦境`,
      collection: newCollection,
      recoveredCount: orphanDreams.length,
    });
  } catch (error) {
    console.error('恢复梦境失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
