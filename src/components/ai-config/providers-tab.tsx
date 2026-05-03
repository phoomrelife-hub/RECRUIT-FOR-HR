"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, CheckCircle, XCircle, TestTube, Trash2 } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  displayName: string;
  apiKey: string | null;
  baseUrl: string | null;
  isActive: boolean;
  defaultModel: string | null;
}

const PRESET_PROVIDERS = [
  { name: "anthropic", displayName: "Anthropic (Claude)", defaultModel: "claude-haiku-4-5-20251001" },
  { name: "openai", displayName: "OpenAI (GPT)", defaultModel: "gpt-4o-mini" },
  { name: "kimi", displayName: "Kimi AI (Moonshot)", defaultModel: "moonshot-v1-8k" },
];

export function ProvidersTab() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; latencyMs: number; message: string }>>({});
  const [form, setForm] = useState<Partial<Provider & { apiKeyInput: string }> | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/ai/providers");
    if (res.ok) setProviders(await res.json());
    setLoading(false);
  }

  async function save() {
    if (!form) return;
    setSaving("save");
    const res = await fetch("/api/settings/ai/providers" + (form.id ? "" : ""), {
      method: form.id ? "POST" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, apiKey: form.apiKeyInput }),
    });
    if (res.ok) { setForm(null); await load(); }
    setSaving(null);
  }

  async function test(id: string) {
    setTesting(id);
    const res = await fetch(`/api/settings/ai/providers/${id}`, { method: "POST" });
    const data = await res.json();
    setTestResult((prev) => ({ ...prev, [id]: data }));
    setTesting(null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this provider?")) return;
    await fetch(`/api/settings/ai/providers/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <div className="animate-pulse h-64 bg-slate-100 rounded-lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">AI Providers</h2>
          <p className="text-sm text-slate-500">Configure API keys for each AI provider</p>
        </div>
        <button
          onClick={() => setForm({})}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Provider
        </button>
      </div>

      {/* Quick-add presets */}
      {providers.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700 mb-3">Quick-add a provider:</p>
          <div className="flex gap-2 flex-wrap">
            {PRESET_PROVIDERS.map((p) => (
              <button
                key={p.name}
                onClick={() => setForm({ name: p.name, displayName: p.displayName, defaultModel: p.defaultModel })}
                className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded text-sm hover:bg-blue-100"
              >
                {p.displayName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Provider cards */}
      <div className="space-y-3">
        {providers.map((p) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${p.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                <div>
                  <div className="font-medium text-slate-800">{p.displayName}</div>
                  <div className="text-xs text-slate-500">{p.name} · {p.defaultModel ?? "no model set"}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {testResult[p.id] && (
                  <span className={`text-xs flex items-center gap-1 ${testResult[p.id].success ? "text-green-600" : "text-red-600"}`}>
                    {testResult[p.id].success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {testResult[p.id].message}
                  </span>
                )}
                <button
                  onClick={() => test(p.id)}
                  disabled={testing === p.id}
                  className="flex items-center gap-1 px-2 py-1 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50"
                >
                  {testing === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <TestTube className="h-3 w-3" />}
                  Test
                </button>
                <button
                  onClick={() => setForm({ ...p })}
                  className="px-2 py-1 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50"
                >
                  Edit
                </button>
                <button onClick={() => remove(p.id)} className="p-1 text-red-400 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              API Key: {p.apiKey ?? "Not set"}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit form */}
      {form !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">{form.id ? "Edit Provider" : "Add Provider"}</h3>
            {!form.id && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Provider Name</label>
                <select
                  value={form.name ?? ""}
                  onChange={(e) => {
                    const preset = PRESET_PROVIDERS.find((p) => p.name === e.target.value);
                    setForm((f) => ({ ...f, name: e.target.value, displayName: preset?.displayName ?? f?.displayName, defaultModel: preset?.defaultModel ?? f?.defaultModel }));
                  }}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select provider</option>
                  {PRESET_PROVIDERS.map((p) => <option key={p.name} value={p.name}>{p.displayName}</option>)}
                </select>
              </div>
            )}
            {[
              { key: "displayName", label: "Display Name" },
              { key: "defaultModel", label: "Default Model" },
              { key: "baseUrl", label: "Base URL (optional)" },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium text-slate-700">{label}</label>
                <input
                  value={(form as Record<string, string>)[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">API Key</label>
              <input
                type="password"
                placeholder={form.apiKey ? "••••••••" : "sk-..."}
                value={form.apiKeyInput ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, apiKeyInput: e.target.value }))}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive ?? false}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              <label htmlFor="isActive" className="text-sm text-slate-700">Set as active provider</label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={save}
                disabled={saving === "save"}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
