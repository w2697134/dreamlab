'use client';

export interface ServiceHealth {
  name: string;
  check: () => Promise<boolean>;
  errorMessage: string;
}

/**
 * 链式健康检测
 * 按顺序检测服务，任一失败立即返回错误
 */
export async function checkServicesChain(
  services: ServiceHealth[],
  onProgress?: (name: string, status: 'checking' | 'success' | 'error') => void
): Promise<{ success: boolean; failedService?: string; errorMessage?: string }> {
  for (const service of services) {
    onProgress?.(service.name, 'checking');
    
    try {
      const isHealthy = await service.check();
      if (!isHealthy) {
        onProgress?.(service.name, 'error');
        return {
          success: false,
          failedService: service.name,
          errorMessage: service.errorMessage,
        };
      }
      onProgress?.(service.name, 'success');
    } catch (error) {
      onProgress?.(service.name, 'error');
      return {
        success: false,
        failedService: service.name,
        errorMessage: service.errorMessage,
      };
    }
  }
  
  return { success: true };
}

// 预定义的服务检测
export const LLM_SERVICE: ServiceHealth = {
  name: '大语言模型',
  check: async () => {
    try {
      const response = await fetch('/api/health-check?service=llm', { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        // 如果返回failover状态，说明千问不可用但故障转移开启
        if (data.status === 'failover') {
          console.log('[健康检查] 千问不可用，故障转移开启');
          // 存储状态供前端使用
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('llm_failover_active', 'true');
          }
          return true;
        }
        // 千问正常
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('llm_failover_active');
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
  errorMessage: '大语言模型服务不可用，请检查千问 API 配置',
};

export const IMAGE_SERVICE: ServiceHealth = {
  name: '图片生成模型',
  check: async () => {
    try {
      const response = await fetch('/api/health-check?service=image', { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  },
  errorMessage: '图片生成服务不可用，请检查 SD 服务是否启动',
};

export const VIDEO_SERVICE: ServiceHealth = {
  name: '视频生成模型',
  check: async () => {
    try {
      const response = await fetch('/api/health-check?service=video', { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  },
  errorMessage: '视频生成服务不可用',
};
