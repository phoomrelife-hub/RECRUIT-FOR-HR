import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const DEFAULT_MSG_PASS = `หวัดดีค้าา~ 🎉
ยินดีด้วยนะคะ! ทางทีม Relife ได้พิจารณาใบสมัครของคุณแล้ว
และอยากเชิญคุณมาคุยกันเพิ่มเติมค่ะ 🥳
ทางทีมจะติดต่อกลับเพื่อนัดวันและเวลาสัมภาษณ์เร็วๆ นี้นะคะ 📅
ฝากติดตาม inbox ไว้ด้วยนะคะ~
ขอบคุณมากค่า ❤️
— ทีม Relife Solutions`;

export const DEFAULT_MSG_FAIL = `หวัดดีค้าา~ ขอบคุณมากๆ เลยนะคะที่สนใจมาร่วมทีม Relife 🥰
ทางทีมได้อ่านใบสมัครของคุณแล้วค่ะ ครั้งนี้อาจจะยังไม่ match กันพอดีซักนิด
แต่ไม่ได้แปลว่าไม่เก่งนะคะ 💪
ถ้าในอนาคตมีตำแหน่งที่ใช่ จะทักกลับมาเลยค่า ฝากติดตาม Relife ไว้ด้วยนะคะ 🌟
ขอบคุณอีกครั้งค้าา ❤️
— ทีม Relife Solutions`;

// GET /api/settings/qualify-messages
export async function GET() {
  await auth();

  const settings = await db.setting.findMany({
    where: { key: { in: ["qualify.msg_pass", "qualify.msg_fail"] } },
    select: { key: true, value: true },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return NextResponse.json({
    msg_pass: map["qualify.msg_pass"] ?? DEFAULT_MSG_PASS,
    msg_fail: map["qualify.msg_fail"] ?? DEFAULT_MSG_FAIL,
  });
}

// PUT /api/settings/qualify-messages
// Body: { msg_pass?: string; msg_fail?: string }
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const ops: Promise<unknown>[] = [];

  if (typeof body.msg_pass === "string" && body.msg_pass.trim()) {
    ops.push(
      db.setting.upsert({
        where: { key: "qualify.msg_pass" },
        update: { value: body.msg_pass.trim() },
        create: { key: "qualify.msg_pass", value: body.msg_pass.trim() },
      })
    );
  }
  if (typeof body.msg_fail === "string" && body.msg_fail.trim()) {
    ops.push(
      db.setting.upsert({
        where: { key: "qualify.msg_fail" },
        update: { value: body.msg_fail.trim() },
        create: { key: "qualify.msg_fail", value: body.msg_fail.trim() },
      })
    );
  }

  await Promise.all(ops);
  return NextResponse.json({ ok: true });
}
