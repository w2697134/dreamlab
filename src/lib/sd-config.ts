/**
 * SD API 配置工具 - 多SD实例分工模式
 * 
 * 【核心优化】固定实例 + 固定模型 + 智能路由 = 零切换时间
 * 
 * 实例分工：
 * - 实例A (二次元专用): anything-v5.safetensors - 动漫、萌系、角色
 * - 实例B (写实专用): Realistic_Vision_V2.0 - 真实人物、摄影、风景
 * 
 * 优势：
 * 1. 无需切换模型，节省 5-15 秒
 * 2. 每个实例专注一种风格，质量更稳定
 * 3. 可并行处理（如果同时来二次元和写实请求）
 */

// ==================== SD模型配置（易扩展）====================

export interface SDModel {
  id: string;           // 'anime' | 'realistic'
  name: string;         // 显示名称
  file: string;         // 模型文件名
  keywords: string[];   // 触发关键词
}

// 模型配置 - 新增模型只需在这里添加
export const SD_MODELS: SDModel[] = [
  {
    id: 'anime',
    name: 'Anything V5.0',
    file: 'anything-v5.safetensors',
    keywords: [
      'anime', '动漫', '二次元', 'manga', '卡通',
      'yae miko', '八重神子', 'raiden shogun', '雷电将军',
      'nahida', '纳西妲', 'furina', '芙宁娜',
      'zhongli', '钟离', 'venti', '温迪', 'xiao', '魈',
      'ganyu', '甘雨', 'ayaka', '神里绫华', 'hutao', '胡桃',
      'genshin', '原神', 'hatsune miku', '初音未来',
      'kasugano sora', '春日野穹', 'rem', '蕾姆', 'ram', '拉姆',
    ],
  },
  {
    id: 'realistic',
    name: 'Realistic Vision V2.0',
    file: 'Realistic_Vision_V2.0-fp16-no-ema.safetensors',
    keywords: [], // 写实模型，无关键词触发（兜底类型）
  },
];

// ==================== 配置校验 ====================

/**
 * 校验 SD 配置是否正确
 * 在应用启动时调用
 */
export function validateSDConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 校验实例的 specialty 是否有效
  sdInstances.forEach((inst, idx) => {
    if (!inst.url) {
      errors.push(`实例 ${idx + 1} (${inst.name}) 缺少 URL`);
    }
    if (inst.specialty && !SD_MODELS.some(m => m.id === inst.specialty)) {
      errors.push(
        `实例 "${inst.name}" 的 specialty "${inst.specialty}" 无效，` +
        `可选值: ${SD_MODELS.map(m => m.id).join(', ')}`
      );
    }
  });

  return { valid: errors.length === 0, errors };
}

import fs from 'fs';
import path from 'path';

// 配置文件路径
const CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'sd-instances.json');

// ==================== 配置文件持久化 ====================

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  const configDir = path.dirname(CONFIG_FILE_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * 从文件加载实例配置
 */
function loadInstancesFromFile(): Omit<SDInstance, 'isAvailable'>[] | null {
  try {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const instances = JSON.parse(data);
      if (Array.isArray(instances) && instances.length > 0) {
        console.log(`[SD实例管理] 从文件加载 ${instances.length} 个实例`);
        return instances;
      }
    }
  } catch (error) {
    console.error('[SD实例管理] 加载配置文件失败:', error);
  }
  return null;
}

/**
 * 保存实例配置到文件
 */
function saveInstancesToFile(instances: Omit<SDInstance, 'isAvailable'>[]): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(instances, null, 2), 'utf-8');
    console.log(`[SD实例管理] 已保存 ${instances.length} 个实例到文件`);
  } catch (error) {
    console.error('[SD实例管理] 保存配置文件失败:', error);
  }
}

// ==================== 多实例分工配置 ====================

