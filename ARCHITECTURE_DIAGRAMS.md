# 梦境可视化系统 - 架构图

```mermaid
graph TB
    %% 用户层
    subgraph UI["用户交互层"]
        Home[首页 page.tsx]
        Dream[梦境创作 dream/page.tsx]
        Dreams[梦境库 dreams/page.tsx]
        Profile[个人中心 profile/page.tsx]
    end

    %% 页面组件层
    subgraph Components["页面组件层"]
        DreamPage["DreamPage 组件"]
        TypeSelector["梦境类型选择器"]
        StyleSelector["艺术风格选择器"]
        KeywordSystem["动态关键词系统"]
        ImageGrid["候选图片网格"]
        SelectedList["已选图片列表"]
        MoodPanel["心理分析面板"]
        AdjustModal["图片调整弹窗"]
    end

    %% API 路由层
    subgraph APIRoutes["API 路由层"]
        GenImageBatch["/api/generate-image-batch<br/>多风格图片生成"]
        PolishText["/api/polish-text<br/>语言润色"]
        GenKeywords["/api/generate-keywords<br/>关键词生成"]
        AnalyzeMood["/api/analyze-mood<br/>心理分析"]
        AdjustImage["/api/adjust-image<br/>图片调整"]
        GenVideo["/api/generate-video<br/>视频生成"]
        DreamsAPI["/api/dreams<br/>梦境CRUD"]
        AuthAPI["/api/auth<br/>用户认证"]
    end

    %% AI 服务层
    subgraph AIServices["AI 服务层"]
        ImageGen["ImageGenerationClient<br/>图片生成"]
        LLM["LLMClient<br/>大语言模型"]
        VideoGen["VideoGenerationClient<br/>视频生成"]
        Config["Config<br/>配置管理"]
    end

    %% 数据层
    subgraph Data["数据层"]
        Supabase["Supabase<br/>数据库+认证"]
        LocalStorage["LocalStorage<br/>本地存储"]
    end

    %% 用户交互
    Home --> Dream
    Dream --> TypeSelector
    Dream --> StyleSelector
    Dream --> KeywordSystem
    Dream --> ImageGrid
    Dream --> SelectedList
    Dream --> MoodPanel
    Dream --> AdjustModal

    %% 组件调用 API
    KeywordSystem -->|输入2秒后| GenKeywords
    KeywordSystem -->|润色| PolishText
    ImageGrid -->|生成| GenImageBatch
    ImageGrid -->|分析| AnalyzeMood
    AdjustModal -->|调整| AdjustImage
    SelectedList -->|生成视频| GenVideo
    SelectedList -->|保存| DreamsAPI
    Dream -->|登录| AuthAPI

    %% API 调用 AI 服务
    GenImageBatch -->|batchGenerate| ImageGen
    PolishText -->|invoke| LLM
    GenKeywords -->|invoke| LLM
    AnalyzeMood -->|invoke| LLM
    AdjustImage -->|generate| ImageGen
    GenVideo -->|generate| VideoGen

    %% AI 服务调用底层
    ImageGen --> Config
    LLM --> Config
    VideoGen --> Config

    %% 数据存储
    DreamsAPI --> Supabase
    AuthAPI --> Supabase
    Profile --> LocalStorage

    %% 样式
    classDef uiLayer fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef component fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef apiLayer fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef aiLayer fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    classDef dataLayer fill:#fce4ec,stroke:#c2185b,stroke-width:2px

    class Home,Dream,Dreams,Profile uiLayer
    class DreamPage,TypeSelector,StyleSelector,KeywordSystem,ImageGrid,SelectedList,MoodPanel,AdjustModal component
    class GenImageBatch,PolishText,GenKeywords,AnalyzeMood,AdjustImage,GenVideo,DreamsAPI,AuthAPI apiLayer
    class ImageGen,LLM,VideoGen,Config aiLayer
    class Supabase,LocalStorage dataLayer
```

