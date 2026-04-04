import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { createMemoryClient, shouldUseMemoryDB } from '@/lib/memory-db';

let envLoaded = false;
let usingMemoryDB = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

function loadEnv(): void {
  if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
    envLoaded = true;
    return;
  }

  if (envLoaded) {
    return;
  }

  try {
    // Try dotenv first
    try {
      require('dotenv').config();
      if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
        envLoaded = true;
        console.log('[Supabase] Environment loaded from dotenv');
        return;
      }
    } catch {
      // dotenv not available
    }

    // Try coze_workload_identity
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    let loadedCount = 0;
    for (const line of lines) {
      if (line.startsWith('#') || line.startsWith('Error')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
          if (key === 'COZE_SUPABASE_URL' || key === 'COZE_SUPABASE_ANON_KEY') {
            loadedCount++;
          }
        }
      }
    }

    if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
      envLoaded = true;
      console.log(`[Supabase] Environment loaded from coze_workload_identity (${loadedCount} keys)`);
    }
  } catch (error) {
    console.error('[Supabase] Failed to load environment:', error);
  }
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadEnv();

  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('COZE_SUPABASE_URL is not set');
  }
  if (!anonKey) {
    throw new Error('COZE_SUPABASE_ANON_KEY is not set');
  }

  return { url, anonKey };
}

function createRealSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  if (token) {
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      db: {
        timeout: 60000,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return createClient(url, anonKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// 获取客户端（自动判断使用 Supabase 还是内存数据库）
export function getSupabaseClient(token?: string): any {
  loadEnv();
  
  // 检查是否应该使用内存数据库
  if (shouldUseMemoryDB()) {
    if (!usingMemoryDB) {
      usingMemoryDB = true;
      console.log('[数据库] ⚠️ 使用内存数据库模式（数据将在服务器重启后丢失）');
      console.log('[数据库] 如需持久化存储，请设置 COZE_SUPABASE_URL 和 COZE_SUPABASE_ANON_KEY');
    }
    return createMemoryClient(token);
  }

  try {
    return createRealSupabaseClient(token);
  } catch (error) {
    console.error('[Supabase] 连接失败，切换到内存数据库:', error);
    if (!usingMemoryDB) {
      usingMemoryDB = true;
      console.log('[数据库] ⚠️ 已切换到内存数据库模式');
    }
    return createMemoryClient(token);
  }
}

export { loadEnv, getSupabaseCredentials };