export interface SDInstance {
  id: string;
  name: string;
  url: string;
  /** 固定使用的模型文件名 */
  fixedModelFile: string;
  /** 固定使用的模型名称（显示用） */
  fixedModelName: string;
  /** 擅长的艺术风格 */
  specialty: 'anime' | 'realistic' | 'dreamy' | '';
  isDefault: boolean;
  isAvailable: boolean;
}

// 多实例配置 - 远程SD实例（通过cpolar）
const SD_INSTANCES_CONFIG: Omit<SDInstance, 'isAvailable'>[] = [
  {
    id: 'anime',
    name: '二次元实例',
    url: 'https://dreamlab0.cpolar.top',
    specialty: 'anime',
    isDefault: true,
  },
  {
    id: 'realistic',
    name: '写实实例',
    url: 'http://textimage.cpolar.top',
    specialty: 'realistic',
  },
];

// 内存中的实例状态
// 优先从文件加载，文件不存在或为空时使用默认配置
const savedInstances = loadInstancesFromFile();
let sdInstances: SDInstance[] = (savedInstances || SD_INSTANCES_CONFIG).map(config => ({
  ...config,
  isAvailable: false,
}));

// 如果是从文件加载的，说明之前有用户操作过配置
if (savedInstances) {
  console.log(`[SD实例管理] 检测到用户已自定义配置，加载 ${savedInstances.length} 个实例`);
} else {
  console.log('[SD实例管理] 使用默认配置');
}

// ==================== 模型映射配置（用于AI分析返回的风格）====================

export const AI_MODEL_TO_ARTSTYLE: Record<string, string> = {
  'anything v5': 'anime-hq',
  'anything v5.0': 'anime-hq',
  'anything': 'anime',
  '动漫': 'anime',
  '二次元': 'anime',
  'anime': 'anime',
  'dreamlike diffusion': 'dreamy',
  'dreamlike': 'dreamy',
  'realistic vision': 'realistic',
  'realistic': 'realistic',
  '写实': 'realistic',
  '照片': 'realistic',
  'photoreal': 'realistic',
};

