import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface CodeAction {
  type: 'read' | 'edit' | 'create' | 'delete';
  filePath: string;
  content?: string;
  oldContent?: string;
  description: string;
}

// 获取项目根目录
function getProjectRoot(): string {
  return process.env.COZE_WORKSPACE_PATH || '/workspace/projects';
}

// 确保目录存在
function ensureDir(dirPath: string): void {
  const fullPath = path.join(getProjectRoot(), dirPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
}

// 读取文件
function readFile(filePath: string): { success: boolean; content?: string; error?: string } {
  try {
    const fullPath = path.join(getProjectRoot(), filePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: '文件不存在' };
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// 创建文件
function createFile(filePath: string, content: string): { success: boolean; error?: string } {
  try {
    const fullPath = path.join(getProjectRoot(), filePath);
    const dir = path.dirname(fullPath);
    ensureDir(dir);
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// 编辑文件（替换指定内容）
function editFile(
  filePath: string, 
  oldContent: string, 
  newContent: string
): { success: boolean; error?: string } {
  try {
    const fullPath = path.join(getProjectRoot(), filePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: '文件不存在' };
    }
    
    let fileContent = fs.readFileSync(fullPath, 'utf-8');
    
    // 如果指定了 oldContent，使用精确替换
    if (oldContent) {
      if (!fileContent.includes(oldContent)) {
        return { success: false, error: '未找到要替换的内容' };
      }
      fileContent = fileContent.replace(oldContent, newContent);
    } else {
      // 否则追加到文件末尾
      fileContent += '\n' + newContent;
    }
    
    fs.writeFileSync(fullPath, fileContent, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// 删除文件
function deleteFile(filePath: string): { success: boolean; error?: string } {
  try {
    const fullPath = path.join(getProjectRoot(), filePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: '文件不存在' };
    }
    fs.unlinkSync(fullPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actions } = await request.json();
    
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少操作列表' 
      }, { status: 400 });
    }

    const results: Array<{
      type: string;
      filePath: string;
      success: boolean;
      error?: string;
    }> = [];

    // 执行每个操作
    for (const action of actions) {
      const { type, filePath, content, oldContent } = action as CodeAction;
      
      console.log(`[代码执行] ${type}: ${filePath}`);
      
      let result: { success: boolean; error?: string };
      
      switch (type) {
        case 'read':
          result = readFile(filePath);
          break;
        case 'create':
          result = createFile(filePath, content || '');
          break;
        case 'edit':
          result = editFile(filePath, oldContent || '', content || '');
          break;
        case 'delete':
          result = deleteFile(filePath);
          break;
        default:
          result = { success: false, error: `未知操作类型: ${type}` };
      }
      
      results.push({
        type,
        filePath,
        success: result.success,
        error: result.error,
      });
      
      if (!result.success) {
        console.error(`[代码执行] 失败: ${type} ${filePath} - ${result.error}`);
      }
    }

    const allSuccess = results.every(r => r.success);
    
    return NextResponse.json({
      success: allSuccess,
      results,
      error: allSuccess ? undefined : '部分操作失败',
    });
  } catch (error) {
    console.error('[代码执行] 错误:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}
