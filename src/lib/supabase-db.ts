/**
 * Supabase 数据库客户端
 * 替代内存数据库，数据持久化到 Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.COZE_SUPABASE_URL || '';
const supabaseKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[Supabase DB] 缺少配置，请检查环境变量');
}

// 创建 Supabase 客户端
export const supabaseDB = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 用户相关操作
export const dbUsers = {
  async findByUsername(username: string) {
    const { data, error } = await supabaseDB
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle();
    
    if (error) {
      console.error('[DB] 查找用户失败:', error);
      return null;
    }
    return data;
  },

  async findById(id: string) {
    const { data, error } = await supabaseDB
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) {
      console.error('[DB] 查找用户失败:', error);
      return null;
    }
    return data;
  },

  async create(user: any) {
    const { data, error } = await supabaseDB
      .from('profiles')
      .insert(user)
      .select()
      .single();
    
    if (error) {
      console.error('[DB] 创建用户失败:', error);
      return { data: null, error };
    }
    return { data, error: null };
  },

  // 兼容内存DB的接口
  select(columns?: string) {
    return {
      eq: (field: string, value: string) => ({
        maybeSingle: async () => {
          const { data, error } = await supabaseDB
            .from('profiles')
            .select(columns || '*')
            .eq(field, value)
            .maybeSingle();
          return { data, error };
        },
        single: async () => {
          const { data, error } = await supabaseDB
            .from('profiles')
            .select(columns || '*')
            .eq(field, value)
            .single();
          return { data, error };
        },
      }),
    };
  },

  async insert(data: any | any[]) {
    const items = Array.isArray(data) ? data : [data];
    const { error } = await supabaseDB
      .from('profiles')
      .insert(items);
    
    if (error) {
      console.error('[DB] 插入用户失败:', error);
    }
    return { error };
  },
};

// 梦境相关操作
export const dbDreams = {
  select(columns?: string) {
    return {
      eq: (field: string, value: string) => ({
        order: (field2: string, { ascending }: { ascending: boolean }) => ({
          thenBy: (field3: string, { ascending: ascending2 }: { ascending: boolean }) => ({
            execute: async () => {
              const { data, error } = await supabaseDB
                .from('dreams')
                .select(columns || '*')
                .eq(field, value)
                .order(field2, { ascending })
                .order(field3, { ascending: ascending2 });
              return { data, error };
            },
          }),
          execute: async () => {
            const { data, error } = await supabaseDB
              .from('dreams')
              .select(columns || '*')
              .eq(field, value)
              .order(field2, { ascending });
            return { data, error };
          },
        }),
        execute: async () => {
          const { data, error } = await supabaseDB
            .from('dreams')
            .select(columns || '*')
            .eq(field, value);
          return { data, error };
        },
      }),
    };
  },

  async insert(data: any | any[]) {
    const items = Array.isArray(data) ? data : [data];
    const { error } = await supabaseDB
      .from('dreams')
      .insert(items);
    
    if (error) {
      console.error('[DB] 插入梦境失败:', error);
    }
    return { error };
  },

  delete() {
    return {
      eq: (field: string, value: string) => ({
        execute: async () => {
          const { error } = await supabaseDB
            .from('dreams')
            .delete()
            .eq(field, value);
          return { error };
        },
      }),
      in: (field: string, values: string[]) => ({
        execute: async () => {
          const { error } = await supabaseDB
            .from('dreams')
            .delete()
            .in(field, values);
          return { error };
        },
      }),
    };
  },
};

// 梦境集相关操作
export const dbCollections = {
  select(columns?: string) {
    return {
      eq: (field: string, value: string) => ({
        order: (field2: string, { ascending }: { ascending: boolean }) => ({
          execute: async () => {
            const { data, error } = await supabaseDB
              .from('dream_collections')
              .select(columns || '*')
              .eq(field, value)
              .order(field2, { ascending });
            return { data, error };
          },
        }),
        single: async () => {
          const { data, error } = await supabaseDB
            .from('dream_collections')
            .select(columns || '*')
            .eq(field, value)
            .single();
          return { data, error };
        },
        maybeSingle: async () => {
          const { data, error } = await supabaseDB
            .from('dream_collections')
            .select(columns || '*')
            .eq(field, value)
            .maybeSingle();
          return { data, error };
        },
      }),
    };
  },

  async insert(data: any | any[]) {
    const items = Array.isArray(data) ? data : [data];
    const { error } = await supabaseDB
      .from('dream_collections')
      .insert(items);
    
    if (error) {
      console.error('[DB] 插入梦境集失败:', error);
    }
    return { error };
  },

  update(data: any) {
    return {
      eq: (field: string, value: string) => ({
        execute: async () => {
          const { error } = await supabaseDB
            .from('dream_collections')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq(field, value);
          return { error };
        },
      }),
    };
  },

  delete() {
    return {
      eq: (field: string, value: string) => ({
        execute: async () => {
          const { error } = await supabaseDB
            .from('dream_collections')
            .delete()
            .eq(field, value);
          return { error };
        },
      }),
    };
  },
};

// 创建 Supabase 客户端（兼容内存DB接口）
export function createDBClient(token?: string) {
  return {
    from: (table: string) => {
      switch (table) {
        case 'profiles':
          return dbUsers;
        case 'dreams':
          return dbDreams;
        case 'dream_collections':
          return dbCollections;
        default:
          return {
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
            insert: () => Promise.resolve({ error: null }),
          };
      }
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  };
}

// 检查是否使用 Supabase
export function shouldUseSupabase(): boolean {
  return !!process.env.COZE_SUPABASE_URL && !!process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}

console.log('[Supabase DB] 模块已加载');
