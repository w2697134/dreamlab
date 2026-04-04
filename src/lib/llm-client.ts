import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'llm-config.json');
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_BASE_URL = 'https://api.moonshot.cn/v1';

export type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export interface LLMResponse {
  content: string;
  provider: 'qwen' | 'kimi';
}

// 读取故障转移配置
function getFailoverConfig(): { failoverEnabled: boolean } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { failoverEnabled: config.failoverEnabled ?? false };
    }
  } catch {
    // 忽略读取错误
  }
  return { failoverEnabled: process.env.LLM_FAILOVER_TO_KIMI === 'true' };
}

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 调用Kimi
async function callKimi(messages: Message[]): Promise<string> {
  if (!KIMI_API_KEY) {
    throw new Error('KIMI_API_KEY not configured');
  }

  const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-8k',
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kimi API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// 调用千问
async function callQwen(messages: Message[], customHeaders?: Record<string, string>): Promise<string> {
  const client = new LLMClient(new Config(), customHeaders || {});
  const response = await client.invoke(messages, {
    model: 'qwen3.5 9b',
    temperature: 0.7,
  });
  return response.content;
}

/**
 * 统一调用LLM，自动处理故障转移
 * 所有API都应该用这个函数调用LLM
 */
export async function invokeLLM(
  messages: Message[],
  options?: {
    customHeaders?: Record<string, string>;
    enableFailover?: boolean; // 是否允许故障转移，默认true
  }
): Promise<LLMResponse> {
  const { customHeaders, enableFailover = true } = options || {};
  const { failoverEnabled } = getFailoverConfig();
  
  // 首先尝试千问
  try {
    await delay(100);
    const content = await callQwen(messages, customHeaders);
    console.log('[LLM] 千问调用成功');
    return { content, provider: 'qwen' };
  } catch (error) {
    console.warn('[LLM] 千问调用失败:', error);
    
    // 检查是否应该故障转移
    if (!enableFailover || !failoverEnabled) {
      console.log('[LLM] 故障转移已禁用，抛出错误');
      throw error;
    }
    
    // 尝试Kimi
    console.log('[LLM] 尝试切换到Kimi...');
    try {
      await delay(100);
      const content = await callKimi(messages);
      console.log('[LLM] Kimi调用成功（故障转移）');
      return { content, provider: 'kimi' };
    } catch (kimiError) {
      console.error('[LLM] Kimi也失败了:', kimiError);
      throw new Error('所有LLM服务均不可用');
    }
  }
}

/**
 * 快速调用LLM（只返回内容，不返回provider）
 */
export async function invokeLLMSimple(
  messages: Message[],
  options?: { customHeaders?: Record<string, string> }
): Promise<string> {
  const response = await invokeLLM(messages, options);
  return response.content;
}
