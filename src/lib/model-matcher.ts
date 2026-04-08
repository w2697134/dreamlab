/**
 * 模型名称相似度匹配 - 综合算法
 * 结合多种相似度计算方法，更准确地判断模型名称是否匹配
 */

/**
 * Levenshtein 编辑距离 - 计算将一个字符串转换为另一个字符串所需的最少编辑操作数
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  
  // 创建距离矩阵
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // 初始化边界
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // 填充矩阵
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // 删除
          dp[i][j - 1] + 1,     // 插入
          dp[i - 1][j - 1] + 1  // 替换
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Levenshtein 相似度 (0-1)
 */
function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Jaccard 相似度 - 计算两个集合的交集/并集
 * 用于判断字符组成相似度
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * 最长公共子序列 (LCS) 相似度
 */
function lcsSimilarity(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  const lcsLength = dp[m][n];
  return (2 * lcsLength) / (m + n); // 归一化到 0-1
}

/**
 * 前缀匹配度 - 重视开头的相似性
 */
function prefixSimilarity(a: string, b: string): number {
  let commonLen = 0;
  const minLen = Math.min(a.length, b.length);
  
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) {
      commonLen++;
    } else {
      break;
    }
  }
  
  return commonLen / Math.max(a.length, b.length);
}

/**
 * 标准化模型名称
 * 统一大小写、去除多余空格、统一分隔符
 */
function normalizeModelName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // 多个空格合并
    .replace(/[-_]/g, ' ')          // 统一分隔符为空格
    .replace(/\bv(\d)/g, ' $1')     // v1 -> 1
    .replace(/(\d)\.(\d)/g, '$1 $2'); // 3.5 -> 3 5
}

/**
 * 综合相似度计算
 * 加权组合多种相似度算法
 */
function calculateSimilarity(a: string, b: string): number {
  const normA = normalizeModelName(a);
  const normB = normalizeModelName(b);
  
  // 完全相同
  if (normA === normB) return 1;
  
  // 计算各种相似度
  const levSim = levenshteinSimilarity(normA, normB);
  const jacSim = jaccardSimilarity(normA, normB);
  const lcsSim = lcsSimilarity(normA, normB);
  const preSim = prefixSimilarity(normA, normB);
  
  // 加权组合 (权重可根据实际情况调整)
  // 前缀相似度权重最高，因为模型名通常开头最重要
  const weightedSim = 
    levSim * 0.25 +  // 编辑距离
    jacSim * 0.15 +  // 字符集合
    lcsSim * 0.25 +  // 最长公共子序列
    preSim * 0.35;   // 前缀匹配 (最重要)
  
  return weightedSim;
}

/**
 * 判断两个模型名称是否匹配
 * @param modelA 模型名称A
 * @param modelB 模型名称B
 * @param threshold 相似度阈值（默认0.55 = 55%）
 */
export function isModelMatch(
  modelA: string, 
  modelB: string, 
  threshold: number = 0.55
): boolean {
  if (!modelA || !modelB) return false;
  
  const similarity = calculateSimilarity(modelA, modelB);
  
  console.log(`[模型匹配] "${modelA}" vs "${modelB}"`);
  console.log(`[模型匹配] 综合相似度: ${(similarity * 100).toFixed(1)}%`);
  
  return similarity >= threshold;
}

/**
 * 从候选列表中找到最佳匹配的模型
 */
export function findBestModelMatch(
  targetModel: string,
  candidates: string[],
  threshold: number = 0.55
): { model: string | null; similarity: number } {
  let bestMatch: string | null = null;
  let bestSimilarity = 0;
  
  for (const candidate of candidates) {
    const similarity = calculateSimilarity(targetModel, candidate);
    
    if (similarity >= threshold && similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = candidate;
    }
  }
  
  return { model: bestMatch, similarity: bestSimilarity };
}

/**
 * 获取详细的相似度分析（用于调试）
 */
export function getSimilarityDetails(a: string, b: string) {
  const normA = normalizeModelName(a);
  const normB = normalizeModelName(b);
  
  return {
    original: { a, b },
    normalized: { a: normA, b: normB },
    levenshtein: levenshteinSimilarity(normA, normB),
    jaccard: jaccardSimilarity(normA, normB),
    lcs: lcsSimilarity(normA, normB),
    prefix: prefixSimilarity(normA, normB),
    overall: calculateSimilarity(a, b),
  };
}

// 测试
if (require.main === module) {
  console.log('=== 测试模型匹配 ===\n');
  
  const testCases = [
    ['qwen3.5 9b', 'qwen3.5-9b'],
    ['qwen3.5 9b', 'qwen3.5 27b'],
    ['anything-v5', 'anythingV5'],
    ['anything-v5', 'anything v5'],
    ['realistic', 'anime'],
    ['Realistic Vision V2.0', 'realistic vision v2'],
    ['Stable Diffusion XL', 'SDXL'],
  ];
  
  for (const [a, b] of testCases) {
    const details = getSimilarityDetails(a, b);
    console.log(`\n"${a}" vs "${b}"`);
    console.log(`  标准化: "${details.normalized.a}" vs "${details.normalized.b}"`);
    console.log(`  编辑距离: ${(details.levenshtein * 100).toFixed(1)}%`);
    console.log(`  Jaccard: ${(details.jaccard * 100).toFixed(1)}%`);
    console.log(`  LCS: ${(details.lcs * 100).toFixed(1)}%`);
    console.log(`  前缀: ${(details.prefix * 100).toFixed(1)}%`);
    console.log(`  综合: ${(details.overall * 100).toFixed(1)}% → ${isModelMatch(a, b) ? '匹配' : '不匹配'}`);
  }
}
