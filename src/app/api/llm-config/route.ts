import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'llm-config.json');

// 默认配置
const DEFAULT_LLM_CONFIG = {
  name: '千问 (Qwen)',
  url: 'http://qwen.cpolar.top/v1',
  model: 'qwen3.5 9b',
};

// 确保数据目录存在
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// 读取配置
function readConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {
      ...DEFAULT_LLM_CONFIG,
      failoverEnabled: process.env.LLM_FAILOVER_TO_KIMI === 'true',
      primaryProvider: 'qwen',
      backupProvider: 'kimi',
    };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {
      ...DEFAULT_LLM_CONFIG,
      failoverEnabled: process.env.LLM_FAILOVER_TO_KIMI === 'true',
      primaryProvider: 'qwen',
      backupProvider: 'kimi',
    };
  }
}

// 保存配置
function saveConfig(config: any) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// GET /api/llm-config - 获取LLM配置
export async function GET() {
  try {
    const config = readConfig();
    return new Response(JSON.stringify({
      success: true,
      config,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[LLM配置] 读取失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '读取配置失败',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/llm-config - 更新LLM配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentConfig = readConfig();
    
    const newConfig = {
      ...currentConfig,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    saveConfig(newConfig);
    
    console.log('[LLM配置] 已更新:', newConfig);
    
    return new Response(JSON.stringify({
      success: true,
      config: newConfig,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[LLM配置] 保存失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '保存配置失败',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// DELETE /api/llm-config - 删除LLM配置
export async function DELETE() {
  try {
    const currentConfig = readConfig();
    
    // 清空LLM配置，保留故障转移设置
    const newConfig = {
      ...currentConfig,
      name: '',
      url: '',
      model: '',
      isAvailable: false,
      updatedAt: new Date().toISOString(),
    };
    
    saveConfig(newConfig);
    
    console.log('[LLM配置] 已删除');
    
    return new Response(JSON.stringify({
      success: true,
      config: newConfig,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[LLM配置] 删除失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '删除配置失败',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
