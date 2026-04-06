/**
 * 内存数据库 - 临时方案（无 Supabase 时使用）
 * 数据仅在服务器运行期间存在，重启后丢失
 */

export interface MemoryUser {
  id: string;
  username: string;
  nickname?: string;
  password_hash: string;
  password_salt: string;
  email?: string;
  created_at: string;
}

export interface MemoryDream {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  video_url?: string;
  dream_type: string;
  art_style: string;
  collection_id?: string;
  session_id?: string;
  created_at: string;
}

export interface MemoryCollection {
  id: string;
  user_id: string;
  title?: string;
  description?: string;
  cover_url?: string;
  has_video: boolean;
  image_count: number;
  created_at: string;
  updated_at?: string;
}

// 内存存储
const memoryDB = {
  users: new Map<string, MemoryUser>(), // key: username
  usersById: new Map<string, MemoryUser>(), // key: id
  dreams: new Map<string, MemoryDream>(),
  collections: new Map<string, MemoryCollection>(),
};

// 用户相关操作
export const memoryUsers = {
  findByUsername(username: string): MemoryUser | null {
    return memoryDB.users.get(username) || null;
  },

  findById(id: string): MemoryUser | null {
    return memoryDB.usersById.get(id) || null;
  },

  create(user: MemoryUser): { data: MemoryUser | null; error: any } {
    try {
      if (memoryDB.users.has(user.username)) {
        return { data: null, error: { message: '用户名已存在' } };
      }
      memoryDB.users.set(user.username, user);
      memoryDB.usersById.set(user.id, user);
      console.log(`[内存DB] 创建用户: ${user.username}`);
      return { data: user, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  // 模拟 Supabase 的 select().eq().maybeSingle() 链式调用
  select(columns?: string) {
    return {
      eq: (field: string, value: string) => ({
        maybeSingle: () => {
          if (field === 'username') {
            const user = memoryDB.users.get(value);
            return Promise.resolve({ data: user || null, error: null });
          }
          if (field === 'id') {
            const user = memoryDB.usersById.get(value);
            return Promise.resolve({ data: user || null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        single: () => {
          if (field === 'username') {
            const user = memoryDB.users.get(value);
            return Promise.resolve({ data: user || null, error: user ? null : { message: 'Not found' } });
          }
          return Promise.resolve({ data: null, error: { message: 'Not found' } });
        },
      }),
    };
  },

  insert(data: MemoryUser | MemoryUser[]) {
    const items = Array.isArray(data) ? data : [data];
    try {
      for (const item of items) {
        memoryDB.users.set(item.username, item);
        memoryDB.usersById.set(item.id, item);
      }
      console.log(`[内存DB] 插入 ${items.length} 个用户`);
      return Promise.resolve({ error: null });
    } catch (error) {
      return Promise.resolve({ error });
    }
  },
};

// 梦境相关操作
export const memoryDreams = {
  select(columns?: string) {
    return {
      eq: (field: string, value: string) => ({
        order: (field2: string, { ascending }: { ascending: boolean }) => ({
          thenBy: (field3: string, { ascending: ascending2 }: { ascending: boolean }) => ({
            execute: () => {
              const dreams = Array.from(memoryDB.dreams.values())
                .filter(d => d.user_id === value)
                .sort((a, b) => {
                  const timeA = new Date(a.created_at).getTime();
                  const timeB = new Date(b.created_at).getTime();
                  return ascending ? timeA - timeB : timeB - timeA;
                });
              return Promise.resolve({ data: dreams, error: null });
            },
          }),
          execute: () => {
            const dreams = Array.from(memoryDB.dreams.values())
              .filter(d => d.user_id === value)
              .sort((a, b) => {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return ascending ? timeA - timeB : timeB - timeA;
              });
            return Promise.resolve({ data: dreams, error: null });
          },
        }),
        execute: () => {
          const dreams = Array.from(memoryDB.dreams.values())
            .filter(d => (d as any)[field] === value);
          return Promise.resolve({ data: dreams, error: null });
        },
      }),
    };
  },

  insert(data: MemoryDream | MemoryDream[]) {
    const items = Array.isArray(data) ? data : [data];
    try {
      for (const item of items) {
        memoryDB.dreams.set(item.id, item);
      }
      return Promise.resolve({ error: null });
    } catch (error) {
      return Promise.resolve({ error });
    }
  },

  delete() {
    return {
      eq: (field: string, value: string) => ({
        execute: () => {
          const toDelete: string[] = [];
          for (const [id, dream] of memoryDB.dreams) {
            if ((dream as any)[field] === value) {
              toDelete.push(id);
            }
          }
          toDelete.forEach(id => memoryDB.dreams.delete(id));
          return Promise.resolve({ error: null });
        },
      }),
      in: (field: string, values: string[]) => ({
        execute: () => {
          const toDelete: string[] = [];
          for (const [id, dream] of memoryDB.dreams) {
            if (values.includes((dream as any)[field])) {
              toDelete.push(id);
            }
          }
          toDelete.forEach(id => memoryDB.dreams.delete(id));
          return Promise.resolve({ error: null });
        },
      }),
    };
  },
};

// 梦境集相关操作
export const memoryCollections = {
  select(columns?: string) {
    return {
      eq: (field: string, value: string) => ({
        order: (field2: string, { ascending }: { ascending: boolean }) => ({
          execute: () => {
            const collections = Array.from(memoryDB.collections.values())
              .filter(c => c.user_id === value)
              .sort((a, b) => {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return ascending ? timeA - timeB : timeB - timeA;
              });
            return Promise.resolve({ data: collections, error: null });
          },
        }),
        single: () => {
          const collection = Array.from(memoryDB.collections.values())
            .find(c => (c as any)[field] === value);
          return Promise.resolve({ data: collection || null, error: null });
        },
        maybeSingle: () => {
          const collection = Array.from(memoryDB.collections.values())
            .find(c => (c as any)[field] === value);
          return Promise.resolve({ data: collection || null, error: null });
        },
      }),
    };
  },

  insert(data: MemoryCollection | MemoryCollection[]) {
    const items = Array.isArray(data) ? data : [data];
    try {
      for (const item of items) {
        memoryDB.collections.set(item.id, item);
      }
      return Promise.resolve({ error: null });
    } catch (error) {
      return Promise.resolve({ error });
    }
  },

  update(data: Partial<MemoryCollection>) {
    return {
      eq: (field: string, value: string) => ({
        execute: () => {
          const collection = Array.from(memoryDB.collections.values())
            .find(c => (c as any)[field] === value);
          if (collection) {
            Object.assign(collection, data, { updated_at: new Date().toISOString() });
          }
          return Promise.resolve({ error: null });
        },
      }),
    };
  },

  delete() {
    return {
      eq: (field: string, value: string) => ({
        execute: () => {
          for (const [id, collection] of memoryDB.collections) {
            if ((collection as any)[field] === value) {
              memoryDB.collections.delete(id);
            }
          }
          return Promise.resolve({ error: null });
        },
      }),
    };
  },
};

// 模拟 Supabase 客户端
export function createMemoryClient(token?: string) {
  return {
    from: (table: string) => {
      switch (table) {
        case 'profiles':
          return memoryUsers;
        case 'dreams':
          return memoryDreams;
        case 'dream_collections':
          return memoryCollections;
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

// 检查是否使用内存数据库
export function shouldUseMemoryDB(): boolean {
  return !process.env.COZE_SUPABASE_URL || !process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}

// 模块加载时输出日志
if (shouldUseMemoryDB()) {
  console.log('[内存DB] 模块已加载，服务器重启后数据会丢失');
}
