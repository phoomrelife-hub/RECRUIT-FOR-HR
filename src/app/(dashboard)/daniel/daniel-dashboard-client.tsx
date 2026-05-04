"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bot, Activity, Clock, MessageSquare, Wifi, WifiOff,
  RefreshCw, ExternalLink, CheckCircle, XCircle, User, Zap
} from "lucide-react";

type Stats = {
  activeConversations: number;
  aiConversations: number;
  responseRate: number;
  avgResponseSeconds: number;
  totalBotMessages: number;
};

type LiveConversation = {
  id: string;
  candidate: { id: string; nickname: string | null; fullName: string | null; currentStatus: string; sourceChannel: string };
  channel: string;
  botEnabled: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessage: string | null;
  lastMessageSender: string | null;
  openclawId: string | null;
};

type Props = {
  apiUrl: string;
  hasApiKey: boolean;
  isSuperAdmin: boolean;
};

const CHANNEL_COLORS: Record<string, string> = {
  LINE: "bg-green-100 text-green-700",
  FACEBOOK: "bg-blue-100 text-blue-700",
  WEBSITE: "bg-purple-100 text-purple-700",
  MANUAL: "bg-slate-100 text-slate-600",
  OTHER: "bg-slate-100 text-slate-600",
};

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DanielDashboardClient({ apiUrl, hasApiKey, isSuperAdmin }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [conversations, setConversations] = useState<LiveConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testError, setTestError] = useState("");
  const [testVersion, setTestVersion] = useState("");

  const fetchData = useCallback(async () => {
    const [statsRes, convsRes] = await Promise.all([
      fetch("/api/daniel/stats"),
      fetch("/api/daniel/conversations"),
    ]);
    if (statsRes.ok) setStats(await statsRes.json());
    if (convsRes.ok) setConversations(await convsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  async function handleTestConnection() {
    setTestStatus("testing");
    setTestError("");
    try {
      const res = await fetch("/api/daniel/test-connection", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setTestStatus("ok");
        setTestVersion(data.version ?? "");
      } else {
        setTestStatus("fail");
        setTestError(data.error ?? "Connection failed");
      }
    } catch {
      setTestStatus("fail");
      setTestError("Network error");
    }
  }

  const candidateName = (c: LiveConversation["candidate"]) =>
    c.nickname ?? c.fullName ?? "Unknown";

  const timeAgo = (dt: string | null) => {
    if (!dt) return "-";
    const diff = Date.now() - new Date(dt).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "เมื่อกี้";
    if (m < 60) return `${m} นาทีที่แล้ว`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ชม.ที่แล้ว`;
    return `${Math.floor(h / 24)} วันที่แล้ว`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-600" /> Daniel AI Control Panel
          </h1>
          <p className="text-slate-500 mt-1">ติดตามและควบคุม Daniel AI bot ที่เชื่อมต่อผ่าน OpenClaw</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-4 h-4" /> รีเฟรช
        </button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={MessageSquare} label="Active Conversations" value={stats.activeConversations} sub="botEnabled=true" color="bg-blue-50 text-blue-600" />
          <StatCard icon={Zap} label="AI Response Rate" value={`${stats.responseRate}%`} sub="BOT replies / candidate msgs" color="bg-green-50 text-green-600" />
          <StatCard icon={Clock} label="Avg Response Time" value={`${stats.avgResponseSeconds}s`} sub="จาก candidate → bot" color="bg-amber-50 text-amber-600" />
          <StatCard icon={Activity} label="Total Bot Messages" value={stats.totalBotMessages.toLocaleString()} sub="ตลอดทั้งหมด" color="bg-purple-50 text-purple-600" />
        </div>
      ) : null}

      {/* Live Conversations */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Live Conversations</h2>
          <span className="text-xs text-slate-400">รีเฟรชทุก 15 วิ</span>
        </div>
        {conversations.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>ไม่มี active conversations</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {conversations.map((conv) => (
              <div key={conv.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 truncate">{candidateName(conv.candidate)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_COLORS[conv.channel] ?? "bg-slate-100 text-slate-600"}`}>
                      {conv.channel}
                    </span>
                    {conv.botEnabled ? (
                      <span className="flex items-center gap-1 text-xs text-green-600"><Bot className="w-3 h-3" /> Bot</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-orange-500"><User className="w-3 h-3" /> HR</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {conv.lastMessageSender === "BOT" && <span className="text-blue-500">Daniel: </span>}
                    {conv.lastMessageSender === "CANDIDATE" && <span className="text-slate-500">Candidate: </span>}
                    {conv.lastMessage ?? "—"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-400">{timeAgo(conv.lastMessageAt)}</p>
                  {conv.unreadCount > 0 && (
                    <span className="mt-1 inline-block bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{conv.unreadCount}</span>
                  )}
                </div>
                <a href={`/inbox`} className="shrink-0 text-slate-300 hover:text-blue-600 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OpenClaw Connection Config */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">OC</div>
          <div>
            <p className="font-semibold text-slate-900">OpenClaw Connection</p>
            <p className="text-sm text-slate-500">Daniel AI ผ่าน OpenClaw API</p>
          </div>
          {hasApiKey ? (
            <span className="ml-auto flex items-center gap-1.5 text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle className="w-4 h-4" /> API Key ตั้งค่าแล้ว
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1.5 text-sm text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full">
              <XCircle className="w-4 h-4" /> ยังไม่ได้ตั้งค่า API Key
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">OpenClaw API URL</p>
            <code className="block text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 break-all">{apiUrl}</code>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Webhook Endpoint (ส่งให้ OpenClaw ใช้)</p>
            <code className="block text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 break-all">POST /api/openclaw/webhook</code>
          </div>
        </div>

        {isSuperAdmin && (
          <div>
            <button
              onClick={handleTestConnection}
              disabled={testStatus === "testing"}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {testStatus === "testing" ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> กำลังทดสอบ...</>
              ) : (
                <><Wifi className="w-4 h-4" /> ทดสอบการเชื่อมต่อ</>
              )}
            </button>

            {testStatus === "ok" && (
              <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                <CheckCircle className="w-4 h-4" />
                เชื่อมต่อสำเร็จ{testVersion && ` — OpenClaw v${testVersion}`}
              </div>
            )}
            {testStatus === "fail" && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                <WifiOff className="w-4 h-4" />
                เชื่อมต่อไม่ได้: {testError}
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700 space-y-2">
          <p className="font-medium">วิธีตั้งค่า OpenClaw</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-600">
            <li>เพิ่ม <code className="bg-blue-100 px-1 rounded">OPENCLAW_API_URL</code> และ <code className="bg-blue-100 px-1 rounded">OPENCLAW_API_KEY</code> ใน Environment Variables</li>
            <li>ตั้งค่า OpenClaw ให้ส่ง webhook มาที่ <code className="bg-blue-100 px-1 rounded">/api/openclaw/webhook</code></li>
            <li>กด "ทดสอบการเชื่อมต่อ" เพื่อตรวจสอบ</li>
            <li>เมื่อเชื่อมต่อแล้ว Daniel จะตอบผ่าน OpenClaw AI อัตโนมัติ</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
