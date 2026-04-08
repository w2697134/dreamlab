import { NextRequest, NextResponse } from 'next/server';
import { createLocalToken } from '@/lib/local-token';
import { hashPassword } from '@/lib/password';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 重置密码
export async function POST(request: NextRequest) {
  try {
    const { username, newPassword, oldPassword } = await request.json();

    if (!username || !newPassword) {
      return NextResponse.json(
        { error: '用户名和新密码不能为空' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少为6位' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询用户
    const { data: profile, error: queryError } = await client
      .from('profiles')
      .select('id, username, password_hash, password_salt')
      .eq('username', username)
      .maybeSingle();

    if (queryError) {
      console.error('查询用户错误:', queryError);
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 如果有旧密码，验证旧密码
    if (oldPassword && profile.password_hash && profile.password_salt) {
      const { verifyPassword } = await import('@/lib/password');
      if (!verifyPassword(oldPassword, profile.password_hash, profile.password_salt)) {
        return NextResponse.json(
          { error: '原密码错误' },
          { status: 401 }
        );
      }
    }

    // 加密新密码
    const { hash, salt } = hashPassword(newPassword);

    // 更新密码
    const { error: updateError } = await client
      .from('profiles')
      .update({
        password_hash: hash,
        password_salt: salt,
      })
      .eq('username', username);

    if (updateError) {
      console.error('更新密码错误:', updateError);
      return NextResponse.json(
        { error: '重置密码失败' },
        { status: 500 }
      );
    }

    // 生成新 token
    const localToken = createLocalToken(profile.id, profile.username);

    return NextResponse.json({
      success: true,
      message: '密码重置成功',
      user: {
        id: profile.id,
        username: profile.username,
      },
      accessToken: localToken,
      refreshToken: localToken,
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
