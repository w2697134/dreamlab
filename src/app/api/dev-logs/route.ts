import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 日志文件路径
const LOG_PATHS = {
  app: '/app/work/logs/bypass/app.log',
  console: '/app/work/logs/bypass/console.log',
  dev: '/app/work/logs/bypass/dev.log'
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logType = searchParams.get('type') || 'app';
    const lines = parseInt(searchParams.get('lines') || '100');
    const filter = searchParams.get('filter') || '';
    
    const logPath = LOG_PATHS[logType as keyof typeof LOG_PATHS] || LOG_PATHS.app;
    
    // 检查文件是否存在
    if (!fs.existsSync(logPath)) {
      return NextResponse.json({ 
        logs: [], 
        error: `日志文件不存在: ${logPath}`,
        available: Object.keys(LOG_PATHS).filter(key => fs.existsSync(LOG_PATHS[key as keyof typeof LOG_PATHS]))
      });
    }
    
    // 读取日志文件
    const content = fs.readFileSync(logPath, 'utf-8');
    let logLines = content.split('\n').filter(line => line.trim());
    
    // 过滤日志
    if (filter) {
      logLines = logLines.filter(line => 
        line.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    // 取最后N行
    const recentLogs = logLines.slice(-lines);
    
    return NextResponse.json({ 
      logs: recentLogs,
      total: logLines.length,
      returned: recentLogs.length,
      logType,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[DevLogs] 读取日志失败:', error);
    return NextResponse.json({ 
      logs: [], 
      error: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const logType = searchParams.get('type') || 'app';
    
    const logPath = LOG_PATHS[logType as keyof typeof LOG_PATHS] || LOG_PATHS.app;
    
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '');
      return NextResponse.json({ success: true, message: '日志已清空' });
    }
    
    return NextResponse.json({ success: false, error: '日志文件不存在' }, { status: 404 });
    
  } catch (error) {
    console.error('[DevLogs] 清空日志失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 });
  }
}
