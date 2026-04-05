import { NextRequest } from 'next/server';
import { uploadImage, generateFileName } from '@/lib/supabase-storage';
import { 
  getSDInstances, 
  checkSDAvailability,
  selectSDInstanceByStyle 
} from '@/lib/sd-config';

// ==================== 类型 ====================
interface SDInstance {
  id: string;
  name: string;
  url: string;
  vram: number;
  canSwitchModel: boolean;
  fixedModel?: 'anime' | 'realistic';
}

// ==================== 工具 ====================
// 【上传模式】生成后立即上传到 Supabase
async function saveImage(base64: string, userId: string | undefined): Promise<string> {
  const fileName = generateFileName(userId, Math.random().toString(36).substring(2, 8));
  return await uploadImage(base64, fileName);
}

async function sendProgress(
  controller: ReadableStreamDefaultController,
  stage: string,
  message: string,
  progress: number,
  data?: Record<string, unknown>
) {
  try {
    const event = { stage, message, progress, timestamp: Date.now(), ...data };
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
    await new Promise(resolve => setImmediate(resolve));
  } catch {}
}

async function checkSD(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/sdapi/v1/options`, {
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function getCurrentModel(url: string): Promise<string | null> {
  try {
    const res = await fetch(`${url}/sdapi/v1/options`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    return data.sd_model_checkpoint || null;
  } catch {
    return null;
  }
}

async function switchModel(url: string, modelFile: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/sdapi/v1/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sd_model_checkpoint: modelFile }),
      signal: AbortSignal.timeout(30000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// 【核心】SD 批量生成 - 支持 txt2img 和 img2img
async function generateBatch(
  prompt: string,
  sdUrl: string,
  batchSize: number,
  width = 1024,
  height = 768,
  artStyle?: string,
  negativePrompt?: string[],
  initImage?: string // 可选：参考图片（base64）用于 img2img
): Promise<{ base64Images: string[]; time: number }> {
  const start = Date.now();
  
  // 获取当前使用的模型名称
  const modelName = artStyle === 'anime' ? 'Anything V5.0 (二次元)' : 
                    artStyle === 'realistic' ? 'Realistic Vision V2.0 (写实)' : 
                    artStyle === 'watercolor' ? 'Realistic Vision V2.0 (水彩)' : 
                    artStyle === 'oil' ? 'Realistic Vision V2.0 (油画)' : 'Unknown';
  
  console.log(`[SD] ${sdUrl.split('/')[2]} | ${modelName} | ${batchSize}张`);
  
  // 使用传入的反向提示词，或根据风格使用默认
  let negativePromptStr: string;
  if (negativePrompt && negativePrompt.length > 0) {
    negativePromptStr = negativePrompt.join(', ');
  } else {
    negativePromptStr = 'ugly, blurry, low quality, bad anatomy';
    
    if (artStyle === 'realistic') {
      negativePromptStr += ', anime, manga, cartoon, 2d, illustration, big eyes, colorful hair, unrealistic proportions, doll, plastic, wax figure, mannequin, uncanny valley, fake, cg, 3d render, smooth skin, porcelain skin, oversaturated, oversharp, artificial, synthetic, doll-like, puppet, lifeless eyes, flat lighting, anime style, manga style, cartoon style, chibi, kawaii, anime girl, anime boy, anime character, cel shading, toon, comic, japanese animation, anime aesthetic, anime eyes, anime face, anime hair, anime background, anime scene, visual novel, game cg, anime screenshot, fanart, doujin'
    }
  }
  
  // 判断使用 txt2img 还是 img2img
  const isImg2Img = initImage && initImage.length > 0;
  const apiEndpoint = isImg2Img ? '/sdapi/v1/img2img' : '/sdapi/v1/txt2img';
  
  const requestBody: any = {
    prompt,
    negative_prompt: negativePromptStr,
    steps: 40,
    width: 768,
    height: 512,
    cfg_scale: 7,
    sampler_index: 'DPM++ 2M SDE Karras',
    batch_size: Math.min(batchSize, 2),
    n_iter: 1,
  };
  
  // 如果是 img2img，添加参考图片参数
  if (isImg2Img) {
    requestBody.init_images = [initImage];
    // 根据风格调整降噪强度：写实风格需要更高的降噪强度来避免风格混合
    requestBody.denoising_strength = artStyle === 'realistic' ? 0.75 : 0.6;
    requestBody.resize_mode = 0; // 拉伸模式
    
    // 写实风格时，添加额外的反向提示词避免动漫风格渗透
    if (artStyle === 'realistic') {
      requestBody.negative_prompt += ', anime style, cartoon style, manga style, 2d illustration, big eyes, colorful hair, unrealistic proportions, doll-like features, chibi, kawaii, anime girl, anime boy, anime character, cel shading, toon, comic, japanese animation, anime aesthetic'
    }
  }
  
  const res = await fetch(`${sdUrl}${apiEndpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(300000),
  });
  
  if (!res.ok) throw new Error(`SD error: ${res.status}`);
  
  const data = await res.json();
  if (!data.images || data.images.length === 0) {
    throw new Error('No images returned');
  }
  
  const time = Date.now() - start;
  console.log(`[SD] 完成: ${data.images.length}张, ${time}ms`);
  
  return { base64Images: data.images, time };
}

