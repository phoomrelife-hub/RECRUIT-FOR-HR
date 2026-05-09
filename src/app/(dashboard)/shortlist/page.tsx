import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ShortlistClient } from "./shortlist-client";

export default async function ShortlistPage() {
  await auth();

  const candidates = await db.candidate.findMany({
    where: {
      currentStatus: {
        in: ["QUALIFIED", "INTERVIEW_SCHEDULED", "INTERVIEWED", "PASSED"],
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
    },
    orderBy: { updatedAt: "desc" },
  });

  const qualified   = candidates.filter((c) => c.currentStatus === "QUALIFIED");
  const scheduled   = candidates.filter((c) => c.currentStatus === "INTERVIEW_SCHEDULED");
  const interviewed = candidates.filter((c) => c.currentStatus === "INTERVIEWED");
  const passed      = candidates.filter((c) => c.currentStatus === "PASSED");

  return (
    <ShortlistClient
      qualified={qualified as any}
      scheduled={scheduled as any}
      interviewed={interviewed as any}
      passed={passed as any}
    />
  );
}
