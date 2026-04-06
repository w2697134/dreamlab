import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { createWriteStream, statSync } from 'fs';
import archiver from 'archiver';

const pipelineAsync = promisify(pipeline);

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
    const zipFileName = `dream-project-${timestamp}.zip`;
    
    // 使用本地目录存储
    ensureExportDir();
    const zipPath = path.join(LOCAL_EXPORT_PATH, zipFileName);

    console.log(`[项目导出] 开始打包项目到: ${zipPath}`);

    // 排除不必要的文件
    const excludeDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.coze', 'exports'];
    
    // 使用 archiver 打包（跨平台兼容）
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('[项目导出] 警告:', err);
        } else {
          reject(err);
        }
      });
      
      archive.pipe(output);
      
      // 添加目录内容，排除指定文件夹
      archive.glob('**/*', {
        cwd: workspacePath,
        ignore: excludeDirs.map(d => `**/${d}/**`),
        dot: true,
      });
      
      archive.finalize();
    });

    // 检查文件是否存在
    if (!fs.existsSync(zipPath)) {
      return NextResponse.json(
        { error: '打包文件未生成' },
        { status: 500 }
      );
    }

    const fileSize = fs.statSync(zipPath).size;
    console.log(`[项目导出] 打包完成，大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // 构建下载 URL
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'localhost:5000';
    const downloadUrl = `${protocol}://${host.replace(/^https?:\/\//, '')}/exports/${zipFileName}`;

    console.log(`[项目导出] 完成，下载链接已生成`);

    return NextResponse.json({
      success: true,
      filename: zipFileName,
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
