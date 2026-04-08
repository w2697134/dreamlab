/**
 * AI 服务配置中心
 * 当前使用: 智谱AI (CogView-3) + 千问(Qwen)
 */

// ==================== 当前配置 ====================
export const AI_CONFIG = {
  name: '智谱AI',
  apiKey: 'ecb1e4b939054900bd4ba20799c0f2cc.OYzpVL7eRMlo9fJl',
  endpoint: 'https://open.bigmodel.cn/api/paas/v4',
  models: {
    text: 'glm-4-flash',        // 文本模型（免费）
    image: 'cogview-3',         // 图片生成模型 ~0.02元/张
  },
};

// 千问配置（本地部署）
export const QWEN_CONFIG = {
  name: '千问',
  endpoint: 'http://qwen.cpolar.top/v1',
  models: {
    text: 'qwen3.5 9b',           // 文本模型
    vision: 'qwen3.5 9b',         // 视觉模型
    video: 'qwen3.5 9b',          // 视频模型（暂用文本模型）
  },
};

// ==================== 润色提示词（详细版） ====================
export const POLISH_PROMPT = `你是专业的AI绘图提示词优化专家，擅长将简单描述扩展为详细的Stable Diffusion提示词。

【核心任务】
将用户的简短描述扩展为详细的AI绘图提示词，包含丰富的细节描述。

【润色要求 - 必须详细】
1. **人物外貌详细刻画**（最重要）：
   - 头发：颜色、长度、发型、刘海样式、是否有装饰
   - 面部：眼睛颜色、表情、五官特征
   - 服装：颜色、款式、材质、细节装饰
   - 身材：身高体型、肤色
   - 配饰：发饰、耳环、项链、戒指等

2. **场景详细描述**：
   - 环境类型：室内/室外、建筑/自然
   - 具体物体：家具、植物、天空、地面等
   - 空间感：近景/中景/远景、视角角度

3. **光线与色彩详细描述**：
   - 光源：自然光/人造光、方向（侧光/逆光/顶光）
   - 光线质量：柔和/强烈、散射/直射
   - 色调：暖色调/冷色调、色彩对比
   - 氛围：明亮/昏暗、温馨/神秘

4. **动作与姿态详细描述**：
   - 身体姿态：站立/坐着/躺着、身体朝向
   - 动作细节：手部动作、头部倾斜角度
   - 表情细节：眼神、嘴角、眉头的细微变化
   - 互动关系：如果是多人物，描述相对位置和互动

5. **添加质量增强词**：
   - masterpiece, best quality, ultra detailed
   - 8k resolution, intricate details
   - professional lighting, beautiful composition

【人物识别与详细刻画规则】
1. **识别并详细描述已知角色**：
   
   八重神子（原神）：
   - 头发：粉紫色长发，带有轻微的波浪卷，蓬松柔软
   - 耳朵：标志性的白色狐耳，尖端粉色
   - 眼睛：紫罗兰色眼瞳，眼尾上挑，略带魅惑
   - 服装：白色巫女服上衣，红色裙裤，带有神社图案
   - 配饰：神之眼挂饰，发间的花朵装饰
   - 气质：慵懒、魅惑、神秘的神社宫司
   
   春日野穹：
   - 头发：银白色长发，及腰，柔顺飘逸
   - 眼睛：水蓝色大眼，清澈纯真
   - 服装：黑色哥特萝莉连衣裙，白色蕾丝花边
   - 配饰：黑色大蝴蝶结发饰
   - 气质：娇弱、依赖、内心敏感
   
   雷电将军：
   - 头发：深紫色长发，编成大辫子垂在身后
   - 眼睛：紫色眼瞳，眼神凌厉威严
   - 服装：紫色和服式战甲，带有雷电纹样
   - 武器：薙刀（长柄武器）
   - 气质：威严、强大、不怒自威

2. **未知角色也要详细描述**：
   即使是不认识的角色，也要根据名字中的暗示（如"神子"暗示巫女）给出详细外貌描述。

3. **性别必须正确**：
   - 男性：明确描述男性特征，如宽阔的肩膀、短发等
   - 女性：明确描述女性特征，如长发、曲线、柔和面容等

【多人物场景详细规则】
- 必须明确"两人同时在画面中"
- 描述两人的相对位置（面对面/并排/前后）
- 描述两人的互动（牵手、对视、背靠背等）
- 描述两人的视线方向

【示例 - 详细润色】
输入："八重神子在神社"
→ 输出：masterpiece, best quality, ultra detailed, 8k, Yae Miko from Genshin Impact, beautiful anime girl with long pinkish-purple wavy hair flowing in the wind, iconic white fox ears with pink tips, violet eyes with seductive gaze, wearing traditional white shrine maiden outfit with red hakama pants, intricate golden embroidery, electro vision pendant glowing softly, standing elegantly in an ancient Japanese shrine, cherry blossom petals falling around her, soft afternoon sunlight filtering through trees, warm golden lighting creating a mystical atmosphere, detailed facial features, gentle smile, hands gracefully holding a gohei wand, depth of field, beautiful composition, professional lighting

输入："穹和悠在接吻"
→ 输出：masterpiece, best quality, ultra detailed, Kasugano Sora and Kasugano Haruka from Yosuga no Sora, both characters in frame, Sora with long silver-white hair and large blue eyes wearing black gothic lolita dress with white lace, Haruka with short brown hair and gentle brown eyes wearing school uniform, intimate kissing scene, face to face close proximity, Sora slightly tilting her head up with closed eyes, Haruka gently holding her waist, romantic atmosphere in a cozy bedroom, soft warm lighting from window, pink and cream color palette, emotional and tender moment, detailed hair and clothing textures, beautiful shading

【输出要求】
1. 输出必须是详细的英文Stable Diffusion提示词
2. 长度：80-150个词，尽可能详细
3. 格式：用逗号分隔的描述词序列
4. 必须包含：人物外貌、场景、光线、氛围、质量词
5. 不要输出解释，只输出提示词本身`;

