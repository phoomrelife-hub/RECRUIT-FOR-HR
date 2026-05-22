import { db } from "@/lib/db";

const MARKER_START = "<!-- AUTO_POSITIONS_START -->";
const MARKER_END = "<!-- AUTO_POSITIONS_END -->";

const WORK_TYPE_LABEL: Record<string, string> = {
  ONSITE: "ออฟฟิศ",
  WFH: "Work from Home",
  HYBRID: "Hybrid (ออฟฟิศ + WFH)",
};

function formatSalary(min?: number | null, max?: number | null): string {
  if (!min && !max) return "ตามตกลง";
  if (min && max) return `${min.toLocaleString()} – ${max.toLocaleString()} บาท`;
  if (min) return `เริ่มต้น ${min.toLocaleString()} บาท`;
  return `สูงสุด ${max!.toLocaleString()} บาท`;
}

function generatePositionsBlock(
  jobs: Array<{
    title: string;
    description?: string | null;
    department?: string | null;
    workType: string;
    salaryMin?: number | null;
    salaryMax?: number | null;
    requiredExperience?: string | null;
    workingTime?: string | null;
    location?: string | null;
    headcount: number;
  }>
): string {
  const updated = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });

  if (jobs.length === 0) {
    return `${MARKER_START}
## ตำแหน่งงานที่เปิดรับ (อัปเดต: ${updated})

ขณะนี้ยังไม่มีตำแหน่งที่เปิดรับสมัคร กรุณาติดตามข่าวสารในภายหลัง
${MARKER_END}`;
  }

  const lines: string[] = [
    MARKER_START,
    `## ตำแหน่งงานที่เปิดรับ (อัปเดต: ${updated})`,
    "",
  ];

  for (const job of jobs) {
    lines.push(`### ${job.title}`);
    if (job.department) lines.push(`- **แผนก**: ${job.department}`);
    lines.push(`- **รูปแบบงาน**: ${WORK_TYPE_LABEL[job.workType] ?? job.workType}`);
    lines.push(`- **เงินเดือน**: ${formatSalary(job.salaryMin, job.salaryMax)}`);
    if (job.requiredExperience) lines.push(`- **ประสบการณ์**: ${job.requiredExperience}`);
    if (job.workingTime) lines.push(`- **เวลาทำงาน**: ${job.workingTime}`);
    if (job.location) lines.push(`- **สถานที่**: ${job.location}`);
    lines.push(`- **จำนวนรับ**: ${job.headcount} อัตรา`);
    if (job.description) {
      lines.push(`- **รายละเอียด**: ${job.description}`);
    }
    lines.push("");
  }

  lines.push(MARKER_END);
  return lines.join("\n");
}

/**
 * Re-generates the AUTO_POSITIONS section inside POSITIONS.md stored in Setting table.
 * Preserves all content outside the markers (form links, rules, etc.)
 * Also sets the dirty flag so middleware.py picks it up.
 */
export async function syncPositionsMd(): Promise<void> {
  try {
    // Fetch all OPEN job positions
    const jobs = await db.jobPosition.findMany({
      where: { status: "OPEN" },
      select: {
        title: true,
        description: true,
        department: true,
        workType: true,
        salaryMin: true,
        salaryMax: true,
        requiredExperience: true,
        workingTime: true,
        location: true,
        headcount: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Get current POSITIONS.md from Setting
    const setting = await db.setting.findUnique({
      where: { key: "openclaw.file.POSITIONS.md" },
    });

    const currentContent = setting?.value ?? "";
    const newBlock = generatePositionsBlock(jobs);

    let newContent: string;

    if (currentContent.includes(MARKER_START) && currentContent.includes(MARKER_END)) {
      // Replace existing auto section
      const before = currentContent.substring(0, currentContent.indexOf(MARKER_START));
      const after = currentContent.substring(
        currentContent.indexOf(MARKER_END) + MARKER_END.length
      );
      newContent = before + newBlock + after;
    } else {
      // No markers yet — prepend the auto section
      newContent = newBlock + (currentContent ? "\n\n" + currentContent : "");
    }

    // Update POSITIONS.md and set dirty flag in one transaction
    await db.$transaction([
      db.setting.upsert({
        where: { key: "openclaw.file.POSITIONS.md" },
        create: { key: "openclaw.file.POSITIONS.md", value: newContent },
        update: { value: newContent },
      }),
      db.setting.upsert({
        where: { key: "openclaw.file.dirty" },
        create: { key: "openclaw.file.dirty", value: new Date().toISOString() },
        update: { value: new Date().toISOString() },
      }),
    ]);
  } catch (err) {
    // Non-critical — don't break the main job CRUD flow
    console.error("[syncPositionsMd] failed:", err);
  }
}
