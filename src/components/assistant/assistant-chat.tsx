"use client";
import { useEffect, useRef, useState } from "react";
import { Md } from "./markdown";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function AssistantChat({
  sessionId,
  initialMessages,
  onSessionCreated,
  onThinkingChange,
}: {
  sessionId: string | null;
  initialMessages: ChatMessage[];
  onSessionCreated: (id: string) => void;
  onThinkingChange: (thinking: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages(initialMessages); }, [initialMessages]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => { onThinkingChange(busy); }, [busy, onThinkingChange]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const r = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const d = await r.json();
      if (d.sessionId && d.sessionId !== sessionId) onSessionCreated(d.sessionId);
      setMessages((m) => [...m, { role: "assistant", content: d.reply ?? "—" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "เกิดข้อผิดพลาด โปรดลองใหม่" }]);
    } finally {
      setBusy(false);
    }
  }

  const examples = [
    "หา Sales Admin ประสบการณ์ 3 ปีขึ้นไป เงินเดือนไม่เกิน 18,000",
    "ผู้สมัคร Telesales ที่ขายเก่ง ยอดขายสูง",
    "วันนี้มีผู้สมัครใหม่กี่คน",
  ];

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500 space-y-2">
            <p>ลองถามดูได้เลย เช่น</p>
            {examples.map((ex) => (
              <button key={ex} onClick={() => setInput(ex)}
                className="block text-left w-full rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 text-slate-700">
                {ex}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={
              m.role === "user"
                ? "max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 text-white px-4 py-2 text-sm whitespace-pre-wrap"
                : "max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 text-slate-800 px-4 py-2 text-sm"
            }>
              {m.role === "user" ? m.content : <Md text={m.content} className="space-y-1" />}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="rounded-2xl bg-slate-100 text-slate-500 px-4 py-2 text-sm">กำลังค้นหา…</div></div>}
      </div>
      <div className="border-t border-slate-200 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="พิมพ์สิ่งที่คุณต้องการ เช่น หา Sales Admin ประสบการณ์ 3 ปี…"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          disabled={busy}
        />
        <button onClick={send} disabled={busy || !input.trim()}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
          ส่ง
        </button>
      </div>
    </div>
  );
}
