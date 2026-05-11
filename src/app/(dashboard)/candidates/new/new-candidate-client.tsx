"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

const statusLabel: Record<string, string> = {
  NEW_APPLICANT: "ผู้สมัครใหม่", BOT_SCREENING: "บอทคัดกรอง",
  WAITING_HR_REVIEW: "รอ HR พิจารณา", NEED_MORE_INFO: "ขอข้อมูลเพิ่ม",
  QUALIFIED: "ผ่านเกณฑ์", INTERVIEW_SCHEDULED: "นัดสัมภาษณ์",
  INTERVIEWED: "สัมภาษณ์แล้ว", PASSED: "ผ่านการคัดเลือก",
  REJECTED: "ไม่ผ่าน", TALENT_POOL: "Talent Pool", CLOSED: "ปิด",
};

const schema = z.object({
  fullName: z.string().min(1, "กรุณาใส่ชื่อ"),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("อีเมลไม่ถูกต้อง").optional().or(z.literal("")),
  age: z.string().optional(),
  interestedPositionId: z.string().optional(),
  sourceChannel: z.enum(["LINE", "FACEBOOK", "MANUAL", "OTHER"]),
  experienceStatus: z.enum(["EXPERIENCED", "FRESH_GRADUATE", "NO_EXPERIENCE", ""]).optional(),
  experienceDetail: z.string().optional(),
  expectedSalary: z.string().optional(),
  workPreference: z.enum(["ONSITE", "WFH", "HYBRID", ""]).optional(),
  availableStartDate: z.string().optional(),
  resumeUrl: z.string().optional(),
  portfolioUrl: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  jobs: { id: string; title: string }[];
  defaultJobId?: string;
}

export function NewCandidateClient({ jobs, defaultJobId }: Props) {
  const router = useRouter();
  const [duplicate, setDuplicate] = useState<{ id: string; fullName: string | null; nickname: string | null; phone: string | null; email: string | null; currentStatus: string } | null>(null);
  const [bypassDuplicate, setBypassDuplicate] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sourceChannel: "MANUAL",
      interestedPositionId: defaultJobId ?? "",
    },
  });

  async function onSubmit(data: FormValues) {
    const payload = {
      fullName: data.fullName,
      nickname: data.nickname || null,
      phone: data.phone || null,
      email: data.email || null,
      age: data.age ? parseInt(data.age) : null,
      interestedPositionId: data.interestedPositionId || null,
      sourceChannel: data.sourceChannel,
      experienceStatus: data.experienceStatus || null,
      experienceDetail: data.experienceDetail || null,
      expectedSalary: data.expectedSalary ? parseInt(data.expectedSalary) : null,
      workPreference: data.workPreference || null,
      availableStartDate: data.availableStartDate || null,
      resumeUrl: data.resumeUrl || null,
      portfolioUrl: data.portfolioUrl || null,
    };

    const res = await fetch(`/api/candidates${bypassDuplicate ? "?bypass=true" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      const data = await res.json();
      setDuplicate(data.candidate);
      return;
    }

    if (!res.ok) {
      toast.error("บันทึกไม่สำเร็จ");
      return;
    }

    const candidate = await res.json();
    toast.success("เพิ่มผู้สมัครสำเร็จ");
    router.push(`/candidates/${candidate.id}`);
  }

  return (
    <div className="space-y-4">
      <Link href="/candidates">
        <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500">
          <ArrowLeft className="h-4 w-4" /> กลับ
        </Button>
      </Link>

      {/* Duplicate warning */}
      {duplicate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">พบผู้สมัครเดิมในระบบ</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {duplicate.fullName ?? duplicate.nickname ?? "ไม่ระบุชื่อ"}
              {duplicate.phone ? ` · ${duplicate.phone}` : ""}
              {duplicate.email ? ` · ${duplicate.email}` : ""}
              {" · "}
              <span className="font-medium">{statusLabel[duplicate.currentStatus] ?? duplicate.currentStatus}</span>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/candidates/${duplicate.id}`}>
              <Button size="sm" variant="outline" className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100">
                ดูโปรไฟล์เดิม
              </Button>
            </Link>
            <Button size="sm" variant="ghost" className="text-xs h-7 text-amber-600" onClick={() => { setDuplicate(null); setBypassDuplicate(true); }}>
              เพิ่มใหม่อยู่ดี
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="border-slate-200">
          <CardContent className="pt-6 space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">ข้อมูลส่วนตัว</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>ชื่อ-นามสกุล *</Label>
                  <Input {...register("fullName")} placeholder="ชื่อ นามสกุล" />
                  {errors.fullName && <p className="text-xs text-red-500">{errors.fullName.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>ชื่อเล่น</Label>
                  <Input {...register("nickname")} placeholder="ชื่อเล่น" />
                </div>
                <div className="space-y-1.5">
                  <Label>เบอร์โทรศัพท์</Label>
                  <Input {...register("phone")} placeholder="08x-xxx-xxxx" />
                </div>
                <div className="space-y-1.5">
                  <Label>อีเมล</Label>
                  <Input {...register("email")} type="email" placeholder="email@example.com" />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>อายุ</Label>
                  <Input {...register("age")} type="number" placeholder="25" />
                </div>
                <div className="space-y-1.5">
                  <Label>ช่องทาง</Label>
                  <Controller
                    name="sourceChannel"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MANUAL">Manual</SelectItem>
                          <SelectItem value="LINE">LINE</SelectItem>
                          <SelectItem value="FACEBOOK">Facebook</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Job Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">ข้อมูลการสมัครงาน</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>ตำแหน่งที่สนใจ</Label>
                  <Controller
                    name="interestedPositionId"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="เลือกตำแหน่งงาน" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">ไม่ระบุ</SelectItem>
                          {jobs.map((j) => (
                            <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ประสบการณ์</Label>
                  <Controller
                    name="experienceStatus"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">ไม่ระบุ</SelectItem>
                          <SelectItem value="EXPERIENCED">มีประสบการณ์</SelectItem>
                          <SelectItem value="FRESH_GRADUATE">จบใหม่</SelectItem>
                          <SelectItem value="NO_EXPERIENCE">ไม่มีประสบการณ์</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>เงินเดือนที่ต้องการ (บาท)</Label>
                  <Input {...register("expectedSalary")} type="number" placeholder="15000" />
                </div>
                <div className="space-y-1.5">
                  <Label>รูปแบบงานที่ต้องการ</Label>
                  <Controller
                    name="workPreference"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">ไม่ระบุ</SelectItem>
                          <SelectItem value="ONSITE">Onsite</SelectItem>
                          <SelectItem value="WFH">WFH</SelectItem>
                          <SelectItem value="HYBRID">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>วันที่พร้อมเริ่มงาน</Label>
                  <Input {...register("availableStartDate")} type="date" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>รายละเอียดประสบการณ์</Label>
                  <Textarea {...register("experienceDetail")} placeholder="ประสบการณ์ทำงาน..." rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label>Resume URL</Label>
                  <Input {...register("resumeUrl")} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Portfolio URL</Label>
                  <Input {...register("portfolioUrl")} placeholder="https://..." />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/candidates" className="flex-1">
                <Button type="button" variant="outline" className="w-full">Cancel</Button>
              </Link>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Candidate
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
