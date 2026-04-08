// Kimi (Moonshot) API 客户端 - 作为千问的备用
const KIMI_API_KEY = process.env.KIMI_API_KEY || '19d501c4-9922-8ee6-8000-00005184e290';
const KIMI_BASE_URL = 'https://api.moonshot.cn/v1';

export async function invokeKimi(messages: Array<{role: string, content: string}>, options?: {
  model?: string;
  temperature?: number;
}) {
  const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: options?.model || 'moonshot-v1-8k',
      messages,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Kimi API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error('Kimi API 返回空 choices');
  }
  return data.choices[0].message.content;
}

// 带故障转移的LLM调用
export async function invokeLLMWithFallback(
  primaryFn: () => Promise<string>,
  messages: Array<{role: string, content: string}>,
  options?: { model?: string; temperature?: number }
): Promise<string> {
  try {
    // 先尝试主模型（千问）
    return await primaryFn();
  } catch (error) {
    console.log('[LLM] 主模型失败，切换到Kimi备用:', error);
    // 千问挂了，Kimi顶上
    return await invokeKimi(messages, options);
  }
}
