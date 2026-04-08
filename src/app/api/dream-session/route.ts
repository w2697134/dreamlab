import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  
  // 如果没有token，返回成功但返回null session，让前端继续工作
  if (!token) {
    console.log('[会话] 未提供token，跳过会话创建');
    return NextResponse.json({ session: null, message: '未登录，跳过会话关联' });
  }

  const { userId, title, prompt, imageUrl } = await request.json();

  const client = getSupabaseClient(token);

  // 创建新会话
  const { data: session, error } = await client
    .from("dream_sessions")
    .insert({
      user_id: userId,
      title: title?.substring(0, 200) || "梦境创作",
      prompt_history: JSON.stringify([{ prompt, imageUrl, timestamp: Date.now() }]),
      image_history: JSON.stringify([imageUrl]),
      latest_prompt: prompt,
      latest_image_url: imageUrl,
      image_count: 1,
      status: "active",
    })
    .select()
    .single();

  if (error) {
    console.error("[创建梦境会话失败]", error);
    return NextResponse.json({ session: null, error: "创建会话失败" }, { status: 200 }); // 返回200让前端继续
  }

  console.log(`[会话] 创建成功: ${session.id}`);
  return NextResponse.json({ session });
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ sessions: [] });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const status = searchParams.get("status") || "active";

  const client = getSupabaseClient(token);

  const { data: sessions, error } = await client
    .from("dream_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[查询梦境会话失败]", error);
    return NextResponse.json({ sessions: [] });
  }

  // 解析历史数据
  const sessionsWithHistory = sessions.map((s: Record<string, unknown>) => ({
    ...s,
    prompt_history: s.prompt_history ? JSON.parse(s.prompt_history as string) : [],
    image_history: s.image_history ? JSON.parse(s.image_history as string) : [],
  }));

  return NextResponse.json({ sessions: sessionsWithHistory });
}

export async function PATCH(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    console.log('[会话] PATCH: 未提供token，跳过更新');
    return NextResponse.json({ success: false, message: '未登录' });
  }

  const { sessionId, prompt, imageUrl } = await request.json();

  const client = getSupabaseClient(token);

  // 获取现有会话
  const { data: existingSession, error: fetchError } = await client
    .from("dream_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (fetchError || !existingSession) {
    console.log(`[会话] PATCH: 会话不存在 ${sessionId}`);
    return NextResponse.json({ success: false, error: "会话不存在" }, { status: 404 });
  }

  // 解析并更新历史
  const promptHistory = existingSession.prompt_history
    ? JSON.parse(existingSession.prompt_history)
    : [];
  const imageHistory = existingSession.image_history
    ? JSON.parse(existingSession.image_history)
    : [];

  promptHistory.push({ prompt, imageUrl, timestamp: Date.now() });
  imageHistory.push(imageUrl);

  const { data: updatedSession, error } = await client
    .from("dream_sessions")
    .update({
      prompt_history: JSON.stringify(promptHistory),
      image_history: JSON.stringify(imageHistory),
      latest_prompt: prompt,
      latest_image_url: imageUrl,
      image_count: (existingSession.image_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    console.error("[更新梦境会话失败]", error);
    return NextResponse.json({ success: false, error: "更新失败" }, { status: 200 });
  }

  console.log(`[会话] PATCH: 更新成功 ${sessionId}，历史记录: ${promptHistory.length} 条`);
  return NextResponse.json({
    session: {
      ...updatedSession,
      prompt_history: promptHistory,
      image_history: imageHistory,
    },
  });
}

export async function DELETE(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "缺少会话ID" }, { status: 400 });
  }

  const client = getSupabaseClient(token);

  // 标记为已完成而非删除
  const { error } = await client
    .from("dream_sessions")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) {
    console.error("[结束梦境会话失败]", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
