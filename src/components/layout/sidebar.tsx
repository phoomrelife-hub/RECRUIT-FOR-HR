"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { navSections } from "@/lib/nav";
import { UserRole } from "@prisma/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  userRole: UserRole;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const [inboxUnread, setInboxUnread] = useState(0);

  useEffect(() => {
    async function fetchUnread() {
      try {
        const res = await fetch("/api/conversations/unread-count");
        if (!res.ok) return;
        const data = await res.json();
        setInboxUnread(data.total ?? 0);
      } catch {}
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(userRole)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <span className="text-sm font-bold text-white">R</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Relife Recruit</p>
            <p className="text-xs text-slate-500">ATS System</p>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-4rem)]">
        <nav className="px-3 py-4">
          {filteredSections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-blue-600" : "text-slate-400"
                          )}
                        />
                        {item.title}
                        {item.href === "/inbox" && inboxUnread > 0 ? (
                          <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white min-w-[18px] text-center">
                            {inboxUnread}
                          </span>
                        ) : item.badge ? (
                          <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
