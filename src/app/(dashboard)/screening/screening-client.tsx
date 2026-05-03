"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, ChevronDown, ChevronUp, Pencil, Trash2, Check, X,
  ClipboardList, GripVertical, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Question = { id: string; question: string; fieldKey: string; sortOrder: number };
type Form = {
  id: string;
  title: string;
  isActive: boolean;
  jobPosition: { id: string; title: string };
  questions: Question[];
};

interface Props {
  forms: Form[];
  jobs: { id: string; title: string }[];
  currentUserRole: string;
}

export function ScreeningClient({ forms: initialForms, jobs, currentUserRole }: Props) {
  const router = useRouter();
  const canManage = currentUserRole !== "HR_STAFF";

  const [forms, setForms] = useState<Form[]>(initialForms);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newJobId, setNewJobId] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit form state
  const [editFormId, setEditFormId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingForm, setSavingForm] = useState(false);
  const [deletingFormId, setDeletingFormId] = useState<string | null>(null);

  // Question state
  const [addingQuestionTo, setAddingQuestionTo] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editFieldKey, setEditFieldKey] = useState("");
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);

  async function createForm() {
    if (!newTitle.trim() || !newJobId) { toast.error("กรุณากรอกชื่อฟอร์มและเลือกตำแหน่ง"); return; }
    setCreating(true);
    const res = await fetch("/api/screening-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, jobPositionId: newJobId }),
    });
    setCreating(false);
    if (!res.ok) { toast.error("สร้างฟอร์มไม่สำเร็จ"); return; }
    const form = await res.json();
    setForms((prev) => [form, ...prev]);
    setNewTitle("");
    setNewJobId("");
    setShowCreateForm(false);
    setExpandedId(form.id);
    toast.success("สร้างฟอร์มสำเร็จ");
  }

  async function saveFormTitle(formId: string) {
    if (!editTitle.trim()) return;
    setSavingForm(true);
    const res = await fetch(`/api/screening-forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle }),
    });
    setSavingForm(false);
    if (!res.ok) { toast.error("แก้ไขไม่สำเร็จ"); return; }
    setForms((prev) => prev.map((f) => f.id === formId ? { ...f, title: editTitle } : f));
    setEditFormId(null);
    toast.success("แก้ไขสำเร็จ");
  }

  async function toggleActive(form: Form) {
    const res = await fetch(`/api/screening-forms/${form.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !form.isActive }),
    });
    if (!res.ok) { toast.error("อัพเดตสถานะไม่สำเร็จ"); return; }
    setForms((prev) => prev.map((f) => f.id === form.id ? { ...f, isActive: !f.isActive } : f));
  }

  async function deleteForm(formId: string) {
    if (!confirm("ลบฟอร์มนี้?")) return;
    setDeletingFormId(formId);
    const res = await fetch(`/api/screening-forms/${formId}`, { method: "DELETE" });
    setDeletingFormId(null);
    if (!res.ok) { toast.error("ลบไม่สำเร็จ"); return; }
    setForms((prev) => prev.filter((f) => f.id !== formId));
    toast.success("ลบฟอร์มสำเร็จ");
    router.refresh();
  }

  function autoFieldKey(text: string) {
    return text.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 40);
  }

  async function addQuestion(formId: string) {
    if (!newQuestion.trim()) { toast.error("กรุณากรอกคำถาม"); return; }
    const fieldKey = newFieldKey.trim() || autoFieldKey(newQuestion);
    const form = forms.find((f) => f.id === formId);
    const sortOrder = form ? form.questions.length : 0;
    setSavingQuestion(true);
    const res = await fetch(`/api/screening-forms/${formId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: newQuestion, fieldKey, sortOrder }),
    });
    setSavingQuestion(false);
    if (!res.ok) { toast.error("เพิ่มคำถามไม่สำเร็จ"); return; }
    const q = await res.json();
    setForms((prev) =>
      prev.map((f) => f.id === formId ? { ...f, questions: [...f.questions, q] } : f)
    );
    setNewQuestion("");
    setNewFieldKey("");
    setAddingQuestionTo(null);
    toast.success("เพิ่มคำถามสำเร็จ");
  }

  async function saveQuestion(formId: string, qId: string) {
    if (!editQuestionText.trim()) return;
    const res = await fetch(`/api/screening-forms/${formId}/questions/${qId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: editQuestionText, fieldKey: editFieldKey }),
    });
    if (!res.ok) { toast.error("แก้ไขคำถามไม่สำเร็จ"); return; }
    setForms((prev) =>
      prev.map((f) =>
        f.id === formId
          ? { ...f, questions: f.questions.map((q) => q.id === qId ? { ...q, question: editQuestionText, fieldKey: editFieldKey } : q) }
          : f
      )
    );
    setEditQuestionId(null);
    toast.success("แก้ไขคำถามสำเร็จ");
  }

  async function deleteQuestion(formId: string, qId: string) {
    setDeletingQuestionId(qId);
    const res = await fetch(`/api/screening-forms/${formId}/questions/${qId}`, { method: "DELETE" });
    setDeletingQuestionId(null);
    if (!res.ok) { toast.error("ลบคำถามไม่สำเร็จ"); return; }
    setForms((prev) =>
      prev.map((f) =>
        f.id === formId ? { ...f, questions: f.questions.filter((q) => q.id !== qId) } : f
      )
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Screening Forms</h1>
          <p className="mt-1 text-sm text-slate-500">จัดการแบบฟอร์มคัดกรองผู้สมัครสำหรับแต่ละตำแหน่งงาน</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setShowCreateForm((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-1.5 h-4 w-4" /> สร้างฟอร์ม
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">ชื่อฟอร์ม</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="เช่น Screening Telesales Q1/2026"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ตำแหน่งงาน</Label>
                <select
                  value={newJobId}
                  onChange={(e) => setNewJobId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- เลือกตำแหน่ง --</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={createForm} disabled={creating} className="bg-blue-600 hover:bg-blue-700">
                {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                สร้าง
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>ยกเลิก</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forms List */}
      {forms.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">ยังไม่มี Screening Form</p>
            <p className="text-sm text-slate-400 mt-1">สร้างฟอร์มแรกสำหรับตำแหน่งที่เปิดรับ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => {
            const isExpanded = expandedId === form.id;
            return (
              <Card key={form.id} className="border-slate-200">
                <CardHeader className="pb-0 pt-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : form.id)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {editFormId === form.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <button onClick={() => saveFormTitle(form.id)} disabled={savingForm} className="text-green-600 hover:text-green-700 disabled:opacity-50">
                          {savingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setEditFormId(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <CardTitle className="flex-1 text-base font-semibold text-slate-800">
                        {form.title}
                      </CardTitle>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs text-slate-500">
                        {form.jobPosition.title}
                      </Badge>
                      <Badge className={`text-xs ${form.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {form.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-xs text-slate-400">{form.questions.length} คำถาม</span>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditFormId(form.id); setEditTitle(form.title); }}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => toggleActive(form)}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 text-xs"
                            title={form.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          >
                            {form.isActive ? "OFF" : "ON"}
                          </button>
                          {currentUserRole === "SUPER_ADMIN" && (
                            <button
                              onClick={() => deleteForm(form.id)}
                              disabled={deletingFormId === form.id}
                              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
                            >
                              {deletingFormId === form.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-4 space-y-2">
                    {/* Question list */}
                    {form.questions.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2 text-center">ยังไม่มีคำถาม</p>
                    ) : (
                      <div className="space-y-1.5">
                        {form.questions.map((q, idx) => (
                          <div key={q.id} className="flex items-start gap-2 group rounded-md border border-slate-100 px-3 py-2 bg-white hover:border-slate-200">
                            <GripVertical className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
                            <span className="text-xs text-slate-400 mt-0.5 shrink-0 w-5">{idx + 1}.</span>

                            {editQuestionId === q.id ? (
                              <div className="flex flex-1 flex-col gap-1.5">
                                <Input
                                  value={editQuestionText}
                                  onChange={(e) => setEditQuestionText(e.target.value)}
                                  className="h-7 text-sm"
                                  autoFocus
                                />
                                <Input
                                  value={editFieldKey}
                                  onChange={(e) => setEditFieldKey(e.target.value)}
                                  className="h-6 text-xs font-mono text-slate-500"
                                  placeholder="field_key"
                                />
                                <div className="flex gap-1.5">
                                  <button onClick={() => saveQuestion(form.id, q.id)} className="text-green-600 hover:text-green-700">
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => setEditQuestionId(null)} className="text-slate-400 hover:text-slate-600">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700">{q.question}</p>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">{q.fieldKey}</p>
                              </div>
                            )}

                            {canManage && editQuestionId !== q.id && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                                <button
                                  onClick={() => { setEditQuestionId(q.id); setEditQuestionText(q.question); setEditFieldKey(q.fieldKey); }}
                                  className="p-1 rounded text-slate-400 hover:text-blue-600"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteQuestion(form.id, q.id)}
                                  disabled={deletingQuestionId === q.id}
                                  className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-40"
                                >
                                  {deletingQuestionId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add question */}
                    {canManage && (
                      addingQuestionTo === form.id ? (
                        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 space-y-2 mt-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">คำถาม</Label>
                            <Input
                              value={newQuestion}
                              onChange={(e) => { setNewQuestion(e.target.value); if (!newFieldKey) setNewFieldKey(autoFieldKey(e.target.value)); }}
                              placeholder="เช่น มีประสบการณ์ขายตรงมาก่อนไหม?"
                              className="text-sm"
                              autoFocus
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Field Key (auto-generated)</Label>
                            <Input
                              value={newFieldKey}
                              onChange={(e) => setNewFieldKey(e.target.value)}
                              placeholder="experience_sales"
                              className="text-sm font-mono"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => addQuestion(form.id)} disabled={savingQuestion} className="bg-blue-600 hover:bg-blue-700">
                              {savingQuestion ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                              เพิ่ม
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setAddingQuestionTo(null); setNewQuestion(""); setNewFieldKey(""); }}>
                              ยกเลิก
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingQuestionTo(form.id)}
                          className="mt-1 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium py-1"
                        >
                          <Plus className="h-3.5 w-3.5" /> เพิ่มคำถาม
                        </button>
                      )
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
