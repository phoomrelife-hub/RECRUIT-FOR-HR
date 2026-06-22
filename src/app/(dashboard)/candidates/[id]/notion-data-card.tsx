"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Users,
  TrendingUp,
  Wallet,
  Laptop,
  MessageCircle,
  Link2,
  FileText,
  Tag,
  BookOpen,
  Printer,
} from "lucide-react";

type PropItem = {
  name: string;
  type: "text" | "url" | "tags" | "number" | "files";
  value: string | string[] | number;
};

type NotionDetail = {
  info: {
    name: string;
    phone: string;
    email: string;
    age: number | null;
    children: number | null;
    address: string;
    position: string;
    experience: string;
    maxSales: string;
    expectedSalary: string;
    equipment: string[];
    lineId: string;
  };
  allProps: PropItem[];
  qa: Array<{ question: string; answer: string }>;
};

interface Props {
  candidateId: string;
  positionTitle: string | null;
}

// ── PDF export (browser print-to-PDF — best Thai rendering) ──

function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

function buildPrintHtml(detail: NotionDetail, positionTitle: string | null): string {
  const info = detail.info;
  const isSalesAdmin = (positionTitle ?? "").toLowerCase().includes("sales admin");
  const printedAt = new Date().toLocaleString("th-TH");

  let body = "";

  if (isSalesAdmin) {
    const personal = [
      row("เบอร์โทร", info.phone),
      row("อีเมล", info.email),
      row("อายุ", info.age != null ? `${info.age} ปี` : null),
      row("บุตร", info.children != null ? `${info.children} คน` : null),
      row("ที่อยู่", info.address),
      row("LINE ID", info.lineId),
    ].join("");
    if (personal) body += `<h2>ข้อมูลส่วนตัว</h2><table>${personal}</table>`;

    const sales = [
      row("ประสบการณ์ขาย", info.experience),
      row("ยอดขายสูงสุด/เดือน", info.maxSales),
      row("รายได้ที่คาดหวัง", info.expectedSalary),
      row("อุปกรณ์ที่มี", info.equipment.length ? info.equipment.join(", ") : null),
    ].join("");
    if (sales) body += `<h2>ข้อมูลการขาย</h2><table>${sales}</table>`;
  } else if (detail.allProps.length > 0) {
    const props = detail.allProps
      .map((p) => {
        const v = Array.isArray(p.value) ? p.value.join(", ") : p.value;
        return row(p.name, v);
      })
      .join("");
    if (props) body += `<h2>ข้อมูล</h2><table>${props}</table>`;
  }

  if (detail.qa.length > 0) {
    const items = detail.qa
      .map(
        (q, i) => `
        <div class="qa">
          <p class="q">${i + 1}. ${escapeHtml(q.question)}</p>
          <p class="a${q.answer === "(ไม่ได้ตอบ)" ? " unanswered" : ""}">${escapeHtml(q.answer)}</p>
        </div>`
      )
      .join("");
    body += `<h2>คำถาม-คำตอบ (${detail.qa.length} ข้อ)</h2>${items}`;
  }

  const title = info.name || "ผู้สมัคร";

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} - Notion</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Sarabun', 'Tahoma', sans-serif;
    color: #1e293b;
    margin: 0;
    padding: 32px 36px;
    font-size: 13px;
    line-height: 1.5;
  }
  header { border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 20px; }
  header h1 { font-size: 20px; margin: 0 0 4px; color: #0f172a; }
  header .meta { font-size: 11px; color: #64748b; }
  header .pos { display: inline-block; background: #f1f5f9; color: #475569; border-radius: 999px; padding: 2px 10px; font-size: 11px; margin-top: 6px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #7c3aed; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th, td { text-align: left; vertical-align: top; padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
  th { width: 38%; font-weight: 600; color: #64748b; font-size: 12px; }
  td { color: #1e293b; }
  .qa { margin-bottom: 12px; page-break-inside: avoid; }
  .qa .q { font-weight: 600; color: #0f172a; margin: 0 0 3px; }
  .qa .a { margin: 0; padding-left: 12px; border-left: 2px solid #c7d2fe; color: #334155; white-space: pre-line; }
  .qa .a.unanswered { color: #94a3b8; font-style: italic; border-left-color: #e2e8f0; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    ${positionTitle ? `<span class="pos">${escapeHtml(positionTitle)}</span>` : ""}
    <div class="meta">ข้อมูลจาก Notion · พิมพ์เมื่อ ${escapeHtml(printedAt)}</div>
  </header>
  ${body || "<p>ไม่พบข้อมูล</p>"}
  <footer>Relife Recruit OS — เอกสารนี้สร้างจากข้อมูลผู้สมัครใน Notion</footer>
  <script>
    window.onload = function () {
      var go = function () { window.focus(); window.print(); };
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { setTimeout(go, 150); });
      } else {
        setTimeout(go, 400);
      }
    };
  </script>
</body>
</html>`;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 mt-0.5 text-slate-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-slate-400 block">{label}</span>
        <span className="text-xs text-slate-700 break-words">{value}</span>
      </div>
    </div>
  );
}

export function NotionDataCard({ candidateId, positionTitle }: Props) {
  const [detail, setDetail] = useState<NotionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSalesAdmin = (positionTitle ?? "").toLowerCase().includes("sales admin");

  function exportPdf() {
    if (!detail) return;
    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) {
      toast.error("เบราว์เซอร์บล็อก popup — กรุณาอนุญาต popup แล้วลองใหม่");
      return;
    }
    win.document.open();
    win.document.write(buildPrintHtml(detail, positionTitle));
    win.document.close();
  }

  useEffect(() => {
    fetch(`/api/candidates/${candidateId}/notion-detail`)
      .then(async (res) => {
        if (res.status === 404) {
          setError("ไม่มีข้อมูลใน Notion");
        } else if (!res.ok) {
          throw new Error("โหลดข้อมูลไม่สำเร็จ");
        } else {
          setDetail(await res.json());
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"))
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-400" />
            ข้อมูลจาก Notion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-slate-400 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">กำลังโหลด...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-400" />
            ข้อมูลจาก Notion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!detail) return null;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-violet-500" />
          ข้อมูลจาก Notion
          {positionTitle && (
            <span className="ml-auto text-[10px] font-normal text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
              {positionTitle}
            </span>
          )}
          <button
            onClick={exportPdf}
            title="Export เป็น PDF"
            className={`${positionTitle ? "" : "ml-auto"} inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 transition-colors`}
          >
            <Printer className="h-3 w-3" />
            PDF
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">

        {/* ── Sales Admin: structured view ── */}
        {isSalesAdmin && (
          <>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ข้อมูลส่วนตัว</p>
              <div className="space-y-1.5">
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="เบอร์โทร" value={detail.info.phone} />
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="อีเมล" value={detail.info.email} />
                <InfoRow icon={<span className="text-[10px] text-slate-400">อายุ</span>} label="อายุ" value={detail.info.age != null ? `${detail.info.age} ปี` : null} />
                <InfoRow icon={<Users className="h-3.5 w-3.5" />} label="บุตร" value={detail.info.children != null ? `${detail.info.children} คน` : null} />
                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="ที่อยู่" value={detail.info.address} />
                {detail.info.lineId && (
                  <InfoRow icon={<MessageCircle className="h-3.5 w-3.5" />} label="LINE ID" value={detail.info.lineId} />
                )}
              </div>
            </div>

            {(detail.info.experience || detail.info.maxSales || detail.info.expectedSalary || detail.info.equipment.length > 0) && (
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ข้อมูลการขาย</p>
                <div className="space-y-1.5">
                  <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="ประสบการณ์ขาย" value={detail.info.experience} />
                  <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="ยอดขายสูงสุด/เดือน" value={detail.info.maxSales} />
                  <InfoRow icon={<Wallet className="h-3.5 w-3.5" />} label="รายได้ที่คาดหวัง" value={detail.info.expectedSalary} />
                  {detail.info.equipment.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Laptop className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-[10px] text-slate-400 block">อุปกรณ์ที่มี</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {detail.info.equipment.map((eq) => (
                            <span key={eq} className="inline-flex rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5">
                              {eq}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Other positions: generic view ── */}
        {!isSalesAdmin && detail.allProps.length > 0 && (
          <div className="space-y-2">
            {detail.allProps.map((prop) => {
              if (prop.type === "url") {
                return (
                  <div key={prop.name} className="flex items-start gap-2">
                    <Link2 className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-400 block">{prop.name}</span>
                      <a
                        href={prop.value as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 break-all"
                      >
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        {prop.value as string}
                      </a>
                    </div>
                  </div>
                );
              }
              if (prop.type === "files") {
                return (
                  <div key={prop.name} className="flex items-start gap-2">
                    <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-400 block">{prop.name}</span>
                      {(prop.value as string[]).map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          {i === 0 ? "เปิดไฟล์" : `ไฟล์ ${i + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              }
              if (prop.type === "tags") {
                return (
                  <div key={prop.name} className="flex items-start gap-2">
                    <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-400 block">{prop.name}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(prop.value as string[]).map((v) => (
                          <span key={v} className="inline-flex rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5">
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }
              // text / number
              const displayVal =
                typeof prop.value === "number"
                  ? prop.value.toLocaleString()
                  : (prop.value as string);
              return (
                <InfoRow
                  key={prop.name}
                  icon={<span className="h-3.5 w-3.5 inline-block" />}
                  label={prop.name}
                  value={displayVal}
                />
              );
            })}
          </div>
        )}

        {/* ── Q&A blocks — all positions ── */}
        {detail.qa.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              คำถาม-คำตอบ ({detail.qa.length} ข้อ)
            </p>
            {detail.qa.map((item, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs font-semibold text-slate-700 leading-snug">
                  {i + 1}. {item.question}
                </p>
                <p
                  className={`text-xs leading-relaxed pl-3 border-l-2 ${
                    item.answer === "(ไม่ได้ตอบ)"
                      ? "text-slate-400 border-slate-200 italic"
                      : "text-slate-600 border-blue-200"
                  }`}
                >
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        )}

        {!isSalesAdmin && detail.allProps.length === 0 && detail.qa.length === 0 && (
          <p className="text-xs text-slate-400">ไม่พบข้อมูลเพิ่มเติมใน Notion</p>
        )}
      </CardContent>
    </Card>
  );
}
