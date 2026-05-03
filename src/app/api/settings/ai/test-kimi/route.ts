import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["SUPER_ADMIN", "HR_MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "KIMI_API_KEY is not set in environment" });
  }

  try {
    const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "moonshot-v1-8k",
        messages: [{ role: "user", content: "สวัสดี ตอบสั้นๆ ว่า OK" }],
        max_tokens: 20,
      }),
    });

    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        status: res.status,
        error: text,
        keyPreview: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
      });
    }

    const data = JSON.parse(text);
    return NextResponse.json({
      ok: true,
      reply: data.choices?.[0]?.message?.content,
      model: data.model,
      keyPreview: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      keyPreview: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
    });
  }
}
