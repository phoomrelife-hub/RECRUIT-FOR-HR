"use client";
import { useState } from "react";
import { OfficeCanvas } from "@/components/assistant/office-canvas";
import { AssistantChat, type ChatMessage } from "@/components/assistant/assistant-chat";

type SessionRow = { id: string; title: string; updatedAt: string };

export function AssistantClient({ initialSessions }: { initialSessions: SessionRow[] }) {
  const [sessions, setSessions] = useState<SessionRow[]>(initialSessions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);

  function newChat() {
    setActiveId(null);
    setMessages([]);
  }

  async function deleteSession(id: string) {
    await fetch(`/api/assistant/sessions?id=${id}`, { method: "DELETE" });
    setSessions((s) => s.filter((x) => x.id !== id));
    if (activeId === id) newChat();
  }

  function onSessionCreated(id: string) {
    setActiveId(id);
    // refresh the session list to show the new thread
    fetch("/api/assistant/sessions").then((r) => r.json()).then((d) => { if (d.sessions) setSessions(d.sessions); }).catch(() => {});
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      {/* session rail */}
      <div className="rounded-xl border border-slate-200 bg-white p-2 h-fit">
        <button onClick={newChat} className="w-full rounded-lg bg-blue-600 text-white text-sm font-medium py-2 mb-2">+ แชทใหม่</button>
        <div className="space-y-1">
          {sessions.length === 0 && <p className="text-xs text-slate-400 px-2 py-3">ยังไม่มีประวัติแชท</p>}
          {sessions.map((s) => (
            <div key={s.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer ${activeId === s.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700"}`}>
              <button onClick={() => setActiveId(s.id)} className="flex-1 text-left truncate">{s.title}</button>
              <button onClick={() => deleteSession(s.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* office + chat */}
      <div className="space-y-4">
        <div className="rounded-xl p-4 flex justify-center" style={{ background: "#050810" }}>
          <OfficeCanvas thinking={thinking} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white h-[480px] flex flex-col">
          <AssistantChat
            key={activeId ?? "new"}
            sessionId={activeId}
            initialMessages={messages}
            onSessionCreated={onSessionCreated}
            onThinkingChange={setThinking}
          />
        </div>
      </div>
    </div>
  );
}
