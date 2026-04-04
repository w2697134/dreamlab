# 忆梦空间 - 项目交接文档

> 整理人：Claude
> 整理时间：2025年
> 适用对象：接手该项目的开发者

---

## 一、项目概述

### 1.1 项目名称
**忆梦空间** - AI梦境图片生成与心理评估系统

### 1.2 核心价值
用户描述梦境 → AI生成梦境图片 → 心理状态分析评估

### 1.3 目标用户
- 需要释放压力、探索潜意识的成年人
- 对AI生成艺术感兴趣的用户
- 心理咨询/自我探索场景

### 1.4 技术栈
| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5 |
| UI库 | shadcn/ui + Tailwind CSS 4 |
| 后端 | Next.js API Routes |
| 数据库 | Supabase (PostgreSQL) |
| 对象存储 | S3兼容存储 |
| AI服务 | 豆包(Doubao) / 智谱AI(CogView) |
| 图像生成 | Stable Diffusion WebUI (本地部署) |

---

## 二、功能模块详解

### 2.1 首页 (`src/app/page.tsx` - 318行)
**功能**：landing page + 用户入口

**核心元素**：
- 星星闪烁动画背景（Canvas 或 CSS）
- 云朵浮动按钮（引导进入dream页面）
- 暗色/浅色主题切换
- 登录/注册入口

**状态管理**：
- 主题状态来自 `ThemeProvider`
- 用户登录状态来自 `AuthProvider`

---

### 2.2 梦境生成页 (`src/app/dream/page.tsx` - 3437行) ⚠️ 核心页面

**功能**：用户输入梦境描述 → AI生成4张风格不同的图片

**用户流程**：
```
1. 输入梦境描述（支持AI润色）
2. 上传参考图片（可选）
3. 选择风格参数：
   - 梦境类型：默认/美梦/噩梦/奇幻/回忆/清醒梦
   - 艺术风格：默认/动漫/写实
4. 点击生成
5. 观看流式生成过程
6. 保存到梦境库
7. 可选：生成视频
```

**核心交互**：
- **草稿自动保存**：每3秒保存到localStorage，key: `dreamDraft`
- **图生图模式**：上传参考图，基于参考图生成
- **流式输出**：SSE协议实时显示生成进度
- **全局状态**：`GenerationProvider` 管理生成状态

**重要文件依赖**：
```typescript
// API调用
POST /api/generate-image-batch    // 批量生成
POST /api/analyze-prompt          // 分析提示词
POST /api/polish-text             // 润色文本
GET  /api/sd-config               // 获取SD配置

// 本地工具
src/lib/sd-config.ts              // SD实例路由
src/lib/ai-config.ts              // AI提示词配置
src/lib/auth-token.ts             // Token管理
```

---

### 2.3 批量生成API (`src/app/api/generate-image-batch/route.ts` - 1546行)

**这是最复杂的API**，负责：
1. 接收用户输入（提示词、风格参数）
2. 调用AI润色提示词（豆包模型）
3. 翻译为英文
4. 智能路由到SD实例
5. 并行生成4张图片
6. 上传到对象存储
7. 保存到数据库
8. SSE流式返回进度

**核心逻辑 - 场景识别**：
```typescript
// 【严格】二次元检测关键词（只有这些才走二次元）：
- 原神角色：yae miko, raiden shogun, nahida, furina...
- 明确要求：anime style, 动漫风格, 二次元风格
- 其他游戏：kasugano sora(春日野穹), 初音未来, 蕾姆拉姆

// 写实场景：所有非二次元的场景默认走写实
```

**智能Sampler选择**：
- 检测到特定角色 → `DDIM`（更稳定）
- 普通场景 → `DPM++ 2M Karras`（效果柔和）

**多实例路由**：
```typescript
// src/lib/sd-config.ts 定义的实例：
- 二次元实例: https://2dbeb2d3.r18.cpolar.top (anything-v5)
- 写实实例: https://61d7c604.r8.vip.cpolar.cn (Realistic Vision)

selectSDInstanceByStyle('anime') → 返回二次元实例
selectSDInstanceByStyle('realistic') → 返回写实实例
```

---

### 2.4 生成结果页 (`src/app/dream/result/page.tsx` - 1204行)

**功能**：展示生成的图片集

**功能点**：
- 网格展示4张图片
- 放大查看单张
- 保存到梦境集
- 重新生成某张（图生图调整）
- 生成视频（多图串联）
- AI解读梦境

---

### 2.5 梦境库 (`src/app/dreams/page.tsx` - 817行)

**功能**：管理用户保存的梦境

**数据结构**：
```typescript
interface DreamCollection {
  id: string;
  title: string;
  cover_url: string;
  has_video: boolean;
  image_count: number;
  created_at: string;
  dreams: Dream[];
}

interface Dream {
  id: string;
  prompt: string;
  image_url: string;
  video_url?: string;
  dream_type: string;
  art_style: string;
  created_at: string;
}
```

**操作**：
- 展开/收起梦境集
- 删除梦境（单个）
- 删除梦境集（全部）
- 恢复孤立梦境（数据修复）
- 去心理评估

