"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

type TagWithCount = {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  _count: { candidates: number };
};

const PRESET_COLORS = [
  "#10b981", "#6366f1", "#3b82f6", "#f59e0b", "#22c55e",
  "#f97316", "#8b5cf6", "#06b6d4", "#ef4444", "#dc2626",
  "#ec4899", "#14b8a6", "#84cc16", "#a855f7", "#64748b",
];

interface Props {
  tags: TagWithCount[];
}

export function TagsClient({ tags: initialTags }: Props) {
  const [tags, setTags] = useState<TagWithCount[]>(initialTags);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function createTag() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error === "Tag name already exists" ? "ชื่อ tag ซ้ำ" : "สร้าง tag ไม่สำเร็จ");
      return;
    }
    const tag = await res.json();
    setTags((prev) => [...prev, { ...tag, _count: { candidates: 0 } }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
    toast.success("สร้าง tag สำเร็จ");
  }

  function startEdit(tag: TagWithCount) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  }

  async function saveEdit(tagId: string) {
    if (!editName.trim()) return;
    setSavingEdit(true);
    const res = await fetch(`/api/tags/${tagId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    });
    setSavingEdit(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error === "Tag name already exists" ? "ชื่อ tag ซ้ำ" : "แก้ไข tag ไม่สำเร็จ");
      return;
    }
    const updated = await res.json();
    setTags((prev) =>
      prev.map((t) => (t.id === tagId ? { ...t, ...updated } : t)).sort((a, b) => a.name.localeCompare(b.name))
    );
    cancelEdit();
    toast.success("แก้ไข tag สำเร็จ");
  }

  async function deleteTag(tagId: string, name: string) {
    setDeletingId(tagId);
    const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) { toast.error("ลบ tag ไม่สำเร็จ"); return; }
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    toast.success(`ลบ tag "${name}" สำเร็จ`);
  }

  return (
    <div className="space-y-6">
      {/* Create */}
      <Card className="border-slate-200">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-slate-700">สร้าง Tag ใหม่</p>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">ชื่อ</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ชื่อ tag..."
                  className="h-9 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && createTag()}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">สี</Label>
                <div className="flex flex-wrap gap-1.5 max-w-xs">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`h-6 w-6 rounded-full transition-transform ${newColor === c ? "ring-2 ring-offset-1 ring-slate-400 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <Button
                onClick={createTag}
                disabled={creating || !newName.trim()}
                className="h-9 bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                สร้าง
              </Button>
            </div>
            {newName && (
              <div>
                <span
                  className="rounded-full px-3 py-0.5 text-sm font-medium text-white"
                  style={{ backgroundColor: newColor }}
                >
                  {newName}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tags List */}
      <Card className="border-slate-200">
        <CardContent className="pt-4 divide-y divide-slate-100">
          {tags.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">ยังไม่มี tag</p>
          )}
          {tags.map((tag) => (
            <div key={tag.id} className="py-3 flex items-center gap-3">
              {editingId === tag.id ? (
                <>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`h-5 w-5 rounded-full transition-transform ${editColor === c ? "ring-2 ring-offset-1 ring-slate-400 scale-110" : "hover:scale-105"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(tag.id); if (e.key === "Escape") cancelEdit(); }}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => saveEdit(tag.id)}
                    disabled={savingEdit || !editName.trim()}
                    className="h-8 w-8 text-green-600 hover:text-green-700"
                  >
                    {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={cancelEdit}
                    className="h-8 w-8 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className="rounded-full px-3 py-0.5 text-sm font-medium text-white shrink-0"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                  <span className="text-xs text-slate-400 flex-1">
                    {tag._count.candidates} candidates
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(tag)}
                    className="h-8 w-8 text-slate-400 hover:text-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteTag(tag.id, tag.name)}
                    disabled={deletingId === tag.id}
                    className="h-8 w-8 text-slate-300 hover:text-red-500"
                  >
                    {deletingId === tag.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
