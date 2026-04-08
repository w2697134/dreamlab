import { NextRequest, NextResponse } from 'next/server';
import { invokeQwen } from '@/lib/qwen-client';
import fs from 'fs';
import path from 'path';

// 本地存储路径
const LOCAL_STORAGE_PATH = path.join(process.cwd(), 'public', 'generated-images');

// 确保本地存储目录存在
function ensureLocalStorageDir(): void {
  if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
    fs.mkdirSync(LOCAL_STORAGE_PATH, { recursive: true });
  }
}

// 保存图片到本地
async function saveImageLocal(buffer: Buffer, fileName: string): Promise<string> {
  ensureLocalStorageDir();
  const filePath = path.join(LOCAL_STORAGE_PATH, fileName);
  fs.writeFileSync(filePath, buffer);
  return `/generated-images/${fileName}`;
}

interface MoodAnalysis {
  overall: string;
  colorTendency: string;
  moodLevel: number;
  stressLevel: number;
  keywords: string[];
  suggestions: string;
}

/**
 * 从URL下载图片并保存到本地
 */
async function saveImageToStorage(imageUrl: string): Promise<string> {
  try {
    // 如果已经是本地图片URL，直接返回
    if (imageUrl.includes('/generated-images/')) {
      return imageUrl;
    }
    
    // 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('下载图片失败');
    }
    const buffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);
    
    // 获取内容类型
    const contentType = response.headers.get('content-type') || 'image/png';
    const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('png') ? 'png' : 'jpg';
    
    // 保存到本地
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const fileName = `mood_${timestamp}_${randomStr}.${ext}`;
    
    const localUrl = await saveImageLocal(imageBuffer, fileName);
    
    // 构建完整 URL
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'localhost:5000';
    const finalUrl = `${protocol}://${host.replace(/^https?:\/\//, '')}${localUrl}`;
    
    console.log('[心理分析] 图片已保存:', finalUrl);
    return finalUrl;
  } catch (error) {
    console.error('[心理分析] 保存图片失败:', error);
    return imageUrl; // 返回原URL
  }
}

/**
 * 心理状态分析API（支持图片保存）
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      imageUrl, 
      saveImage = true,  // 是否保存图片
      userId            // 用户ID（用于保存到用户心理档案）
    } = await request.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: '缺少图片' }, { status: 400 });
    }

    // 保存图片（如果需要）
    let savedImageUrl = imageUrl;
    if (saveImage) {
      savedImageUrl = await saveImageToStorage(imageUrl);
    }

    // 使用千问进行图片分析
    const messages = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: `你是一位专业的心理状态分析师。请分析这张图片传达的情绪和心理状态。

请从以下维度进行分析：
1. 整体氛围（温馨/压抑/神秘/混乱/平静等）
2. 色彩倾向（暖色调/冷色调/中性/多彩/暗淡等）
3. 情绪指数（1-10，1最消极，10最积极）
4. 压力指数（1-10，1最轻松，10最紧张）
5. 关键词（3-5个描述心理状态的词）
6. 建议（简短的正面引导语）

请以JSON格式返回：
{
  "overall": "整体氛围描述",
  "colorTendency": "色彩倾向",
  "moodLevel": 数字(1-10),
  "stressLevel": 数字(1-10),
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "suggestions": "简短建议"
}

只返回JSON，不要有其他内容。`
          },
          {
            type: 'image_url' as const,
            image_url: {
              url: imageUrl,
              detail: 'high' as const
            }
          }
        ]
      }
    ];

    let response;
    try {
      response = await invokeQwen(messages, {
        model: 'qwen3.5 9b',
        temperature: 0.7
      });
    } catch (error) {
      console.error('[图片分析] 千问调用失败:', error);
      return NextResponse.json({
        success: false,
        error: 'AI分析服务暂时不可用'
      }, { status: 503 });
    }

    // 尝试解析 JSON
    let analysis: MoodAnalysis;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      // 如果解析失败，返回默认分析
      analysis = {
        overall: '图像分析中',
        colorTendency: '未知',
        moodLevel: 5,
        stressLevel: 5,
        keywords: ['待分析'],
        suggestions: '请稍后再试'
      };
    }

    return NextResponse.json({
      success: true,
      analysis,
      savedImageUrl, // 返回保存后的图片URL
      userId // 用户ID（如果有）
    });
  } catch (error) {
    console.error('Mood analysis error:', error);
    return NextResponse.json({
      success: false,
      error: '心理状态分析失败，请稍后重试'
    }, { status: 500 });
  }
}