// ==================== 实例选择 ====================

// 缓存在线实例，避免每次请求都检测
let cachedOnlineInstances: SDInstance[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30000; // 30秒缓存

// 获取在线实例（使用配置文件中的实例）
async function getOnlineInstances(): Promise<SDInstance[]> {
  const now = Date.now();
  if (cachedOnlineInstances && now - cacheTime < CACHE_TTL) {
    return cachedOnlineInstances;
  }
  
  // 从配置文件获取实例
  const configInstances = getSDInstances();
  const onlineInstances: SDInstance[] = [];
  
  for (const inst of configInstances) {
    if (await checkSDAvailability(inst.url)) {
      // 转换为内部格式
      onlineInstances.push({
        id: inst.id,
        name: inst.name,
        url: inst.url,
        vram: 24,
        canSwitchModel: !inst.specialty, // 没有 specialty 的实例可以切换模型
        fixedModel: inst.specialty as 'anime' | 'realistic' | undefined,
      });
    }
  }
  
  cachedOnlineInstances = onlineInstances;
  cacheTime = now;
  return onlineInstances;
}

// 获取在线实例（不带缓存，用于故障转移）
async function getOnlineInstancesUncached(): Promise<SDInstance[]> {
  // 清空缓存
  cachedOnlineInstances = null;
  cacheTime = 0;
  return getOnlineInstances();
}

// 模型文件映射
const MODEL_FILES: Record<string, string> = {
  'anime': 'anything-v5.safetensors',
  'realistic': 'Realistic_Vision_V2.0-fp16-no-ema.safetensors',
};

const MODEL_NAMES: Record<string, string> = {
  'anime': '二次元',
  'realistic': '写实',
};

async function selectInstance(
  targetModel: 'anime' | 'realistic',
  skipCache = false
): Promise<{
  instance: SDInstance;
  needSwitch: boolean;
}> {
  // 故障转移时跳过缓存，获取最新实例状态
  const onlineInstances = skipCache ? await getOnlineInstancesUncached() : await getOnlineInstances();
  
  if (onlineInstances.length === 0) {
    throw new Error('没有可用的 SD 实例');
  }
  
  // 【优先】找固定模型匹配的实例（专用实例优先于可切换实例）
  const fixedModelInstances = onlineInstances.filter(
    i => i.fixedModel === targetModel && !i.canSwitchModel
  );
  
  if (fixedModelInstances.length > 0) {
    // 使用第一个匹配的固定模型实例
    const dedicatedInstance = fixedModelInstances[0];
    console.log(`[路由] 使用专用${MODEL_NAMES[targetModel]}实例: ${dedicatedInstance.name}`);
    return { instance: dedicatedInstance, needSwitch: false };
  }
  
  // 【备选】找可切换模型的实例
  const switchableInstances = onlineInstances.filter(i => i.canSwitchModel);
  if (switchableInstances.length > 0) {
    const mainInstance = switchableInstances[0];
    const currentModel = await getCurrentModel(mainInstance.url);
    const targetFile = MODEL_FILES[targetModel];
    const modelName = MODEL_NAMES[targetModel];
    
    // 使用相似度算法检查是否需要切换模型
    const { isModelMatch } = await import('@/lib/model-matcher');
    const targetModelName = targetModel === 'anime' ? 'anything' : 'realistic';
    const isMatch = currentModel ? await isModelMatch(currentModel, targetModelName, 0.55) : false;
    const needSwitch = !isMatch;
    
    if (needSwitch) {
      console.log(`[路由] 切换${modelName}模型: ${currentModel} -> ${targetFile}`);
      await switchModel(mainInstance.url, targetFile);
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.log(`[路由] 使用当前${modelName}模型: ${currentModel} (相似度匹配)`);
    }
    
    // 动态更新实例名称
    mainInstance.name = `${modelName}-24G`;
    mainInstance.fixedModel = targetModel;
    return { instance: mainInstance, needSwitch };
  }
  
  // 【最后备选】使用第一个在线实例
  const fallback = onlineInstances[0];
  console.log(`[路由] 使用实例: ${fallback.name}`);
  return { instance: fallback, needSwitch: false };
}

// ==================== 主处理 ====================

export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 获取用户ID（从请求头或token）
        const authHeader = request.headers.get('authorization');
        const userId = authHeader?.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : undefined;
        
        // 接收：润色后的提示词（只润色一次）、数量、风格
        const body = await request.json();
        console.log('[生成] 请求: ' + (body.polishedPrompt?.substring(0, 30) || '无') + '..., 风格=' + body.artStyle + ', 数量=' + body.count);
        
        const { polishedPrompt, count = 1, artStyle = 'anime', negativePrompt, uploadedImages, isImg2Img } = body;
        
        // 获取参考图片（如果有）
        let initImage: string | undefined;
        if (isImg2Img && uploadedImages && uploadedImages.length > 0) {
          initImage = uploadedImages[0]; // 使用第一张上传的图片作为参考
          // img2img日志已精简
        }
        
        if (!polishedPrompt || typeof polishedPrompt !== 'string' || polishedPrompt.trim() === '') {
          console.error('[生成API] 缺少或无效的提示词:', polishedPrompt);
          throw new Error('缺少提示词');
        }
        
        await sendProgress(controller, 'start', '开始生成...', 0);
        
        // 【平滑过渡】从0%到10%的初始进度
        let initProgress = 0;
        const initInterval = setInterval(async () => {
          initProgress += 2;
          if (initProgress <= 10) {
            await sendProgress(controller, 'start', '准备生成环境...', initProgress);
          }
        }, 200);
        
        // 风格映射：写实/水彩/油画用realistic模型，二次元用anime模型
        const styleMapping: Record<string, { model: 'realistic' | 'anime'; promptSuffix: string; name: string }> = {
          'realistic': { model: 'realistic', promptSuffix: ', photorealistic, highly detailed, 8k uhd', name: '写实' },
          'watercolor': { model: 'realistic', promptSuffix: ', watercolor painting, soft translucent colors, flowing pigments, wet-on-wet technique, delicate brushwork, artistic, paper texture', name: '水彩' },
          'oil': { model: 'realistic', promptSuffix: ', oil painting, rich impasto texture, classical composition, dramatic chiaroscuro, deep colors, visible brush strokes, canvas texture', name: '油画' },
          'anime': { model: 'anime', promptSuffix: ', anime style, manga art, vibrant colors', name: '二次元' },
          'default': { model: 'realistic', promptSuffix: ', best quality, masterpiece', name: '默认' },
        };
        
        const style = styleMapping[artStyle] || styleMapping['default'];
        await sendProgress(controller, 'analyzing', `选择${style.name}风格...`, 12);
        
        // 选择实例（只用一台，SD内部批量生成）
        const { instance } = await selectInstance(style.model);
        
        clearInterval(initInterval);
        await sendProgress(controller, 'analyzing', '模型选择完成', 18);
        
        // 【分批生成】每批最多2张，避免显存不足
        const batchSize = 2;
        const batches = Math.ceil(count / batchSize);
        const allImages: string[] = [];
        
        // 添加风格提示词后缀，用于最终返回给前端显示
        const styledPrompt = polishedPrompt + style.promptSuffix;
        
        for (let batch = 0; batch < batches; batch++) {
          const currentBatchSize = Math.min(batchSize, count - allImages.length);
          const batchStartProgress = 20 + (batch / batches) * 60;
          const batchEndProgress = 20 + ((batch + 1) / batches) * 60;
          
          await sendProgress(controller, 'generating', `生成第${batch + 1}/${batches}批 (${currentBatchSize}张)...`, batchStartProgress);
          
          // 【修复】每500ms更新2%进度，确保不卡住，直到SD生成完成
          let currentProgress = batchStartProgress;
          const progressInterval = setInterval(async () => {
            currentProgress += 2; // 每次增加2%
            // 限制在批次结束进度前5%，留一点给完成时更新
            if (currentProgress < batchEndProgress - 5) {
              await sendProgress(controller, 'generating', `生成第${batch + 1}/${batches}批中...`, currentProgress);
            }
          }, 500); // 每500ms更新一次 = 每秒4%，但前端限制显示每秒2%~10%
          
          // 生成图片（支持故障转移：所有风格都支持主模型失败→备用模型）
          let base64Images: string[];
          let time: number;
          let usedFallback = false;
          try {
            const result = await generateBatch(
              styledPrompt,
              instance.url,
              currentBatchSize,
              768,
              512,
              artStyle,
              negativePrompt,
              initImage // 传入参考图片（如果有）
            );
            base64Images = result.base64Images;
            time = result.time;
          } catch (error) {
            // 故障转移：主模型失败→备用模型（保留原风格提示词后缀）
            const isAnime = style.model === 'anime';
            const fallbackModel = isAnime ? 'realistic' : 'anime';
            const currentStyleName = style.name;
            const fallbackStyleName = isAnime ? '写实' : '二次元';
            
            console.log(`[生成] ${currentStyleName}实例失败，尝试${fallbackStyleName}实例...`);
            await sendProgress(controller, 'generating', `${currentStyleName}实例繁忙，尝试${fallbackStyleName}风格...`, currentProgress);
            
            try {
              // 选择另一个模型类型的实例（跳过缓存，获取最新状态）
              const { instance: fallbackInstance } = await selectInstance(fallbackModel, true);
              
              // 【关键】保留原风格的提示词后缀，只换模型实例
              const result = await generateBatch(
                styledPrompt,
                fallbackInstance.url,
                currentBatchSize,
                768,
                512,
                artStyle,
                negativePrompt,
                initImage // 传入参考图片（如果有）
              );
              base64Images = result.base64Images;
              time = result.time;
              usedFallback = true;
              console.log(`[生成] 备用${fallbackStyleName}实例生成成功（保留${currentStyleName}风格）`);
            } catch (fallbackError) {
              // 备用实例也失败，返回失败
              console.error(`[生成] 主实例和备用实例都失败`);
              throw new Error(`生成失败：${currentStyleName}和${fallbackStyleName}实例均不可用，请稍后重试`);
            }
          }
          
          clearInterval(progressInterval);
          // 【平滑过渡】从当前进度到批次结束进度
          const currentBatchProgress = Math.min(currentProgress, batchEndProgress - 5);
          for (let p = Math.floor(currentBatchProgress); p <= Math.floor(batchEndProgress); p += 3) {
            await sendProgress(controller, 'generating', `第${batch + 1}批完成中...`, p);
            await new Promise(r => setTimeout(r, 100));
          }
          await sendProgress(controller, 'generating', `第${batch + 1}批完成`, batchEndProgress);
          allImages.push(...base64Images);
          console.log(`[生成] 第${batch + 1}批完成，${currentBatchSize}张，耗时${time}ms`);
        }
        
        // 【平滑过渡】从最后批次进度到80%
        const lastBatchEndProgress = 20 + (batches / batches) * 60;
        for (let p = Math.floor(lastBatchEndProgress); p <= 80; p += 4) {
          await sendProgress(controller, 'saving', '准备保存...', p);
          await new Promise(r => setTimeout(r, 80));
        }
        
        await sendProgress(controller, 'saving', '保存图片...', 80);
        
        // 保存所有图片
        const savedImages = [];
        for (let i = 0; i < allImages.length; i++) {
          const url = await saveImage(allImages[i], userId);
          savedImages.push({ imageUrl: url, index: i });
          // 每保存一张更新进度
          const saveProgress = 80 + ((i + 1) / allImages.length) * 15;
          await sendProgress(controller, 'saving', `保存第${i + 1}/${allImages.length}张...`, saveProgress);
        }
        
        // 【平滑过渡】到100%
        for (let p = 95; p < 100; p += 2) {
          await sendProgress(controller, 'complete', '即将完成...', p);
          await new Promise(r => setTimeout(r, 50));
        }
        
        await sendProgress(controller, 'complete', '完成！', 100, {
          success: true,
          results: savedImages,
          count: savedImages.length,
          instance: instance.name,
          polishedPrompt: polishedPrompt, // 返回原始润色提示词（不带技术后缀）
        });
        
        controller.close();
      } catch (error) {
        console.error('[生成错误]', error);
        await sendProgress(controller, 'error', String(error), 0, { error: String(error) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
