import { NextRequest, NextResponse } from 'next/server';
import { verifyLocalToken } from '@/lib/local-token';

// 清理URL中的引号
function cleanUrl(url: string | null | undefined): string {
  if (!url) return '';
  let cleanUrl = url.trim();
  if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || 
      (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
    cleanUrl = cleanUrl.slice(1, -1);
  }
  return cleanUrl;
}

// 获取用户的梦境集列表
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

    const userId = tokenData.userId;
    console.log('[API] 用户ID:', userId);

    // 检查环境变量
    const supabaseUrl = process.env.COZE_SUPABASE_URL;
    const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] 环境变量缺失:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseKey 
      });
      return NextResponse.json(
        { error: '服务器配置错误' },
        { status: 500 }
      );
    }
    
    console.log('[API] Supabase URL:', supabaseUrl);

    // 使用 Service Role Key 绕过 RLS，因为我们已经用本地 token 验证了用户身份
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { timeout: 60000 },
      }
    );

    // 查询用户的梦境集，并关联梦境内容（明确指定字段，避免schema缓存问题）
    const { data: collections, error } = await client
      .from('dream_collections')
      .select(`
        id,
        user_id,
        title,
        description,
        cover_url,
        has_video,
        image_count,
        created_at,
        dreams (
          id,
          prompt,
          image_url,
          video_url,
          dream_type,
          art_style,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取梦境集错误:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('[API] 查询到梦境集数量:', collections?.length || 0);
    if (collections && collections.length > 0) {
      console.log('[API] 第一个梦境集:', {
        id: collections[0].id,
        title: collections[0].title,
        dreams_count: collections[0].dreams?.length || 0,
        first_dream_image: collections[0].dreams?.[0]?.image_url
      });
    } else {
      console.log('[API] 未查询到任何梦境集，用户ID:', userId);
    }

    // 清理URL中的引号
    const cleanedCollections = (collections || []).map((collection: any) => ({
      ...collection,
      cover_url: cleanUrl(collection.cover_url),
      dreams: (collection.dreams || []).map((dream: any) => ({
        ...dream,
        image_url: cleanUrl(dream.image_url),
        video_url: cleanUrl(dream.video_url),
      }))
    }));

    return NextResponse.json({
      success: true,
      collections: cleanedCollections,
    });
  } catch (error) {
    console.error('获取梦境集错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 创建新的梦境集
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

    const userId = tokenData.userId;

    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const client = getSupabaseClient();

    const { title, description, coverUrl, dreams: dreamItems } = await request.json();

    if (!dreamItems || dreamItems.length === 0) {
      return NextResponse.json(
        { error: '梦境内容不能为空' },
        { status: 400 }
      );
    }

    // 创建梦境集
    const insertData: any = {
      user_id: userId,
      title: title || `梦境集 ${new Date().toLocaleDateString('zh-CN')}`,
      description: description || null,
      cover_url: coverUrl || dreamItems[0]?.imageUrl,
      has_video: dreamItems.some((d: any) => d.videoUrl),
      image_count: dreamItems.length,
    };
    
    const { data: collection, error: collectionError } = await client
      .from('dream_collections')
      .insert(insertData)
      .select()
      .single();

    if (collectionError) {
      console.error('创建梦境集错误:', collectionError);
      return NextResponse.json(
        { error: collectionError.message },
        { status: 500 }
      );
    }

    // 批量插入梦境
    const dreamsToInsert = dreamItems.map((dream: any) => ({
      user_id: userId,
      collection_id: collection.id,
      prompt: dream.prompt,
      image_url: dream.imageUrl,
      video_url: dream.videoUrl || null,
      dream_type: dream.dreamType || 'default',
      art_style: dream.artStyle || 'realistic',
    }));

    const { error: dreamsError } = await client
      .from('dreams')
      .insert(dreamsToInsert);

    if (dreamsError) {
      console.error('插入梦境错误:', dreamsError);
      // 回滚：删除已创建的梦境集
      await client.from('dream_collections').delete().eq('id', collection.id);
      return NextResponse.json(
        { error: dreamsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '梦境集创建成功',
      collection,
    });
  } catch (error) {
    console.error('创建梦境集错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 删除梦境集
export async function DELETE(request: NextRequest) {
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

    const userId = tokenData.userId;

    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const client = getSupabaseClient();

    // 从 URL 参数获取 collectionId
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');

    if (!collectionId) {
      return NextResponse.json(
        { error: '缺少梦境集ID' },
        { status: 400 }
      );
    }

    // 【修复】检查ID格式，纯数字ID是本地数据，不需要操作数据库
    const isLocalId = /^\d+$/.test(collectionId);
    if (isLocalId) {
      console.log('[API] 本地数据删除请求，跳过数据库操作:', collectionId);
      return NextResponse.json({
        success: true,
        message: '本地数据已删除',
      });
    }

    // 删除梦境集中的所有梦境
    await client.from('dreams').delete().eq('collection_id', collectionId);

    // 删除梦境集
    const { error } = await client
      .from('dream_collections')
      .delete()
      .eq('id', collectionId)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '梦境集删除成功',
    });
  } catch (error) {
    console.error('删除梦境集错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
