import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReviewClient } from "./review-client";
import { ClipboardCheck } from "lucide-react";

export default async function ReviewQueuePage() {
  await auth();

  const [queue, positions] = await Promise.all([
    db.candidate.findMany({
      where: {
        currentStatus: {
          in: ["WAITING_HR_REVIEW", "BOT_SCREENING", "NEED_MORE_INFO", "NEW_APPLICANT"],
        },
      },
      select: {
        id: true,
        nickname: true,
        fullName: true,
        lineDisplayName: true,
        lineProfilePicUrl: true,
        lineUserId: true,
        phone: true,
        notionPageId: true,
        experienceText: true,
        currentStatus: true,
        createdAt: true,
        interestedPosition: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),

    db.jobPosition.findMany({
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const waitingCount = queue.filter((c) => c.currentStatus === "WAITING_HR_REVIEW").length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-yellow-600" />
          <h1 className="text-2xl font-bold text-slate-900">คิวพิจารณาใบสมัคร</h1>
          {queue.length > 0 && (
            <span className="ml-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold px-2.5 py-0.5">
              {queue.length} รายการ
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          กด ✅ ผ่าน หรือ ❌ ไม่ผ่าน เพื่อแจ้งผลและส่ง LINE ทันที
          {waitingCount > 0 && ` · ${waitingCount} รายรอพิจารณา`}
        </p>
      </div>

      <ReviewClient initial={queue as any} positions={positions} />
    </div>
  );
}
