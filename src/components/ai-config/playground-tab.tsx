"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, RotateCcw, Bot, Info } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function PlaygroundTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerInfo, setProviderInfo] = useState<{ provider?: string; model?: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load initial bot config to get provider info
  useEffect(() => {
    fetch("/api/settings/ai/bot-prompt")
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.provider_name) {
          setProviderInfo({ provider: cfg.provider_name, model: cfg.provider_model });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/ai/chat-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      } else {
        setMessages([...newMessages, { role: "assistant", content: data.reply }]);
        if (data.provider && data.model) {
          setProviderInfo({ provider: data.provider, model: data.model });
        }
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบการตั้งค่า API");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">ทดสอบ Chatbot</h3>
          <p className="text-xs text-slate-400 mt-0.5">ทดสอบ bot ด้วย AI จริง — ใช้ credit ตาม API ที่ตั้งค่าไว้</p>
        </div>
        <div className="flex items-center gap-2">
          {providerInfo?.model && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full flex items-center gap-1">
              <Info className="h-3 w-3" />
              {providerInfo.provider} · {providerInfo.model}
            </span>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            ล้างบทสนทนา
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 border border-slate-200 rounded-xl bg-white overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center mb-4 shadow-md">
                <Bot className="h-7 w-7 text-white" />
              </div>
              <p className="text-sm font-medium text-slate-700">พิมพ์ข้อความเพื่อทดสอบ Chatbot</p>
              <p className="text-xs text-slate-400 mt-1">Bot จะตอบตาม Prompt & บุคลิกที่คุณตั้งค่าไว้</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-2.5`}>
              {m.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                  D
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                  HR
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex justify-start gap-2.5">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                D
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start gap-2.5">
              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-sm font-bold shrink-0">
                !
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-red-700">
                {error}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-100 p-3 flex gap-2 bg-white">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="พิมพ์ข้อความเพื่อทดสอบ..."
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex items-center justify-center h-10 w-10 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Warning note */}
      <p className="text-[11px] text-slate-400 mt-2 text-center">
        ⚡ การทดสอบนี้ใช้ AI จริงและอาจมีค่าใช้จ่ายตาม API ที่เลือก — ไม่เชื่อมต่อกับ LINE
      </p>
    </div>
  );
}
