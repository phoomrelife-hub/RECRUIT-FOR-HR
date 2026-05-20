import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export const DEFAULT_INTERVIEW_MSG_PASS = `สวัสดีค่ะ 🎉
ขอแสดงความยินดีด้วยนะคะ!
ทางทีม Relife ได้พิจารณาผลการสัมภาษณ์ของคุณแล้ว
และยินดีที่จะเชิญคุณเข้าร่วมทีมกับเราค่ะ 🥳
ทางทีมจะติดต่อกลับเพื่อแจ้งรายละเอียดขั้นตอนต่อไปเร็วๆ นี้นะคะ 📅
ขอบคุณมากค่า ❤️
— ทีม Relife Solutions`;

export const DEFAULT_INTERVIEW_MSG_FAIL = `สวัสดีค่ะ ขอบคุณมากๆ ที่มาสัมภาษณ์กับทีม Relife นะคะ 🙏
ทางทีมได้พิจารณาผลการสัมภาษณ์แล้วค่ะ ครั้งนี้อาจจะยังไม่ match กันพอดีซักนิด
แต่ไม่ได้แปลว่าไม่เก่งนะคะ 💪
ถ้าในอนาคตมีตำแหน่งที่ใช่ จะทักกลับมาเลยค่า ฝากติดตาม Relife ไว้ด้วยนะคะ 🌟
ขอบคุณอีกครั้งค้าา ❤️
— ทีม Relife Solutions`;

export async function GET() {
  await auth();

  const settings = await db.setting.findMany({
    where: { key: { in: ["interview.msg_pass", "interview.msg_fail"] } },
    select: { key: true, value: true },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return NextResponse.json({
    msg_pass: map["interview.msg_pass"] ?? DEFAULT_INTERVIEW_MSG_PASS,
    msg_fail: map["interview.msg_fail"] ?? DEFAULT_INTERVIEW_MSG_FAIL,
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: { key: string; value: string }[] = [];
  if (typeof body.msg_pass === "string") updates.push({ key: "interview.msg_pass", value: body.msg_pass });
  if (typeof body.msg_fail === "string") updates.push({ key: "interview.msg_fail", value: body.msg_fail });

  await Promise.all(
    updates.map((u) =>
      db.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
