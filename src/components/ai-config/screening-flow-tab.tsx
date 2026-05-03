"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, X, Trash2, GripVertical } from "lucide-react";

interface FlowQuestion {
  id?: string;
  question: string;
  fieldKey: string;
  required: boolean;
  sortOrder: number;
}

interface ScreeningFlow {
  id?: string;
  name: string;
  isActive: boolean;
  greeting: string;
  closing: string;
  questions: FlowQuestion[];
}

export function ScreeningFlowTab() {
  const [flows, setFlows] = useState<ScreeningFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ScreeningFlow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/ai/screening-flow");
    if (res.ok) setFlows(await res.json());
    setLoading(false);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    await fetch("/api/settings/ai/screening-flow", {
      method: editing.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    await load();
    setSaving(false);
  }

  function addQuestion() {
    setEditing((e) => e ? ({
      ...e,
      questions: [...e.questions, { question: "", fieldKey: "", required: false, sortOrder: e.questions.length }],
    }) : e);
  }

  function updateQuestion(idx: number, key: keyof FlowQuestion, value: string | boolean) {
    setEditing((e) => e ? ({
      ...e,
      questions: e.questions.map((q, i) => i === idx ? { ...q, [key]: value } : q),
    }) : e);
  }

  function removeQuestion(idx: number) {
    setEditing((e) => e ? ({ ...e, questions: e.questions.filter((_, i) => i !== idx) }) : e);
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Screening Flow</h2>
          <p className="text-sm text-slate-500">กำหนดลำดับคำถาม Screening ที่ Bot จะถาม</p>
        </div>
        <button
          onClick={() => setEditing({ name: "", isActive: false, greeting: "", closing: "", questions: [] })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Flow
        </button>
      </div>

      <div className="space-y-3">
        {flows.map((flow) => (
          <div key={flow.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${flow.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                <span className="font-medium text-slate-800">{flow.name}</span>
                <span className="text-xs text-slate-400">{flow.questions.length} questions</span>
              </div>
              <button
                onClick={() => setEditing({ ...flow })}
                className="px-3 py-1 border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
        {flows.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            No screening flows yet
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-5 mx-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">{editing.id ? "Edit Flow" : "New Flow"}</h3>
              <button onClick={() => setEditing(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Flow Name *</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing((ed) => ed ? { ...ed, name: e.target.value } : ed)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                  placeholder="เช่น Standard Screening"
                />
              </div>
              <div className="flex items-end gap-2">
                <input type="checkbox" id="isActive" checked={editing.isActive} onChange={(e) => setEditing((ed) => ed ? { ...ed, isActive: e.target.checked } : ed)} />
                <label htmlFor="isActive" className="text-sm text-slate-700">Set as active flow</label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(["greeting", "closing"] as const).map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">{key === "greeting" ? "Greeting Message" : "Closing Message"}</label>
                  <textarea
                    value={editing[key] ?? ""}
                    onChange={(e) => setEditing((ed) => ed ? { ...ed, [key]: e.target.value } : ed)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Questions</label>
                <button onClick={addQuestion} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                  <Plus className="h-3.5 w-3.5" /> Add Question
                </button>
              </div>
              <div className="space-y-2">
                {editing.questions.map((q, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                    <GripVertical className="h-4 w-4 text-slate-300 mt-2 shrink-0" />
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        value={q.question}
                        onChange={(e) => updateQuestion(idx, "question", e.target.value)}
                        className="col-span-2 border border-slate-200 rounded px-2 py-1.5 text-sm"
                        placeholder="Question text..."
                      />
                      <input
                        value={q.fieldKey}
                        onChange={(e) => updateQuestion(idx, "fieldKey", e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1.5 text-sm font-mono"
                        placeholder="field_key"
                      />
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`req-${idx}`} checked={q.required} onChange={(e) => updateQuestion(idx, "required", e.target.checked)} />
                        <label htmlFor={`req-${idx}`} className="text-xs text-slate-600">Required</label>
                      </div>
                    </div>
                    <button onClick={() => removeQuestion(idx)} className="p-1 text-slate-400 hover:text-red-500 mt-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {editing.questions.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-3">No questions yet</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancel</button>
              <button onClick={save} disabled={saving || !editing.name} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Flow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
