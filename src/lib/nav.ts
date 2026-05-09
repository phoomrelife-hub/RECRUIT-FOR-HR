import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Briefcase,
  KanbanSquare,
  ClipboardList,
  Calendar,
  BarChart3,
  UserCog,
  Tag,
  Plug,
  ShieldCheck,
  Brain,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { UserRole } from "@prisma/client";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  badge?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    title: "ภาพรวม",
    items: [
      {
        title: "หน้าหลัก",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
    ],
  },
  {
    title: "การรับสมัคร",
    items: [
      {
        title: "กล่องข้อความ",
        href: "/inbox",
        icon: MessageSquare,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
      {
        title: "คิวพิจารณา",
        href: "/review",
        icon: ClipboardCheck,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
      {
        title: "ผู้สมัคร",
        href: "/candidates",
        icon: Users,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
      {
        title: "Pipeline",
        href: "/pipeline",
        icon: KanbanSquare,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
      {
        title: "ตำแหน่งงาน",
        href: "/jobs",
        icon: Briefcase,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
    ],
  },
  {
    title: "กระบวนการ",
    items: [
      {
        title: "แบบคัดกรอง",
        href: "/screening",
        icon: ClipboardList,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
      {
        title: "สัมภาษณ์",
        href: "/interviews",
        icon: Calendar,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
    ],
  },
  {
    title: "วิเคราะห์",
    items: [
      {
        title: "รายงาน",
        href: "/reports",
        icon: BarChart3,
        roles: ["SUPER_ADMIN", "HR_MANAGER"],
      },
    ],
  },
  {
    title: "ผู้ดูแล",
    items: [
      {
        title: "ผู้ใช้งาน",
        href: "/users",
        icon: UserCog,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "จัดการแท็ก",
        href: "/tags",
        icon: Tag,
        roles: ["SUPER_ADMIN", "HR_MANAGER"],
      },
      {
        title: "ตั้งค่า AI",
        href: "/settings/ai",
        icon: Brain,
        roles: ["SUPER_ADMIN", "HR_MANAGER"],
      },
      {
        title: "การเชื่อมต่อ",
        href: "/integrations",
        icon: Plug,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "บันทึกกิจกรรม",
        href: "/audit-logs",
        icon: ShieldCheck,
        roles: ["SUPER_ADMIN"],
      },
    ],
  },
];
