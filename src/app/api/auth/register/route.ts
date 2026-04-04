import { NextRequest, NextResponse } from 'next/server';
import { createLocalToken } from '@/lib/local-token';
import { hashPassword } from '@/lib/password';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 用户注册
export async function POST(request: NextRequest) {
  try {
    const { username, password, nickname } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少为6位' },
        { status: 400 }
      );
    }

    if (username.length < 2) {
      return NextResponse.json(
        { error: '用户名长度至少为2位' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 检查用户名是否已存在
    const { data: existingUser } = await client
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 409 }
      );
    }

    // 加密密码
    const { hash, salt } = hashPassword(password);

    // 生成用户 ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // 创建用户
    const { error: insertError } = await client
      .from('profiles')
      .insert({
        id: userId,
        username,
        password_hash: hash,
        password_salt: salt,
        nickname: nickname || username,
        email: `${username}@dream.local`,
      });

    if (insertError) {
      console.error('创建用户错误:', insertError);
      return NextResponse.json(
        { error: '注册失败：' + insertError.message },
        { status: 500 }
      );
    }

    // 生成 token
    const localToken = createLocalToken(userId, username);

    return NextResponse.json({
      success: true,
      message: '注册成功',
      user: {
        id: userId,
        username,
        nickname: nickname || username,
      },
      accessToken: localToken,
      refreshToken: localToken,
    });
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
