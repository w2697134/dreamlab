// 本地 Token 管理（不依赖 Supabase Auth）
import { createHmac, randomBytes } from 'crypto';

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dream-visualizer-secret-key-2024';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7天

interface TokenData {
  userId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
  random: string;
}

/**
 * 创建本地 token
 */
export function createLocalToken(userId: string, username: string): string {
  const now = Date.now();
  const data: TokenData = {
    userId,
    username,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY,
    random: randomBytes(16).toString('hex'),
  };
  
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const signature = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  
  return `${payload}.${signature}`;
}

/**
 * 验证本地 token
 */
export function verifyLocalToken(token: string): TokenData | null {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    
    // 验证签名
    const expectedSignature = createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    if (signature !== expectedSignature) return null;
    
    // 解析数据
    const data: TokenData = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    // 检查过期
    if (Date.now() > data.expiresAt) return null;
    
    return data;
  } catch {
    return null;
  }
}

/**
 * 刷新 token（延长过期时间）
 */
export function refreshLocalToken(token: string): string | null {
  const data = verifyLocalToken(token);
  if (!data) return null;
  
  return createLocalToken(data.userId, data.username);
}
