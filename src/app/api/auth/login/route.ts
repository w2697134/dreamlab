import { NextRequest, NextResponse } from 'next/server';
import { createLocalToken } from '@/lib/local-token';
import { verifyPassword, hashPassword, simpleVerifyPassword } from '@/lib/password';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 用户登录
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询用户
    const { data: profile, error: queryError } = await client
      .from('profiles')
      .select('id, username, nickname, password_hash, password_salt')
      .eq('username', username)
      .maybeSingle();

    if (queryError) {
      console.error('查询用户错误:', queryError);
      return NextResponse.json(
        { error: '查询用户失败' },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户名不存在' },
        { status: 401 }
      );
    }

    // 验证密码
    let isValid = false;
    
    if (profile.password_hash && profile.password_salt) {
      // 新加密方式
      isValid = verifyPassword(password, profile.password_hash, profile.password_salt);
    } else if (profile.password_hash) {
      // 简单密码比较（兼容旧数据）
      isValid = simpleVerifyPassword(password, profile.password_hash);
    } else {
      // 没有任何密码记录
      return NextResponse.json(
        { error: '密码未设置，请联系管理员重置' },
        { status: 401 }
      );
    }

    if (!isValid) {
      return NextResponse.json(
        { error: '密码错误' },
        { status: 401 }
      );
    }

    // 登录成功，生成 token
    const localToken = createLocalToken(profile.id, profile.username);

    return NextResponse.json({
      success: true,
      message: '登录成功',
      user: {
        id: profile.id,
        username: profile.username,
        nickname: profile.nickname || profile.username,
      },
      accessToken: localToken,
      refreshToken: localToken,
    });
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
