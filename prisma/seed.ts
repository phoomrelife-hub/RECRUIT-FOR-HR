import { PrismaClient, UserRole, CandidateStatus, SourceChannel, ExperienceStatus, WorkPreference, JobStatus, WorkType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Users
  const password = await bcrypt.hash("password123", 12);

  const superAdmin = await db.user.upsert({
    where: { email: "admin@relife.co.th" },
    update: {},
    create: {
      email: "admin@relife.co.th",
      password,
      name: "Super Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });

  const hrManager = await db.user.upsert({
    where: { email: "manager@relife.co.th" },
    update: {},
    create: {
      email: "manager@relife.co.th",
      password,
      name: "นภา วิชัยดิษฐ",
      role: UserRole.HR_MANAGER,
    },
  });

  const hrStaff1 = await db.user.upsert({
    where: { email: "staff1@relife.co.th" },
    update: {},
    create: {
      email: "staff1@relife.co.th",
      password,
      name: "มินตรา สุขสมาน",
      role: UserRole.HR_STAFF,
    },
  });

  const hrStaff2 = await db.user.upsert({
    where: { email: "staff2@relife.co.th" },
    update: {},
    create: {
      email: "staff2@relife.co.th",
      password,
      name: "กฤษณ์ ทองสมบูรณ์",
      role: UserRole.HR_STAFF,
    },
  });

  console.log("✅ Users created");

  // Job Positions
  const jobSalesAdmin = await db.jobPosition.create({
    data: {
      title: "Sales Admin",
      description: "ดูแลงานเอกสาร สนับสนุนทีม Sales",
      department: "Sales",
      workType: WorkType.ONSITE,
      salaryMin: 15000,
      salaryMax: 20000,
      requiredExperience: "0-2 ปี",
      workingTime: "จันทร์-ศุกร์ 09:00-18:00",
      location: "กรุงเทพฯ",
      headcount: 3,
      status: JobStatus.OPEN,
      ownerId: hrManager.id,
    },
  });

  const jobTelesales = await db.jobPosition.create({
    data: {
      title: "Telesales",
      description: "โทรหาลูกค้า นำเสนอสินค้าและบริการ",
      department: "Sales",
      workType: WorkType.WFH,
      salaryMin: 12000,
      salaryMax: 18000,
      requiredExperience: "ไม่จำเป็น",
      workingTime: "จันทร์-ศุกร์ 09:00-18:00",
      location: "Work from Home",
      headcount: 5,
      status: JobStatus.OPEN,
      ownerId: hrManager.id,
    },
  });

  const jobContent = await db.jobPosition.create({
    data: {
      title: "Content Creator",
      description: "สร้างคอนเทนต์ Social Media",
      department: "Marketing",
      workType: WorkType.HYBRID,
      salaryMin: 18000,
      salaryMax: 25000,
      requiredExperience: "1+ ปี",
      workingTime: "จันทร์-ศุกร์",
      location: "กรุงเทพฯ / Hybrid",
      headcount: 2,
      status: JobStatus.OPEN,
      ownerId: hrManager.id,
    },
  });

  console.log("✅ Job positions created");

  // Tags
  const tagDefs = [
    { name: "มีประสบการณ์", color: "#10b981" },
    { name: "ไม่มีประสบการณ์", color: "#6366f1" },
    { name: "สนใจ WFH", color: "#3b82f6" },
    { name: "สนใจ Office", color: "#f59e0b" },
    { name: "พร้อมเริ่มงาน", color: "#22c55e" },
    { name: "รอ Resume", color: "#f97316" },
    { name: "คุณภาพดี", color: "#8b5cf6" },
    { name: "Talent Pool", color: "#06b6d4" },
    { name: "เคสด่วน", color: "#ef4444" },
    { name: "เงินเดือนเกินงบ", color: "#dc2626" },
  ];

  const tags: Record<string, { id: string; name: string }> = {};
  for (const t of tagDefs) {
    const tag = await db.tag.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
    tags[t.name] = tag;
  }

  console.log("✅ Tags created");

  // Candidates with various statuses
  const candidatesData = [
    {
      nickname: "นุ่น",
      fullName: "ณัฐนิชา พรมสิทธิ์",
      phone: "081-234-5678",
      email: "natnicha@gmail.com",
      age: 24,
      sourceChannel: SourceChannel.LINE,
      interestedPositionId: jobSalesAdmin.id,
      experienceStatus: ExperienceStatus.NO_EXPERIENCE,
      expectedSalary: 16000,
      workPreference: WorkPreference.ONSITE,
      hasComputer: true,
      hasInternet: true,
      currentStatus: CandidateStatus.WAITING_HR_REVIEW,
      ownerId: hrStaff1.id,
      tags: ["ไม่มีประสบการณ์", "พร้อมเริ่มงาน"],
    },
    {
      nickname: "ปลา",
      fullName: "ปณิตา ชัยศรี",
      phone: "089-876-5432",
      age: 27,
      sourceChannel: SourceChannel.FACEBOOK,
      interestedPositionId: jobTelesales.id,
      experienceStatus: ExperienceStatus.EXPERIENCED,
      experienceDetail: "เคยทำ Telesales 2 ปี",
      expectedSalary: 15000,
      workPreference: WorkPreference.WFH,
      hasComputer: true,
      hasInternet: true,
      currentStatus: CandidateStatus.QUALIFIED,
      ownerId: hrStaff1.id,
      tags: ["มีประสบการณ์", "สนใจ WFH", "คุณภาพดี"],
    },
    {
      nickname: "ไอซ์",
      fullName: "ศุภวิชญ์ ดอกไม้งาม",
      phone: "062-111-2222",
      age: 22,
      sourceChannel: SourceChannel.LINE,
      interestedPositionId: jobContent.id,
      experienceStatus: ExperienceStatus.FRESH_GRADUATE,
      expectedSalary: 20000,
      workPreference: WorkPreference.HYBRID,
      hasComputer: true,
      hasInternet: true,
      currentStatus: CandidateStatus.INTERVIEW_SCHEDULED,
      ownerId: hrStaff2.id,
      tags: ["คุณภาพดี", "พร้อมเริ่มงาน"],
    },
    {
      nickname: "แป้ง",
      fullName: "กัลยา สายใจ",
      phone: "093-333-4444",
      age: 30,
      sourceChannel: SourceChannel.FACEBOOK,
      interestedPositionId: jobSalesAdmin.id,
      experienceStatus: ExperienceStatus.EXPERIENCED,
      experienceDetail: "Admin 5 ปี",
      expectedSalary: 25000,
      workPreference: WorkPreference.ONSITE,
      hasComputer: true,
      hasInternet: true,
      currentStatus: CandidateStatus.REJECTED,
      ownerId: hrStaff2.id,
      tags: ["มีประสบการณ์", "เงินเดือนเกินงบ"],
    },
    {
      nickname: "ต้น",
      fullName: "ธนกฤต มั่นคง",
      phone: "085-555-6666",
      age: 25,
      sourceChannel: SourceChannel.LINE,
      interestedPositionId: jobTelesales.id,
      experienceStatus: ExperienceStatus.NO_EXPERIENCE,
      expectedSalary: 13000,
      workPreference: WorkPreference.WFH,
      hasComputer: false,
      hasInternet: true,
      currentStatus: CandidateStatus.NEW_APPLICANT,
      tags: ["ไม่มีประสบการณ์", "สนใจ WFH", "รอ Resume"],
    },
    {
      nickname: "เฟิร์น",
      fullName: "พัชรี เจริญสุข",
      phone: "097-777-8888",
      age: 28,
      sourceChannel: SourceChannel.LINE,
      interestedPositionId: jobContent.id,
      experienceStatus: ExperienceStatus.EXPERIENCED,
      experienceDetail: "Content 3 ปี",
      expectedSalary: 22000,
      workPreference: WorkPreference.HYBRID,
      hasComputer: true,
      hasInternet: true,
      currentStatus: CandidateStatus.PASSED,
      ownerId: hrStaff1.id,
      tags: ["มีประสบการณ์", "คุณภาพดี"],
    },
    {
      nickname: "มิ้ว",
      fullName: "สุภาพร ใจดี",
      phone: "080-999-0000",
      age: 23,
      sourceChannel: SourceChannel.FACEBOOK,
      interestedPositionId: jobSalesAdmin.id,
      experienceStatus: ExperienceStatus.FRESH_GRADUATE,
      expectedSalary: 15000,
      workPreference: WorkPreference.ONSITE,
      hasComputer: true,
      hasInternet: true,
      currentStatus: CandidateStatus.TALENT_POOL,
      ownerId: hrManager.id,
      tags: ["Talent Pool", "คุณภาพดี"],
    },
    {
      nickname: "เบส",
      fullName: "ณัฐพล สีดา",
      phone: "064-123-4567",
      age: 26,
      sourceChannel: SourceChannel.LINE,
      interestedPositionId: jobTelesales.id,
      experienceStatus: ExperienceStatus.EXPERIENCED,
      experienceDetail: "Telesales 1 ปี",
      expectedSalary: 14000,
      workPreference: WorkPreference.WFH,
      hasComputer: true,
      hasInternet: true,
      currentStatus: CandidateStatus.BOT_SCREENING,
      tags: ["มีประสบการณ์", "สนใจ WFH"],
    },
  ];

  for (const candidateData of candidatesData) {
    const { tags: candidateTags, ...data } = candidateData;

    const candidate = await db.candidate.create({ data });

    for (const tagName of candidateTags) {
      if (tags[tagName]) {
        await db.candidateTag.create({
          data: {
            candidateId: candidate.id,
            tagId: tags[tagName].id,
          },
        });
      }
    }

    await db.candidateStatusHistory.create({
      data: {
        candidateId: candidate.id,
        toStatus: data.currentStatus,
        reason: "Initial status",
      },
    });
  }

  console.log("✅ Candidates created");

  // Quick Replies
  const quickReplies = [
    { title: "ขอชื่อเล่น", content: "สวัสดีครับ/ค่ะ ขอทราบชื่อเล่นด้วยนะครับ/ค่ะ", sortOrder: 1 },
    { title: "ขออายุ", content: "ขอทราบอายุด้วยนะครับ/ค่ะ", sortOrder: 2 },
    { title: "ขอเบอร์โทร", content: "ขอเบอร์โทรศัพท์เพื่อนัดสัมภาษณ์ด้วยนะครับ/ค่ะ", sortOrder: 3 },
    { title: "ขอประสบการณ์", content: "ที่ผ่านมาเคยทำงานด้านนี้มาก่อนไหมครับ/ค่ะ? ถ้าเคย ช่วยเล่าให้ฟังหน่อยได้เลยครับ/ค่ะ", sortOrder: 4 },
    { title: "ขอ Resume", content: "รบกวนส่ง Resume มาให้ด้วยนะครับ/ค่ะ ส่งเป็นไฟล์ PDF หรือรูปภาพได้เลยครับ/ค่ะ", sortOrder: 5 },
    { title: "แจ้งรายละเอียดตำแหน่ง", content: "ตำแหน่งนี้ทำงาน จ-ศ เวลา 09.00-18.00 น. เงินเดือนเริ่มต้น 15,000-20,000 บาท มีโอทีและโบนัสตามผลงานครับ/ค่ะ", sortOrder: 6 },
    { title: "แจ้งรอพิจารณา", content: "ขอบคุณที่สนใจร่วมงานกับเรานะครับ/ค่ะ ทางทีม HR จะพิจารณาข้อมูลและติดต่อกลับภายใน 1-3 วันทำการครับ/ค่ะ", sortOrder: 7 },
    { title: "นัดสัมภาษณ์", content: "ยินดีที่ผ่านการคัดเลือกเบื้องต้นครับ/ค่ะ ขอนัดสัมภาษณ์ในวัน______ เวลา______ น. ที่______ ได้เลยไหมครับ/ค่ะ?", sortOrder: 8 },
    { title: "แจ้งไม่ผ่าน", content: "ขอบคุณที่สนใจร่วมงานกับ Relife นะครับ/ค่ะ ขณะนี้คุณสมบัติยังไม่ตรงกับที่เราต้องการในช่วงนี้ ถ้ามีตำแหน่งที่เหมาะสมจะติดต่อกลับครับ/ค่ะ ขอบคุณมากครับ/ค่ะ", sortOrder: 9 },
  ];

  for (const qr of quickReplies) {
    await db.quickReply.create({ data: qr });
  }

  console.log("✅ Quick replies created");

  console.log("\n🎉 Seed completed!");
  console.log("\n📋 Test accounts:");
  console.log("  Super Admin : admin@relife.co.th / password123");
  console.log("  HR Manager  : manager@relife.co.th / password123");
  console.log("  HR Staff 1  : staff1@relife.co.th / password123");
  console.log("  HR Staff 2  : staff2@relife.co.th / password123");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
