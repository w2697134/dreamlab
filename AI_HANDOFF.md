# 🎯 梦境生成与心理评估系统 - AI 交接文档

## 📋 项目概述

这是一个基于 Next.js 的**梦境生成与心理评估平台**，核心功能：

### 核心功能
1. **AI 梦境生成** - 使用 Stable Diffusion 生成梦境图片/视频
2. **多风格并行生成** - 一次生成 4 张不同风格的图片
3. **心理状态分析** - 基于视觉模型分析潜意识状态
4. **梦境库管理** - 保存、分类、查看历史梦境
5. **用户认证系统** - 中文用户名注册/登录

### 技术栈
- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript 5
- **UI**: shadcn/ui + Tailwind CSS 4
- **数据库**: Supabase (PostgreSQL)
- **AI 模型**: 豆包/DeepSeek (对话)、Stable Diffusion (生图)

---

## 🚀 快速启动

```bash
cd /workspace/projects
pnpm install
pnpm dev
# 访问 http://localhost:5000
```

---

## 📁 核心文件清单

### 页面路由 (`src/app/`)
| 路径 | 功能 |
|------|------|
| `/` | 首页 - 入口 |
| `/dream` | 梦境生成页面 |
| `/dreams` | 梦境库 |
| `/assessment` | 心理评估 |
| `/project-export` | 项目导出 |

### API 路由 (`src/app/api/`)
| 路径 | 功能 |
|------|------|
| `/api/generate-keywords` | 生成关键词 |
| `/api/generate-image` | 单图生成 |
| `/api/generate-image-batch` | 批量生图 |
| `/api/interpret-dream` | 梦境解读 |
| `/api/video/generate` | 视频生成 |
| `/api/dream-collections` | 梦境集 CRUD |
| `/api/dream-session` | 会话管理 |
| `/api/project-export` | 项目导出 |

### 核心库 (`src/lib/`)
| 文件 | 功能 |
|------|------|
| `sd-config.ts` | Stable Diffusion 多实例管理、模型检测、智能路由 |
| `local-token.ts` | 本地 Token 验证 |
| `auth-token.ts` | 认证相关 |
| `ai-service.ts` | AI 对话服务 |

### 核心组件 (`src/components/`)
| 组件 | 功能 |
|------|------|
| `ThemeProvider.tsx` | 主题管理 |
| `DraggableFixButton.tsx` | 可拖动工具按钮 |
| `Toast.tsx` | 消息提示 |

---

## 🔧 关键实现

### 1. SD 多实例路由 (`sd-config.ts`)

**核心逻辑**：根据模型类型自动路由到不同 SD 实例
- 实例 1 (二次元): `https://2dbeb2d3.r18.cpolar.top` → Anything V5.0
- 实例 2 (写实): `https://61d7c604.r8.vip.cpolar.cn` → Realistic Vision V2.0

**关键函数**:
```typescript
// 根据风格选择实例
selectSDInstanceByStyle(artStyle: string): Promise<SDInstance>

// 检测模型类型（相似度匹配）
detectModelSpecialty(url: string): Promise<'anime' | 'realistic' | null>

// 获取当前模型
getCurrentSDModel(url: string): Promise<string | null>
```

### 2. 批量生图 (`generate-image-batch/route.ts`)

**流程**:
1. 分析提示词 → 确定风格
2. 路由到对应 SD 实例
3. 并行调用 SD API 生成 4 张不同风格图片
4. 上传到对象存储
5. 返回结果

### 3. 心理评估 (`assessment/page.tsx`)

**基于图片分析**:
- 使用视觉模型分析色彩、构图
- 评估潜意识状态（压力、情绪等）
- 生成评估报告

---

## 🎨 风格系统

### 光线氛围
`晨曦 | 正午 | 黄昏 | 夜晚 | 暮色`

### 视角类型
`近景 | 中景 | 远景 | 鸟瞰 | 仰视`

### 整体氛围
`宁静 | 神秘 | 温馨 | 忧郁 | 魔幻 | 孤独`

---

## 🔐 认证流程

1. 用户注册/登录 → Supabase Auth
2. 获取 JWT Token
3. 后续请求携带 Token
4. 后端验证 Token 后操作数据库

---

## 📊 数据库表结构

### dream_collections
```sql
id, user_id, title, description, cover_url, 
image_count, has_video, created_at, updated_at
```

### dreams
```sql
id, user_id, collection_id, session_id,
prompt, image_url, video_url, dream_type, art_style,
is_favorite, created_at
```

### dream_sessions
```sql
id, user_id, title, prompt_history, image_history,
latest_prompt, latest_image_url, image_count, status, created_at
```

---

## ⚠️ 已知问题

| 问题 | 状态 | 备注 |
|------|------|------|
| SD 检测偶尔超时 | ✅ 已修复 | 超时时间改为 15s |
| 删除梦境集偶发错误 | ✅ 已修复 | 改用 URL 参数 |
| JWT Token 部分错误 | ⚠️ 非阻塞 | 不影响核心功能 |

---

## 📝 开发规范

1. **禁止硬编码端口** - 使用环境变量 `DEPLOY_RUN_PORT`
2. **禁止使用 npm/yarn** - 必须用 pnpm
3. **禁止 Hydration 错误** - 动态内容用 useEffect
4. **上传文件用存储服务** - 禁止自建文件服务
5. **Token 验证用本地方案** - `verifyLocalToken()`

---

## 🎯 下一步任务建议

1. **优化 SD 实例检测** - 添加重试机制
2. **完善心理评估算法** - 引入更多心理学维度
3. **视频生成优化** - 支持更长视频
4. **移动端适配** - 优化触摸交互
5. **错误处理优化** - 更友好的错误提示

---

## 📞 环境变量

```env
COZE_WORKSPACE_PATH=/workspace/projects
COZE_PROJECT_DOMAIN_DEFAULT=https://xxx.dev.coze.site
DEPLOY_RUN_PORT=5000
COZE_SUPABASE_URL=xxx
COZE_SUPABASE_ANON_KEY=xxx
COZE_BUCKET_ENDPOINT_URL=xxx
COZE_BUCKET_NAME=xxx
```

---

**如需完整代码，请下载项目压缩包：**
👉 https://4cb92f22-949d-4ae0-960f-265f40705429.dev.coze.site/project-export