---

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as DreamPage
    participant API as API Routes
    participant AI as AI Services
    participant DB as Supabase

    Note over User,UI: 梦境创作流程

    User->>UI: 输入"太阳"
    UI->>UI: 启动2秒定时器
    UI->>UI: 显示河流动画
    Note right of UI: 输入中...

    User->>UI: 停止输入(2秒后)
    UI->>API: POST /api/generate-keywords
    API->>AI: LLMClient.invoke()
    AI-->>API: keywords: ["朝阳","光晕","黎明",...]
    API-->>UI: 更新关键词列表
    UI->>UI: 隐藏动画,显示新关键词

    User->>UI: 点击"润色描述"
    UI->>API: POST /api/polish-text
    API->>AI: LLMClient.invoke()
    AI-->>API: polished: "初升的太阳洒下金色光芒..."
    API-->>UI: 更新输入框文本

    User->>UI: 点击"生成多张图片"
    UI->>API: POST /api/generate-image-batch
    API->>AI: batchGenerate(4个不同风格)
    AI-->>API: 4张不同风格的图片
    API-->>UI: 显示2x2图片网格

    User->>UI: 选择一张图片
    UI->>UI: 记录风格(sceneElements, lightMood...)
    UI->>UI: 添加到已选列表
    UI->>UI: 更新contextHistory

    User->>UI: 继续输入"洗衣服"
    UI->>API: POST /api/generate-keywords
    Note over UI: 根据contextHistory延续场景
    API-->>UI: 相关关键词
    User->>UI: 再次生成并选择

    User->>UI: 点击"生成视频"
    UI->>API: POST /api/generate-video
    API->>AI: VideoGenerationClient
    AI-->>API: 视频URL
    API-->>UI: 视频播放器

    User->>UI: 点击"保存到梦境库"
    UI->>API: POST /api/dreams
    API->>DB: 插入梦境记录
    DB-->>API: success
    API-->>UI: 保存成功
```

---

```mermaid
graph LR
    subgraph InputLayer["输入层"]
        A1[梦境类型]
        A2[艺术风格]
        A3[文字描述]
        A4[关键词选择]
    end

    subgraph ProcessLayer["处理层"]
        B1[Prompt 构建]
        B2[多风格变体]
        B3[上下文关联]
        B4[风格记录]
    end

    subgraph OutputLayer["输出层"]
        C1[4张候选图]
        C2[风格标签]
        C3[心理分析]
        C4[最终视频]
    end

    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1

    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 -->|下次生成| B1

    B2 --> C1
    B1 --> C2
    C1 --> C3
    C1 --> C4
```

---

```mermaid
mindmap
  root((梦境可视化系统))
    核心功能
      多风格图片生成
        晨曦+宁静
        黄昏+魔幻
        夜晚+神秘
        暮色+温馨
      风格记录关联
        场景元素
        光线氛围
        视角类型
        整体氛围
      动态关键词系统
        输入检测
        2秒刷新
        河流动画
        AI生成
      语言润色
        诗意表达
        氛围增强
        感官描写
    AI 服务
      图片生成
        batchGenerate
        图生图调整
      视觉分析
        心理状态
        色彩倾向
        情绪指数
      文本处理
        关键词生成
        语言润色
      视频生成
        多图串联
        转场效果
    用户界面
      首页
        功能介绍
        快速入口
      创作页
        类型选择
        风格选择
        输入区域
        图片网格
        结果展示
      梦境库
        分类筛选
        瀑布流
        详情弹窗
      个人中心
        主题切换
        账户管理
    数据存储
      Supabase
        用户认证
        梦境记录
        云端同步
      LocalStorage
        主题偏好
        临时数据
```

---

## 架构图说明

| 图类型 | 内容 |
|--------|------|
| **Mermaid Graph** | 展示系统各层的模块划分和调用关系 |
| **Sequence Diagram** | 展示用户创作梦境的完整交互流程 |
| **Flow Graph** | 展示输入→处理→输出的数据流 |
| **Mind Map** | 展示系统功能的思维导图结构 |

所有图表已集成到此文档中，可以直接在任何支持 Mermaid 的 Markdown 预览工具中查看（如 VS Code + Mermaid 插件、GitHub、Notion 等）。
