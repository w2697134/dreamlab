/**
 * 千问 (Qwen) API 客户端 - 支持故障转移到Kimi
 * 直接调用本地部署的千问服务 http://qwen.cpolar.top/v1
 * 千问不可用时自动切换到Kimi
 */

import fs from 'fs';
import path from 'path';

const QWEN_BASE_URL = 'http://lmstudio.vip.cpolar.cn/v1';
const DEFAULT_MODEL = 'qwen3.5 9b';
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_BASE_URL = 'https://api.moonshot.cn/v1';
const CONFIG_FILE = path.join(process.cwd(), 'data', 'llm-config.json');

interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface QwenCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface QwenResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 读取故障转移配置
function getFailoverConfig(): { failoverEnabled: boolean } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      // LLM配置读取日志已精简
      return { failoverEnabled: config.failoverEnabled ?? false };
    }
    // LLM配置不存在日志已精简
  } catch (error) {
    console.error('[LLM配置] 读取失败:', error);
  }
  return { failoverEnabled: process.env.LLM_FAILOVER_TO_KIMI === 'true' };
}

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 调用Kimi
async function callKimi(messages: QwenMessage[]): Promise<string> {
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
async function callQwen(
  messages: QwenMessage[],
  options: QwenCompletionOptions
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    max_tokens = 2048,
    stream = false,
  } = options;

  const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`千问 API 错误: ${response.status} - ${errorText}`);
  }

  const data: QwenResponse = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('千问返回空结果');
  }

  return data.choices[0].message.content;
}

/**
 * 调用千问 API，支持故障转移到Kimi
 * 这是主要的调用接口，所有API都应该用这个
 */
export async function invokeQwen(
  messages: QwenMessage[],
  options: QwenCompletionOptions = {}
): Promise<{ content: string; usage?: any; provider?: 'qwen' | 'kimi' }> {
  const { failoverEnabled } = getFailoverConfig();
  
  console.log('[LLM] 调用: 千问' + (failoverEnabled ? '(故障转移开)' : ''));
  console.log('[LLM] 消息数:', messages.length);

  // 首先尝试千问
  try {
    await delay(100);
    const content = await callQwen(messages, options);
    console.log('[LLM] 千问调用成功, 长度:', content.length);
    return { content, provider: 'qwen' };
  } catch (error) {
    console.warn('[LLM] 千问调用失败:', error);
    
    // 检查故障转移是否开启
    if (!failoverEnabled) {
      console.log('[LLM] 故障转移已禁用，抛出错误');
      throw error;
    }
    
    // 尝试Kimi
    console.log('[LLM] 尝试切换到Kimi...');
    try {
      await delay(100);
      const content = await callKimi(messages);
      console.log('[LLM] Kimi调用成功（故障转移）, 长度:', content.length);
      return { content, provider: 'kimi' };
    } catch (kimiError) {
      console.error('[LLM] Kimi也失败了:', kimiError);
      throw new Error('所有LLM服务均不可用');
    }
  }
}

/**
 * 简单的文本生成接口
 */
export async function generateText(
  prompt: string,
  systemPrompt?: string,
  options: QwenCompletionOptions = {}
): Promise<string> {
  const messages: QwenMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });
  
  const result = await invokeQwen(messages, options);
  return result.content;
}

/**
 * 检查千问服务是否可用
 */
export async function checkQwenAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${QWEN_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 兼容旧接口的类
export class QwenClient {
  async invoke(
    messages: QwenMessage[],
    options: QwenCompletionOptions = {}
  ): Promise<{ content: string; provider?: 'qwen' | 'kimi' }> {
    return invokeQwen(messages, options);
  }
}
