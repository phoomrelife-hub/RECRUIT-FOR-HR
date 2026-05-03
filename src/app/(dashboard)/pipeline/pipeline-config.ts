export const STAGE_ORDER = [
  "NEW_APPLICANT",
  "BOT_SCREENING",
  "WAITING_HR_REVIEW",
  "NEED_MORE_INFO",
  "QUALIFIED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEWED",
  "PASSED",
  "REJECTED",
  "TALENT_POOL",
  "CLOSED",
] as const;

export type PipelineStatus = (typeof STAGE_ORDER)[number];

export const STAGE_CONFIG: Record<
  PipelineStatus,
  { label: string; headerBg: string; countBg: string; isTerminal?: boolean }
> = {
  NEW_APPLICANT: {
    label: "ผู้สมัครใหม่",
    headerBg: "bg-slate-500",
    countBg: "bg-slate-100 text-slate-700",
  },
  BOT_SCREENING: {
    label: "Bot คัดกรอง",
    headerBg: "bg-violet-500",
    countBg: "bg-violet-100 text-violet-700",
  },
  WAITING_HR_REVIEW: {
    label: "รอ HR ตรวจสอบ",
    headerBg: "bg-amber-500",
    countBg: "bg-amber-100 text-amber-700",
  },
  NEED_MORE_INFO: {
    label: "ต้องการข้อมูลเพิ่ม",
    headerBg: "bg-orange-500",
    countBg: "bg-orange-100 text-orange-700",
  },
  QUALIFIED: {
    label: "ผ่านการคัดกรอง",
    headerBg: "bg-blue-500",
    countBg: "bg-blue-100 text-blue-700",
  },
  INTERVIEW_SCHEDULED: {
    label: "นัดสัมภาษณ์",
    headerBg: "bg-sky-500",
    countBg: "bg-sky-100 text-sky-700",
  },
  INTERVIEWED: {
    label: "สัมภาษณ์แล้ว",
    headerBg: "bg-indigo-500",
    countBg: "bg-indigo-100 text-indigo-700",
  },
  PASSED: {
    label: "ผ่าน",
    headerBg: "bg-green-500",
    countBg: "bg-green-100 text-green-700",
    isTerminal: true,
  },
  REJECTED: {
    label: "ไม่ผ่าน",
    headerBg: "bg-red-500",
    countBg: "bg-red-100 text-red-700",
    isTerminal: true,
  },
  TALENT_POOL: {
    label: "Talent Pool",
    headerBg: "bg-teal-500",
    countBg: "bg-teal-100 text-teal-700",
    isTerminal: true,
  },
  CLOSED: {
    label: "ปิด",
    headerBg: "bg-gray-400",
    countBg: "bg-gray-100 text-gray-600",
    isTerminal: true,
  },
};

export type KanbanCandidate = {
  id: string;
  fullName: string | null;
  nickname: string | null;
  phone: string | null;
  currentStatus: PipelineStatus;
  interestedPosition: { id: string; title: string } | null;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
  assignments: Array<{ assignedTo: { id: string; name: string } }>;
  sourceChannel: string;
  createdAt: string;
};
