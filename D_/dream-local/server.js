// 梦境可视化本地版 - 免费SD生图
const express = require('express');
const path = require('path');
const app = express();
const PORT = 5000;

// 本地 SD API 地址
const SD_API = 'http://127.0.0.1:7860';

// 中间件
app.use(express.json());
app.use(express.static(__dirname));

// 检测 SD 是否可用
async function isSDAvailable() {
  try {
    const response = await fetch(`${SD_API}/sdapi/v1/sd-models`, {
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

// API：检测SD状态
app.get('/api/check-sd', async (req, res) => {
  const available = await isSDAvailable();
  res.json({ 
    available,
    message: available ? '本地SD可用，免费生图！' : 'SD未运行，请先启动SD WebUI'
  });
});

// API：生成图片
app.post('/api/generate', async (req, res) => {
  const { prompt, negative_prompt = 'ugly, blurry, low quality' } = req.body;
  
  if (!prompt) {
    return res.json({ success: false, error: '请输入提示词' });
  }

  // 检测SD
  const available = await isSDAvailable();
  if (!available) {
    return res.json({ success: false, error: 'SD未运行，请先启动SD WebUI' });
  }

  try {
    console.log(`[生图] 开始生成: ${prompt.substring(0, 50)}...`);
    
    const response = await fetch(`${SD_API}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        negative_prompt: negative_prompt,
        steps: 20,
        width: 512,
        height: 512,
        cfg_scale: 7,
        sampler_name: 'DPM++ 2M'
      })
    });

    const data = await response.json();
    
    if (data.images && data.images[0]) {
      console.log('[生图] 成功！');
      res.json({ 
        success: true, 
        image: `data:image/png;base64,${data.images[0]}`,
        method: '本地SD（免费）'
      });
    } else {
      res.json({ success: false, error: '生成失败' });
    }
  } catch (error) {
    console.error('[生图] 错误:', error);
    res.json({ success: false, error: '生成失败: ' + error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════');
  console.log('  🌙 梦境可视化 - 本地版');
  console.log('═══════════════════════════════════════');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log('  生图方式: 本地 SD（免费）');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('💡 使用前请确保 SD WebUI 正在运行！');
  console.log('   SD地址: http://127.0.0.1:7860');
  console.log('');
});