export function convertAIModelToArtStyle(aiModel: string): string {
  if (!aiModel) return 'default';
  const normalized = aiModel.toLowerCase().trim();
  
  if (AI_MODEL_TO_ARTSTYLE[normalized]) {
    return AI_MODEL_TO_ARTSTYLE[normalized];
  }
  
  for (const [key, value] of Object.entries(AI_MODEL_TO_ARTSTYLE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  return 'default';
}

// ==================== 核心：智能路由（根据风格选实例）====================

/**
 * 根据艺术风格选择最优SD实例
 * 核心：直接路由到固定模型实例，无需切换！
 * 
 * @param artStyle 'anime' | 'realistic' | 'dreamy' | 'default'
 * @returns 选中的实例配置
 */

// 轮询计数器 - 用于在多个实例间轮换
let roundRobinIndex = 0;

// 获取所有指定风格的实例
function getInstancesBySpecialty(specialty: string): SDInstance[] {
  return sdInstances.filter(i => i.specialty === specialty);
}

// 获取下一个轮询实例（用于并行生成多张图）
export async function getNextInstanceByStyle(artStyle: string): Promise<SDInstance> {
  // 获取所有在线实例（异步检查可用性）
  const availableInstances = await getAvailableInstances();
  
  // 获取匹配的在线实例
  let targetInstances: SDInstance[];
  
  if (artStyle === 'anime' || artStyle === 'anime-hq') {
    targetInstances = availableInstances.filter(i => i.specialty === 'anime');
  } else if (artStyle === 'realistic') {
    targetInstances = availableInstances.filter(i => i.specialty === 'realistic');
  } else {
    targetInstances = availableInstances;
  }
  
  if (targetInstances.length === 0) {
    // 没有匹配的在线实例，返回第一个在线实例（如果有）
    if (availableInstances.length > 0) {
      console.log(`[路由] 风格 ${artStyle} 无匹配实例，使用第一个在线实例: ${availableInstances[0].name}`);
      return availableInstances[0];
    }
    // 【修复】0个SD在线，抛出错误
    console.error(`[路由] ❌ 没有可用的 SD 实例！`);
    throw new Error('没有可用的 SD 实例');
  }
  
  // 轮询选择
  const selectedInstance = targetInstances[roundRobinIndex % targetInstances.length];
  roundRobinIndex++;
  console.log(`[路由] 风格 ${artStyle} → ${selectedInstance.name} (${selectedInstance.url})`);
  
  return selectedInstance;
}

// 重置轮询计数器（可选，用于新请求开始时重置）
export function resetRoundRobinIndex(): void {
  roundRobinIndex = 0;
}

// 获取所有二次元相关的实例
function getAnimeInstances(): SDInstance[] {
  return sdInstances.filter(i => i.specialty === 'anime');
}

export async function selectSDInstanceByStyle(artStyle: string): Promise<SDInstance> {
  // 获取所有在线实例
  const availableInstances = await getAvailableInstances();
  
  // 二次元风格 - 轮询选择实例（实现多实例并行）
  if (artStyle === 'anime' || artStyle === 'anime-hq') {
    const animeInstances = availableInstances.filter(i => i.specialty === 'anime');
    if (animeInstances.length > 0) {
      // 轮询选择
      const selectedInstance = animeInstances[roundRobinIndex % animeInstances.length];
      roundRobinIndex++;
      console.log(`[路由] 二次元风格 → 轮询选择: ${selectedInstance.name} (${selectedInstance.fixedModelName}) [${roundRobinIndex % animeInstances.length}/${animeInstances.length}]`);
      return selectedInstance;
    }
  }
  
  if (artStyle === 'realistic') {
    const instance = availableInstances.find(i => i.specialty === 'realistic');
    if (instance) {
      console.log(`[路由] 写实风格 → 选择实例: ${instance.name} (${instance.fixedModelName})`);
      return instance;
    }
  }
  
  // 兜底：使用第一个在线实例
  if (availableInstances.length > 0) {
    const fallbackInstance = availableInstances[0];
    console.log(`[路由] 未匹配风格 → 选择实例: ${fallbackInstance.name} (${fallbackInstance.fixedModelName})`);
    return fallbackInstance;
  }
  
  // 最后的兜底：返回第一个配置实例（即使可能离线）
  if (sdInstances.length === 0) {
    throw new Error('没有配置任何 SD 实例');
  }
  console.warn(`[路由] ⚠️ 没有在线 SD 实例！使用配置中的第一个实例: ${sdInstances[0].name}`);
  return sdInstances[0];
}

/**
 * 获取实例的API URL（用于直接调用）
 */
export async function getSDApiUrlForStyle(artStyle: string): Promise<string> {
  const instance = await selectSDInstanceByStyle(artStyle);
  return instance.url;
}

// ==================== 双模式核心函数 ====================

// 关键词正则缓存（性能优化）
const keywordRegexCache = new Map<string, RegExp>();

/**
 * 获取模型的关键词正则表达式（带缓存）
 */
function getKeywordRegex(modelId: string): RegExp | null {
  if (keywordRegexCache.has(modelId)) {
    return keywordRegexCache.get(modelId)!;
  }

  const model = SD_MODELS.find(m => m.id === modelId);
  if (!model || model.keywords.length === 0) return null;

  // 转义特殊字符并构建正则
  const escapedKeywords = model.keywords.map(k => 
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(escapedKeywords.join('|'), 'i');
  keywordRegexCache.set(modelId, regex);
  return regex;
}

/**
 * 检测提示词类型（返回模型ID）
 */
export function detectPromptType(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();

  for (const model of SD_MODELS) {
    const regex = getKeywordRegex(model.id);
    if (regex && regex.test(lowerPrompt)) {
      return model.id;
    }
  }
  return 'realistic'; // 兜底返回写实类型
}

/**
 * 获取目标模型（单台模式用）
 */
export function getTargetModel(artStyle?: string): SDModel {
  if (artStyle && artStyle !== 'default') {
    const model = SD_MODELS.find(m => m.id === artStyle);
    if (model) return model;
  }
  return SD_MODELS.find(m => m.id === 'realistic')!;
}

/**
 * 获取可用的、有 specialty 的实例列表
 */
export async function getAvailableInstances(): Promise<SDInstance[]> {
  const results = await Promise.all(
    sdInstances
      .filter(inst => inst.url) // 只看有 URL 的实例
      .map(async (inst) => {
        const available = await checkSDAvailability(inst.url);
        if (!available) return null;
        
        // 自动检测模型并设置 specialty（相似度识别）
        const detectedSpecialty = await detectModelSpecialty(inst.url);
        if (detectedSpecialty) {
          inst.specialty = detectedSpecialty;
          console.log(`[SD实例管理] 自动识别 ${inst.name} 为 ${detectedSpecialty === 'anime' ? '二次元' : '写实'} 实例`);
        }
        
        return inst;
      })
  );
  return results.filter(Boolean) as SDInstance[];
}

/**
 * 检测SD实例中已加载模型的专长类型（相似度识别）
 * 使用连续子串匹配公式：匹配的连续字母数 / 短字符串总字母数
 */
async function detectModelSpecialty(url: string): Promise<'anime' | 'realistic' | null> {
  try {
    const response = await fetch(`${url}/sdapi/v1/sd-models`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) return null;
    
    const models = await response.json();
    if (!Array.isArray(models) || models.length === 0) return null;
    
    // 获取当前加载的模型（通常在第一位或标记为 current）
    const currentModel = models.find((m: any) => m.title?.includes('*')) || models[0];
    if (!currentModel?.title) return null;
    
    const modelName = currentModel.title.toLowerCase();
    console.log(`[模型检测] 当前模型: ${currentModel.title}`);
    
    // 标准模型名称（用于匹配）
    const animeModels = [
      'anything-v5', 'anythingv5', 'anything-v3', 'anythingv3',
      'novelai', 'nai', 'counterfeit', 'setzer', '7thsea',
      'dreamlike', 'pastel', 'toon', 'meina', 'meinamix',
      'flat', 'anime2', 'chara', 'kawaii', '萌系'
    ];
    
    const realisticModels = [
      'realistic-vision', 'realistic_vision', 'realisticvision',
      'sd-15', 'sd15', 'v1.5', 'v2.1', 'v3.1', 'sdxl', 'xl',
      'majicmix', 'majic', '麦橘', 'revanimated', 'juggernaut',
      'deliberate', 'cyberrealistic', 'perfect', 'lofi', 'icbinp',
      'henmix', 'samaritan', 'pony', 'ponydiffusion', 'furry'
    ];
    
    // 计算最长公共连续子串匹配度
    function lcsMatchRatio(shortStr: string, longStr: string): number {
      const s = shortStr.toLowerCase();
      const l = longStr.toLowerCase();
      
      // 如果短字符串包含在长字符串中，直接返回 1.0
      if (l.includes(s)) return 1.0;
      
      // 动态规划找最长公共连续子串
      let maxLen = 0;
      const dp: number[][] = Array(s.length + 1).fill(null).map(() => Array(l.length + 1).fill(0));
      
      for (let i = 1; i <= s.length; i++) {
        for (let j = 1; j <= l.length; j++) {
          if (s[i - 1] === l[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1] + 1;
            maxLen = Math.max(maxLen, dp[i][j]);
          }
        }
      }
      
      // 返回匹配度：最长匹配长度 / 短字符串长度
      return maxLen / s.length;
    }
    
    // 找出最佳匹配的二次元和写实模型
    let bestAnimeScore = 0;
    let bestRealisticScore = 0;
    let bestAnimeModel = '';
    let bestRealisticModel = '';
    
    for (const animeModel of animeModels) {
      const ratio = lcsMatchRatio(animeModel, modelName);
      if (ratio > bestAnimeScore) {
        bestAnimeScore = ratio;
        bestAnimeModel = animeModel;
      }
    }
    
    for (const realisticModel of realisticModels) {
      const ratio = lcsMatchRatio(realisticModel, modelName);
      if (ratio > bestRealisticScore) {
        bestRealisticScore = ratio;
        bestRealisticModel = realisticModel;
      }
    }
    
    console.log(`[模型检测] 最佳匹配 - 二次元: ${bestAnimeModel}(${(bestAnimeScore * 100).toFixed(1)}%), 写实: ${bestRealisticModel}(${(bestRealisticScore * 100).toFixed(1)}%)`);
    
    // 设定阈值 50%，超过阈值才认定匹配
    if (bestAnimeScore >= 0.5 && bestAnimeScore > bestRealisticScore) {
      return 'anime';
    }
    if (bestRealisticScore >= 0.5 && bestRealisticScore > bestAnimeScore) {
      return 'realistic';
    }
    
    // 如果都不够阈值，尝试部分匹配（30%阈值）
    if (bestAnimeScore >= 0.3 && bestAnimeScore > bestRealisticScore) {
      console.log(`[模型检测] 使用宽松阈值，二次元: ${bestAnimeModel}(${(bestAnimeScore * 100).toFixed(1)}%)`);
      return 'anime';
    }
    if (bestRealisticScore >= 0.3 && bestRealisticScore > bestAnimeScore) {
      console.log(`[模型检测] 使用宽松阈值，写实: ${bestRealisticModel}(${(bestRealisticScore * 100).toFixed(1)}%)`);
      return 'realistic';
    }
    
    return null;
  } catch (error) {
    console.log(`[模型检测] 检测失败:`, error);
    return null;
  }
}

/**
 * 核心选择函数 - 根据可用实例自动选择模式
 * 
 * @param prompt 提示词（用于检测类型）
 * @param artStyle 用户选择的风格
 * @returns 选择结果（模式 + 实例/模型）
 */
export async function selectSDTarget(
  prompt: string,
  artStyle?: string
): Promise<{
  mode: 'single' | 'multi';
  instance?: SDInstance;
  model?: SDModel;
}> {
  const availableInstances = await getAvailableInstances();

  // 按 specialty 分组
  const instancesBySpecialty: Record<string, SDInstance> = {};
  availableInstances.forEach(inst => {
    if (inst.specialty) {
      instancesBySpecialty[inst.specialty] = inst;
    }
  });

  const hasAnime = instancesBySpecialty['anime'];
  const hasRealistic = instancesBySpecialty['realistic'];

  // 【多台模式】同时有 anime 和 realistic 实例
  if (hasAnime && hasRealistic) {
    const targetModelId = detectPromptType(prompt);
    const instance = instancesBySpecialty[targetModelId] || hasAnime || hasRealistic;

    console.log(`[多台模式] 检测到 ${availableInstances.length} 个可用实例`);
    console.log(`[多台模式] 提示词类型: ${targetModelId} → 路由到 ${instance?.name}`);

    return { mode: 'multi', instance };
  }

  // 【单台模式】可用实例不足，回退到单台模式
  const targetModel = getTargetModel(artStyle || detectPromptType(prompt));
  console.log(`[单台模式] 可用实例不足（${availableInstances.length}），回退到单台模式`);
  console.log(`[单台模式] 目标模型: ${targetModel.name}`);

  return { mode: 'single', model: targetModel };
}

// ==================== 兼容旧接口 ====================

export function getSDInstances(): SDInstance[] {
  return sdInstances;
}

export async function checkSDAvailability(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/sdapi/v1/sd-models`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 兼容旧接口：检查所有实例可用性
export async function checkAllSDAvailability(): Promise<SDInstance[]> {
  const updatedInstances = await Promise.all(
    sdInstances.map(async (instance) => {
      const isAvailable = await checkSDAvailability(instance.url);
      return { ...instance, isAvailable };
    })
  );
  sdInstances = updatedInstances;
  return updatedInstances;
}

// 获取指定实例的当前模型
export async function getCurrentSDModel(url: string): Promise<string | null> {
  try {
    const optionsResponse = await fetch(`${url}/sdapi/v1/options`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });
    
    if (optionsResponse.ok) {
      const options = await optionsResponse.json();
      if (options?.sd_model_checkpoint) {
        console.log(`[SD] 从options获取到当前模型: ${options.sd_model_checkpoint}`);
        return options.sd_model_checkpoint;
      }
    }
    
    const modelsResponse = await fetch(`${url}/sdapi/v1/sd-models`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });
    
    if (!modelsResponse.ok) return null;
    
    const models = await modelsResponse.json();
    const activeModel = models?.find((m: any) => m?.title && m?.model_name);
    return activeModel?.title || activeModel?.model_name || models?.[0]?.title || models?.[0]?.model_name || null;
  } catch (error) {
    console.error('[SD] 获取当前模型失败:', error);
    return null;
  }
}

// 检查实例是否已加载正确的模型
export async function verifyInstanceModel(instance: SDInstance): Promise<boolean> {
  try {
    const currentModel = await getCurrentSDModel(instance.url);
    if (!currentModel) return false;
    
    // 模糊匹配：检查当前模型是否包含期望模型的关键字
    const expected = instance.fixedModelFile.toLowerCase();
    const current = currentModel.toLowerCase();
    
    // anything 相关匹配
    if (expected.includes('anything') && current.includes('anything')) return true;
    // realistic 相关匹配
    if (expected.includes('realistic') && current.includes('realistic')) return true;
    // dreamlike 相关匹配
    if (expected.includes('dreamlike') && current.includes('dreamlike')) return true;
    
    // 精确匹配
    if (current.includes(expected) || expected.includes(current.replace('.safetensors', '').replace('.ckpt', ''))) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

// 切换模型（带重试机制）
export async function switchSDModel(url: string, modelFile: string, retryCount = 0): Promise<boolean> {
  const MAX_RETRIES = 2;
  
  try {
    console.log(`\n========== [模型切换] 开始${retryCount > 0 ? ` (第${retryCount + 1}次尝试)` : ''} ==========`);
    console.log(`[SD] 目标模型文件: ${modelFile}`);
    
    const currentModel = await getCurrentSDModel(url);
    console.log(`[SD] 当前模型: ${currentModel}`);
    
    // 简化匹配逻辑
    const targetModelName = modelFile.replace('.safetensors', '').replace('.ckpt', '');
    if (currentModel) {
      const currentModelLower = currentModel.toLowerCase();
      const targetModelLower = targetModelName.toLowerCase();
      
      if ((targetModelLower.includes('anything') && currentModelLower.includes('anything')) ||
          (targetModelLower.includes('realistic') && currentModelLower.includes('realistic')) ||
          (targetModelLower.includes('dreamlike') && currentModelLower.includes('dreamlike')) ||
          currentModelLower.includes(targetModelLower) ||
          targetModelLower.includes(currentModelLower)) {
        console.log(`[SD] 当前模型已经匹配，跳过切换 ✅`);
        console.log(`========== [模型切换] 完成 ==========\n`);
        return true;
      }
    }
    
    // 映射文件名
    const modelMapping: Record<string, string> = {
      'anything-v5.safetensors': 'anything-v5.safetensors',
      'anythingV5.safetensors': 'anything-v5.safetensors',
      'Realistic_Vision_V2.0-fp16-no-ema.safetensors': 'Realistic_Vision_V2.0-fp16-no-ema.safetensors',
      'dreamlikeDiffusion10_10.ckpt': 'dreamlikeDiffusion10_10.ckpt',
    };
    const actualModelFile = modelMapping[modelFile] || modelFile;
    
    console.log(`[SD] 发送切换请求...`);
    
    const response = await fetch(`${url}/sdapi/v1/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sd_model_checkpoint: actualModelFile }),
    });
    
    if (!response.ok) {
      console.error(`[SD] ❌ 切换失败: ${response.status}`);
      
      // 重试机制
      if (retryCount < MAX_RETRIES) {
        console.log(`[SD] 1秒后重试...`);
        await new Promise(r => setTimeout(r, 1000));
        return switchSDModel(url, modelFile, retryCount + 1);
      }
      
      console.log(`[SD] 重试${MAX_RETRIES}次后仍失败，继续使用当前模型`);
      console.log(`========== [模型切换] 失败但继续 ==========\n`);
      return true; // 切换失败但继续用当前模型
    }
    
    console.log(`[SD] ✅ 切换请求已发送`);
    console.log(`========== [模型切换] 完成 ==========\n`);
    return true;
  } catch (error) {
    console.error('[SD] ❌ 切换出错:', error);
    
    // 重试机制
    if (retryCount < MAX_RETRIES) {
      console.log(`[SD] 1秒后重试...`);
      await new Promise(r => setTimeout(r, 1000));
      return switchSDModel(url, modelFile, retryCount + 1);
    }
    
    console.log(`[SD] 重试${MAX_RETRIES}次后仍失败，继续使用当前模型`);
    console.log(`========== [模型切换] 出错但继续 ==========\n`);
    return true; // 即使出错也继续用当前模型
  }
}

