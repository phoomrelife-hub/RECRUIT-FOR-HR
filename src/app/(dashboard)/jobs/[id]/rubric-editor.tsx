"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Criterion { name: string; weight: number; description: string }

export function RubricEditor({ jobId }: { jobId: string }) {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [isDraft, setIsDraft] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/rubric`)
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg) {
          setCriteria(cfg.categories.map((c: Criterion) => ({
            name: c.name, weight: c.weight, description: c.description ?? "",
          })));
          setIsDraft(cfg.isDraft);
        }
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  async function draft() {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/rubric`, { method: "POST" });
      const cfg = await res.json();
      if (!res.ok) { toast.error(cfg.error ?? "ร่างเกณฑ์ไม่สำเร็จ"); return; }
      setCriteria(cfg.categories.map((c: Criterion) => ({
        name: c.name, weight: c.weight, description: c.description ?? "",
      })));
      setIsDraft(true);
      toast.success("ร่างเกณฑ์แล้ว — ตรวจสอบและกดอนุมัติ");
    } finally { setBusy(false); }
  }

  async function approve() {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/rubric`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria }),
      });
      const cfg = await res.json();
      if (!res.ok) { toast.error(cfg.error ?? "บันทึกไม่สำเร็จ"); return; }
      setCriteria(cfg.categories.map((c: Criterion) => ({
        name: c.name, weight: c.weight, description: c.description ?? "",
      })));
      setIsDraft(false);
      toast.success("อนุมัติเกณฑ์แล้ว");
    } finally { setBusy(false); }
  }

  const update = (i: number, patch: Partial<Criterion>) =>
    setCriteria((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const total = criteria.reduce((s, c) => s + c.weight, 0);

  if (loading) return <div className="p-5 text-sm text-slate-400">กำลังโหลดเกณฑ์…</div>;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">เกณฑ์การให้คะแนน (AI)</h3>
          {isDraft && criteria.length > 0 && (
            <p className="text-xs text-amber-600">
              ยังเป็นฉบับร่าง — AI จะยังไม่ใช้เกณฑ์นี้จนกว่าจะกดอนุมัติ
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={draft} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
          ให้ AI ร่างให้
        </Button>
      </div>

      {criteria.length === 0 && (
        <p className="text-sm text-slate-500">
          ยังไม่มีเกณฑ์เฉพาะตำแหน่งนี้ — ระบบจะใช้เกณฑ์กลางของบริษัทไปก่อน
        </p>
      )}

      <div className="space-y-3">
        {criteria.map((c, i) => (
          <div key={i} className="flex gap-2">
            <Input
              className="flex-1"
              value={c.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="ชื่อเกณฑ์"
            />
            <Input
              className="w-20"
              type="number"
              value={c.weight}
              onChange={(e) => update(i, { weight: Number(e.target.value) })}
            />
            <Input
              className="flex-[2]"
              value={c.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="ดูอะไรบ้าง"
            />
            <Button
              variant="ghost" size="sm"
              onClick={() => setCriteria((p) => p.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {criteria.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className={`text-xs ${total === 100 ? "text-slate-500" : "text-amber-600"}`}>
            น้ำหนักรวม {total} {total !== 100 && "(ระบบจะปรับให้เป็น 100 ตอนบันทึก)"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setCriteria((p) => [...p, { name: "", weight: 0, description: "" }])}
            >
              เพิ่มเกณฑ์
            </Button>
            <Button size="sm" onClick={approve} disabled={busy}>บันทึกและอนุมัติ</Button>
          </div>
        </div>
      )}
    </div>
  );
}
