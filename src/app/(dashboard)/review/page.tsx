import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCachedAllJobs } from "@/lib/cached-queries";
import { ReviewClient } from "./review-client";
import { ClipboardCheck } from "lucide-react";
import { fuzzyMatchPosition, extractPositionFromMessage } from "@/lib/position-match";

export default async function ReviewQueuePage() {
  await auth();

  const [rawQueue, positions] = await Promise.all([
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
        email: true,
        address: true,
        sourceChannel: true,
        notionPageId: true,
        experienceText: true,
        currentStatus: true,
        createdAt: true,
        interestedPosition: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),

    getCachedAllJobs(),
  ]);

  // ── Detect position for unlinked candidates ─────────────────────────────
  const unlinkedIds = rawQueue
    .filter((c) => !c.interestedPosition)
    .map((c) => c.id);

  const detectedMap = new Map<string, { id: string; title: string }>();

  if (unlinkedIds.length > 0) {
    const msgs = await db.message.findMany({
      where: {
        conversation: { candidateId: { in: unlinkedIds } },
        senderType: "SYSTEM",
      },
      select: {
        content: true,
        conversation: { select: { candidateId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const msg of msgs) {
      const cid = msg.conversation.candidateId;
      if (detectedMap.has(cid)) continue; // already found one for this candidate
      const hint = extractPositionFromMessage(msg.content);
      if (!hint) continue;
      const matched = fuzzyMatchPosition(hint, positions);
      if (matched) detectedMap.set(cid, matched);
    }
  }

  const queue = rawQueue.map((c) => ({
    ...c,
    detectedPosition: detectedMap.get(c.id) ?? null,
  }));

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
          กด ✅ ผ่าน หรือ ❌ ไม่ผ่าน · LINE candidates แจ้งผลผ่าน LINE · JobBKK แจ้งผลผ่าน Email
          {waitingCount > 0 && ` · ${waitingCount} รายรอพิจารณา`}
        </p>
      </div>

      <ReviewClient initial={queue as any} positions={positions} />
    </div>
  );
}
