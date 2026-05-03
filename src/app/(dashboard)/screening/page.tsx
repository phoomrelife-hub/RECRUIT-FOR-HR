import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScreeningClient } from "./screening-client";

export default async function ScreeningPage() {
  const session = await auth();

  const [forms, jobs] = await Promise.all([
    db.screeningForm.findMany({
      include: {
        jobPosition: { select: { id: true, title: true } },
        questions: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.jobPosition.findMany({
      where: { status: { in: ["OPEN", "DRAFT"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <ScreeningClient
      forms={forms as any}
      jobs={jobs}
      currentUserRole={session?.user?.role ?? "HR_STAFF"}
    />
  );
}