/**
 * 根据艺术风格获取模型配置（用于兼容旧代码）
 */
export async function getModelForStyle(artStyle: string): Promise<{ modelName: string; modelFile: string }> {
  // 直接从实例配置中获取
  const instance = await selectSDInstanceByStyle(artStyle);
  return {
    modelName: instance.fixedModelName,
    modelFile: instance.fixedModelFile,
  };
}

/**
 * 获取所有可用模型列表（用于前端展示）
 */
export function getAvailableModelsList() {
  return sdInstances.map(instance => ({
    category: instance.specialty,
    name: instance.fixedModelName,
    description: getSpecialtyDescription(instance.specialty),
    instanceId: instance.id,
    instanceUrl: instance.url,
  }));
}

function getSpecialtyDescription(specialty: string): string {
  switch (specialty) {
    case 'anime':
      return '适合动漫角色、萌系画风、精细人物';
    case 'realistic':
      return '适合真实人物、摄影风格、写实场景';
    case 'dreamy':
      return '适合梦幻场景、氛围渲染、艺术插画';
    default:
      return '通用风格';
  }
}

// ==================== 模块初始化 ====================

/**
 * 初始化时校验配置
 */
function initConfigValidation() {
  if (process.env.NODE_ENV === 'development') {
    const { valid, errors } = validateSDConfig();
    if (!valid) {
      console.error('[SD配置错误]', errors);
    } else {
      console.log('[SD配置校验通过] 共', sdInstances.length, '个实例配置');
    }
  }
}

