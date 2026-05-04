"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface OpenClawConfig {
  enabled: boolean;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
}

interface ConnectionStatus {
  ok: boolean;
  version?: string;
  error?: string;
}

export default function OpenClawConfigPage() {
  const [config, setConfig] = useState<OpenClawConfig>({
    enabled: true,
    model: "default",
    temperature: 0.7,
    max_tokens: 500,
    system_prompt: "",
  });
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load config
  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/bot-config/openclaw");
      if (!res.ok) throw new Error("Failed to load config");
      const data = await res.json();
      setConfig(data.config);
      setConnection(data.connection);
      setAvailableModels(data.availableModels || []);
    } catch (error) {
      toast.error("ไม่สามารถโหลด config ได้");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch("/api/bot-config/openclaw", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Failed to save config");
      toast.success("บันทึก config สำเร็จ");
    } catch (error) {
      toast.error("บันทึก config ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setLoading(true);
    try {
      const res = await fetch("/api/bot-config/openclaw");
      if (!res.ok) throw new Error("Failed to test connection");
      const data = await res.json();
      setConnection(data.connection);
      if (data.connection.ok) {
        toast.success(`เชื่อมต่อ OpenClaw สำเร็จ (v${data.connection.version})`);
      } else {
        toast.error(`เชื่อมต่อไม่สำเร็จ: ${data.connection.error}`);
      }
    } catch (error) {
      toast.error("ไม่สามารถทดสอบการเชื่อมต่อได้");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !config.system_prompt) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">OpenClaw AI Config</h1>
        <p className="text-slate-500 mt-1">
          ตั้งค่า OpenClaw เป็น AI หลักสำหรับ Daniel HR Bot
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            สถานะการเชื่อมต่อ
            {connection?.ok ? (
              <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                เชื่อมต่อแล้ว
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                ไม่ได้เชื่อมต่อ
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600">
              {connection?.ok ? (
                <span>เวอร์ชัน: {connection.version || "ไม่ระบุ"}</span>
              ) : (
                <span className="text-red-600">{connection?.error || "ไม่สามารถเชื่อมต่อได้"}</span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={testConnection} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              ทดสอบอีกครั้ง
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ตั้งค่า OpenClaw</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">เปิดใช้งาน OpenClaw</Label>
              <p className="text-sm text-slate-500">
                ปิดถ้าต้องการใช้ Kimi/Qwen เป็น AI หลักแทน
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label>โมเดล</Label>
            <div className="flex gap-2">
              <Input
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                placeholder="default"
                className="flex-1"
              />
              {availableModels.length > 0 && (
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="border rounded-md px-3 py-2 text-sm"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs text-slate-500">
              ใช้ "default" ถ้าต้องการให้ OpenClaw เลือกโมเดลอัตโนมัติ
            </p>
          </div>

          {/* Temperature */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Temperature</Label>
              <span className="text-sm font-medium">{config.temperature}</span>
            </div>
            <Slider
              value={[config.temperature]}
              onValueChange={([v]) => setConfig({ ...config, temperature: v })}
              min={0}
              max={2}
              step={0.1}
            />
            <p className="text-xs text-slate-500">
              ค่าต่ำ = ตอบแบบเดียวกันเสมอ | ค่าสูง = สร้างสรรค์มากขึ้น
            </p>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <Label>Max Tokens</Label>
            <Input
              type="number"
              value={config.max_tokens}
              onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) || 500 })}
              min={100}
              max={4000}
            />
            <p className="text-xs text-slate-500">
              จำนวน token สูงสุดที่ตอบกลับ (1 token ≈ 4 ตัวอักษรภาษาไทย)
            </p>
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <Label>System Prompt (Optional)</Label>
            <Textarea
              value={config.system_prompt}
              onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
              placeholder="ใส่ system prompt เฉพาะที่ต้องการ override ค่าเริ่มต้น..."
              rows={6}
            />
            <p className="text-xs text-slate-500">
              ถ้าเว้นว่าง จะใช้ prompt จากหน้า Bot Config (/bot-config) แทน
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={saveConfig} disabled={saving} className="min-w-[120px]">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                "บันทึกการตั้งค่า"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h4 className="font-medium text-blue-900 mb-2">วิธีการทำงาน</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>OpenClaw จะเป็น AI หลักที่ตอบผู้สมัครผ่าน LINE</li>
            <li>ถ้า OpenClaw ไม่ตอบ ระบบจะ fallback ไปใช้ Kimi/Qwen อัตโนมัติ</li>
            <li>System prompt จากหน้า Bot Config จะถูกส่งไป OpenClaw ทุกครั้ง</li>
            <li>การตั้งค่านี้มีผลทันทีหลังบันทึก (ไม่ต้อง restart server)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
