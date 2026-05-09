"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Phone,
  MessageCircle,
  ExternalLink,
  Inbox,
  FileText,
  Mail,
  MapPin,
  Users,
  TrendingUp,
  Wallet,
  Laptop,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { parseTier, TIER_CONFIG, type Tier } from "@/lib/experience-tier";

type QueueCandidate = {
  id: string;
  nickname: string | null;
  fullName: string | null;
  lineDisplayName: string | null;
  lineProfilePicUrl: string | null;
  lineUserId: string | null;
  phone: string | null;
  notionPageId: string | null;
  experienceText: string | null;
  currentStatus: string;
  interestedPosition: { title: string } | null;
  createdAt: Date;
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
  qa: Array<{ question: string; answer: string }>;
};

interface Props {
  initial: QueueCandidate[];
}

const ALL_TAB = "__all__";

// ── Detail Sheet ──────────────────────────────────────────────────────────────
function DetailSheet({
  c,
  open,
  onOpenChange,
}: {
  c: QueueCandidate;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [detail, setDetail] = useState<NotionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุชื่อ";
  const tier = parseTier(c.experienceText);

  // fetch on first open
  useEffect(() => {
    if (!open || detail || loadingDetail) return;
    setLoadingDetail(true);
    setDetailError(null);
    fetch(`/api/candidates/${c.id}/notion-detail`)
      .then(async (res) => {
        if (res.status === 404) {
          setDetailError("ไม่มีข้อมูลใน Notion สำหรับผู้สมัครนี้");
        } else if (!res.ok) {
          throw new Error("โหลดข้อมูลไม่สำเร็จ");
        } else {
          setDetail(await res.json());
        }
      })
      .catch((err) => setDetailError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"))
      .finally(() => setLoadingDetail(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0"
      >
        {/* ── Header ── */}
        <SheetHeader className="sticky top-0 z-10 bg-white border-b px-6 py-4 gap-2">
          <div className="flex items-center gap-3 pr-8">
            {c.lineProfilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.lineProfilePicUrl}
                alt={name}
                className="h-10 w-10 rounded-full object-cover border-2 border-green-200 shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200 shrink-0">
                <span className="text-slate-500 font-semibold text-sm">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <SheetTitle className="text-base font-bold text-slate-900 leading-tight">
                {name}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {c.interestedPosition && (
                  <span className="text-xs text-slate-500">
                    {c.interestedPosition.title}
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-full border text-[10px] font-semibold px-2 py-0.5 ${TIER_CONFIG[tier].color}`}
                >
                  {TIER_CONFIG[tier].label}
                </span>
                {c.lineUserId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5">
                    <MessageCircle className="h-2.5 w-2.5" /> LINE
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* ── Body ── */}
        <div className="px-6 py-4 space-y-6">

          {/* Quick contact from DB */}
          <Section title="ข้อมูลติดต่อ (จากระบบ)">
            <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="เบอร์โทร" value={c.phone} />
            {c.lineUserId && (
              <InfoRow icon={<MessageCircle className="h-3.5 w-3.5" />} label="LINE User ID" value={c.lineUserId} />
            )}
            {c.experienceText && (
              <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="ประสบการณ์" value={c.experienceText} />
            )}
            <div className="mt-2">
              <Link href={`/candidates/${c.id}`} target="_blank">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />
                  เปิดโปรไฟล์เต็ม
                </Button>
              </Link>
            </div>
          </Section>

          {/* Notion detail */}
          {loadingDetail && (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">กำลังโหลดข้อมูลจาก Notion...</span>
            </div>
          )}

          {detailError && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {detailError}
            </div>
          )}

          {detail && (
            <>
              {/* Contact from Notion */}
              <Section title="ข้อมูลส่วนตัว">
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="เบอร์โทร" value={detail.info.phone} />
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="อีเมล" value={detail.info.email} />
                <InfoRow icon={<span className="text-[10px] font-bold text-slate-500">อายุ</span>} label="อายุ" value={detail.info.age != null ? `${detail.info.age} ปี` : null} />
                <InfoRow icon={<Users className="h-3.5 w-3.5" />} label="บุตร" value={detail.info.children != null ? `${detail.info.children} คน` : null} />
                <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="ที่อยู่" value={detail.info.address} />
                {detail.info.lineId && (
                  <InfoRow icon={<MessageCircle className="h-3.5 w-3.5" />} label="LINE ID" value={detail.info.lineId} />
                )}
              </Section>

              {/* Sales info */}
              {(detail.info.experience || detail.info.maxSales || detail.info.expectedSalary || detail.info.equipment.length > 0) && (
                <Section title="ข้อมูลการขาย">
                  <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="ประสบการณ์ขาย" value={detail.info.experience} />
                  <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="ยอดขายสูงสุด/เดือน" value={detail.info.maxSales} />
                  <InfoRow icon={<Wallet className="h-3.5 w-3.5" />} label="รายได้ที่คาดหวัง" value={detail.info.expectedSalary} />
                  {detail.info.equipment.length > 0 && (
                    <div className="flex gap-2 py-1">
                      <span className="shrink-0 mt-0.5 text-slate-400">
                        <Laptop className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-500 block mb-1">อุปกรณ์ที่มี</span>
                        <div className="flex flex-wrap gap-1">
                          {detail.info.equipment.map((eq) => (
                            <span key={eq} className="inline-flex rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5">
                              {eq}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Deep Q&A */}
              {detail.qa.length > 0 && (
                <Section title={`คำถามเชิงลึก (${detail.qa.length} ข้อ)`}>
                  <div className="space-y-4 mt-1">
                    {detail.qa.map((item, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-xs font-semibold text-slate-700 leading-snug">
                          {i + 1}. {item.question}
                        </p>
                        <p className={`text-xs leading-relaxed pl-3 border-l-2 ${item.answer === "(ไม่ได้ตอบ)" ? "text-slate-400 border-slate-200 italic" : "text-slate-600 border-blue-200"}`}>
                          {item.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h3>
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 space-y-1">
        {children}
      </div>
    </div>
  );
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
    <div className="flex items-start gap-2 py-1">
      <span className="shrink-0 mt-0.5 text-slate-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-slate-400 block">{label}</span>
        <span className="text-xs text-slate-700 break-words">{value}</span>
      </div>
    </div>
  );
}

// ── Candidate Row ─────────────────────────────────────────────────────────────
function CandidateRow({
  c,
  showTier,
  loading,
  onQualify,
}: {
  c: QueueCandidate;
  showTier: boolean;
  loading: Record<string, "pass" | "fail">;
  onQualify: (c: QueueCandidate, result: "pass" | "fail") => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const name = c.fullName ?? c.nickname ?? c.lineDisplayName ?? "ไม่ระบุชื่อ";
  const isLoading = !!loading[c.id];
  const tier: Tier | null = showTier ? parseTier(c.experienceText) : null;

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-slate-300 transition-colors">
        {/* Avatar */}
        <div className="shrink-0">
          {c.lineProfilePicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.lineProfilePicUrl}
              alt={name}
              className="h-10 w-10 rounded-full object-cover border-2 border-green-200"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-slate-200 shrink-0">
              <span className="text-slate-500 font-semibold text-sm">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{name}</span>
            {c.lineUserId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5">
                <MessageCircle className="h-2.5 w-2.5" /> LINE
              </span>
            )}
            {tier && (
              <span
                className={`inline-flex items-center rounded-full border text-[10px] font-semibold px-2 py-0.5 ${TIER_CONFIG[tier].color}`}
              >
                {TIER_CONFIG[tier].label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
            {c.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {c.phone}
              </span>
            )}
            {showTier && c.experienceText && (
              <span className="text-slate-400 truncate max-w-[260px]" title={c.experienceText}>
                {c.experienceText.length > 50
                  ? c.experienceText.slice(0, 50) + "…"
                  : c.experienceText}
              </span>
            )}
            {!showTier && c.interestedPosition && (
              <span className="text-slate-400">{c.interestedPosition.title}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Detail button */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs gap-1 text-slate-600 border-slate-200"
            onClick={() => setSheetOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" />
            รายละเอียด
          </Button>
          <Link href={`/candidates/${c.id}`} target="_blank">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white h-8 px-3 text-xs"
            disabled={isLoading}
            onClick={() => onQualify(c, "pass")}
          >
            {loading[c.id] === "pass" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                ผ่าน
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 px-3 text-xs"
            disabled={isLoading}
            onClick={() => onQualify(c, "fail")}
          >
            {loading[c.id] === "fail" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 mr-1" />
                ไม่ผ่าน
              </>
            )}
          </Button>
        </div>
      </div>

      <DetailSheet c={c} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ReviewClient({ initial }: Props) {
  const [queue, setQueue] = useState<QueueCandidate[]>(initial);
  const [loading, setLoading] = useState<Record<string, "pass" | "fail">>({});
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);

  const tabs = useMemo(() => {
    const posMap = new Map<string, number>();
    for (const c of queue) {
      const key = c.interestedPosition?.title ?? "ไม่ระบุตำแหน่ง";
      posMap.set(key, (posMap.get(key) ?? 0) + 1);
    }
    const named = [...posMap.entries()]
      .filter(([k]) => k !== "ไม่ระบุตำแหน่ง")
      .sort((a, b) => b[1] - a[1]);
    const none = posMap.get("ไม่ระบุตำแหน่ง");
    return [
      ...named,
      ...(none ? [["ไม่ระบุตำแหน่ง", none] as [string, number]] : []),
    ];
  }, [queue]);

  const isSalesAdmin =
    activeTab !== ALL_TAB && activeTab.toLowerCase().includes("sales admin");

  const filtered = useMemo(() => {
    const list =
      activeTab === ALL_TAB
        ? queue
        : queue.filter(
            (c) => (c.interestedPosition?.title ?? "ไม่ระบุตำแหน่ง") === activeTab
          );
    if (isSalesAdmin) {
      return [...list].sort((a, b) => {
        const ta = TIER_CONFIG[parseTier(a.experienceText)].order;
        const tb = TIER_CONFIG[parseTier(b.experienceText)].order;
        if (ta !== tb) return ta - tb;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }
    return list;
  }, [queue, activeTab, isSalesAdmin]);

  async function handleQualify(candidate: QueueCandidate, result: "pass" | "fail") {
    setLoading((prev) => ({ ...prev, [candidate.id]: result }));
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      setQueue((prev) => prev.filter((c) => c.id !== candidate.id));

      const remaining = queue.filter(
        (c) =>
          c.id !== candidate.id &&
          (c.interestedPosition?.title ?? "ไม่ระบุตำแหน่ง") === activeTab
      );
      if (remaining.length === 0 && activeTab !== ALL_TAB) setActiveTab(ALL_TAB);

      const label = result === "pass" ? "✅ ผ่าน" : "❌ ไม่ผ่าน";
      const name =
        candidate.fullName ?? candidate.nickname ?? candidate.lineDisplayName ?? "ไม่ระบุ";
      const msgs: string[] = [];
      if (data.lineSent) msgs.push("ส่ง LINE แล้ว");
      if (data.notionPatched) msgs.push("อัปเดต Notion แล้ว");

      toast.success(`${name} — ${label}`, {
        description: msgs.join(" · ") || undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading((prev) => {
        const next = { ...prev };
        delete next[candidate.id];
        return next;
      });
    }
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Inbox className="h-12 w-12 mb-3 text-slate-300" />
        <p className="text-lg font-medium text-slate-500">ไม่มีใบสมัครที่รอพิจารณา</p>
        <p className="text-sm mt-1">เมื่อมีผู้สมัครใหม่จะแสดงที่นี่</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab(ALL_TAB)}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
            activeTab === ALL_TAB
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800"
          }`}
        >
          ทั้งหมด
          <span className={`rounded-full px-1.5 py-0 text-[10px] font-bold ${activeTab === ALL_TAB ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
            {queue.length}
          </span>
        </button>
        {tabs.map(([title, count]) => {
          const isActive = activeTab === title;
          const isSA = title.toLowerCase().includes("sales admin");
          return (
            <button
              key={title}
              onClick={() => setActiveTab(title)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                isActive
                  ? isSA
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-800"
              }`}
            >
              {title}
              <span className={`rounded-full px-1.5 py-0 text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Sales Admin tier legend ── */}
      {isSalesAdmin && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-blue-50 border border-blue-100">
          <span className="text-xs font-medium text-blue-700 mr-1">ระดับประสบการณ์ :</span>
          {(Object.entries(TIER_CONFIG) as [Tier, (typeof TIER_CONFIG)[Tier]][]).map(([key, cfg]) => (
            <span key={key} className={`inline-flex items-center rounded-full border text-[10px] font-semibold px-2 py-0.5 ${cfg.color}`}>
              {cfg.label}
            </span>
          ))}
        </div>
      )}

      {/* ── Candidate list ── */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">ไม่มีรายการในตำแหน่งนี้</div>
        ) : (
          filtered.map((c) => (
            <CandidateRow
              key={c.id}
              c={c}
              showTier={isSalesAdmin}
              loading={loading}
              onQualify={handleQualify}
            />
          ))
        )}
      </div>
    </div>
  );
}
