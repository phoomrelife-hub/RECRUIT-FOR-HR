"use client";

import { useState } from "react";
import { Send, Loader2, Save, RotateCcw, Zap } from "lucide-react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RunResult {
  content: string;
  extractedFields: Record<string, string>;
  tags: string[];
  score: number;
  handoff: boolean;
  tokenEstimate: number;
  costEstimate: number;
  latencyMs: number;
}

export function PlaygroundTab() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [saving, setSaving] = useState(false);

  async function send() {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user" as const, content: input }];
    setMessages(newMessages);
    setInput("");
    setRunning(true);

    const res = await fetch("/api/settings/ai/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, messages: newMessages }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult(data);
      setMessages([...newMessages, { role: "assistant", content: data.content }]);
    }
    setRunning(false);
  }

  async function saveRun() {
    if (!result) return;
    setSaving(true);
    await fetch("/api/settings/ai/playground/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt,
        messages: messages.slice(0, -1),
        responseContent: result.content,
        tokenEstimate: result.tokenEstimate,
        costEstimate: result.costEstimate,
        latencyMs: result.latencyMs,
      }),
    });
    setSaving(false);
  }

  return (
    <div className="grid grid-cols-3 gap-4 h-[75vh]">
      {/* Left: system prompt + results */}
      <div className="col-span-1 flex flex-col gap-3">
        <div className="flex-none">
          <label className="text-sm font-medium text-slate-700 block mb-1">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            className="w-full border border-slate-200 rounded-lg p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Leave empty to use the published system prompt..."
          />
        </div>

        {result && (
          <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs overflow-y-auto">
            <div className="font-medium text-slate-700 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Analysis
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Metric label="Tokens" value={result.tokenEstimate} />
              <Metric label="Cost" value={`$${result.costEstimate.toFixed(6)}`} />
              <Metric label="Latency" value={`${result.latencyMs}ms`} />
              <Metric label="Score" value={result.score} />
            </div>
            {result.handoff && (
              <div className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs">⚠ Handoff triggered</div>
            )}
            {result.tags.length > 0 && (
              <div>
                <span className="text-slate-500">Tags: </span>
                {result.tags.map((t) => (
                  <span key={t} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs mr-1">{t}</span>
                ))}
              </div>
            )}
            {Object.keys(result.extractedFields).length > 0 && (
              <div>
                <span className="text-slate-500 block mb-1">Extracted:</span>
                {Object.entries(result.extractedFields).map(([k, v]) => (
                  <div key={k} className="text-slate-600"><b>{k}:</b> {v}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => { setMessages([]); setResult(null); }}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          {result && (
            <button
              onClick={saveRun}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Run
            </button>
          )}
        </div>
      </div>

      {/* Right: chat */}
      <div className="col-span-2 border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-sm font-medium text-slate-700 flex items-center justify-between">
          <span>Playground Chat</span>
          <span className="text-xs text-slate-400">Mock AI — does not connect to LINE</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-12">
              Start typing to test your bot configuration
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {running && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> Thinking...
              </div>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-slate-100 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Type a message..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={send}
            disabled={running || !input.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-50 rounded px-2 py-1">
      <div className="text-slate-400 text-[10px]">{label}</div>
      <div className="font-medium text-slate-700">{value}</div>
    </div>
  );
}
