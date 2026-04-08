/**
 * LLM 客户端 - 统一调用千问(Qwen)
 * 所有 LLM 调用都走这个文件
 */
import { invokeQwen } from './qwen-client';

export type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export interface LLMResponse {
  content: string;
  provider: 'qwen';
}

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 统一调用 LLM（千问），带重试机制
 * 所有 API 都应该用这个函数调用 LLM
 */
export async function invokeLLM(
  messages: Message[],
  options?: {
    customHeaders?: Record<string, string>;
    enableFailover?: boolean;
  }
): Promise<LLMResponse> {
  const maxRetries = 20;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await delay(1000 + 100 * attempt); // 递增延迟，基础1秒
      const result = await invokeQwen(messages, {
        temperature: 0.7,
      });
      console.log(`[LLM] 千问调用成功 (尝试 ${attempt}/${maxRetries})`);
      return { content: result.content, provider: 'qwen' };
    } catch (error) {
      lastError = error as Error;
      console.warn(`[LLM] 千问调用失败 (尝试 ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        console.log(`[LLM] 等待后重试...`);
        await delay(1000 + 500 * attempt); // 重试间隔基础1秒
      }
    }
  }

  throw lastError || new Error('千问服务不可用');
}

/**
 * 快速调用 LLM（只返回内容）
 */
export async function invokeLLMSimple(
  messages: Message[],
  options?: { customHeaders?: Record<string, string> }
): Promise<string> {
  const response = await invokeLLM(messages, options);
  return response.content;
}

// 兼容性导出
export { invokeQwen };
