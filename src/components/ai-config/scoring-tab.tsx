"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, AlertCircle } from "lucide-react";

interface Category {
  id?: string;
  name: string;
  weight: number;
  description: string;
  sortOrder: number;
}

interface ScoringConfig {
  id?: string;
  name: string;
  isActive: boolean;
  categories: Category[];
}

const DEFAULT_CATEGORIES: Category[] = [
  { name: "Experience", weight: 20, description: "ประสบการณ์การทำงาน", sortOrder: 0 },
  { name: "Communication", weight: 20, description: "ทักษะการสื่อสาร", sortOrder: 1 },
  { name: "Availability", weight: 15, description: "ความพร้อมเริ่มงาน", sortOrder: 2 },
  { name: "Salary Fit", weight: 15, description: "ความเหมาะสมของเงินเดือน", sortOrder: 3 },
  { name: "Role Fit", weight: 20, description: "ความเหมาะสมกับตำแหน่ง", sortOrder: 4 },
  { name: "Attitude", weight: 10, description: "ทัศนคติ", sortOrder: 5 },
];

export function ScoringTab() {
  const [config, setConfig] = useState<ScoringConfig>({ name: "Default Scoring", isActive: true, categories: DEFAULT_CATEGORIES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/ai/scoring")
      .then((r) => r.json())
      .then((data) => {
        if (data) setConfig(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalWeight = config.categories.reduce((s, c) => s + (c.weight || 0), 0);

  function updateWeight(idx: number, value: number) {
    setConfig((c) => ({
      ...c,
      categories: c.categories.map((cat, i) => i === idx ? { ...cat, weight: value } : cat),
    }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings/ai/scoring", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      const data = await res.json();
      setConfig(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-semibold text-slate-800">AI Scoring Configuration</h2>
        <p className="text-sm text-slate-500">กำหนดน้ำหนักการให้คะแนน candidate (ผลรวมต้องเท่ากับ 100)</p>
      </div>

      {totalWeight !== 100 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Total weight = {totalWeight} (should be 100)
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
        {config.categories.map((cat, idx) => (
          <div key={idx} className="p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="font-medium text-slate-800 text-sm">{cat.name}</div>
              <div className="text-xs text-slate-400">{cat.description}</div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={50}
                value={cat.weight}
                onChange={(e) => updateWeight(idx, parseInt(e.target.value))}
                className="w-32"
              />
              <div className="flex items-center border border-slate-200 rounded-md overflow-hidden">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={cat.weight}
                  onChange={(e) => updateWeight(idx, parseInt(e.target.value) || 0)}
                  className="w-14 text-center py-1 text-sm focus:outline-none"
                />
                <span className="px-2 bg-slate-50 text-slate-500 text-sm border-l border-slate-200">%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Visual weight bar */}
      <div className="h-4 rounded-full overflow-hidden flex">
        {config.categories.map((cat, idx) => {
          const colors = ["bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-teal-500"];
          return (
            <div
              key={idx}
              style={{ width: `${cat.weight}%` }}
              className={`${colors[idx % colors.length]} transition-all`}
              title={`${cat.name}: ${cat.weight}%`}
            />
          );
        })}
        {totalWeight < 100 && <div style={{ width: `${100 - totalWeight}%` }} className="bg-slate-200" />}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
        {config.categories.map((cat, idx) => {
          const colors = ["text-blue-600", "text-green-600", "text-amber-600", "text-purple-600", "text-rose-600", "text-teal-600"];
          return (
            <span key={idx} className={`flex items-center gap-1 ${colors[idx % colors.length]}`}>
              <span className="h-2 w-2 rounded-full bg-current" />{cat.name} {cat.weight}%
            </span>
          );
        })}
      </div>

      <button
        onClick={save}
        disabled={saving || totalWeight !== 100}
        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saved ? "Saved!" : "Save Scoring"}
      </button>
    </div>
  );
}
