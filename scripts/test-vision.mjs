/**
 * 测试千问模型是否支持图片理解（多模态）
 */

const QWEN_BASE_URL = 'http://lmstudio.vip.cpolar.cn/v1';
const DEFAULT_MODEL = 'qwen3.5 9b';

// 测试图片 - 使用一个在线的测试图片
const TEST_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png';

async function testVision() {
  console.log('=== 测试千问图片理解能力 ===\n');
  
  // 测试1: 标准 OpenAI 格式 (image_url)
  console.log('测试1: OpenAI 标准格式 (image_url)');
  try {
    const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: '这张图片里有什么？请详细描述。' },
              {
                type: 'image_url',
                image_url: { url: TEST_IMAGE_URL }
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });
    
    const data = await response.json();
    console.log('状态:', response.status);
    console.log('回复:', data.choices?.[0]?.message?.content || '无回复');
    console.log('错误:', data.error?.message || '无错误');
  } catch (error) {
    console.log('错误:', error.message);
  }
  
  console.log('\n---\n');
  
  // 测试2: 使用 base64 格式
  console.log('测试2: Base64 格式');
  try {
    // 创建一个简单的 1x1 像素的红色 PNG base64
    const RED_PIXEL_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    
    const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: '这张图片是什么颜色？' },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${RED_PIXEL_B64}` }
              }
            ]
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });
    
    const data = await response.json();
    console.log('状态:', response.status);
    console.log('回复:', data.choices?.[0]?.message?.content || '无回复');
    console.log('错误:', data.error?.message || '无错误');
  } catch (error) {
    console.log('错误:', error.message);
  }
  
  console.log('\n---\n');
  
  // 测试3: 纯文本（对照组）
  console.log('测试3: 纯文本（对照组）');
  try {
    const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'user', content: '你好，请介绍一下自己' }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });
    
    const data = await response.json();
    console.log('状态:', response.status);
    console.log('回复:', data.choices?.[0]?.message?.content?.substring(0, 100) + '...' || '无回复');
  } catch (error) {
    console.log('错误:', error.message);
  }
  
  console.log('\n=== 测试完成 ===');
}

testVision();
