"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
