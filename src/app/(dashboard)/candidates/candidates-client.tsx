"use client";

import { useState, useCallback } from "react";
import { CandidateStatus, SourceChannel, ExperienceStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Search, MoreHorizontal, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Candidate = {
  id: string;
  fullName: string | null;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  age: number | null;
  sourceChannel: SourceChannel;
  currentStatus: CandidateStatus;
  experienceStatus: ExperienceStatus | null;
  expectedSalary: number | null;
  createdAt: Date;
  interestedPosition: { id: string; title: string } | null;
  lineProfilePicUrl: string | null;
};

const statusColor: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "bg-slate-100 text-slate-600",
  BOT_SCREENING: "bg-blue-100 text-blue-600",
  WAITING_HR_REVIEW: "bg-yellow-100 text-yellow-700",
  NEED_MORE_INFO: "bg-orange-100 text-orange-700",
  QUALIFIED: "bg-teal-100 text-teal-700",
  INTERVIEW_SCHEDULED: "bg-purple-100 text-purple-700",
  INTERVIEWED: "bg-indigo-100 text-indigo-700",
  PASSED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
  TALENT_POOL: "bg-cyan-100 text-cyan-700",
  CLOSED: "bg-slate-100 text-slate-400",
};

const statusLabel: Record<CandidateStatus, string> = {
  NEW_APPLICANT: "ผู้สมัครใหม่",
  BOT_SCREENING: "บอทคัดกรอง",
  WAITING_HR_REVIEW: "รอ HR พิจารณา",
  NEED_MORE_INFO: "ขอข้อมูลเพิ่ม",
  QUALIFIED: "ผ่านเกณฑ์",
  INTERVIEW_SCHEDULED: "นัดสัมภาษณ์",
  INTERVIEWED: "สัมภาษณ์แล้ว",
  PASSED: "ผ่านการคัดเลือก",
  REJECTED: "ไม่ผ่าน",
  TALENT_POOL: "Talent Pool",
  CLOSED: "ปิด",
};

const sourceLabel: Record<SourceChannel, string> = {
  LINE: "LINE",
  FACEBOOK: "Facebook",
  WEBSITE: "Website",
  MANUAL: "Manual",
  OTHER: "Other",
};

const sourceBadge: Record<SourceChannel, string> = {
  LINE: "bg-green-50 text-green-700",
  FACEBOOK: "bg-blue-50 text-blue-600",
  WEBSITE: "bg-purple-50 text-purple-700",
  MANUAL: "bg-slate-50 text-slate-600",
  OTHER: "bg-orange-50 text-orange-600",
};

function getDisplayName(c: Candidate) {
  return c.fullName ?? c.nickname ?? "ไม่ระบุชื่อ";
}

function getInitials(c: Candidate) {
  const name = getDisplayName(c);
  return name.slice(0, 2).toUpperCase();
}

interface CandidatesClientProps {
  initialCandidates: Candidate[];
  initialTotal: number;
  jobs: { id: string; title: string }[];
  canDelete: boolean;
}

export function CandidatesClient({
  initialCandidates,
  initialTotal,
  canDelete,
}: CandidatesClientProps) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 20;

  const fetchCandidates = useCallback(
    async (opts: { search?: string; status?: string; source?: string; page?: number }) => {
      setLoading(true);
      const p = new URLSearchParams();
      if (opts.search) p.set("search", opts.search);
      if (opts.status && opts.status !== "ALL") p.set("status", opts.status);
      if (opts.source && opts.source !== "ALL") p.set("source", opts.source);
      p.set("page", String(opts.page ?? 1));
      p.set("limit", String(limit));

      const res = await fetch(`/api/candidates?${p}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates);
        setTotal(data.total);
        setPage(data.page);
      }
      setLoading(false);
    },
    []
  );

  async function handleSearch(value: string) {
    setSearch(value);
    await fetchCandidates({ search: value, status: statusFilter, source: sourceFilter, page: 1 });
  }

  async function handleStatusFilter(value: string) {
    setStatusFilter(value);
    await fetchCandidates({ search, status: value, source: sourceFilter, page: 1 });
  }

  async function handleSourceFilter(value: string) {
    setSourceFilter(value);
    await fetchCandidates({ search, status: statusFilter, source: value, page: 1 });
  }

  async function handlePage(newPage: number) {
    await fetchCandidates({ search, status: statusFilter, source: sourceFilter, page: newPage });
  }

  async function deleteCandidate(id: string) {
    if (!confirm("ต้องการลบผู้สมัครนี้?")) return;
    const res = await fetch(`/api/candidates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("ลบไม่สำเร็จ");
      return;
    }
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    setTotal((prev) => prev - 1);
    toast.success("ลบผู้สมัครสำเร็จ");
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && handleStatusFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            {(Object.keys(statusLabel) as CandidateStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => v && handleSourceFilter(v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            <SelectItem value="LINE">LINE</SelectItem>
            <SelectItem value="FACEBOOK">Facebook</SelectItem>
            <SelectItem value="WEBSITE">Website</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Link href="/candidates/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Candidate
            </Button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `${total} คน`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {candidates.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/candidates/${c.id}`)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    {c.lineProfilePicUrl && (
                      <AvatarImage src={c.lineProfilePicUrl} alt={getDisplayName(c)} />
                    )}
                    <AvatarFallback className="bg-blue-50 text-blue-700 text-xs font-semibold">
                      {getInitials(c)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900">{getDisplayName(c)}</p>
                      {c.age && <span className="text-xs text-slate-400">อายุ {c.age} ปี</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      {c.phone && <span>{c.phone}</span>}
                      {c.email && <span>{c.email}</span>}
                      {c.interestedPosition && (
                        <span className="text-blue-500">{c.interestedPosition.title}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <Badge className={`${sourceBadge[c.sourceChannel]} text-xs`}>
                    {sourceLabel[c.sourceChannel]}
                  </Badge>
                  <Badge className={`${statusColor[c.currentStatus]} text-xs`}>
                    {statusLabel[c.currentStatus]}
                  </Badge>
                  {c.expectedSalary && (
                    <span className="text-xs text-slate-400 hidden lg:block">
                      {c.expectedSalary.toLocaleString()} ฿
                    </span>
                  )}
                  <p className="text-xs text-slate-400 hidden sm:block">
                    {format(new Date(c.createdAt), "d MMM yy")}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" className="h-8 w-8" />}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/candidates/${c.id}`); }}>View Profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/candidates/${c.id}/edit`); }}>Edit</DropdownMenuItem>
                      {canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={(e) => { e.stopPropagation(); deleteCandidate(c.id); }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {candidates.length === 0 && !loading && (
              <p className="py-12 text-center text-sm text-slate-400">ไม่พบผู้สมัคร</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>หน้า {page} จาก {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePage(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
