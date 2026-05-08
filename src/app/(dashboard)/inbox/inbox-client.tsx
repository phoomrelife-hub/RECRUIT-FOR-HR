"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import {
  MessageSquare,
  Bot,
  User,
  Send,
  Zap,
  X,
  Phone,
  ExternalLink,
  RefreshCw,
  Plus,
  Sparkles,
  Tag as TagIcon,
  UserCheck,
  ArrowUpDown,
  ChevronDown,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type SenderType = "CANDIDATE" | "BOT" | "HR" | "SYSTEM";
type ConvStatus = "ACTIVE" | "CLOSED" | "WAITING";

interface Message {
  id: string;
  content: string;
  senderType: SenderType;
  senderId?: string | null;
  sender?: { id: string; name: string; avatar?: string | null } | null;
  createdAt: string;
}

interface Candidate {
  id: string;
  fullName?: string | null;
  nickname?: string | null;
  phone?: string | null;
  lineDisplayName?: string | null;
  lineProfilePicUrl?: string | null;
  sourceChannel: string;
  currentStatus: string;
  interestedPosition?: { id: string; title: string } | null;
}

interface Conversation {
  id: string;
  candidateId: string;
  channel: string;
  botEnabled: boolean;
  status: ConvStatus;
  unreadCount: number;
  lastMessageAt?: string | null;
  candidate: Candidate;
  messages: Message[];
}