// 添加新实例
export function addSDInstance(name: string, url: string): SDInstance[] {
  // 生成唯一 ID
  const id = `custom-${Date.now()}`;
  
  const newInstance: Omit<SDInstance, 'isAvailable'> = {
    id,
    name,
    url: url.endsWith('/') ? url.slice(0, -1) : url,
    fixedModelFile: '',  // 用户自定义实例不预设模型
    fixedModelName: '待配置',
    specialty: '',       // 用户需要手动设置
    isDefault: false,
  };
  
  sdInstances.push({ ...newInstance, isAvailable: false });
  console.log(`[SD实例管理] 添加实例: ${name} (${url})`);
  
  // 保存到文件
  saveInstancesToFile(sdInstances);
  
  return sdInstances;
}

// 删除实例
export function removeSDInstance(id: string): SDInstance[] {
  const index = sdInstances.findIndex(i => i.id === id);
  if (index !== -1) {
    const removed = sdInstances[index];
    sdInstances.splice(index, 1);
    console.log(`[SD实例管理] 删除实例: ${removed.name} (${removed.url})`);
    
    // 保存到文件（删除优先）
    saveInstancesToFile(sdInstances);
  }
  return sdInstances;
}

// 设置优先实例（调整顺序，把指定的实例放到第一位）
export function setPreferredInstance(id: string): SDInstance[] {
  const index = sdInstances.findIndex(i => i.id === id);
  if (index === -1) {
    return sdInstances;
  }
  
  // 把选中的实例移到第一位
  const [selected] = sdInstances.splice(index, 1);
  sdInstances.unshift(selected);
  
  // 更新 isDefault 标志
  sdInstances = sdInstances.map((inst, idx) => ({
    ...inst,
    isDefault: idx === 0,
  }));
  
  console.log(`[SD实例管理] 设置优先实例: ${selected.name}`);
  
  // 保存到文件
  saveInstancesToFile(sdInstances);
  
  return sdInstances;
}

