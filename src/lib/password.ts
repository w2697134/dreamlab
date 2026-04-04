// 密码加密和验证工具（使用 Node.js 内置 crypto）
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const ITERATIONS = 10000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

/**
 * 生成盐值
 */
function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

/**
 * 加密密码
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = generateSalt();
  const hash = createHash(DIGEST)
    .update(salt + password)
    .digest('hex');
  
  return { hash, salt };
}

/**
 * 验证密码
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const hashToCheck = createHash(DIGEST)
    .update(salt + password)
    .digest('hex');
  
  try {
    return timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(hashToCheck, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * 简化版密码验证（用于迁移）
 */
export function simpleVerifyPassword(password: string, storedPassword: string): boolean {
  return password === storedPassword;
}
