const http = require('http');

// 测试数据
const testData = {
  prompts: [
    "一个可爱的动漫女孩，粉色头发，蓝色眼睛，在樱花树下，anime style, masterpiece, best quality"
  ],
  autoPolish: false,
  dreamType: "default",
  artStyle: "anime",
  aiSuggestedModel: "anime",
  userInput: "一个可爱的动漫女孩",
  selectedKeywords: ["樱花", "女孩"]
};

// 发送请求
const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/generate-image-batch',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 开始测试 Anything 模型生图...');
console.log('📝 测试数据:', testData);
console.log('🚀 发送请求到 /api/generate-image-batch...\n');

const req = http.request(options, (res) => {
  console.log(`✅ 响应状态码: ${res.statusCode}`);
  console.log(`📋 响应头: ${JSON.stringify(res.headers)}\n`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
    console.log('📨 收到数据块...');
    
    // 尝试解析SSE格式
    const lines = chunk.toString().split('\n\n');
    lines.forEach(line => {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6));
          console.log(`\n🎯 事件: stage=${event.stage}, message=${event.message}, progress=${event.progress}%`);
          if (event.results) {
            console.log('🖼️ 生成结果:', event.results);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    });
  });
  
  res.on('end', () => {
    console.log('\n✅ 请求完成！');
    console.log('📊 完整响应数据长度:', data.length);
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error);
});

// 写入数据
req.write(postData);
req.end();
