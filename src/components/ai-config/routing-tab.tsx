"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, X, Trash2 } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  displayName: string;
}

interface RoutingRule {
  id: string;
  useCase: string;
  providerId: string | null;
  model: string | null;
  maxTokens: number | null;
  temperature: number | null;
  isActive: boolean;
  provider?: Provider | null;
}

const USE_CASES = ["chat", "screening", "summary", "playground", "fallback"];

export function RoutingTab() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<RoutingRule> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/ai/routing").then((r) => r.json()),
      fetch("/api/settings/ai/providers").then((r) => r.json()),
    ]).then(([rulesData, providersData]) => {
      setRules(rulesData ?? []);
      setProviders(providersData ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    await fetch("/api/settings/ai/routing", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(null);
    const res = await fetch("/api/settings/ai/routing");
    if (res.ok) setRules(await res.json());
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch("/api/settings/ai/routing", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const res = await fetch("/api/settings/ai/routing");
    if (res.ok) setRules(await res.json());
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Model Routing</h2>
          <p className="text-sm text-slate-500">กำหนดว่า Use Case ไหนใช้ AI Model อะไร</p>
        </div>
        <button
          onClick={() => setForm({ useCase: "chat", isActive: true, temperature: 0.7 })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Route
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {["Use Case", "Provider", "Model", "Temp", "Max Tokens", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <tr key={rule.id} className={rule.isActive ? "" : "opacity-50"}>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{rule.useCase}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{rule.provider?.displayName ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{rule.model ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{rule.temperature ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{rule.maxTokens ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs ${rule.isActive ? "text-green-600" : "text-slate-400"}`}>
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => remove(rule.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">No routing rules configured</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Add Routing Rule</h3>
              <button onClick={() => setForm(null)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Use Case</label>
                <select value={form.useCase ?? "chat"} onChange={(e) => setForm((f) => ({ ...f, useCase: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm">
                  {USE_CASES.map((uc) => <option key={uc} value={uc}>{uc}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Provider</label>
                <select value={form.providerId ?? ""} onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value || null }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm">
                  <option value="">Select provider</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Model</label>
                <input value={form.model ?? ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm font-mono" placeholder="e.g. claude-haiku-4-5-20251001" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Temperature</label>
                <input type="number" min={0} max={2} step={0.1} value={form.temperature ?? 0.7} onChange={(e) => setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-sm font-medium text-slate-700">Max Tokens</label>
                <input type="number" value={form.maxTokens ?? ""} onChange={(e) => setForm((f) => ({ ...f, maxTokens: parseInt(e.target.value) || null }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" placeholder="e.g. 1024" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="routeActive" checked={form.isActive ?? true} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              <label htmlFor="routeActive" className="text-sm text-slate-700">Active</label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
