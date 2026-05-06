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
  ChevronRight,
  Phone,
  ExternalLink,
  RefreshCw,
  Plus,
  Sparkles,
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
  NEW_APPLICANT: "New",
  BOT_SCREENING: "Bot Screening",
  WAITING_HR_REVIEW: "Waiting HR",
  NEED_MORE_INFO: "Need Info",
  QUALIFIED: "Qualified",
  INTERVIEW_SCHEDULED: "Interview Set",
  INTERVIEWED: "Interviewed",
  PASSED: "Passed",
  REJECTED: "Rejected",
  TALENT_POOL: "Talent Pool",
  CLOSED: "Closed",
};

function candidateName(c: Candidate | null | undefined) {
  if (!c) return "Unknown";
  return c.fullName || c.lineDisplayName || c.nickname || c.phone || "ไม่ระบุชื่อ";
}

function CandidateAvatar({ c, size = "md" }: { c: Candidate | null | undefined; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  const name = candidateName(c);
  if (c?.lineProfilePicUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={c.lineProfilePicUrl}
        alt={name}
        className={`${sz} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          // fallback to initials if CDN link expires
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
      {/* Avatar */}
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

      {/* Bubble */}
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
        {/* Avatar */}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function InboxClient({
  initialConversations,
  quickReplies,
  candidatesWithoutConversation,
  currentUser,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    // update unreadCount in list
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
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
    setShowSimulate(false);
    setShowQuickReplies(false);
    await loadConversation(id);
  }

  // ── polling: active conversation (1.5s) + list refresh (2s) ──
  useEffect(() => {
    if (!activeId) return;
    pollRef.current = setInterval(() => loadConversation(activeId), 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeId, loadConversation]);

  useEffect(() => {
    const listPoll = setInterval(() => refreshList(), 2000);
    return () => clearInterval(listPoll);
  }, [refreshList]);

  // ── scroll to bottom on new messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── send HR message ──
  async function sendMessage() {
    if (!inputMsg.trim() || !activeId || sending) return;
    setSending(true);
    const res = await fetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: inputMsg.trim() }),
    });
    if (res.ok) {
      setInputMsg("");
      await loadConversation(activeId);
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

  // ── create conversation for candidate without one ──
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

          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา candidate..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {/* Filter tabs */}
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

      {/* ── Right Panel: Chat View ─────────────────────────────── */}
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
              {/* Bot status badge */}
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${activeConv.botEnabled ? "bg-indigo-100 text-indigo-700" : "bg-orange-100 text-orange-700"}`}>
                <Bot size={12} />
                {activeConv.botEnabled ? "Bot Active" : "HR Mode"}
              </div>

              {/* Takeover / Release button */}
              {activeConv.botEnabled ? (
                <button
                  onClick={() => handleTakeover("TAKE_OVER")}
                  disabled={takingOver}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium"
                >
                  <User size={12} />
                  Takeover
                </button>
              ) : (
                <button
                  onClick={() => handleTakeover("RELEASE")}
                  disabled={takingOver}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors font-medium"
                >
                  <Bot size={12} />
                  Release Bot
                </button>
              )}

              {/* Simulate toggle */}
              <button
                onClick={() => setShowSimulate(!showSimulate)}
                title="OpenClaw Mock"
                className={`p-1.5 rounded-lg transition-colors ${showSimulate ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-100"}`}
              >
                <Sparkles size={14} />
              </button>

              {/* Link to candidate profile */}
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
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <MessageSquare size={32} className="opacity-20" />
                <p className="text-sm">ยังไม่มีข้อความ</p>
                {showSimulate === false && (
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
              {activeConv.botEnabled ? "🤖 บอทกำลังทำงาน — Takeover เพื่อส่งข้อความเอง" : "✅ HR Mode — ข้อความจากคุณ"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
