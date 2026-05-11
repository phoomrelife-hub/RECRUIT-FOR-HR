import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Setting keys
export const EMAIL_QUALIFY_KEYS = {
  subjectPass: "email.qualify_subject_pass",
  subjectFail: "email.qualify_subject_fail",
  bodyPass: "email.qualify_body_pass",
  bodyFail: "email.qualify_body_fail",
} as const;

export const DEFAULT_EMAIL_QUALIFY = {
  subjectPass: "ผลการพิจารณาใบสมัคร — ผ่านการคัดเลือก",
  subjectFail: "ผลการพิจารณาใบสมัคร — รีไลฟ์ โซลูชั่นส์",
  bodyPass: `<p>เรียน คุณ{ชื่อ}</p>
<p>ขอบคุณที่สมัครงานตำแหน่ง <strong>{ตำแหน่ง}</strong> กับบริษัท รีไลฟ์ โซลูชั่นส์ จำกัด</p>
<p>ยินดีแจ้งให้ทราบว่า <strong>คุณผ่านการพิจารณาเบื้องต้น</strong> แล้ว ทีม HR จะติดต่อกลับเพื่อนัดสัมภาษณ์ภายใน 1-3 วันทำการ</p>
<p>หากมีข้อสงสัยติดต่อได้ที่ hr@relife.co.th หรือ 082-474-4442</p>
<br/><p>ขอแสดงความนับถือ<br/>ทีม HR รีไลฟ์ โซลูชั่นส์</p>`,
  bodyFail: `<p>เรียน คุณ{ชื่อ}</p>
<p>ขอบคุณที่สมัครงานตำแหน่ง <strong>{ตำแหน่ง}</strong> กับบริษัท รีไลฟ์ โซลูชั่นส์ จำกัด</p>
<p>ขอเรียนให้ทราบว่า หลังจากพิจารณาคุณสมบัติของท่านแล้ว <strong>ทางบริษัทขอสงวนสิทธิ์ในการพิจารณาท่านในรอบนี้</strong> อย่างไรก็ดีบริษัทขอเก็บประวัติของท่านไว้เพื่อพิจารณาในโอกาสต่อไป</p>
<p>ขอบคุณสำหรับความสนใจ และขอให้โชคดีในการสมัครงานครั้งต่อไป</p>
<br/><p>ขอแสดงความนับถือ<br/>ทีม HR รีไลฟ์ โซลูชั่นส์</p>`,
};

// GET /api/settings/email-qualify
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.setting.findMany({
    where: { key: { in: Object.values(EMAIL_QUALIFY_KEYS) } },
  });

  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  return NextResponse.json({
    subjectPass: map[EMAIL_QUALIFY_KEYS.subjectPass] ?? DEFAULT_EMAIL_QUALIFY.subjectPass,
    subjectFail: map[EMAIL_QUALIFY_KEYS.subjectFail] ?? DEFAULT_EMAIL_QUALIFY.subjectFail,
    bodyPass: map[EMAIL_QUALIFY_KEYS.bodyPass] ?? DEFAULT_EMAIL_QUALIFY.bodyPass,
    bodyFail: map[EMAIL_QUALIFY_KEYS.bodyFail] ?? DEFAULT_EMAIL_QUALIFY.bodyFail,
  });
}

// PUT /api/settings/email-qualify
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const updates = [
    { key: EMAIL_QUALIFY_KEYS.subjectPass, value: body.subjectPass ?? DEFAULT_EMAIL_QUALIFY.subjectPass },
    { key: EMAIL_QUALIFY_KEYS.subjectFail, value: body.subjectFail ?? DEFAULT_EMAIL_QUALIFY.subjectFail },
    { key: EMAIL_QUALIFY_KEYS.bodyPass, value: body.bodyPass ?? DEFAULT_EMAIL_QUALIFY.bodyPass },
    { key: EMAIL_QUALIFY_KEYS.bodyFail, value: body.bodyFail ?? DEFAULT_EMAIL_QUALIFY.bodyFail },
  ];

  await Promise.all(
    updates.map(({ key, value }) =>
      db.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