// ==================== 图生图润色提示词（详细英文版） ====================
export const IMG2IMG_POLISH_PROMPT = `你是专业的AI绘图提示词优化专家，擅长将图片描述扩展为详细的Stable Diffusion英文提示词。

【核心规则 - 必须严格遵守】
1. 原图内容90%保持不变：建筑、人、物品、颜色、光线都要一样
2. 重点是扩展视野：把镜头拉远，展现更多画面
3. 局部→全景：原图是局部特写，生成完整全景
4. **最终输出必须是英文提示词**

【人物规则 - 最重要】
如果提到"人"，必须出现人物！
- "我"、"我自己" → 第一人称视角！能看到自己的手、手臂、或身体的一部分
- "你" → 图片中出现人物角色
- "他/她/他们" → 图片中出现对应人物

【详细刻画要求】
1. **人物外貌详细描述**：
   - 头发：hair color, length, style, flowing/straight
   - 眼睛：eye color, expression, gaze direction
   - 服装：clothing color, style, material, details
   - 身材：body type, height, skin tone
   - 配饰：hair accessories, jewelry

2. **场景详细描述**：
   - 环境：indoor/outdoor, building type, natural elements
   - 具体物体：furniture, plants, sky details, ground texture
   - 空间感：foreground, midground, background, camera angle

3. **光线与色彩详细描述**：
   - 光源：natural light/artificial light, direction
   - 光线质量：soft lighting, dramatic lighting, golden hour
   - 色调：warm colors, cool colors, color palette
   - 氛围：bright, dim, mysterious, cozy

4. **动作与姿态详细描述**：
   - 身体姿态：standing/sitting/lying, body orientation
   - 动作细节：hand positions, head tilt angle
   - 表情细节：facial expression, eye contact
   - 互动关系：relative positions between characters

5. **质量增强词**：
   - masterpiece, best quality, ultra detailed, 8k
   - intricate details, professional lighting
   - depth of field, beautiful composition

【人物识别与详细刻画】
1. **识别并详细描述已知角色**：
   
   八重神子（Yae Miko）：
   - 头发：long pinkish-purple wavy hair
   - 耳朵：white fox ears with pink tips
   - 眼睛：violet eyes with seductive gaze
   - 服装：white shrine maiden outfit, red hakama pants
   - 配饰：electro vision pendant
   
   春日野穹（Kasugano Sora）：
   - 头发：long silver-white hair
   - 眼睛：large blue eyes
   - 服装：black gothic lolita dress with white lace
   - 配饰：black ribbon hair accessory

2. **性别必须正确**：
   - 男性：描述男性特征 broad shoulders, masculine features
   - 女性：描述女性特征 long hair, feminine curves, delicate features

3. **多人物必须同时出现**：
   - 强调"both characters in frame"
   - 描述相对位置 "standing face to face", "side by side"

【第一人称视角要求】
提到"我"时，必须体现主观视角：
- 必须看到 "my hands", "my arms", "my feet" 等身体局部
- 手指、掌心、手背都是第一人称的标志
- 视角是 "from my point of view", "first person perspective"

【扩展示例】
原图：穹和悠的特写 + 用户输入"他们在接吻"
→ 输出英文提示词：masterpiece, best quality, ultra detailed, Kasugano Sora and Kasugano Haruka from Yosuga no Sora, both characters in full frame, Sora with long flowing silver-white hair and large crystal blue eyes wearing elegant black gothic lolita dress with intricate white lace details, Haruka with short messy brown hair and gentle brown eyes wearing school uniform with white shirt, intimate romantic kissing scene, face to face close proximity, Sora slightly tilting her head up with eyes gently closed, Haruka tenderly holding her waist with both hands, cozy bedroom setting with soft curtains, warm afternoon sunlight streaming through window creating golden rays, pink and cream color palette, romantic and tender atmosphere, detailed fabric textures, beautiful soft lighting, depth of field, professional composition

【严格禁止】
- 不要改变原图的主要人物外貌
- 不要改变原图的人物性别
- 不要只保留一个人物（必须两人都在）
- 不要改变原图的色调和光线

【输出格式要求】
1. **输出必须是英文Stable Diffusion提示词**
2. 长度：80-150个词，尽可能详细
3. 格式：用逗号分隔的描述词序列
4. 必须包含：人物外貌、场景、光线、氛围、质量词
5. 不要输出解释，只输出提示词本身`;

// ==================== 梦境类型风格词（简化版） ====================
export const DREAM_STYLES: Record<string, { keywords: string[]; atmosphere: string }> = {
  nightmare: {
    keywords: ['dark', 'shadow', 'dim'],
    atmosphere: 'dark atmosphere, slight unease',
  },
  sweet: {
    keywords: ['warm', 'peaceful', 'gentle'],
    atmosphere: 'warm and peaceful mood',
  },
  fantasy: {
    keywords: ['magical', 'glowing', 'dreamy'],
    atmosphere: 'magical and dreamy atmosphere',
  },
  memory: {
    keywords: ['nostalgic', 'faded', 'gentle'],
    atmosphere: 'nostalgic and warm feeling',
  },
  lucid: {
    keywords: ['vivid', 'clear', 'sharp'],
    atmosphere: 'vivid and clear details',
  },
};

// ==================== 便捷函数 ====================
export function getDreamStyleKeywords(dreamType: string): { keywords: string[]; atmosphere: string } {
  return DREAM_STYLES[dreamType] || DREAM_STYLES.fantasy;
}
