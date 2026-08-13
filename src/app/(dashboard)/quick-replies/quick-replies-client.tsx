"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { TEMPLATE_PLACEHOLDERS, VISIBLE_CHIP_COUNT } from "@/lib/quick-reply-template";

type QuickReply = {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
};

interface Props {
  quickReplies: QuickReply[];
}

function PlaceholderHint() {
  return (
    <p className="text-xs text-slate-400">
      ใส่ตัวแปรได้: {TEMPLATE_PLACEHOLDERS.join(" · ")} — ถ้าไม่มีข้อมูลจะเว้นว่างให้อัตโนมัติ
    </p>
  );
}

export function QuickRepliesClient({ quickReplies: initial }: Props) {
  const [items, setItems] = useState<QuickReply[]>(initial);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  async function createItem() {
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    const res = await fetch("/api/quick-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
    });
    setCreating(false);
    if (!res.ok) {
      toast.error("สร้างข้อความไม่สำเร็จ");
      return;
    }
    const created: QuickReply = await res.json();
    setItems((prev) => [...prev, created]);
    setNewTitle("");
    setNewContent("");
    toast.success("สร้างข้อความสำเร็จ");
  }

  function startEdit(item: QuickReply) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim() || !editContent.trim()) return;
    setSavingEdit(true);
    const res = await fetch(`/api/quick-replies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
    });
    setSavingEdit(false);
    if (!res.ok) {
      toast.error("แก้ไขข้อความไม่สำเร็จ");
      return;
    }
    const updated: QuickReply = await res.json();
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    cancelEdit();
    toast.success("แก้ไขข้อความสำเร็จ");
  }

  async function deleteItem(id: string, title: string) {
    if (!confirm(`ลบข้อความ "${title}" ?`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/quick-replies/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (!res.ok) {
      toast.error("ลบข้อความไม่สำเร็จ");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success(`ลบข้อความ "${title}" สำเร็จ`);
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next); // optimistic — the arrows should feel instant

    setReordering(true);
    const res = await fetch("/api/quick-replies/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((i) => i.id) }),
    });
    setReordering(false);

    if (!res.ok) {
      setItems(items); // roll back to the order we started from
      toast.error("จัดลำดับไม่สำเร็จ");
      return;
    }
    const data = await res.json();
    setItems(data.quickReplies);
  }

  return (
    <div className="space-y-6">
      {/* Create */}
      <Card className="border-slate-200">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-slate-700">สร้างข้อความใหม่</p>
            <div className="space-y-1.5">
              <Label className="text-xs">ชื่อปุ่ม</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="เช่น ทักทาย, นัดสัมภาษณ์"
                maxLength={50}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ข้อความ</Label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="ข้อความที่จะใส่ในช่องพิมพ์..."
                maxLength={1000}
                rows={3}
                className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <PlaceholderHint />
            </div>
            <div>
              <Button
                onClick={createItem}
                disabled={creating || !newTitle.trim() || !newContent.trim()}
                className="h-9 bg-blue-600 hover:bg-blue-700"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
                สร้าง
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="border-slate-200">
        <CardContent className="pt-4">
          {items.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อความสำเร็จรูป</p>
          )}
          {items.map((item, index) => (
            <div key={item.id}>
              <div className="py-3 flex items-start gap-3 border-b border-slate-100">
                {editingId === item.id ? (
                  <div className="flex-1 space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={50}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <PlaceholderHint />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveEdit(item.id)}
                        disabled={savingEdit || !editTitle.trim() || !editContent.trim()}
                        className="h-8 bg-green-600 hover:bg-green-700"
                      >
                        {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                        บันทึก
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 text-slate-500">
                        <X className="h-3.5 w-3.5 mr-1" />
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => move(index, -1)}
                        disabled={index === 0 || reordering}
                        className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => move(index, 1)}
                        disabled={index === items.length - 1 || reordering}
                        className="text-slate-300 hover:text-slate-600 disabled:opacity-30"
                        title="เลื่อนลง"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{item.title}</p>
                      <p className="text-xs text-slate-400 truncate">{item.content}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(item)}
                      className="h-8 w-8 text-slate-400 hover:text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteItem(item.id, item.title)}
                      disabled={deletingId === item.id}
                      className="h-8 w-8 text-slate-300 hover:text-red-500"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </>
                )}
              </div>

              {/* Without this, nothing on screen explains why the arrows matter. */}
              {index === VISIBLE_CHIP_COUNT - 1 && items.length > VISIBLE_CHIP_COUNT && (
                <p className="py-2 text-center text-xs text-blue-600 bg-blue-50 rounded-lg my-1">
                  ↑ {VISIBLE_CHIP_COUNT} อันนี้แสดงเป็นปุ่มในหน้าแชท
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