---

### 2.6 心理评估 (`src/app/assessment/page.tsx` - 1174行)

**功能**：基于梦境内容进行心理压力测评

**流程**：
```
1. 输入梦境描述 或 选择梦境库图片
2. AI分析梦境 → 动态生成心理测评题目
3. 用户答题（多选题）
4. 计算结果 → 可视化展示
```

**评估维度**：
- 压力水平（0-100）
- 压力来源：工作/人际关系/情绪/自我/生活
- 应对风格：积极/消极/回避
- 情绪状态：焦虑/抑郁/韧性
- 人格洞察

**结果保存**：localStorage（按collectionId索引）

---

### 2.7 用户中心 (`src/app/profile/page.tsx` - 759行)

**功能**：
- 个人信息管理
- 主题偏好设置
- 账户设置
- 开发者选项（Debug按钮）

---

### 2.8 SD管理 (`src/app/sd-manager/page.tsx` - 530行)

**功能**：
- 查看SD实例状态（在线/离线）
- 查看当前加载的模型
- 手动切换模型
- 配置文件管理（`data/sd-instances.json`）

---

## 三、API接口清单

### 3.1 图像生成

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/generate-image-batch` | POST | 批量生成4张图片，流式返回 |
| `/api/generate-image` | POST | 单张生成（备用） |
| `/api/adjust-image` | POST | 图生图调整 |
| `/api/generate-video` | POST | 图片生成视频 |
| `/api/generate-progress` | GET | 获取生成进度 |

### 3.2 梦境管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/dream-collections` | GET | 获取所有梦境集 |
| `/api/dream-collections` | POST | 创建梦境集 |
| `/api/dream-collections` | DELETE | 删除梦境集 |
| `/api/dream-collections/recover` | POST | 恢复孤立数据 |
| `/api/dreams` | GET/POST | 梦境CRUD |
| `/api/dreams/[id]` | GET/DELETE | 单个梦境操作 |

### 3.3 心理评估

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/psychology-test` | POST | 生成题目/计算结果 |

### 3.4 AI服务

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/polish-text` | POST | 润色梦境描述 |
| `/api/analyze-prompt` | POST | 分析提示词 |
| `/api/summarize-dream` | POST | 总结梦境 |
| `/api/interpret-dream` | POST | 解读梦境 |
| `/api/analyze-mood` | POST | 心情分析 |

### 3.5 认证

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 登录 |
| `/api/auth/register` | POST | 注册 |
| `/api/auth/refresh` | POST | 刷新Token |
| `/api/auth/reset-password` | POST | 重置密码 |

---

## 四、数据库结构

### 4.1 Supabase 表

```sql
-- 梦境集
CREATE TABLE dream_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  description TEXT,
  cover_url TEXT,
  summary TEXT,           -- AI生成的总结
  image_count INT DEFAULT 0,
  has_video BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 梦境
CREATE TABLE dreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES dream_collections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  prompt TEXT,
  polished_prompt TEXT,
  image_url TEXT,
  video_url TEXT,
  dream_type TEXT DEFAULT 'default',
  art_style TEXT DEFAULT 'default',
  parameters JSONB,       -- 存储生成参数
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会话历史
CREATE TABLE dream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  prompt_history JSONB,   -- [{prompt, imageUrl, timestamp}]
  image_history JSONB,    -- [imageUrl]
  latest_prompt TEXT,
  image_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 RLS策略
- 用户只能访问自己的数据
- 通过 `user_id = auth.uid()` 过滤

---

## 五、环境变量

```env
# 基础配置
COZE_WORKSPACE_PATH=/workspace/projects
COZE_PROJECT_DOMAIN_DEFAULT=https://xxx.dev.coze.site
DEPLOY_RUN_PORT=5000

# Supabase
COZE_SUPABASE_URL=https://xxx.supabase.co
COZE_SUPABASE_ANON_KEY=eyJxxx...

# 对象存储
COZE_BUCKET_ENDPOINT_URL=https://xxx.oss-cn-beijing.aliyuncs.com
COZE_BUCKET_NAME=dream-space

# SD实例（硬编码在sd-config.ts）
# 如需修改，编辑 src/lib/sd-config.ts 中的 SD_INSTANCES_CONFIG
```

---

## 六、关键代码模块

### 6.1 SD多实例管理 (`src/lib/sd-config.ts`)

**核心概念**：
- 每个SD实例固定一个模型，无需动态切换
- 二次元实例：Anything V5（动漫、萌系）
- 写实实例：Realistic Vision V2.0（真实、摄影）

**关键函数**：
```typescript
// 根据风格选择实例
selectSDInstanceByStyle(artStyle: string): Promise<SDInstance>

// 检测提示词类型
detectPromptType(prompt: string): 'anime' | 'realistic'

// 切换模型（备用）
switchSDModel(url: string, modelFile: string): Promise<boolean>

