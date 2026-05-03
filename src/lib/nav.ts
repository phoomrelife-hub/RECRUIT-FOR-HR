import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Briefcase,
  KanbanSquare,
  ClipboardList,
  Calendar,
  BarChart3,
  Settings,
  UserCog,
  Tag,
  Plug,
  ShieldCheck,
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
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
    ],
  },
  {
    title: "Recruitment",
    items: [
      {
        title: "Inbox",
        href: "/inbox",
        icon: MessageSquare,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
      {
        title: "Candidates",
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
        title: "Job Positions",
        href: "/jobs",
        icon: Briefcase,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
    ],
  },
  {
    title: "Process",
    items: [
      {
        title: "Screening",
        href: "/screening",
        icon: ClipboardList,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
      {
        title: "Interviews",
        href: "/interviews",
        icon: Calendar,
        roles: ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF"],
      },
    ],
  },
  {
    title: "Analytics",
    items: [
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        roles: ["SUPER_ADMIN", "HR_MANAGER"],
      },
    ],
  },
  {
    title: "Admin",
    items: [
      {
        title: "Users & Roles",
        href: "/users",
        icon: UserCog,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Tags",
        href: "/tags",
        icon: Tag,
        roles: ["SUPER_ADMIN", "HR_MANAGER"],
      },
      {
        title: "Integrations",
        href: "/integrations",
        icon: Plug,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Audit Logs",
        href: "/audit-logs",
        icon: ShieldCheck,
        roles: ["SUPER_ADMIN"],
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ["SUPER_ADMIN", "HR_MANAGER"],
      },
    ],
  },
];
