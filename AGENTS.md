# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 核心功能

### 开发者工具
- **可拖动按钮**：紫色扳手图标，48px尺寸，支持鼠标和触摸拖动
- **展开面板**：点击按钮展开，包含以下功能：
  - **SD API 配置**：快速修改本地 Stable Diffusion 地址
  - **AI 代码助手**：对话式代码修改助手（基于豆包大模型）
- **位置持久化**：使用 localStorage 保存位置，切换页面保持连贯

### 梦境可视化系统
- **多风格图片生成**：使用 `batchGenerate` 并行生成 4 张**不同风格**的图片（光线、视角、氛围各异）
- **风格记录与关联**：选择图片时记录风格（光线/视角/氛围/场景元素），下次生成自动延续场景
- **动态关键词系统**：输入时显示河流动画，停顿2秒后自动获取相关关键词
- **语言润色**：AI 智能润色描述，使语言更加诗意生动
- **图片调整**：基于图生图实现反馈循环，支持"颜色更暗"等指令调整
- **心理状态分析**：使用视觉模型分析图片色彩、构图，评估潜意识状态
- **视频生成**：支持多图串联生成视频
- **梦境库**：支持分类筛选（全部/图片/视频）、点击放大查看
- **用户认证**：Supabase Auth 支持中文用户名注册/登录

### 风格系统
- **光线氛围**：晨曦、正午、黄昏、夜晚、暮色
- **视角类型**：近景、中景、远景、鸟瞰、仰视
- **整体氛围**：宁静、神秘、温馨、忧郁、魔幻、孤独

### 主题系统
- 深色/暖色模式切换，通过 `ThemeProvider` 统一管理（`src/components/ThemeProvider.tsx`）
- 解决页面跳转时的闪烁问题（FOUC）
- 渐变色按钮适配：
  - 暗色模式：`from-purple-600 to-blue-600`
  - 浅色模式：`from-purple-400 to-blue-400`

## 已知问题与修复记录

| 问题 | 解决方案 | 文件 |
|------|---------|------|
| 图片生成只返回一张 | 使用 `batchGenerate` 并行生成 4 张图片 | `src/app/api/generate-image/route.ts` |
| 暗色模式下按钮暖色闪烁 | 修改渐变色按钮适配深色/浅色模式 | 多个页面组件 |
| 页面跳转时主题闪烁 | 创建 ThemeProvider 统一管理主题状态 | `src/components/ThemeProvider.tsx` |
| Hydration 错误 | 移除 layout.tsx 中的内联脚本 | `src/app/layout.tsx` |
| 返回按钮跳转逻辑 | 使用 `router.back()` 返回上一页 | `src/app/dream/page.tsx` |

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

- **项目理解加速**：初始可以依赖项目下`package.json`文件理解项目类型，如果没有或无法理解退化成阅读其他文件。
- **Hydration 错误预防**：严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。


## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**


