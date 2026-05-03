"use client";

import { useEffect, useState } from "react";
import { Plus, Upload, RotateCcw, Loader2, CheckCircle, Archive } from "lucide-react";

interface PromptVersion {
  id: string;
  version: number;
  title: string;
  content: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  createdAt: string;
}

export function PromptsTab() {
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PromptVersion | null>(null);
  const [editing, setEditing] = useState<{ title: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/ai/prompts");
    if (res.ok) {
      const data = await res.json();
      setPrompts(data);
      if (!selected && data.length > 0) {
        const pub = data.find((p: PromptVersion) => p.status === "PUBLISHED") ?? data[0];
        setSelected(pub);
      }
    }
    setLoading(false);
  }

  async function createDraft() {
    setEditing({ title: `Draft ${prompts.length + 1}`, content: selected?.content ?? "" });
  }

  async function saveDraft() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch("/api/settings/ai/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    if (res.ok) { setEditing(null); await load(); }
    setSaving(false);
  }

  async function publish(id: string) {
    setSaving(true);
    await fetch(`/api/settings/ai/prompts/${id}/publish`, { method: "POST" });
    await load();
    setSaving(false);
  }

  async function restore(id: string) {
    setSaving(true);
    await fetch(`/api/settings/ai/prompts/${id}/restore`, { method: "POST" });
    await load();
    setSaving(false);
  }

  const statusColor = {
    DRAFT: "bg-slate-100 text-slate-600",
    PUBLISHED: "bg-green-100 text-green-700",
    ARCHIVED: "bg-amber-100 text-amber-700",
  };

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="grid grid-cols-3 gap-4 h-[70vh]">
      {/* Version list */}
      <div className="col-span-1 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Versions</span>
          <button onClick={createDraft} className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
            <Plus className="h-3 w-3" /> New Draft
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {prompts.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelected(p); setEditing(null); }}
              className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${selected?.id === p.id ? "bg-blue-50" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusColor[p.status]}`}>{p.status}</span>
                <span className="text-xs text-slate-500">v{p.version}</span>
              </div>
              <div className="text-sm font-medium text-slate-700 mt-1 truncate">{p.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {new Date(p.createdAt).toLocaleDateString("th-TH")}
              </div>
            </button>
          ))}
          {prompts.length === 0 && (
            <div className="p-4 text-center text-sm text-slate-400">No prompt versions yet</div>
          )}
        </div>
      </div>

      {/* Editor / viewer */}
      <div className="col-span-2 border border-slate-200 rounded-lg flex flex-col overflow-hidden">
        {editing ? (
          <>
            <div className="p-3 border-b border-slate-100 flex items-center gap-2">
              <input
                value={editing.title}
                onChange={(e) => setEditing((ed) => ed ? { ...ed, title: e.target.value } : ed)}
                className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm"
              />
              <button onClick={() => setEditing(null)} className="px-3 py-1 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={saveDraft} disabled={saving} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving && <Loader2 className="h-3 w-3 animate-spin" />} Save Draft
              </button>
            </div>
            <textarea
              value={editing.content}
              onChange={(e) => setEditing((ed) => ed ? { ...ed, content: e.target.value } : ed)}
              className="flex-1 p-4 text-sm font-mono resize-none focus:outline-none"
              placeholder="Enter system prompt..."
            />
          </>
        ) : selected ? (
          <>
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[selected.status]}`}>{selected.status}</span>
                <span className="text-sm font-medium text-slate-700">{selected.title}</span>
                <span className="text-xs text-slate-400">v{selected.version}</span>
              </div>
              <div className="flex items-center gap-2">
                {selected.status === "DRAFT" && (
                  <button
                    onClick={() => publish(selected.id)}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" /> Publish
                  </button>
                )}
                {selected.status === "ARCHIVED" && (
                  <button
                    onClick={() => restore(selected.id)}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> Restore as Draft
                  </button>
                )}
                {selected.status === "PUBLISHED" && (
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="h-3.5 w-3.5" /> Active
                  </div>
                )}
                <button
                  onClick={() => setEditing({ title: selected.title, content: selected.content })}
                  className="px-3 py-1 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
                >
                  Edit
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono">{selected.content || "(empty)"}</pre>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Select a version or create a new draft
          </div>
        )}
      </div>
    </div>
  );
}