interface QuickReply {
  id: string;
  title: string;
  content: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface CandidateTag {
  tagId: string;
  tag: Tag;
}

interface HRUser {
  id: string;
  name: string;
}

interface Assignment {
  assignedToId: string;
  assignedTo: HRUser;
}

interface Props {
  initialConversations: Conversation[];
  quickReplies: QuickReply[];
  candidatesWithoutConversation: {
    id: string;
    fullName?: string | null;
    nickname?: string | null;
    sourceChannel: string;
    currentStatus: string;
  }[];
  currentUser: { id: string; name: string };
  allTags: Tag[];
  hrUsers: HRUser[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  NEW_APPLICANT: "bg-slate-100 text-slate-600",
  BOT_SCREENING: "bg-blue-100 text-blue-700",
  WAITING_HR_REVIEW: "bg-yellow-100 text-yellow-700",
  NEED_MORE_INFO: "bg-orange-100 text-orange-700",
  QUALIFIED: "bg-green-100 text-green-700",
  INTERVIEW_SCHEDULED: "bg-purple-100 text-purple-700",
  INTERVIEWED: "bg-indigo-100 text-indigo-700",
  PASSED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  TALENT_POOL: "bg-cyan-100 text-cyan-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

const statusLabel: Record<string, string> = {
  NEW_APPLICANT: "ผู้สมัครใหม่",
  BOT_SCREENING: "บอทคัดกรอง",
  WAITING_HR_REVIEW: "รอ HR พิจารณา",
  NEED_MORE_INFO: "ขอข้อมูลเพิ่ม",
  QUALIFIED: "ผ่านเกณฑ์",
  INTERVIEW_SCHEDULED: "นัดสัมภาษณ์",
  INTERVIEWED: "สัมภาษณ์แล้ว",
  PASSED: "ผ่านการคัดเลือก",
  REJECTED: "ไม่ผ่าน",
  TALENT_POOL: "Talent Pool",
  CLOSED: "ปิด",
};

const STATUS_ORDER = [
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
];

function candidateName(c: Candidate | null | undefined) {
  if (!c) return "Unknown";
  return c.fullName || c.lineDisplayName || c.nickname || c.phone || "ไม่ระบุชื่อ";
}

function CandidateAvatar({ c, size = "md" }: { c: Candidate | null | undefined; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-sm";
  const name = candidateName(c);
  if (c?.lineProfilePicUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={c.lineProfilePicUrl}
        alt={name}
        className={`${sz} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div className={`${sz} rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 font-bold text-slate-600`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function channelIcon(channel: string) {
  switch (channel) {
    case "LINE":
      return <span className="text-green-600 font-bold text-xs">LINE</span>;
    case "FACEBOOK":
      return <span className="text-blue-600 font-bold text-xs">FB</span>;
    default:
      return <span className="text-slate-400 text-xs">—</span>;
  }
}

// ─── Simulate Panel ───────────────────────────────────────────────────────────

function SimulatePanel({
  conversation,
  onSimulated,
}: {
  conversation: Conversation;
  onSimulated: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function simulate() {
    if (!msg.trim()) return;
    setLoading(true);
    await fetch("/api/openclaw/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId: conversation.candidateId,
        message: msg,
        channel: conversation.channel,
      }),
    });
    setMsg("");
    setLoading(false);
    onSimulated();
  }

  return (
    <div className="border border-dashed border-amber-300 bg-amber-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={14} className="text-amber-600" />
        <span className="text-xs font-semibold text-amber-700">OpenClaw Mock — จำลองข้อความจาก Candidate</span>
      </div>
      <div className="flex gap-2">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && simulate()}
          placeholder="พิมพ์ข้อความที่ candidate ส่งมา..."
          className="flex-1 text-sm border border-amber-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        <button
          onClick={simulate}
          disabled={loading || !msg.trim()}
          className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "ส่ง"}
        </button>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.senderType === "SYSTEM") {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-3 py-1">
          {msg.content}
        </span>
      </div>
    );
  }

  const isHR = msg.senderType === "HR";
  const isBot = msg.senderType === "BOT";

  return (
    <div className={`flex gap-2 mb-3 ${isHR ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
          isHR
            ? "bg-blue-600 text-white"
            : isBot
            ? "bg-indigo-100 text-indigo-700"
            : "bg-slate-200 text-slate-600"
        }`}
      >
        {isHR ? (
          <User size={14} />
        ) : isBot ? (
          <Bot size={14} />
        ) : (
          <MessageSquare size={14} />
        )}
      </div>

      <div className={`max-w-[70%] ${isHR ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        {(isBot || (!isHR && !isBot)) && (
          <span className="text-[10px] text-slate-400 ml-1">
            {isBot ? "Claw Bot" : msg.sender?.name ?? "Candidate"}
          </span>
        )}
        <div
          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
            isHR
              ? "bg-blue-600 text-white rounded-tr-sm"
              : isBot
              ? "bg-indigo-50 text-slate-800 border border-indigo-100 rounded-tl-sm"
              : "bg-white text-slate-800 border border-slate-200 rounded-tl-sm"
          }`}
        >
          {msg.content}
        </div>
        <span className="text-[10px] text-slate-400 mx-1">
          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: th })}
        </span>
      </div>
    </div>
  );
}

// ─── Conversation List Item ───────────────────────────────────────────────────

function ConvItem({
  conv,
  active,
  onClick,
}: {
  conv: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const lastMsg = conv.messages[0];
  const name = candidateName(conv.candidate);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
        active ? "bg-blue-50 border-l-2 border-l-blue-600" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <CandidateAvatar c={conv.candidate} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`text-sm font-medium truncate ${active ? "text-blue-700" : "text-slate-800"}`}>
              {name}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {channelIcon(conv.channel)}
              {conv.unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {conv.unreadCount}
                </span>
              )}
            </div>
          </div>

          {lastMsg && (
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {lastMsg.senderType === "HR"
                ? "คุณ: "
                : lastMsg.senderType === "BOT"
                ? "🤖 "
                : ""}
              {lastMsg.content}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor[conv.candidate.currentStatus] ?? "bg-slate-100 text-slate-500"}`}>
              {statusLabel[conv.candidate.currentStatus] ?? conv.candidate.currentStatus}
            </span>
            {!conv.botEnabled && (
              <span className="text-[10px] text-orange-600 font-medium">HR Mode</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Quick Actions Panel ──────────────────────────────────────────────────────

function QuickActionsPanel({
  conv,
  candidateTags,
  assignment,
  allTags,
  hrUsers,
  changingStatus,
  showTagMenu,
  showAssignMenu,
  showScheduleForm,
  scheduling,
  onChangeStatus,
  onAddTag,
  onRemoveTag,
  onAssign,
  onSetShowTagMenu,
  onSetShowAssignMenu,
  onSetShowScheduleForm,
  onScheduleInterview,
}: {
  conv: Conversation;
  candidateTags: CandidateTag[];
  assignment: Assignment | null;
  allTags: Tag[];
  hrUsers: HRUser[];
  changingStatus: boolean;
  showTagMenu: boolean;
  showAssignMenu: boolean;
  showScheduleForm: boolean;
  scheduling: boolean;
  onChangeStatus: (s: string) => void;
  onAddTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onAssign: (userId: string | null) => void;
  onSetShowTagMenu: (v: boolean) => void;
  onSetShowAssignMenu: (v: boolean) => void;
  onSetShowScheduleForm: (v: boolean) => void;
  onScheduleInterview: (data: { interviewType: string; interviewDate: string; startTime: string; endTime: string }) => void;
}) {
  const candidate = conv.candidate;
  const assignedTagIds = new Set(candidateTags.map((ct) => ct.tagId));
  const availableTags = allTags.filter((t) => !assignedTagIds.has(t.id));

  const today = new Date().toISOString().slice(0, 10);
  const [schedInterviewType, setSchedInterviewType] = useState("PHONE");
  const [schedDate, setSchedDate] = useState(today);
  const [schedStart, setSchedStart] = useState("10:00");
  const [schedEnd, setSchedEnd] = useState("11:00");

  return (
    <div className="w-64 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-y-auto">

      {/* ── Candidate Summary ── */}
      <div className="p-4 border-b border-slate-100 flex flex-col items-center text-center gap-2">
        <CandidateAvatar c={candidate} size="lg" />
        <div>
          <p className="font-semibold text-sm text-slate-900 leading-tight">{candidateName(candidate)}</p>
          {candidate.lineDisplayName && candidate.lineDisplayName !== candidateName(candidate) && (
            <p className="text-[11px] text-green-600 mt-0.5">{candidate.lineDisplayName}</p>
          )}
        </div>
        {candidate.interestedPosition && (
          <p className="text-[11px] text-slate-500 -mt-1">{candidate.interestedPosition.title}</p>
        )}
        <Link
          href={`/candidates/${conv.candidateId}`}
          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
        >
          ดูโปรไฟล์เต็ม <ExternalLink size={10} />
        </Link>
      </div>

      {/* ── Status ── */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-1.5 mb-2">
          <ArrowUpDown size={12} className="text-slate-400" />
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">สถานะ</p>
        </div>
        <div className="relative">
          <select
            value={candidate.currentStatus}
            onChange={(e) => onChangeStatus(e.target.value)}
            disabled={changingStatus}
            className={`w-full text-xs border rounded-lg px-2.5 py-2 pr-7 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer disabled:opacity-60 ${statusColor[candidate.currentStatus] ?? "border-slate-200"} border-slate-200`}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        {changingStatus && (
          <p className="text-[10px] text-slate-400 mt-1">กำลังบันทึก...</p>
        )}
      </div>

      {/* ── Tags ── */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-1.5 mb-2">
          <TagIcon size={12} className="text-slate-400" />
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Tags</p>
        </div>

        {candidateTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {candidateTags.map((ct) => (
              <span
                key={ct.tagId}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: ct.tag.color + "25", color: ct.tag.color }}
              >
                {ct.tag.name}
                <button
                  onClick={() => onRemoveTag(ct.tagId)}
                  className="hover:opacity-60 transition-opacity"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => onSetShowTagMenu(!showTagMenu)}
            disabled={availableTags.length === 0}
            className="w-full text-[11px] text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 border border-dashed border-slate-300 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={10} />
            {availableTags.length === 0 ? "ครบทุก tag แล้ว" : "เพิ่ม Tag"}
          </button>

          {showTagMenu && availableTags.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-44 overflow-y-auto">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => onAddTag(tag.id)}
                  className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Assign HR ── */}
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <UserCheck size={12} className="text-slate-400" />
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">ผู้รับผิดชอบ</p>
        </div>

        {assignment ? (
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 flex-shrink-0">
                {assignment.assignedTo.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-slate-700 truncate">{assignment.assignedTo.name}</span>
            </div>
            <button
              onClick={() => onSetShowAssignMenu(!showAssignMenu)}
              className="text-[10px] text-blue-600 hover:underline flex-shrink-0"
            >
              เปลี่ยน
            </button>
          </div>
        ) : (
          <button
            onClick={() => onSetShowAssignMenu(!showAssignMenu)}
            className="w-full text-[11px] text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 border border-dashed border-slate-300 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors mb-1.5"
          >
            <Plus size={10} />
            มอบหมาย HR
          </button>
        )}

        {showAssignMenu && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden">
            {assignment && (
              <button
                onClick={() => onAssign(null)}
                className="w-full text-left text-xs px-3 py-2 hover:bg-red-50 text-red-500 border-b border-slate-100 transition-colors"
              >
                ยกเลิกการมอบหมาย
              </button>
            )}
            {hrUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => onAssign(u.id)}
                className={`w-full text-left text-xs px-3 py-2 hover:bg-slate-50 flex items-center gap-2 transition-colors ${
                  assignment?.assignedToId === u.id ? "bg-blue-50" : ""
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{u.name}</span>
                {assignment?.assignedToId === u.id && (
                  <span className="ml-auto text-[9px] text-blue-600 font-medium">ปัจจุบัน</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Schedule Interview ── */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={() => onSetShowScheduleForm(!showScheduleForm)}
          className="w-full flex items-center justify-between gap-1.5 mb-2"
        >
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-slate-400" />
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">นัดสัมภาษณ์</p>
          </div>
          <ChevronDown
            size={12}
            className={`text-slate-400 transition-transform ${showScheduleForm ? "rotate-180" : ""}`}
          />
        </button>

        {showScheduleForm && (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">รูปแบบ</label>
              <select
                value={schedInterviewType}
                onChange={(e) => setSchedInterviewType(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="PHONE">โทรศัพท์</option>
                <option value="ONLINE">ออนไลน์</option>
                <option value="ONSITE">ที่บริษัท</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">วันที่</label>
              <input
                type="date"
                value={schedDate}
                min={today}
                onChange={(e) => setSchedDate(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 mb-1 block">เริ่ม</label>
                <input
                  type="time"
                  value={schedStart}
                  onChange={(e) => setSchedStart(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 mb-1 block">สิ้นสุด</label>
                <input
                  type="time"
                  value={schedEnd}
                  onChange={(e) => setSchedEnd(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={() => onScheduleInterview({ interviewType: schedInterviewType, interviewDate: schedDate, startTime: schedStart, endTime: schedEnd })}
              disabled={scheduling || !schedDate}
              className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
            >
              <CheckCircle2 size={12} />
              {scheduling ? "กำลังบันทึก..." : "ยืนยันนัดสัมภาษณ์"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InboxClient({
  initialConversations,
  quickReplies,
  candidatesWithoutConversation,
  currentUser,
  allTags,
  hrUsers,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [linePushError, setLinePushError] = useState<string | null>(null);

  // Quick Actions state
  const [candidateTags, setCandidateTags] = useState<CandidateTag[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── filtered conversations ──
  const filtered = conversations.filter((c) => {
    const matchStatus = filterStatus === "ALL" || c.status === filterStatus;
    const name = candidateName(c.candidate).toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // ── load conversation detail ──
  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setActiveConv(data);
    setMessages(data.messages ?? []);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  // ── load candidate detail (tags + assignment) ──
  const loadCandidateDetail = useCallback(async (candidateId: string) => {
    const res = await fetch(`/api/candidates/${candidateId}`);
    if (!res.ok) return;
    const data = await res.json();
    setCandidateTags(data.tags ?? []);
    setAssignment(data.assignments?.[0] ?? null);
  }, []);

  // ── refresh conversations list ──
  const refreshList = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const data = await res.json();
    setConversations(data.conversations ?? []);
  }, []);

  // ── select conversation ──
  async function selectConv(id: string) {
    setActiveId(id);
    isAtBottomRef.current = true;
    prevMessageCountRef.current = 0;
    setShowScrollBtn(false);
    setShowSimulate(false);
    setShowQuickReplies(false);
    setShowTagMenu(false);
    setShowAssignMenu(false);
    setShowScheduleForm(false);
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      await Promise.all([
        loadConversation(id),
        loadCandidateDetail(conv.candidateId),
      ]);
    } else {
      await loadConversation(id);
    }
  }

  // ── polling ──
  useEffect(() => {
    if (!activeId) return;
    pollRef.current = setInterval(() => loadConversation(activeId), 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeId, loadConversation]);

  useEffect(() => {
    refreshList(); // sync ทันทีตอน mount ไม่รอ interval แรก
    const listPoll = setInterval(() => refreshList(), 2000);
    return () => clearInterval(listPoll);
  }, [refreshList]);

  // ── smart scroll: only auto-scroll when user is near bottom ──
  useEffect(() => {
    const newCount = messages.length;
    const hadNewMessages = newCount > prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;

    if (isAtBottomRef.current) {
      // user is at bottom → always follow new messages
      messagesEndRef.current?.scrollIntoView({ behavior: hadNewMessages ? "smooth" : "instant" });
      setShowScrollBtn(false);
    } else if (hadNewMessages) {
      // user scrolled up but new messages arrived → show button
      setShowScrollBtn(true);
    }
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
    isAtBottomRef.current = true;
  }

  function handleMessagesScroll() {
    const el = messagesAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 80;
    if (isAtBottomRef.current) setShowScrollBtn(false);
  }

  // ── send HR message ──
  async function sendMessage() {
    if (!inputMsg.trim() || !activeId || sending) return;
    setSending(true);
    setLinePushError(null);

    // Auto-takeover if bot is still active
    if (activeConv?.botEnabled) {
      const takeoverRes = await fetch(`/api/conversations/${activeId}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TAKE_OVER" }),
      });
      if (!takeoverRes.ok) {
        setSending(false);
        return;
      }
    }

    const res = await fetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: inputMsg.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setInputMsg("");
      isAtBottomRef.current = true; // force scroll after HR sends
      await loadConversation(activeId);
      if (data.linePushError) {
        setLinePushError(data.linePushError);
      }
    }
    setSending(false);
  }

  // ── takeover / release ──
  async function handleTakeover(action: "TAKE_OVER" | "RELEASE") {
    if (!activeId) return;
    setTakingOver(true);
    const res = await fetch(`/api/conversations/${activeId}/takeover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      await loadConversation(activeId);
      await refreshList();
    }
    setTakingOver(false);
  }

  // ── create conversation ──
  async function createConversation(candidateId: string, channel: string) {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, channel }),
    });
    if (res.ok) {
      const conv = await res.json();
      await refreshList();
      setShowNewConv(false);
      selectConv(conv.id);
    }
  }

  // ── Quick Actions ──
  async function changeStatus(newStatus: string) {
    if (!activeConv || changingStatus || newStatus === activeConv.candidate.currentStatus) return;
    setChangingStatus(true);
    await fetch(`/api/candidates/${activeConv.candidateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStatus: newStatus }),
    });
    await loadConversation(activeConv.id);
    setChangingStatus(false);
  }

  async function addTag(tagId: string) {
    if (!activeConv) return;
    await fetch(`/api/candidates/${activeConv.candidateId}/tags/${tagId}`, { method: "POST" });
    await loadCandidateDetail(activeConv.candidateId);
    setShowTagMenu(false);
  }

  async function removeTag(tagId: string) {
    if (!activeConv) return;
    await fetch(`/api/candidates/${activeConv.candidateId}/tags/${tagId}`, { method: "DELETE" });
    await loadCandidateDetail(activeConv.candidateId);
  }

  async function assignTo(userId: string | null) {
    if (!activeConv) return;
    if (userId) {
      await fetch(`/api/candidates/${activeConv.candidateId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: userId }),
      });
    } else {
      await fetch(`/api/candidates/${activeConv.candidateId}/assignments`, { method: "DELETE" });
    }
    await loadCandidateDetail(activeConv.candidateId);
    setShowAssignMenu(false);
  }

  async function scheduleInterview(data: { interviewType: string; interviewDate: string; startTime: string; endTime: string }) {
    if (!activeConv || scheduling) return;
    setScheduling(true);
    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId: activeConv.candidateId,
        jobPositionId: activeConv.candidate.interestedPosition?.id,
        interviewType: data.interviewType,
        interviewDate: data.interviewDate,
        startTime: data.startTime,
        endTime: data.endTime,
      }),
    });
    if (res.ok) {
      setShowScheduleForm(false);
      await loadConversation(activeConv.id);
    }
    setScheduling(false);
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex h-[calc(100vh-4rem-1.5rem)] -m-6 overflow-hidden bg-slate-50">

      {/* ── Left Panel: Conversation List ─────────────────────── */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">Inbox</h1>
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button
                onClick={refreshList}
                title="Refresh"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setShowNewConv(!showNewConv)}
                title="New conversation"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา candidate..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <div className="flex gap-1 mt-2">
            {["ALL", "ACTIVE", "WAITING", "CLOSED"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {s === "ALL" ? "ทั้งหมด" : s === "ACTIVE" ? "Active" : s === "WAITING" ? "รอ" : "ปิด"}
              </button>
            ))}
          </div>
        </div>

        {/* New conversation panel */}
        {showNewConv && (
          <div className="p-3 border-b border-slate-200 bg-blue-50">
            <p className="text-xs font-semibold text-blue-700 mb-2">เริ่มสนทนากับ Candidate</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {candidatesWithoutConversation.length === 0 ? (
                <p className="text-xs text-slate-400">ไม่มี candidate ที่ยังไม่มีการสนทนา</p>
              ) : (
                candidatesWithoutConversation.map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-white rounded px-2 py-1.5 text-xs">
                    <span className="truncate text-slate-700">
                      {c.fullName || c.nickname || "ไม่ระบุชื่อ"}
                    </span>
                    <button
                      onClick={() => createConversation(c.id, c.sourceChannel === "LINE" ? "LINE" : c.sourceChannel === "FACEBOOK" ? "FACEBOOK" : "LINE")}
                      className="ml-2 text-blue-600 hover:underline flex-shrink-0"
                    >
                      เริ่ม
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <MessageSquare size={32} className="opacity-30" />
              <p className="text-sm">ไม่มีการสนทนา</p>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeId}
                onClick={() => selectConv(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Middle Panel: Chat View ────────────────────────────── */}
      {!activeConv ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <MessageSquare size={48} className="opacity-20" />
          <p className="text-base font-medium">เลือกการสนทนาเพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <CandidateAvatar c={activeConv.candidate} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 truncate">
                    {candidateName(activeConv.candidate)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor[activeConv.candidate.currentStatus] ?? ""}`}>
                    {statusLabel[activeConv.candidate.currentStatus] ?? activeConv.candidate.currentStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {activeConv.candidate.lineDisplayName && (
                    <span className="text-green-600 font-medium truncate flex items-center gap-0.5">
                      <span className="text-green-500 font-bold">LINE</span>
                      {activeConv.candidate.lineDisplayName}
                    </span>
                  )}
                  {activeConv.candidate.interestedPosition && (
                    <span className="truncate">{activeConv.candidate.interestedPosition.title}</span>
                  )}
                  {activeConv.candidate.phone && (
                    <span className="flex items-center gap-0.5">
                      <Phone size={10} />
                      {activeConv.candidate.phone}
                    </span>
                  )}
                  <span>{channelIcon(activeConv.channel)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${activeConv.botEnabled ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-700"}`}>
                <Bot size={12} />
                {activeConv.botEnabled ? "บอทดูแลอยู่" : "HR รับแชท"}
              </div>

              {activeConv.botEnabled ? (
                <button
                  onClick={() => handleTakeover("TAKE_OVER")}
                  disabled={takingOver}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium"
                >
                  <User size={12} />
                  รับแชท
                </button>
              ) : (
                <button
                  onClick={() => handleTakeover("RELEASE")}
                  disabled={takingOver}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors font-medium"
                >
                  <Bot size={12} />
                  คืนให้บอท
                </button>
              )}

              <button
                onClick={() => setShowSimulate(!showSimulate)}
                title="OpenClaw Mock"
                className={`p-1.5 rounded-lg transition-colors ${showSimulate ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-100"}`}
              >
                <Sparkles size={14} />
              </button>

              <Link
                href={`/candidates/${activeConv.candidateId}`}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="ดูโปรไฟล์"
              >
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>

          {/* Simulate panel */}
          {showSimulate && (
            <div className="p-3 bg-white border-b border-slate-200">
              <SimulatePanel
                conversation={activeConv}
                onSimulated={() => loadConversation(activeConv.id)}
              />
            </div>
          )}

          {/* Messages area */}
          <div
            ref={messagesAreaRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto p-4 bg-slate-50 relative"
          >
            {/* Scroll to bottom button */}
            {showScrollBtn && (
              <button
                onClick={scrollToBottom}
                className="sticky bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-full shadow-lg hover:bg-blue-700 transition-all z-10 w-fit mx-auto"
              >
                <ChevronDown size={13} />
                ข้อความใหม่
              </button>
            )}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <MessageSquare size={32} className="opacity-20" />
                <p className="text-sm">ยังไม่มีข้อความ</p>
                {!showSimulate && (
                  <button
                    onClick={() => setShowSimulate(true)}
                    className="text-xs text-amber-600 hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={12} />
                    จำลองข้อความจาก Candidate
                  </button>
                )}
              </div>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies panel */}
          {showQuickReplies && (
            <div className="bg-white border-t border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Quick Replies</span>
                <button onClick={() => setShowQuickReplies(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickReplies.map((qr) => (
                  <button
                    key={qr.id}
                    onClick={() => {
                      setInputMsg(qr.content);
                      setShowQuickReplies(false);
                    }}
                    className="text-xs border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition-colors"
                  >
                    {qr.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="bg-white border-t border-slate-200 p-3 flex-shrink-0">
            {linePushError && (
              <div className="mb-2 flex items-start justify-between gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-xs text-red-700 space-y-0.5">
                  <p className="font-medium">⚠️ ส่งถึง LINE ไม่สำเร็จ</p>
                  <p className="text-red-600 leading-relaxed">{linePushError}</p>
                  <p className="text-red-500">
                    แนะนำ: ไป{" "}
                    <a href="/integrations" className="underline font-medium hover:text-red-700">
                      /integrations
                    </a>{" "}
                    → กด "ทดสอบ" เพื่อตรวจสอบ Channel Access Token
                  </p>
                </div>
                <button onClick={() => setLinePushError(null)} className="text-red-400 hover:text-red-600 text-xs shrink-0 mt-0.5">✕</button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                title="Quick replies"
                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${showQuickReplies ? "bg-blue-100 text-blue-700" : "text-slate-400 hover:bg-slate-100"}`}
              >
                <Zap size={16} />
              </button>

              <textarea
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="พิมพ์ข้อความ... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
                rows={2}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              <button
                onClick={sendMessage}
                disabled={sending || !inputMsg.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 ml-9">
              {activeConv.botEnabled ? "🤖 บอทกำลังทำงาน — พิมพ์แล้วส่งได้เลย ระบบจะรับแชทให้อัตโนมัติ" : "✅ HR รับแชทอยู่ — ข้อความจากคุณ"}
            </p>
          </div>
        </div>
      )}

      {/* ── Right Panel: Quick Actions ─────────────────────────── */}
      {activeConv && (
        <QuickActionsPanel
          conv={activeConv}
          candidateTags={candidateTags}
          assignment={assignment}
          allTags={allTags}
          hrUsers={hrUsers}
          changingStatus={changingStatus}
          showTagMenu={showTagMenu}
          showAssignMenu={showAssignMenu}
          showScheduleForm={showScheduleForm}
          scheduling={scheduling}
          onChangeStatus={changeStatus}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onAssign={assignTo}
          onSetShowTagMenu={setShowTagMenu}
          onSetShowAssignMenu={setShowAssignMenu}
          onSetShowScheduleForm={setShowScheduleForm}
          onScheduleInterview={scheduleInterview}
        />
      )}
    </div>
  );
}
