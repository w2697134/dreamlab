/**
 * 测试 LM Studio 的模型能力和多模态支持
 */

const QWEN_BASE_URL = 'http://lmstudio.vip.cpolar.cn/v1';

async function testModels() {
  console.log('=== 获取可用模型列表 ===\n');
  
  try {
    const response = await fetch(`${QWEN_BASE_URL}/models`);
    const data = await response.json();
    console.log('可用模型:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('获取模型列表失败:', error.message);
  }
  
  console.log('\n=== 测试完成 ===');
}

testModels();
