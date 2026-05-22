"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut, User, MessageSquare, Bot, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserRole } from "@prisma/client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

interface TopbarProps {
  userName: string;
  userEmail: string;
  userRole: UserRole;
  onMenuClick?: () => void;
}

const roleBadgeMap: Record<UserRole, { label: string; variant: "default" | "secondary" | "outline" }> = {
  SUPER_ADMIN: { label: "Super Admin", variant: "default" },
  HR_MANAGER: { label: "HR Manager", variant: "secondary" },
  HR_STAFF: { label: "HR Staff", variant: "outline" },
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface UnreadConv {
  id: string;
  unreadCount: number;
  lastMessageAt: string | null;
  channel: string;
  botEnabled: boolean;
  candidate: {
    fullName: string | null;
    nickname: string | null;
    lineDisplayName: string | null;
    lineProfilePicUrl: string | null;
  };
}

function candidateName(c: UnreadConv["candidate"]) {
  return c.fullName ?? c.lineDisplayName ?? c.nickname ?? "ไม่ระบุชื่อ";
}

export function Topbar({ userName, userEmail, userRole, onMenuClick }: TopbarProps) {
  const { label, variant } = roleBadgeMap[userRole];
  const [unreadConvs, setUnreadConvs] = useState<UnreadConv[]>([]);
  const [bellOpen, setBellOpen] = useState(false);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations/unread-count");
      if (!res.ok) return;
      const data = await res.json();
      setUnreadConvs((data.conversations ?? []).slice(0, 10));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 20000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const totalUnread = unreadConvs.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:left-64 md:px-6">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="เปิดเมนู"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <DropdownMenu open={bellOpen} onOpenChange={setBellOpen}>
          <DropdownMenuTrigger render={
            <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-700">
              <Bell className="h-5 w-5" />
              {totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Button>
          } />
          <DropdownMenuContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">
                ข้อความที่ยังไม่อ่าน
                {totalUnread > 0 && (
                  <span className="ml-1.5 text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5 font-bold">
                    {totalUnread}
                  </span>
                )}
              </p>
              <Link
                href="/inbox"
                className="text-xs text-blue-600 hover:underline font-medium"
                onClick={() => setBellOpen(false)}
              >
                ดูทั้งหมด
              </Link>
            </div>

            {unreadConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
                <Bell className="h-6 w-6 opacity-30" />
                <p className="text-xs">ไม่มีข้อความใหม่</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                {unreadConvs.map((conv) => (
                  <Link
                    key={conv.id}
                    href="/inbox"
                    onClick={() => setBellOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    {conv.candidate.lineProfilePicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={conv.candidate.lineProfilePicUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-600">
                        {candidateName(conv.candidate).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {candidateName(conv.candidate)}
                        </p>
                        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {!conv.botEnabled && (
                          <span className="text-[10px] text-orange-500 font-medium flex items-center gap-0.5">
                            <User className="h-2.5 w-2.5" />HR
                          </span>
                        )}
                        {conv.botEnabled && (
                          <span className="text-[10px] text-indigo-500 font-medium flex items-center gap-0.5">
                            <Bot className="h-2.5 w-2.5" />Bot
                          </span>
                        )}
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-slate-400">
                            {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, locale: th })}
                          </span>
                        )}
                      </div>
                    </div>
                    <MessageSquare className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}

            <div className="border-t border-slate-100 px-4 py-2.5">
              <Link
                href="/inbox"
                onClick={() => setBellOpen(false)}
                className="block text-center text-xs text-blue-600 hover:underline font-medium"
              >
                เปิด Inbox →
              </Link>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 transition-colors cursor-pointer">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-sm font-medium text-slate-900">{userName}</p>
              <Badge variant={variant} className="text-xs h-4 px-1.5">
                {label}
              </Badge>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">{userName}</p>
              <p className="text-xs font-normal text-slate-500">{userEmail}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