// 执行初始化校验
initConfigValidation();

// ==================== 定期检查和自动切换模型 ====================

// 每5分钟检查一次实例模型是否正确
const MODEL_CHECK_INTERVAL = 5 * 60 * 1000;

async function checkAndSwitchModels() {
  console.log('[SD定时检查] 开始检查实例模型...');
  
  for (const instance of sdInstances) {
    if (!instance.specialty || !instance.fixedModelFile) continue;
    
    try {
      const isMatch = await verifyInstanceModel(instance);
      if (!isMatch) {
        console.log(`[SD定时检查] ${instance.name} 模型不匹配，自动切换...`);
        await switchSDModel(instance.url, instance.fixedModelFile);
      } else {
        console.log(`[SD定时检查] ${instance.name} 模型正常`);
      }
    } catch (e) {
      console.error(`[SD定时检查] ${instance.name} 检查失败:`, e);
    }
  }
}

// 定时检查启动标志
let isModelCheckStarted = false;

// 启动定时检查（仅在服务器端运行时调用）
export function startModelCheckTimer() {
  if (typeof window === 'undefined' && !isModelCheckStarted) {
    isModelCheckStarted = true;
    setInterval(checkAndSwitchModels, MODEL_CHECK_INTERVAL);
    console.log('[SD定时检查] 已启动，每5分钟检查一次');
    // 延迟执行第一次检查，避免启动时阻塞
    setTimeout(checkAndSwitchModels, 10000);
  }
}

