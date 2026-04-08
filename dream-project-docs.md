# 梦境可视化心理辅助系统 - 项目文档

## 一、项目概览

**项目名称**: 梦境可视化心理辅助系统
**技术栈**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui + Supabase

### 核心功能
- 多风格图片生成（4张不同风格并行生成）
- 风格记录与关联（光线/视角/氛围）
- 动态关键词系统
- 语言润色
- 图片调整
- 心理状态分析
- 视频生成
- 梦境库
- 用户认证

---

## 二、技术架构

### 层级结构
```
用户界面层 → 页面组件层 → API路由层 → AI服务层 → 基础设施层
```

### AI服务
- 图片生成: `doubao-seedream-4`
- 视觉模型: `doubao-seed-1-6-vision`
- 文本模型: `doubao-seed-1-6-251015`

---

## 三、目录结构

```
├── src/
│   ├── app/                    # 页面路由
│   │   ├── page.tsx           # 首页
│   │   ├── dream/             # 梦境创作
│   │   │   ├── page.tsx       # 创作页面
│   │   │   └── result/        # 结果页面
│   │   ├── dreams/            # 梦境库
│   │   ├── profile/           # 个人中心
│   │   └── api/                # API路由
│   ├── components/             # 组件
│   │   ├── ThemeProvider.tsx  # 主题管理
│   │   ├── AuthProvider.tsx   # 认证管理
│   │   └── ui/                # shadcn组件
│   └── lib/                    # 工具库
├── package.json
├── tsconfig.json
├── .coze                      # 项目配置
└── AGENTS.md                  # 开发规范
```

---

## 四、核心页面

### 4.1 首页 (src/app/page.tsx)
- 云朵入口按钮，点击进入梦境创作
- 深色/浅色模式切换

### 4.2 梦境创作 (src/app/dream/page.tsx)
- 梦境类型选择：默认/美梦/噩梦/奇幻/回忆/清醒梦
- 艺术风格：写实/水彩/油画/动漫/抽象/超现实
- 动态关键词：输入停顿2秒后自动获取相关关键词
- 批量生成：一次生成4张不同风格图片
- 风格关联：选择图片后记录风格，下次生成延续场景
- 语言润色：AI将描述润色为诗意语言
- 图片调整：基于图生图反馈调整
- 心理分析：分析色彩、构图评估潜意识状态
- 视频生成：多图串联生成视频

### 4.3 梦境结果 (src/app/dream/result/page.tsx)
- 图片包含/排除选择
- 视频包含/排除
- 保存到梦境库
- 游客模式限制（需登录）

### 4.4 梦境库 (src/app/dreams/page.tsx)
- 分类筛选：全部/图片/视频
- 点击放大查看
- 删除功能

### 4.5 个人中心 (src/app/profile/page.tsx)
- 用户登录/注册
- 统计数据展示
- 功能设置

---

## 五、API路由

| 路由 | 方法 | 功能 |
|------|------|------|
| /api/generate-image-batch | POST | 批量生成图片 |
| /api/generate-image | POST | 单张图片生成 |
| /api/generate-video | POST | 视频生成 |
| /api/generate-keywords | POST | 关键词生成 |
| /api/polish-text | POST | 文本润色 |
| /api/analyze-mood | POST | 心理状态分析 |
| /api/adjust-image | POST | 图片调整 |
| /api/dreams | GET/POST | 梦境CRUD |
| /api/auth/login | POST | 用户登录 |
| /api/auth/register | POST | 用户注册 |

---

## 六、主题系统

### 颜色规范
- **暗色模式**: `from-purple-600 to-blue-600`
- **浅色模式**: `from-purple-400 to-blue-400`

### 背景渐变
- 暗色: `#0f0a1e` → `#1a1030` → `#2d1f4e`
- 浅色: `#FAF8FF` → `#F3F0F7` → `#E8DFF5`

---

## 七、开发规范

### 包管理
- **仅允许 pnpm**，禁止 npm/yarn

### Hydration错误预防
- 禁止在 JSX 中直接使用 `typeof window`、`Date.now()`、`Math.random()`
- 必须使用 `'use client'` + `useEffect` + `useState`

### 已知问题修复
| 问题 | 解决方案 |
|------|---------|
| 图片只返回一张 | 使用 `batchGenerate` |
| 主题闪烁 | ThemeProvider统一管理 |
| 返回按钮跳转 | 使用 `router.push('/')` |

---

## 八、安装运行

```bash
# 安装依赖
pnpm install

# 开发环境
pnpm dev

# 生产构建
pnpm build

# 生产启动
pnpm start
```
