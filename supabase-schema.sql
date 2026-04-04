-- Supabase 数据库表结构
-- 在 Supabase SQL Editor 中执行

-- 用户表 (profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  nickname TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 梦境表 (dreams)
CREATE TABLE IF NOT EXISTS dreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  video_url TEXT,
  dream_type TEXT DEFAULT 'normal',
  art_style TEXT DEFAULT 'anime',
  collection_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 梦境集表 (dream_collections)
CREATE TABLE IF NOT EXISTS dream_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  cover_url TEXT,
  has_video BOOLEAN DEFAULT FALSE,
  image_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 心理评估结果表
CREATE TABLE IF NOT EXISTS psychology_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dream_id UUID REFERENCES dreams(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES dream_collections(id) ON DELETE SET NULL,
  stress_level INTEGER, -- 压力等级 0-100
  emotion_state JSONB, -- 情绪状态数据
  coping_style TEXT, -- 应对方式
  suggestions TEXT[], -- 建议列表
  answers JSONB, -- 用户答案
  questions JSONB, -- 评估题目
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_dreams_user_id ON dreams(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_collection_id ON dreams(collection_id);
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON dream_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_psychology_user_id ON psychology_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_psychology_dream_id ON psychology_assessments(dream_id);
CREATE INDEX IF NOT EXISTS idx_psychology_collection_id ON psychology_assessments(collection_id);

-- 启用 RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_collections ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own dreams" ON dreams
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dreams" ON dreams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dreams" ON dreams
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own collections" ON dream_collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own collections" ON dream_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections" ON dream_collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections" ON dream_collections
  FOR DELETE USING (auth.uid() = user_id);

-- 心理评估表 RLS
ALTER TABLE psychology_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessments" ON psychology_assessments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments" ON psychology_assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assessments" ON psychology_assessments
  FOR DELETE USING (auth.uid() = user_id);