// 检查实例可用性
checkSDAvailability(url: string): Promise<boolean>
```

### 6.2 AI配置 (`src/lib/ai-config.ts`)

**模型配置**：
```typescript
AI_CONFIG = {
  name: '智谱AI',
  endpoint: 'https://open.bigmodel.cn/api/paas/v4',
  models: { text: 'glm-4-flash', image: 'cogview-3' }
}
```

**提示词配置**：
```typescript
POLISH_PROMPT          // 文生图润色提示词（1500+行）
IMG2IMG_POLISH_PROMPT  // 图生图润色提示词
DREAM_STYLES           // 梦境类型风格配置
```

### 6.3 Token管理 (`src/lib/auth-token.ts`)

```typescript
getToken() / setToken()                    // accessToken
getRefreshToken() / setRefreshToken()       // refreshToken
isTokenValid()                              // 检查有效性
refreshAccessToken()                        // 刷新Token
authFetch(url, options)                     // 带自动刷新的fetch
startTokenMonitor()                         // 启动定时检测（5分钟）
```

### 6.4 主题管理 (`src/components/ThemeProvider.tsx`)

```typescript
// 主题规则：
// - 登录用户：可切换主题，保存到localStorage
// - 游客：强制暗色模式

useTheme() → { mode: 'dark' | 'light', toggleMode }
```

---

## 七、已知问题和坑点

### 7.1 图片URL处理
**问题**：从数据库返回的URL可能包含引号

**解决方案**：
```typescript
const getImageUrl = (url: string) => {
  let cleanUrl = url.trim();
  if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || 
      (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
    cleanUrl = cleanUrl.slice(1, -1);
  }
  return cleanUrl;
};
```

### 7.2 Token刷新时机
- 每5分钟检测一次
- 如果token已过期，清理状态并通知UI刷新登录状态
- 触发方式：`window.dispatchEvent(new CustomEvent('authStateChanged'))`

### 7.3 SD实例超时
- 检查可用性超时：15秒
- 如果实例全部离线，使用默认配置继续尝试

### 7.4 批量生成顺序
- 生成顺序可能与最终显示顺序不一致
- 前端按timestamp排序展示

### 7.5 草稿冲突
- 草稿保存频率：每3秒
- 页面切换时不会清除草稿，需要手动处理

---

## 八、文件结构

```
/workspace/projects/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # 首页
│   │   ├── layout.tsx                  # 根布局
│   │   ├── dream/
│   │   │   ├── page.tsx               # 梦境生成（核心）
│   │   │   └── result/page.tsx        # 生成结果
│   │   ├── dreams/page.tsx             # 梦境库
│   │   ├── assessment/page.tsx         # 心理评估
│   │   ├── profile/page.tsx            # 用户中心
│   │   ├── sd-manager/page.tsx         # SD管理
│   │   └── api/                        # API Routes
│   │       ├── generate-image-batch/   # 批量生成
│   │       ├── dream-collections/      # 梦境集CRUD
│   │       ├── dreams/                 # 梦境CRUD
│   │       ├── psychology-test/        # 心理测评
│   │       ├── auth/                   # 认证
│   │       └── ...
│   ├── components/
│   │   ├── ThemeProvider.tsx           # 主题
│   │   ├── AuthProvider.tsx            # 认证
│   │   ├── Toast.tsx                   # 消息提示
│   │   └── ui/                        # shadcn组件
│   ├── lib/
│   │   ├── sd-config.ts                # SD配置 ⭐
│   │   ├── ai-config.ts                # AI配置 ⭐
│   │   ├── auth-token.ts               # Token ⭐
│   │   └── storage/                    # 存储相关
│   └── ...
├── data/                               # 配置文件
│   └── sd-instances.json              # SD实例配置
├── public/                            # 静态资源
├── .coze                             # 项目配置
└── package.json
```

---

## 九、开发注意事项

### 9.1 端口规范
- **必须**使用5000端口
- **禁止**使用9000端口

### 9.2 包管理器
- **必须**使用 pnpm
- **禁止**使用 npm 或 yarn

### 9.3 提交规范
```bash
pnpm install              # 安装依赖
pnpm run dev              # 开发模式（热更新）
pnpm run build            # 构建生产版本
```

### 9.4 样式规范
- 使用 Tailwind CSS 4
- 主题色：紫色渐变 `#8b5cf6` → `#3b82f6`
- 暗色背景：`#020617`
- 浅色背景：`#FAF8FF`

---

## 十、交接清单

### 10.1 需要交接的内容
- [x] 项目源码（已完整阅读）
- [x] 配置文件（.env变量含义）
- [x] 数据库结构（Supabase）
- [x] SD实例配置（已理解）
- [x] AI服务配置（已理解）

### 10.2 后续可能需要的工作
- [ ] SD实例地址变更时更新 sd-config.ts
- [ ] AI模型升级时更新 ai-config.ts
- [ ] 扩展新的梦境风格
- [ ] 优化流式生成体验
- [ ] 添加更多心理评估维度

---

## 十一、联系方式

如有问题，可查阅：
1. `src/lib/sd-config.ts` - SD配置注释
2. `src/lib/ai-config.ts` - AI提示词注释
3. `src/app/api/generate-image-batch/route.ts` - 核心生成逻辑注释

---

**文档结束**

*祝开发顺利！*
