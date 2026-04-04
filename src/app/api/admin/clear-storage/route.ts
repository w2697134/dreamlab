import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * POST /api/admin/clear-storage
 * 清空 Supabase 存储桶中的所有图片（管理员接口）
 */
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限（简单检查，实际应该更严格）
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    const client = getSupabaseClient();
    const bucketName = 'dream-images';

    // 1. 获取存储桶中的所有文件
    const { data: files, error: listError } = await client
      .storage
      .from(bucketName)
      .list('', {
        limit: 1000,
        offset: 0,
      });

    if (listError) {
      console.error('[清空存储] 获取文件列表失败:', listError);
      return NextResponse.json(
        { error: '获取文件列表失败: ' + listError.message },
        { status: 500 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json({
        success: true,
        message: '存储桶为空，无需清理',
        deletedCount: 0,
      });
    }

    // 2. 删除所有文件
    const filePaths = files.map((file: { name: string }) => file.name);
    const { data: deleteData, error: deleteError } = await client
      .storage
      .from(bucketName)
      .remove(filePaths);

    if (deleteError) {
      console.error('[清空存储] 删除文件失败:', deleteError);
      return NextResponse.json(
        { error: '删除文件失败: ' + deleteError.message },
        { status: 500 }
      );
    }

    console.log(`[清空存储] 成功删除 ${filePaths.length} 个文件`);

    return NextResponse.json({
      success: true,
      message: `成功删除 ${filePaths.length} 个文件`,
      deletedCount: filePaths.length,
      deletedFiles: filePaths,
    });

  } catch (error) {
    console.error('[清空存储] 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/clear-storage
 * 获取存储桶状态
 */
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const bucketName = 'dream-images';

    const { data: files, error } = await client
      .storage
      .from(bucketName)
      .list('', {
        limit: 1000,
        offset: 0,
      });

    if (error) {
      return NextResponse.json(
        { error: '获取存储状态失败: ' + error.message },
        { status: 500 }
      );
    }

    // 计算总大小
    let totalSize = 0;
    files?.forEach((file: { metadata?: { size?: number } }) => {
      totalSize += file.metadata?.size || 0;
    });

    return NextResponse.json({
      success: true,
      bucket: bucketName,
      fileCount: files?.length || 0,
      totalSize: totalSize,
      files: files?.map((f: { name: string; metadata?: { size?: number }; created_at?: string }) => ({
        name: f.name,
        size: f.metadata?.size || 0,
        createdAt: f.created_at,
      })) || [],
    });

  } catch (error) {
    console.error('[存储状态] 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