// ==================== SD 中断生成 ====================

/**
 * 中断指定 SD 实例的生成任务
 * 调用 SD WebUI 的 /sdapi/v1/interrupt API
 * 
 * @param instanceUrl SD 实例 URL
 * @returns 是否成功中断
 */
export async function interruptSDGeneration(instanceUrl: string): Promise<boolean> {
  try {
    const url = instanceUrl.endsWith('/') ? instanceUrl.slice(0, -1) : instanceUrl;
    const response = await fetch(`${url}/sdapi/v1/interrupt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      console.log(`[SD中断] 成功中断 ${instanceUrl} 的生成任务`);
      return true;
    } else {
      console.error(`[SD中断] 中断失败: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`[SD中断] 调用中断 API 出错:`, error);
    return false;
  }
}

/**
 * 中断所有 SD 实例的生成任务
 * 用于用户点击取消时，确保所有实例都停止生成
 * 
 * @returns 每个实例的中断结果
 */
export async function interruptAllSDGenerations(): Promise<{ instance: string; success: boolean }[]> {
  const results: { instance: string; success: boolean }[] = [];
  
  // 获取所有实例（包括离线的，因为生成任务可能还在运行）
  const allInstances = sdInstances;
  
  console.log(`[SD中断] 正在中断 ${allInstances.length} 个实例的生成任务...`);
  
  await Promise.all(
    allInstances.map(async (instance) => {
      const success = await interruptSDGeneration(instance.url);
      results.push({ instance: instance.name, success });
    })
  );
  
  const successCount = results.filter(r => r.success).length;
  console.log(`[SD中断] 完成: ${successCount}/${allInstances.length} 个实例成功中断`);
  
  return results;
}
