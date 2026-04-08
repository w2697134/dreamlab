/**
 * Supabase Admin 客户端
 * 使用 Service Role Key 绕过 RLS
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.COZE_SUPABASE_URL || '';
const serviceRoleKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[Supabase Admin] 缺少配置');
}

// 创建 admin 客户端（绕过 RLS）
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
