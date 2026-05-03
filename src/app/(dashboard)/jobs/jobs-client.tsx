"use client";

import { useState } from "react";
import { JobStatus, WorkType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Search,
  Briefcase,
  MapPin,
  Users,
  Clock,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";

type Job = {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  workType: WorkType;
  salaryMin: number | null;
  salaryMax: number | null;
  requiredExperience: string | null;
  workingTime: string | null;
  location: string | null;
  headcount: number;
  status: JobStatus;
  createdAt: Date;
  _count: { candidates: number };
};

const statusBadge: Record<JobStatus, string> = {
  OPEN: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-500",
  DRAFT: "bg-yellow-100 text-yellow-700",
};

const workTypeBadge: Record<WorkType, string> = {
  ONSITE: "bg-blue-50 text-blue-600",
  WFH: "bg-purple-50 text-purple-600",
  HYBRID: "bg-teal-50 text-teal-600",
};

const workTypeLabel: Record<WorkType, string> = {
  ONSITE: "Onsite",
  WFH: "WFH",
  HYBRID: "Hybrid",
};

const jobFormSchema = z.object({
  title: z.string().min(1, "กรุณาใส่ชื่อตำแหน่ง"),
  description: z.string().optional(),
  department: z.string().optional(),
  workType: z.enum(["ONSITE", "WFH", "HYBRID"]),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  requiredExperience: z.string().optional(),
  workingTime: z.string().optional(),
  location: z.string().optional(),
  headcount: z.string(),
  status: z.enum(["OPEN", "CLOSED", "DRAFT"]),
});

type JobForm = z.infer<typeof jobFormSchema>;

interface JobsClientProps {
  initialJobs: Job[];
  canManage: boolean;
  canDelete: boolean;
}

export function JobsClient({ initialJobs, canManage, canDelete }: JobsClientProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);

  const router = useRouter();

  const filteredJobs = jobs.filter((j) => {
    const matchSearch = search === "" || j.title.toLowerCase().includes(search.toLowerCase()) || (j.department ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: jobs.length,
    open: jobs.filter((j) => j.status === "OPEN").length,
    draft: jobs.filter((j) => j.status === "DRAFT").length,
    closed: jobs.filter((j) => j.status === "CLOSED").length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Positions", value: stats.total, color: "text-slate-900" },
          { label: "Open", value: stats.open, color: "text-green-600" },
          { label: "Draft", value: stats.draft, color: "text-yellow-600" },
          { label: "Closed", value: stats.closed, color: "text-slate-400" },
        ].map((s) => (
          <Card key={s.label} className="border-slate-200">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="ค้นหาตำแหน่งงาน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700" />}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Position
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Job Position</DialogTitle>
              </DialogHeader>
              <JobForm
                onSuccess={(job) => {
                  setJobs((prev) => [job, ...prev]);
                  setCreateOpen(false);
                  toast.success("สร้างตำแหน่งงานสำเร็จ");
                }}
                onCancel={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* List */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            {filteredJobs.length} ตำแหน่ง
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {filteredJobs.map((job) => (
              <div key={job.id} className="flex items-start justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                    <Briefcase className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {job.title}
                      </Link>
                      <Badge className={statusBadge[job.status]}>{job.status}</Badge>
                      <Badge className={workTypeBadge[job.workType]}>{workTypeLabel[job.workType]}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      {job.department && (
                        <span>{job.department}</span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {job.location}
                        </span>
                      )}
                      {job.workingTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {job.workingTime}
                        </span>
                      )}
                      {(job.salaryMin || job.salaryMax) && (
                        <span>
                          {job.salaryMin?.toLocaleString()} – {job.salaryMax?.toLocaleString()} บาท
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{job._count.candidates}/{job.headcount}</span>
                  </div>
                  <p className="text-xs text-slate-400">{format(new Date(job.createdAt), "d MMM yyyy")}</p>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/jobs/${job.id}`)}>View Detail</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditJob(job)}>Edit</DropdownMenuItem>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => deleteJob(job.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
            {filteredJobs.length === 0 && (
              <p className="py-12 text-center text-sm text-slate-400">ไม่พบตำแหน่งงาน</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editJob && (
        <Dialog open={!!editJob} onOpenChange={(open) => !open && setEditJob(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Job Position</DialogTitle>
            </DialogHeader>
            <JobForm
              defaultValues={editJob}
              onSuccess={(updated) => {
                setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
                setEditJob(null);
                toast.success("อัพเดตตำแหน่งงานสำเร็จ");
              }}
              onCancel={() => setEditJob(null)}
              jobId={editJob.id}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  async function deleteJob(id: string) {
    if (!confirm("ต้องการลบตำแหน่งงานนี้?")) return;
    const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("ลบไม่สำเร็จ");
      return;
    }
    setJobs((prev) => prev.filter((j) => j.id !== id));
    toast.success("ลบตำแหน่งงานสำเร็จ");
  }
}

interface JobFormProps {
  defaultValues?: Job;
  jobId?: string;
  onSuccess: (job: Job) => void;
  onCancel: () => void;
}

function JobForm({ defaultValues, jobId, onSuccess, onCancel }: JobFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<JobForm>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: defaultValues
      ? {
          title: defaultValues.title,
          description: defaultValues.description ?? "",
          department: defaultValues.department ?? "",
          workType: defaultValues.workType,
          salaryMin: defaultValues.salaryMin?.toString() ?? "",
          salaryMax: defaultValues.salaryMax?.toString() ?? "",
          requiredExperience: defaultValues.requiredExperience ?? "",
          workingTime: defaultValues.workingTime ?? "",
          location: defaultValues.location ?? "",
          headcount: defaultValues.headcount.toString(),
          status: defaultValues.status,
        }
      : { workType: "ONSITE", status: "OPEN", headcount: "1" },
  });

  async function onSubmit(data: JobForm) {
    const payload = {
      title: data.title,
      description: data.description || null,
      department: data.department || null,
      workType: data.workType,
      salaryMin: data.salaryMin ? parseInt(data.salaryMin) : null,
      salaryMax: data.salaryMax ? parseInt(data.salaryMax) : null,
      requiredExperience: data.requiredExperience || null,
      workingTime: data.workingTime || null,
      location: data.location || null,
      headcount: parseInt(data.headcount) || 1,
      status: data.status,
    };

    const res = await fetch(jobId ? `/api/jobs/${jobId}` : "/api/jobs", {
      method: jobId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      toast.error("บันทึกไม่สำเร็จ");
      return;
    }

    const job = await res.json();
    onSuccess(job);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>ชื่อตำแหน่งงาน *</Label>
          <Input {...register("title")} placeholder="เช่น Software Engineer" />
          {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>แผนก</Label>
          <Input {...register("department")} placeholder="เช่น Engineering" />
        </div>
        <div className="space-y-1.5">
          <Label>สถานที่ทำงาน</Label>
          <Input {...register("location")} placeholder="เช่น กรุงเทพฯ" />
        </div>
        <div className="space-y-1.5">
          <Label>รูปแบบงาน</Label>
          <Controller
            name="workType"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONSITE">Onsite</SelectItem>
                  <SelectItem value="WFH">WFH</SelectItem>
                  <SelectItem value="HYBRID">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>สถานะ</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>เงินเดือน ต่ำสุด (บาท)</Label>
          <Input {...register("salaryMin")} type="number" placeholder="15000" />
        </div>
        <div className="space-y-1.5">
          <Label>เงินเดือน สูงสุด (บาท)</Label>
          <Input {...register("salaryMax")} type="number" placeholder="30000" />
        </div>
        <div className="space-y-1.5">
          <Label>ประสบการณ์ที่ต้องการ</Label>
          <Input {...register("requiredExperience")} placeholder="เช่น 1-3 ปี" />
        </div>
        <div className="space-y-1.5">
          <Label>จำนวนที่รับ (headcount)</Label>
          <Input {...register("headcount")} type="number" min="1" />
        </div>
        <div className="space-y-1.5">
          <Label>เวลาทำงาน</Label>
          <Input {...register("workingTime")} placeholder="เช่น จ-ศ 09:00-18:00" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>รายละเอียดงาน</Label>
          <Textarea {...register("description")} placeholder="รายละเอียดตำแหน่งงาน..." rows={3} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {jobId ? "Save Changes" : "Create Position"}
        </Button>
      </div>
    </form>
  );
}
