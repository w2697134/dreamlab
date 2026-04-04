import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/delete-draft
 * 删除用户的草稿数据（包括云端图片和数据库记录）
 */
export async function POST(request: NextRequest) {
  try {
    const { imageUrls } = await request.json();
    
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ success: true, message: '没有需要删除的数据' });
    }

    // 使用 Service Role Key 绕过 RLS
    const supabaseAdmin = createClient(
      process.env.COZE_SUPABASE_URL!,
      process.env.COZE_SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { timeout: 60000 },
      }
    );

    const bucketName = 'dream-images';
    let deletedFiles = 0;
    let deletedRecords = 0;

    // 1. 从 Supabase Storage 删除图片文件
    for (const imageUrl of imageUrls) {
      try {
        // 从 URL 中提取文件名
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];
        
        if (fileName) {
          const { error } = await supabaseAdmin
            .storage
            .from(bucketName)
            .remove([fileName]);
          
          if (!error) {
            deletedFiles++;
            console.log('[删除草稿] 删除文件:', fileName);
          } else {
            console.error('[删除草稿] 删除文件失败:', fileName, error);
          }
        }
      } catch (e) {
        console.error('[删除草稿] 解析 URL 失败:', imageUrl, e);
      }
    }

    // 2. 从数据库删除对应的 dreams 记录（未完成的草稿）
    const { data: draftDreams, error: findError } = await supabaseAdmin
      .from('dreams')
      .select('id')
      .in('image_url', imageUrls)
      .is('collection_id', null); // 只删除未加入梦境集的草稿

    if (findError) {
      console.error('[删除草稿] 查询草稿记录失败:', findError);
    } else if (draftDreams && draftDreams.length > 0) {
      const dreamIds = draftDreams.map(d => d.id);
      
      const { error: deleteError } = await supabaseAdmin
        .from('dreams')
        .delete()
        .in('id', dreamIds);
      
      if (deleteError) {
        console.error('[删除草稿] 删除数据库记录失败:', deleteError);
      } else {
        deletedRecords = dreamIds.length;
        console.log('[删除草稿] 删除数据库记录:', deletedRecords);
      }
    }

    return NextResponse.json({
      success: true,
      deletedFiles,
      deletedRecords,
      message: `已删除 ${deletedFiles} 个文件，${deletedRecords} 条记录`,
    });

  } catch (error) {
    console.error('[删除草稿] 错误:', error);
    return NextResponse.json(
      { error: '删除草稿失败', details: String(error) },
      { status: 500 }
    );
  }
}
