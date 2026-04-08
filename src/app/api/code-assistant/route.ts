import { NextRequest, NextResponse } from 'next/server';
import { invokeLLM } from '@/lib/llm-client';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CodeAction {
  type: 'read' | 'edit' | 'create' | 'delete';
  filePath: string;
  content?: string;
  oldContent?: string;
  description: string;
}

// 获取项目根目录
function getProjectRoot(): string {
  return process.env.COZE_WORKSPACE_PATH || '/workspace/projects';
}

// 读取文件
function readFileContent(filePath: string): { success: boolean; content?: string; error?: string } {
  try {
    const fullPath = path.join(getProjectRoot(), filePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: '文件不存在' };
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

const systemPrompt = `你是一个专业的 Next.js/React/TypeScript 开发助手。你可以：

1. 回答关于代码的问题
2. 帮助修改和优化代码
3. 解释代码逻辑
4. 调试问题
5. 提供最佳实践建议

项目技术栈：
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui (Radix UI)
- Node.js 运行环境
- 项目根目录: /workspace/projects

重要：当用户请求修改代码时，你必须：
1. 先读取相关文件了解上下文
2. 生成具体的代码修改操作
3. 在回复末尾用 JSON 格式输出操作列表

代码操作格式（JSON数组）：
[
  {
    "type": "read",        // read/edit/create/delete
    "filePath": "src/app/page.tsx",
    "description": "读取首页组件"
  },
  {
    "type": "edit",         // 编辑现有文件
    "filePath": "src/app/page.tsx",
    "oldContent": "原代码片段",  // 要替换的内容（可选，精确匹配）
    "content": "新代码片段",
    "description": "修改首页标题"
  },
  {
    "type": "create",       // 创建新文件
    "filePath": "src/components/NewComponent.tsx",
    "content": "完整的文件内容",
    "description": "创建新组件"
  }
]

识别代码修改意图的关键词：
- "添加"、"新增"、"创建" -> create
- "修改"、"更改"、"更新"、"重构" -> edit
- "删除"、"移除" -> delete
- "查看"、"读取"、"了解一下" -> read

请用中文回答。如果检测到代码修改意图，在回复末尾添加 JSON 操作列表。`;

// 从回复中解析代码操作
function parseCodeActions(response: string): CodeAction[] {
  const actions: CodeAction[] = [];
  
  // 尝试在回复末尾找到 JSON 数组
  const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        // 验证每个操作的格式
        for (const item of parsed) {
          if (item.type && item.filePath && item.description) {
            actions.push({
              type: item.type,
              filePath: item.filePath,
              content: item.content,
              oldContent: item.oldContent,
              description: item.description,
            });
          }
        }
      }
    } catch (e) {
      // JSON 解析失败，忽略
    }
  }
  
  return actions;
}

// 过滤掉回复中的 JSON 部分
function filterJsonFromResponse(response: string): string {
  return response.replace(/\[\s*\{[\s\S]*\}\s*\]\s*$/, '').trim();
}

export async function POST(request: NextRequest) {
  try {
    const { messages, stream, enableCodeActions } = await request.json();
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 使用千问进行代码助手对话

    // 获取用户最新的消息
    const userMessage = messages[messages.length - 1]?.content || '';
    const lowerMessage = userMessage.toLowerCase();
    
    // 检查是否需要执行代码操作
    const needCodeAction = enableCodeActions && (
      lowerMessage.includes('添加') || 
      lowerMessage.includes('新增') ||
      lowerMessage.includes('修改') ||
      lowerMessage.includes('更改') ||
      lowerMessage.includes('创建') ||
      lowerMessage.includes('删除') ||
      lowerMessage.includes('帮我') ||
      lowerMessage.includes('能不能') ||
      lowerMessage.includes('可以帮我')
    );

    // 如果需要代码操作，先读取相关文件
    if (needCodeAction) {
      // 分析用户意图，确定需要读取的文件
      const filesToCheck = [
        'src/app/page.tsx',
        'src/app/dream/page.tsx',
        'src/components',
      ];
      
      // 先读取一些关键文件给模型参考
      const contextFiles: Record<string, string> = {};
      for (const file of filesToCheck) {
        const fullPath = path.join(getProjectRoot(), file);
        if (fs.existsSync(fullPath)) {
          if (fs.statSync(fullPath).isDirectory()) {
            // 读取目录下的文件列表
            contextFiles[file] = fs.readdirSync(fullPath).join(', ');
          } else {
            // 读取文件内容（前2000字符）
            const content = fs.readFileSync(fullPath, 'utf-8');
            contextFiles[file] = content.slice(0, 2000) + (content.length > 2000 ? '\n...' : '');
          }
        }
      }
      
      // 添加项目上下文到系统提示
      const projectContext = Object.entries(contextFiles)
        .map(([file, content]) => `【${file}】\n${content}`)
        .join('\n\n');
      
      const enhancedSystem = systemPrompt + `\n\n项目当前结构：\n${projectContext}`;
      
      messages[0] = { role: 'system', content: enhancedSystem };
    }

    // 构建消息历史
    const conversationMessages: Message[] = messages;

    // 检查是否需要流式输出
    if (stream) {
      const encoder = new TextEncoder();
      let fullResponse = '';
      let hasSentActions = false;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const aiStream = client.stream(conversationMessages, {
              model: 'qwen3.5 9b',
              temperature: 0.7,
            });

            for await (const chunk of aiStream) {
              if (chunk.content) {
                fullResponse += chunk.content;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`));
              }
            }
            
            // 解析并执行代码操作
            if (needCodeAction && !hasSentActions) {
              hasSentActions = true;
              const actions = parseCodeActions(fullResponse);
              if (actions.length > 0) {
                // 过滤掉回复中的 JSON 部分，保留纯文本
                const cleanResponse = filterJsonFromResponse(fullResponse);
                // 发送清理后的完整回复
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '\n\n---\n' })}\n\n`));
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ actions, content: '📝 已分析代码修改请求，请确认操作。' })}\n\n`));
              }
            }
            
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          } catch (error) {
            console.error('流式输出错误:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '生成失败' })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // 非流式输出
      let response;
      try {
        response = await invokeLLM(conversationMessages);
      } catch (error) {
        console.error('[代码助手] 千问调用失败:', error);
        return NextResponse.json({ 
          error: 'AI 服务暂时不可用，请稍后重试',
          content: '抱歉，AI 服务暂时不可用，请稍后重试。'
        }, { status: 503 });
      }

      // 解析代码操作
      let actions: CodeAction[] = [];
      if (needCodeAction) {
        actions = parseCodeActions(response.content);
      }
      const cleanContent = filterJsonFromResponse(response.content);

      return NextResponse.json({ 
        content: cleanContent,
        actions: actions.length > 0 ? actions : undefined,
      });
    }
  } catch (error) {
    console.error('Code Assistant API Error:', error);
    return NextResponse.json(
      { error: '服务暂时不可用，请稍后重试' },
      { status: 500 }
    );
  }
}
