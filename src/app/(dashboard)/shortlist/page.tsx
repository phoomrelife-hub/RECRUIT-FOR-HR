import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ShortlistClient } from "./shortlist-client";

export default async function ShortlistPage() {
  await auth();

  const candidates = await db.candidate.findMany({
    where: {
      currentStatus: {
        in: ["QUALIFIED", "INTERVIEW_SCHEDULED", "INTERVIEWED", "PASSED", "HIRED"],
      },
    },
    select: {
      id: true,
      fullName: true,
      nickname: true,
      lineDisplayName: true,
      lineProfilePicUrl: true,
      lineUserId: true,
      phone: true,
      currentStatus: true,
      interestedPosition: { select: { title: true } },
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 1,
        select: { id: true },
      },
      // latest SCHEDULED interview → for candidateResponse
      interviews: {
        where: { status: "SCHEDULED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, candidateResponse: true, respondedAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Flatten: attach latestResponse to each candidate
  const withResponse = candidates.map((c) => ({
    ...c,
    latestResponse: c.interviews[0]?.candidateResponse ?? null,
    interviewId: c.interviews[0]?.id ?? null,
    conversationId: c.conversations[0]?.id ?? null,
  }));

  const qualified   = withResponse.filter((c) => c.currentStatus === "QUALIFIED");
  const scheduled   = withResponse.filter((c) => c.currentStatus === "INTERVIEW_SCHEDULED");
  const interviewed = withResponse.filter((c) => c.currentStatus === "INTERVIEWED");
  const passed      = withResponse.filter((c) => c.currentStatus === "PASSED");
  const hired       = withResponse.filter((c) => c.currentStatus === "HIRED");

  return (
    <ShortlistClient
      qualified={qualified as any}
      scheduled={scheduled as any}
      interviewed={interviewed as any}
      passed={passed as any}
      hired={hired as any}
    />
  );
}
