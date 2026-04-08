/**
 * 健康检查缓存
 * 避免每次生成都检查服务状态
 */

interface HealthCache {
  llm: { ok: boolean; time: number } | null;
  image: { ok: boolean; time: number } | null;
}

const cache: HealthCache = {
  llm: null,
  image: null,
};

const CACHE_TTL = 30000; // 30秒缓存

/**
 * 检查健康状态（带缓存）
 */
export async function checkHealthWithCache(
  service: 'llm' | 'image'
): Promise<boolean> {
  const now = Date.now();
  const cached = cache[service];
  
  // 缓存有效，直接返回
  if (cached && now - cached.time < CACHE_TTL) {
    console.log(`[健康检查] 使用缓存: ${service} = ${cached.ok}`);
    return cached.ok;
  }
  
  // 缓存过期，重新检查
  try {
    const response = await fetch(`/api/health-check?service=${service}`);
    const ok = response.ok;
    cache[service] = { ok, time: now };
    console.log(`[健康检查] 重新检测: ${service} = ${ok}`);
    return ok;
  } catch {
    cache[service] = { ok: false, time: now };
    return false;
  }
}

/**
 * 清除健康检查缓存
 */
export function clearHealthCache(): void {
  cache.llm = null;
  cache.image = null;
}

/**
 * 预检查健康状态（页面加载时调用）
 */
export async function prefetchHealthStatus(): Promise<void> {
  await Promise.all([
    checkHealthWithCache('llm'),
    checkHealthWithCache('image'),
  ]);
}
