"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Loader2, X, Trash2, Tag, Lightbulb } from "lucide-react";

interface TaggingRule {
  id: string;
  name: string;
  condition: string;
  tagId: string | null;
  tagName: string | null;
  isActive: boolean;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

function parseKeywords(condition: string): string[] {
  try {
    const parsed = JSON.parse(condition);
    if (Array.isArray(parsed.keywords)) return parsed.keywords;
    // legacy format fallback
    if (parsed.value) return [parsed.value];
  } catch {}
  return [];
}

function TagChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      <Tag className="h-3 w-3" />
      {name}
    </span>
  );
}

export function TaggingRulesTab() {
  const [rules, setRules] = useState<TaggingRule[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState<TaggingRule | null>(null);
  const [selectedTagId, setSelectedTagId] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [rulesData, tagsData] = await Promise.all([
      fetch("/api/settings/ai/tagging-rules").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ]);
    setRules(rulesData ?? []);
    setTags(tagsData ?? []);
    setLoading(false);
  }

  function openAdd() {
    setEditRule(null);
    setSelectedTagId("");
    setKeywords([]);
    setKeywordInput("");
    setShowForm(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function openEdit(rule: TaggingRule) {
    setEditRule(rule);
    setSelectedTagId(rule.tagId ?? "");
    setKeywords(parseKeywords(rule.condition));
    setKeywordInput("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditRule(null);
  }

  function addKeyword(raw: string) {
    const words = raw
      .split(/[,،\n]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0 && !keywords.includes(w));
    if (words.length > 0) setKeywords((prev) => [...prev, ...words]);
    setKeywordInput("");
  }

  function handleKeywordKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(keywordInput);
    } else if (e.key === "Backspace" && keywordInput === "" && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  }

  async function save() {
    if (!selectedTagId || keywords.length === 0) return;
    setSaving(true);
    const tag = tags.find((t) => t.id === selectedTagId);
    const body = {
      ...(editRule ? { id: editRule.id } : {}),
      name: tag?.name ?? "กฎติดแท็ก",
      condition: JSON.stringify({ keywords }),
      tagId: selectedTagId,
      tagName: tag?.name ?? null,
      isActive: editRule ? editRule.isActive : true,
    };
    await fetch("/api/settings/ai/tagging-rules", {
      method: editRule ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    closeForm();
    await load();
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch("/api/settings/ai/tagging-rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  async function toggle(rule: TaggingRule) {
    await fetch("/api/settings/ai/tagging-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rule, isActive: !rule.isActive }),
    });
    await load();
  }

  const selectedTag = tags.find((t) => t.id === selectedTagId);

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Auto Tagging</h2>
          <p className="text-sm text-slate-500">ระบบจะติดแท็กให้อัตโนมัติเมื่อผู้สมัครพูดถึงคำที่กำหนด</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> เพิ่มกฎ
        </button>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3.5">
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          เมื่อบอทคุยกับผู้สมัคร ถ้าพบคำที่กำหนดไว้ — ระบบจะติดแท็กนั้นให้ผู้สมัครโดยอัตโนมัติ เช่น ถ้าพูดถึง "WFH" หรือ "ทำงานที่บ้าน" → ติดแท็ก <b>WFH</b>
        </p>
      </div>

      {/* Rules list */}
      <div className="space-y-2">
        {rules.map((rule) => {
          const kws = parseKeywords(rule.condition);
          const tag = tags.find((t) => t.id === rule.tagId);
          return (
            <div
              key={rule.id}
              onClick={() => openEdit(rule)}
              className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:border-blue-200 hover:shadow-sm ${
                rule.isActive ? "border-slate-200" : "border-slate-100 opacity-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Tag badge */}
                  {tag ? (
                    <TagChip name={tag.name} color={tag.color} />
                  ) : (
                    <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                      {rule.tagName ?? "ไม่พบแท็ก"}
                    </span>
                  )}

                  {/* Arrow */}
                  <span className="text-slate-300 text-sm shrink-0">←</span>

                  {/* Keywords */}
                  <div className="flex flex-wrap gap-1.5 min-w-0">
                    {kws.slice(0, 5).map((kw) => (
                      <span key={kw} className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-md">
                        {kw}
                      </span>
                    ))}
                    {kws.length > 5 && (
                      <span className="text-xs text-slate-400">+{kws.length - 5} คำ</span>
                    )}
                    {kws.length === 0 && (
                      <span className="text-xs text-slate-300 italic">ยังไม่มีคำ</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Toggle */}
                  <button
                    onClick={() => toggle(rule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      rule.isActive ? "bg-blue-600" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        rule.isActive ? "translate-x-4.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => remove(rule.id)}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {rules.length === 0 && (
          <div className="text-center py-14 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
            <Tag className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-500">ยังไม่มีกฎ Auto Tagging</p>
            <p className="text-xs mt-1">กด "เพิ่มกฎ" เพื่อให้ระบบติดแท็กอัตโนมัติ</p>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {editRule ? "แก้ไขกฎ" : "เพิ่มกฎ Auto Tagging"}
              </h3>
              <button onClick={closeForm}>
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            {/* Tag selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                ติดแท็กไหน?
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTagId(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      selectedTagId === t.id
                        ? "border-transparent text-white scale-105 shadow-md"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                    style={selectedTagId === t.id ? { backgroundColor: t.color, borderColor: t.color } : {}}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </button>
                ))}
              </div>
              {tags.length === 0 && (
                <p className="text-xs text-slate-400">ยังไม่มีแท็ก — ไปสร้างที่เมนู "จัดการแท็ก" ก่อน</p>
              )}
            </div>

            {/* Keywords input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                คำที่ระบบจะมองหา
              </label>
              <p className="text-xs text-slate-400">พิมพ์คำ แล้วกด Enter หรือ , เพื่อเพิ่ม</p>

              <div
                className="min-h-[80px] border border-slate-200 rounded-xl px-3 py-2.5 flex flex-wrap gap-1.5 cursor-text focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-all"
                onClick={() => inputRef.current?.focus()}
              >
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="flex items-center gap-1 bg-blue-50 text-blue-700 text-sm px-2.5 py-0.5 rounded-lg"
                  >
                    {kw}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setKeywords((prev) => prev.filter((k) => k !== kw));
                      }}
                      className="text-blue-400 hover:text-blue-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  onBlur={() => { if (keywordInput.trim()) addKeyword(keywordInput); }}
                  placeholder={keywords.length === 0 ? "เช่น WFH, ทำงานที่บ้าน, remote..." : ""}
                  className="flex-1 min-w-[120px] outline-none text-sm bg-transparent placeholder:text-slate-300"
                />
              </div>
            </div>

            {/* Preview */}
            {selectedTagId && keywords.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3.5 text-sm text-slate-600">
                <span className="text-slate-400 text-xs block mb-1.5">ตัวอย่าง</span>
                ถ้าผู้สมัครพูดถึง{" "}
                <b className="text-slate-800">"{keywords.slice(0, 2).join('", "')}{keywords.length > 2 ? `" หรืออีก ${keywords.length - 2} คำ` : '"'}</b>
                {" → "}ติดแท็ก{" "}
                {selectedTag && <TagChip name={selectedTag.name} color={selectedTag.color} />}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={closeForm}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={save}
                disabled={saving || !selectedTagId || keywords.length === 0}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
