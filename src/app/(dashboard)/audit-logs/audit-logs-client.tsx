"use client";

import { useState, useEffect, useCallback } from "react";
import { AuditAction } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";

type AuditLogEntry = {
  id: string;
  action: AuditAction;
  targetId: string | null;
  targetType: string | null;
  detail: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
};

const ACTION_LABELS: Record<AuditAction, string> = {
  USER_LOGIN: "Login",
  VIEW_CANDIDATE: "View Candidate",
  EDIT_CANDIDATE: "Edit Candidate",
  SEND_MESSAGE: "Send Message",
  TAKEOVER_CONVERSATION: "Takeover Chat",
  RESUME_BOT: "Resume Bot",
  ASSIGN_HR: "Assign HR",
  CHANGE_CANDIDATE_STATUS: "Change Status",
  CREATE_INTERVIEW: "Create Interview",
  SUBMIT_INTERVIEW_FEEDBACK: "Interview Feedback",
  MAKE_HIRING_DECISION: "Hiring Decision",
  EXPORT_CANDIDATE: "Export Candidate",
  CREATE_USER: "Create User",
  UPDATE_USER: "Update User",
  DELETE_USER: "Delete User",
  CREATE_TAG: "Create Tag",
  UPDATE_TAG: "Update Tag",
  DELETE_TAG: "Delete Tag",
  CREATE_QUICK_REPLY: "Create Quick Reply",
  UPDATE_QUICK_REPLY: "Update Quick Reply",
  DELETE_QUICK_REPLY: "Delete Quick Reply",
  ADD_CANDIDATE_TAG: "Add Tag",
  REMOVE_CANDIDATE_TAG: "Remove Tag",
  ASSIGN_CANDIDATE: "Assign Candidate",
  UNASSIGN_CANDIDATE: "Unassign Candidate",
  DELETE_CANDIDATE_NOTE: "Delete Note",
  CREATE_SCREENING_FORM: "Create Screening Form",
  UPDATE_SCREENING_FORM: "Update Screening Form",
  DELETE_SCREENING_FORM: "Delete Screening Form",
  SUBMIT_SCREENING_ANSWERS: "Submit Screening",
  SCORE_CANDIDATE: "Score Candidate",
  GENERATE_AI_SUMMARY: "AI Summary",
  // Phase 11
  UPDATE_AI_PROVIDER: "Update AI Provider",
  UPDATE_AI_PERSONA: "Update AI Persona",
  UPDATE_AI_PROMPT: "Update AI Prompt",
  PUBLISH_AI_PROMPT: "Publish AI Prompt",
  RESTORE_AI_PROMPT: "Restore AI Prompt",
  UPDATE_AI_SCREENING_FLOW: "Update Screening Flow",
  UPDATE_AI_POSITION_RULE: "Update Position Rule",
  UPDATE_AI_FAQ: "Update AI FAQ",
  UPDATE_AI_TEMPLATE: "Update AI Template",
  UPDATE_AI_GUARDRAIL: "Update Guardrail",
  UPDATE_AI_HANDOFF_RULE: "Update Handoff Rule",
  UPDATE_AI_TAGGING_RULE: "Update Tagging Rule",
  UPDATE_AI_SCORING: "Update AI Scoring",
  UPDATE_AI_SUMMARY_TEMPLATE: "Update Summary Template",
  RUN_AI_PLAYGROUND: "Run AI Playground",
  UPDATE_AI_COST_LIMIT: "Update Cost Limit",
  UPDATE_AI_FALLBACK: "Update Fallback",
  UPDATE_AI_ROUTING: "Update AI Routing",
};

const ACTION_COLORS: Partial<Record<AuditAction, string>> = {
  USER_LOGIN: "bg-blue-100 text-blue-700",
  DELETE_USER: "bg-red-100 text-red-700",
  DELETE_TAG: "bg-red-100 text-red-700",
  DELETE_SCREENING_FORM: "bg-red-100 text-red-700",
  DELETE_CANDIDATE_NOTE: "bg-red-100 text-red-700",
  MAKE_HIRING_DECISION: "bg-purple-100 text-purple-700",
  CHANGE_CANDIDATE_STATUS: "bg-yellow-100 text-yellow-700",
  GENERATE_AI_SUMMARY: "bg-indigo-100 text-indigo-700",
  TAKEOVER_CONVERSATION: "bg-orange-100 text-orange-700",
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS) as AuditAction[];

type Props = {
  users: { id: string; name: string; email: string }[];
};

export default function AuditLogsClient({ users }: Props) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filterAction, setFilterAction] = useState("all");
  const [filterUserId, setFilterUserId] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const fetchLogs = useCallback(
    async (p: number) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p) });
      if (filterAction !== "all") params.set("action", filterAction);
      if (filterUserId !== "all") params.set("userId", filterUserId);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setLoading(false);
    },
    [filterAction, filterUserId, filterFrom, filterTo]
  );

  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [filterAction, filterUserId, filterFrom, filterTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLogs(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearFilters = () => {
    setFilterAction("all");
    setFilterUserId("all");
    setFilterFrom("");
    setFilterTo("");
  };

  const totalPages = Math.ceil(total / 50);
  const hasFilters =
    filterAction !== "all" || filterUserId !== "all" || filterFrom || filterTo;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Action</label>
            <Select
              value={filterAction}
              onValueChange={(v) => v && setFilterAction(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ALL_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">User</label>
            <Select
              value={filterUserId}
              onValueChange={(v) => v && setFilterUserId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
            <Input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
            <Input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {total.toLocaleString()} record{total !== 1 ? "s" : ""}
          </p>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-medium text-slate-700">Audit Trail</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchLogs(page)}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Target</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Detail</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    No audit logs found.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {log.user ? (
                      <div>
                        <p className="font-medium text-slate-800">{log.user.name}</p>
                        <p className="text-xs text-slate-400">{log.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {log.targetType && (
                      <span className="mr-1 font-medium text-slate-600">{log.targetType}</span>
                    )}
                    {log.targetId && (
                      <span className="font-mono text-slate-400">
                        {log.targetId.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-slate-500">
                    {log.detail ? (
                      <span className="block truncate font-mono">
                        {JSON.stringify(log.detail)}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-400">
                    {log.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
