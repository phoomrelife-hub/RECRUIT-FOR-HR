"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
  ArrowLeft,
  ChevronDown,
  Calendar,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  Circle,
  Image as ImageIcon,
  Paperclip,
  CheckCheck,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type SenderType = "CANDIDATE" | "BOT" | "HR" | "SYSTEM";
type ConvStatus = "ACTIVE" | "CLOSED" | "WAITING";

interface Message {
  id: string;
  content: string;
  messageType?: string | null; // text | image | file | sticker | video | audio
  mediaUrl?: string | null;
  externalId?: string | null;  // LINE message ID — fallback for constructing mediaUrl
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
  tags?: { tagId: string }[];
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

function MessageMedia({ msg, isRight }: { msg: Message; isRight: boolean }) {
  const [imgOpen, setImgOpen] = useState(false);

  const rawContent = msg.content ?? "";

  // ── Classify message type by messageType field OR content pattern ──────────
  const isImage =
    msg.messageType === "image" ||
    rawContent === "[ส่ง image]" ||
    rawContent === "[📷 รูปภาพ]";
  const isFile =
    msg.messageType === "file" ||
    rawContent === "[ส่ง file]" ||
    /^\[📎/.test(rawContent);

  // ── Effective media URL: stored URL → derived from LINE message ID ─────────
  // Messages saved before the race-condition fix may lack mediaUrl but still
  // have externalId (the LINE message ID). Derive the proxy URL from it so
  // images/files sent within the last 7 days still load.
  const effectiveMediaUrl =
    msg.mediaUrl ||
    ((isImage || isFile) && msg.externalId
      ? `/api/media/line/${msg.externalId}`
      : null);

  // ── Image ──────────────────────────────────────────────────────────────────
  if (isImage && effectiveMediaUrl) {
    return (
      <>
        {/* Thumbnail */}
        <div
          className={`rounded-xl overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity ${
            isRight ? "border-blue-400" : "border-slate-200"
          }`}
          onClick={() => setImgOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={effectiveMediaUrl}
            alt="รูปภาพ"
            className="max-w-[200px] max-h-[200px] object-cover block"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).parentElement!.innerHTML =
                '<span class="text-xs text-slate-400 p-2 block">รูปหมดอายุแล้ว (LINE เก็บ 7 วัน)</span>';
            }}
          />
        </div>

        {/* Lightbox */}
        {imgOpen && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setImgOpen(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={effectiveMediaUrl}
              alt="รูปภาพ"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setImgOpen(false)}
              className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-1 hover:bg-black/80"
            >
              <X size={20} />
            </button>
          </div>
        )}
      </>
    );
  }

  // ── Image — no URL at all (truly expired or before feature existed) ────────
  if (isImage) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
          isRight
            ? "bg-blue-500/20 border-blue-400 text-blue-200"
            : "bg-slate-50 border-slate-200 text-slate-400"
        }`}
      >
        <ImageIcon size={14} className="shrink-0" />
        <span>รูปภาพ (หมดอายุแล้ว)</span>
      </div>
    );
  }

  // ── File ───────────────────────────────────────────────────────────────────
  if (isFile && effectiveMediaUrl) {
    const fileName =
      rawContent.replace(/^\[📎 /, "").replace(/\]$/, "") ||
      rawContent.replace("[ส่ง file]", "ไฟล์แนบ") ||
      "ไฟล์แนบ";
    return (
      <a
        href={effectiveMediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
          isRight
            ? "bg-blue-500 border-blue-400 text-white hover:bg-blue-400"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        }`}
      >
        <ExternalLink size={14} className="shrink-0" />
        <span className="truncate max-w-[160px]">{fileName}</span>
      </a>
    );
  }

  // ── File — no URL at all ───────────────────────────────────────────────────
  if (isFile) {
    const fileName =
      /^\[📎/.test(rawContent)
        ? rawContent.replace(/^\[📎 /, "").replace(/\]$/, "")
        : "ไฟล์แนบ";
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
          isRight
            ? "bg-blue-500/20 border-blue-400 text-blue-200"
            : "bg-slate-50 border-slate-200 text-slate-400"
        }`}
      >
        <Paperclip size={14} className="shrink-0" />
        <span className="truncate max-w-[160px]">{fileName} (หมดอายุแล้ว)</span>
      </div>
    );
  }

  // ── Text (default) ─────────────────────────────────────────────────────────
  return (
    <div
      className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
        isRight
          ? "bg-blue-600 text-white rounded-tr-sm"
          : msg.senderType === "BOT"
          ? "bg-indigo-50 text-slate-800 border border-indigo-100 rounded-tl-sm"
          : "bg-white text-slate-800 border border-slate-200 rounded-tl-sm"
      }`}
    >
      {msg.content}
    </div>
  );
}

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

  // HR and BOT messages appear on the right (outgoing from this app's perspective)
  // Candidate messages appear on the left
  const isRight = msg.senderType === "HR" || msg.senderType === "BOT";
  const isHR = msg.senderType === "HR";
  const isBot = msg.senderType === "BOT";

  return (
    <div className={`msg-bubble flex gap-2 mb-3 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
          isHR
            ? "bg-blue-600 text-white"
            : isBot
            ? "bg-indigo-500 text-white"
            : "bg-slate-200 text-slate-600"
        }`}
      >
        {isHR ? <User size={14} /> : isBot ? <Bot size={14} /> : <MessageSquare size={14} />}
      </div>

      <div className={`max-w-[70%] ${isRight ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        {!isRight && (
          <span className="text-[10px] text-slate-400 ml-1">
            {msg.sender?.name ?? "Candidate"}
          </span>
        )}
        {isBot && (
          <span className="text-[10px] text-slate-400 mr-1 text-right">Claw Bot</span>
        )}

        <MessageMedia msg={msg} isRight={isRight} />

        <span className={`text-[10px] text-slate-400 mx-1 ${isRight ? "text-right" : ""}`}>
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
  onMarkRead,
}: {
  conv: Conversation;
  active: boolean;
  onClick: () => void;
  onMarkRead?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const lastMsg = conv.messages[0];
  const name = candidateName(conv.candidate);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
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
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* mark-as-read icon — ปรากฏเมื่อ hover + มี unread */}
              {hovered && conv.unreadCount > 0 && onMarkRead && (
                <span
                  role="button"
                  title="ทำเครื่องหมายว่าอ่านแล้ว"
                  onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
                  className="p-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <CheckCheck size={13} />
                </span>
              )}
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
  quickReplies: initialQuickReplies,
  candidatesWithoutConversation: initialCandidatesWOConv,
  currentUser,
  allTags: initialAllTags,
  hrUsers: initialHrUsers,
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
  const [filterChannel, setFilterChannel] = useState<string>("ALL");
  const [filterBot, setFilterBot] = useState<string>("ALL"); // ALL | BOT | HR
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterCandidateStatus, setFilterCandidateStatus] = useState<string>("ALL");
  const [filterTagId, setFilterTagId] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"LATEST" | "UNREAD_FIRST">("LATEST");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
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

  // ── Lazy-loaded secondary data ─────────────────────────────────────────────
  // quickReplies, allTags, hrUsers are fetched after mount to keep TTFB fast.
  // candidatesWithoutConversation is fetched only when "New Conversation" opens.
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(initialQuickReplies);
  const [allTags, setAllTags] = useState<Tag[]>(initialAllTags);
  const [hrUsers, setHrUsers] = useState<HRUser[]>(initialHrUsers);
  const [candidatesWithoutConversation, setCandidatesWithoutConversation] = useState(initialCandidatesWOConv);
  const [candidatesWOConvLoaded, setCandidatesWOConvLoaded] = useState(initialCandidatesWOConv.length > 0);

  const searchParams = useSearchParams();
  const autoSelectDoneRef = useRef(false);

  useEffect(() => {
    const convId = searchParams.get("c");
    if (!convId || autoSelectDoneRef.current || conversations.length === 0) return;
    autoSelectDoneRef.current = true;
    selectConv(convId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, searchParams]);

  useEffect(() => {
    // Fetch secondary inbox data (quickReplies, tags, hrUsers) in background after hydration
    fetch("/api/inbox/init")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setQuickReplies(data.quickReplies ?? []);
        setAllTags(data.tags ?? []);
        setHrUsers(data.hrUsers ?? []);
      })
      .catch(() => {/* non-critical */});
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // ref ที่ mirror activeId — ทำให้ refreshList ไม่ต้อง capture state ใน closure
  const activeIdRef = useRef<string | null>(null);

  // ── filtered + sorted conversations ──
  const filtered = (() => {
    let result = conversations.filter((c) => {
      if (filterStatus !== "ALL" && c.status !== filterStatus) return false;
      if (filterChannel !== "ALL" && c.channel !== filterChannel) return false;
      if (filterBot === "BOT" && !c.botEnabled) return false;
      if (filterBot === "HR" && c.botEnabled) return false;
      if (filterUnread && c.unreadCount === 0) return false;
      if (filterCandidateStatus !== "ALL" && c.candidate.currentStatus !== filterCandidateStatus) return false;
      if (filterTagId !== "ALL") {
        const hasTags = c.candidate.tags?.some((t) => t.tagId === filterTagId);
        if (!hasTags) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const cand = c.candidate;
        const fields = [
          cand.fullName ?? "",
          cand.nickname ?? "",
          cand.lineDisplayName ?? "",
          cand.phone ?? "",
          cand.interestedPosition?.title ?? "",
          (c.messages as { content: string }[])?.[0]?.content ?? "",
        ].map((f) => f.toLowerCase());
        if (!fields.some((f) => f.includes(q))) return false;
      }
      return true;
    });
    if (sortBy === "UNREAD_FIRST") {
      result = [...result].sort(
        (a, b) =>
          b.unreadCount - a.unreadCount ||
          new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime()
      );
    }
    return result;
  })();

  // ── load conversation detail ──
  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setActiveConv(data);
    const incoming: Message[] = data.messages ?? [];
    setMessages((prev) => {
      // ถ้า length เท่ากันและ message ล่าสุดเหมือนกัน → ไม่ต้อง re-render
      // (กรณี poll แล้วไม่มีข้อความใหม่)
      if (
        incoming.length === prev.length &&
        incoming.length > 0 &&
        incoming[incoming.length - 1].id === prev[prev.length - 1]?.id
      ) {
        return prev;
      }
      return incoming;
    });
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
  // ใช้ functional update + activeIdRef เพื่อป้องกัน race condition:
  // ถ้า DB write (unreadCount=0) ยังไม่เสร็จตอน list refresh มา
  // conv ที่ user กำลังเปิดอยู่จะถูก lock ไว้ที่ 0 เสมอ
  const refreshList = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const data = await res.json();
    const incoming: Conversation[] = data.conversations ?? [];
    const currentActiveId = activeIdRef.current;
    setConversations(
      incoming.map((c) => ({
        ...c,
        unreadCount: c.id === currentActiveId ? 0 : c.unreadCount,
      }))
    );
  }, []);

  // ── mark one conversation as read ──
  const markOneRead = useCallback(async (id: string) => {
    // optimistic
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markRead: true }),
    });
  }, []);

  // ── mark all conversations as read ──
  const [markingAll, setMarkingAll] = useState(false);
  const markAllRead = useCallback(async () => {
    setMarkingAll(true);
    setConversations((prev) => prev.map((c) => ({ ...c, unreadCount: 0 })));
    await fetch("/api/conversations/mark-all-read", { method: "POST" });
    setMarkingAll(false);
  }, []);

  // ── select conversation ──
  const [isLoadingConv, setIsLoadingConv] = useState(false);

  async function selectConv(id: string) {
    if (id === activeId) return; // ป้องกัน double-click
    setActiveId(id);
    activeIdRef.current = id;
    // ล้างทันทีเพื่อไม่ให้เห็น conv เก่าขณะโหลด
    setActiveConv(null);
    setMessages([]);
    setInputMsg("");
    setIsLoadingConv(true);
    isAtBottomRef.current = true;
    prevMessageCountRef.current = 0;
    setShowScrollBtn(false);
    setShowSimulate(false);
    setShowQuickReplies(false);
    setShowTagMenu(false);
    setShowAssignMenu(false);
    setShowScheduleForm(false);
    setLinePushError(null);
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      await Promise.all([
        loadConversation(id),
        loadCandidateDetail(conv.candidateId),
      ]);
    } else {
      await loadConversation(id);
    }
    setIsLoadingConv(false);
  }

  // ── polling ──
  useEffect(() => {
    if (!activeId) return;
    pollRef.current = setInterval(() => loadConversation(activeId), 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeId, loadConversation]);

  useEffect(() => {
    refreshList(); // sync ทันทีตอน mount ไม่รอ interval แรก
    const listPoll = setInterval(() => refreshList(), 5000);
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
    const text = inputMsg.trim();

    // 1. Clear input + optimistic bubble ทันที
    setInputMsg("");
    setSending(true);
    setLinePushError(null);
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      content: text,
      senderType: "HR",
      senderId: currentUser.id,
      sender: { id: currentUser.id, name: currentUser.name },
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    isAtBottomRef.current = true;

    // 2. Auto-takeover ถ้า bot ยังเปิดอยู่
    if (activeConv?.botEnabled) {
      const takeoverRes = await fetch(`/api/conversations/${activeId}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TAKE_OVER" }),
      });
      if (!takeoverRes.ok) {
        // rollback
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInputMsg(text);
        setSending(false);
        return;
      }
    }

    // 3. ส่งจริง
    const res = await fetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) {
      const data = await res.json();
      // โหลด conv เพื่อแทน temp msg ด้วย real ID (silent — ไม่แสดง loading)
      await loadConversation(activeId);
      if (data.linePushError) setLinePushError(data.linePushError);
    } else {
      // rollback ถ้า fail
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputMsg(text);
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
    // optimistic: อัปเดต UI ทันที
    const prevStatus = activeConv.candidate.currentStatus;
    setActiveConv((prev) =>
      prev ? { ...prev, candidate: { ...prev.candidate, currentStatus: newStatus } } : prev
    );
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? { ...c, candidate: { ...c.candidate, currentStatus: newStatus } }
          : c
      )
    );
    const res = await fetch(`/api/candidates/${activeConv.candidateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStatus: newStatus }),
    });
    if (!res.ok) {
      // rollback ถ้า fail
      setActiveConv((prev) =>
        prev ? { ...prev, candidate: { ...prev.candidate, currentStatus: prevStatus } } : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConv.id
            ? { ...c, candidate: { ...c.candidate, currentStatus: prevStatus } }
            : c
        )
      );
    }
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
    <div className="flex h-[calc(100vh-4rem-1.5rem)] -m-4 md:-m-6 overflow-hidden bg-slate-50">

      {/* ── Left Panel: Conversation List ─────────────────────── */}
      {/* Mobile: full width when no active conv; hidden when chat is open */}
      {/* Desktop: always show as fixed-width sidebar */}
      <div className={`
        flex-shrink-0 bg-white border-r border-slate-200 flex flex-col
        ${activeId ? "hidden md:flex md:w-80" : "w-full md:w-80"}
      `}>
        {/* Header */}
        <div className="p-3 border-b border-slate-200 space-y-2">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Inbox</h1>
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {totalUnread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={markingAll}
                  title="ทำเครื่องหมายว่าอ่านทั้งหมด"
                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-40"
                >
                  <CheckCheck size={13} />
                </button>
              )}
              <button
                onClick={refreshList}
                title="Refresh"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={() => {
                  setShowNewConv(!showNewConv);
                  // Lazy-load candidates without conversations when dialog first opens
                  if (!showNewConv && !candidatesWOConvLoaded) {
                    fetch("/api/candidates?noConversation=true&limit=50")
                      .then((r) => (r.ok ? r.json() : null))
                      .then((data) => {
                        if (!data) return;
                        setCandidatesWithoutConversation(data.candidates ?? []);
                        setCandidatesWOConvLoaded(true);
                      })
                      .catch(() => {/* non-critical */});
                  }
                }}
                title="New conversation"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ชื่อ, เบอร์, ตำแหน่ง, ข้อความ..."
              className="w-full text-xs border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Conversation status tabs */}
          <div className="flex gap-1">
            {(["ALL", "ACTIVE", "WAITING", "CLOSED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`flex-1 text-[11px] py-1 rounded font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {s === "ALL" ? "ทั้งหมด" : s === "ACTIVE" ? "Active" : s === "WAITING" ? "รอ" : "ปิด"}
              </button>
            ))}
          </div>

          {/* Filter toggle row */}
          {(() => {
            const activeFilterCount = [
              filterChannel !== "ALL",
              filterBot !== "ALL",
              filterUnread,
              filterCandidateStatus !== "ALL",
              filterTagId !== "ALL",
              sortBy !== "LATEST",
            ].filter(Boolean).length;
            return (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors flex-1 ${
                    showFilters || activeFilterCount > 0
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <SlidersHorizontal size={11} />
                  กรอง
                  {activeFilterCount > 0 && (
                    <span className="ml-auto bg-blue-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown size={11} className={`ml-auto transition-transform ${showFilters ? "rotate-180" : ""} ${activeFilterCount > 0 ? "ml-0" : ""}`} />
                </button>
                <button
                  onClick={() => setSortBy(sortBy === "LATEST" ? "UNREAD_FIRST" : "LATEST")}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors flex-shrink-0 ${
                    sortBy === "UNREAD_FIRST"
                      ? "bg-slate-700 text-white border-slate-700"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                  title={sortBy === "LATEST" ? "เรียงตามเวลา" : "เรียงยังไม่อ่านก่อน"}
                >
                  <ArrowUpDown size={11} />
                  {sortBy === "UNREAD_FIRST" ? "ยังไม่อ่าน" : "ล่าสุด"}
                </button>
              </div>
            );
          })()}

          {/* Expanded filter panel */}
          {showFilters && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              {/* Candidate status */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-10 flex-shrink-0">สถานะ</span>
                <select
                  value={filterCandidateStatus}
                  onChange={(e) => setFilterCandidateStatus(e.target.value)}
                  className={`flex-1 text-[11px] border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer ${
                    filterCandidateStatus !== "ALL"
                      ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  <option value="ALL">ทุกสถานะ</option>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{statusLabel[s]}</option>
                  ))}
                </select>
              </div>

              {/* Tag */}
              {allTags.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-10 flex-shrink-0">Tag</span>
                  <select
                    value={filterTagId}
                    onChange={(e) => setFilterTagId(e.target.value)}
                    className={`flex-1 text-[11px] border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer ${
                      filterTagId !== "ALL"
                        ? "border-violet-400 bg-violet-50 text-violet-700 font-medium"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <option value="ALL">ทุก Tag</option>
                    {allTags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Channel + Mode + Unread chips */}
              <div className="flex flex-wrap gap-1">
                {(["LINE", "FACEBOOK"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setFilterChannel(filterChannel === ch ? "ALL" : ch)}
                    className={`text-[10px] px-2 py-1 rounded-lg font-medium border transition-colors ${
                      filterChannel === ch
                        ? ch === "LINE"
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-blue-600 text-white border-blue-600"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {ch === "FACEBOOK" ? "Facebook" : "LINE"}
                  </button>
                ))}
                <button
                  onClick={() => setFilterBot(filterBot === "BOT" ? "ALL" : "BOT")}
                  className={`text-[10px] px-2 py-1 rounded-lg font-medium border transition-colors flex items-center gap-1 ${
                    filterBot === "BOT"
                      ? "bg-amber-500 text-white border-amber-500"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Bot size={10} /> บอท
                </button>
                <button
                  onClick={() => setFilterBot(filterBot === "HR" ? "ALL" : "HR")}
                  className={`text-[10px] px-2 py-1 rounded-lg font-medium border transition-colors flex items-center gap-1 ${
                    filterBot === "HR"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <User size={10} /> HR Mode
                </button>
                <button
                  onClick={() => setFilterUnread(!filterUnread)}
                  className={`text-[10px] px-2 py-1 rounded-lg font-medium border transition-colors flex items-center gap-1 ${
                    filterUnread
                      ? "bg-red-500 text-white border-red-500"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Circle size={8} className={filterUnread ? "fill-white" : "fill-slate-400"} />
                  ยังไม่อ่าน
                </button>
              </div>

              {/* Result count + clear */}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-slate-400">
                  {filtered.length} จาก {conversations.length} การสนทนา
                </span>
                <button
                  onClick={() => { setFilterChannel("ALL"); setFilterBot("ALL"); setFilterUnread(false); setSearch(""); setFilterStatus("ALL"); setFilterCandidateStatus("ALL"); setFilterTagId("ALL"); setSortBy("LATEST"); setShowFilters(false); }}
                  className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
                >
                  ล้างทั้งหมด
                </button>
              </div>
            </div>
          )}
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
                onMarkRead={conv.unreadCount > 0 ? () => markOneRead(conv.id) : undefined}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Middle Panel: Chat View ────────────────────────────── */}
      {!activeId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <MessageSquare size={48} className="opacity-20" />
          <p className="text-base font-medium">เลือกการสนทนาเพื่อเริ่มต้น</p>
        </div>
      ) : isLoadingConv ? (
        /* Skeleton while loading */
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-16 bg-white border-b border-slate-200 px-4 flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
              <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex-1 p-4 bg-slate-50 space-y-3 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                <div className="w-7 h-7 rounded-full bg-slate-200 animate-pulse flex-shrink-0" />
                <div className={`h-9 rounded-2xl bg-slate-200 animate-pulse ${i % 2 === 0 ? "w-48" : "w-36"}`} style={{ animationDelay: `${i * 80}ms` }} />
              </div>
            ))}
          </div>
        </div>
      ) : !activeConv ? null : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat Header */}
          <div className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Back button — mobile only */}
              <button
                onClick={() => { setActiveId(null); activeIdRef.current = null; setActiveConv(null); }}
                className="md:hidden -ml-1 p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
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

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Bot status badge — icon only on mobile */}
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${activeConv.botEnabled ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-700"}`}>
                <Bot size={12} />
                <span className="hidden sm:inline">{activeConv.botEnabled ? "บอทดูแลอยู่" : "HR รับแชท"}</span>
              </div>

              {activeConv.botEnabled ? (
                <button
                  onClick={() => handleTakeover("TAKE_OVER")}
                  disabled={takingOver}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium"
                >
                  <User size={12} />
                  <span className="hidden sm:inline">รับแชท</span>
                </button>
              ) : (
                <button
                  onClick={() => handleTakeover("RELEASE")}
                  disabled={takingOver}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors font-medium"
                >
                  <Bot size={12} />
                  <span className="hidden sm:inline">คืนให้บอท</span>
                </button>
              )}

              <button
                onClick={() => setShowSimulate(!showSimulate)}
                title="OpenClaw Mock"
                className={`p-1.5 rounded-lg transition-colors hidden sm:flex ${showSimulate ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-100"}`}
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

      {/* ── Right Panel: Quick Actions (desktop only) ───────────── */}
      {activeConv && !isLoadingConv && (
        <div className="hidden lg:contents">
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
        </div>
      )}
    </div>
  );
}
