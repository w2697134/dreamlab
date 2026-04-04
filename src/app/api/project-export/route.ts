import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// 本地导出目录
const LOCAL_EXPORT_PATH = path.join(process.cwd(), 'public', 'exports');

// 确保本地导出目录存在
function ensureExportDir(): void {
  if (!fs.existsSync(LOCAL_EXPORT_PATH)) {
    fs.mkdirSync(LOCAL_EXPORT_PATH, { recursive: true });
  }
}

/**
 * GET /api/project-export
 * 生成并返回项目打包下载链接
 */
export async function GET(request: NextRequest) {
  try {
    const workspacePath = process.env.COZE_WORKSPACE_PATH || '/workspace/projects';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const tarFileName = `dream-project-${timestamp}.tar.gz`;
    
    // 使用本地目录存储
    ensureExportDir();
    const tarPath = path.join(LOCAL_EXPORT_PATH, tarFileName);

    console.log(`[项目导出] 开始打包项目到: ${tarPath}`);

    // 创建打包目录（排除不必要的文件）
    const excludeDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.coze'];
    
    // 使用 tar 打包（排除大文件和临时文件）
    const excludeArgs = excludeDirs.flatMap(d => ['--exclude', d]).join(' ');
    const tarCmd = `cd "${workspacePath}" && tar ${excludeArgs} -czf "${tarPath}" . 2>/dev/null`;
    
    try {
      execSync(tarCmd, { encoding: 'utf-8', timeout: 60000 });
    } catch (tarError) {
      console.error('[项目导出] tar 打包失败:', tarError);
      return NextResponse.json(
        { error: '打包失败，请重试' },
        { status: 500 }
      );
    }

    // 检查文件是否存在
    if (!fs.existsSync(tarPath)) {
      return NextResponse.json(
        { error: '打包文件未生成' },
        { status: 500 }
      );
    }

    const fileSize = fs.statSync(tarPath).size;
    console.log(`[项目导出] 打包完成，大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // 构建下载 URL
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'localhost:5000';
    const downloadUrl = `${protocol}://${host.replace(/^https?:\/\//, '')}/exports/${tarFileName}`;

    console.log(`[项目导出] 完成，下载链接已生成`);

    return NextResponse.json({
      success: true,
      filename: tarFileName,
      size: fileSize,
      downloadUrl,
      message: '项目打包成功，点击链接下载',
    });
  } catch (error) {
    console.error('[项目导出] 错误:', error);
    return NextResponse.json(
      { error: '导出失败，请重试' },
      { status: 500 }
    );
  }
}
