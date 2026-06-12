"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { UserRole } from "@prisma/client";

interface DashboardShellProps {
  userName: string;
  userEmail: string;
  userRole: UserRole;
  children: React.ReactNode;
}

export function DashboardShell({ userName, userEmail, userRole, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <>
      <Sidebar userRole={userRole} isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <Topbar
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        onMenuClick={openSidebar}
      />

      <main className="md:ml-64 pt-16 min-h-screen">
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </>
  );
}
