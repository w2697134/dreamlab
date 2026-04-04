import { NextRequest, NextResponse } from "next/server";

// 草稿数据类型
interface DraftData {
  currentPrompt?: string;
  selectedKeywords?: string[];
  selectedSceneElements?: string[];
  uploadedImages?: any[];
  generatedImages?: any[];
  selectedImages?: any[];
  artStyle?: string;
  dreamType?: string;
  timestamp?: number;
}

// 使用 localStorage 的替代方案：在服务端用内存存储（开发环境）
// 生产环境应该用数据库
// key格式：user_{userId} 或 anonymous
const draftStore = new Map<string, DraftData>();

// 生成草稿存储key
const getDraftKey = (userId?: string | null) => {
  if (userId) {
    return `user_${userId}`;
  }
  return 'anonymous';
};

export async function POST(request: NextRequest) {
  try {
    const { userId, draft } = await request.json();
    
    const key = getDraftKey(userId);
    
    // 保存草稿
    draftStore.set(key, {
      ...draft,
      timestamp: Date.now(),
    });
    
    console.log('[草稿] 已保存到后端:', key);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[草稿] 保存失败:', error);
    return NextResponse.json({ success: false, error: '保存失败' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    const key = getDraftKey(userId);
    const draft = draftStore.get(key);
    
    if (draft) {
      // 检查是否过期（24小时）
      if (Date.now() - (draft.timestamp || 0) < 24 * 60 * 60 * 1000) {
        console.log('[草稿] 从后端读取:', key);
        return NextResponse.json({ success: true, draft });
      } else {
        console.log('[草稿] 草稿已过期');
        draftStore.delete(key);
      }
    }
    
    return NextResponse.json({ success: true, draft: null });
  } catch (error) {
    console.error('[草稿] 读取失败:', error);
    return NextResponse.json({ success: false, error: '读取失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    const key = getDraftKey(userId);
    draftStore.delete(key);
    
    console.log('[草稿] 已删除:', key);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[草稿] 删除失败:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
