"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Activity, Search, Download, Clock, User, Target, Layers, ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { downloadCSV, exportToExcel, exportToPDF } from "@/lib/export-utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const ACTION_CONFIG: Record<string, { dot: string; label: string; bg: string }> = {
  LOGIN: { label: "Session Init", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-600" },
  LOGOUT: { label: "Terminated", dot: "bg-slate-400", bg: "bg-slate-50 text-slate-500" },
  CREATE: { label: "New Entity", dot: "bg-blue-500", bg: "bg-blue-50 text-blue-600" },
  UPDATE: { label: "Modified", dot: "bg-amber-500", bg: "bg-amber-50 text-amber-600" },
  APPROVE: { label: "Validated", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-600" },
  REJECT: { label: "Denied", dot: "bg-red-500", bg: "bg-red-50 text-red-600" },
  DELETE: { label: "Purged", dot: "bg-red-600", bg: "bg-red-50 text-red-600" },
  SUBMIT: { label: "Committed", dot: "bg-blue-400", bg: "bg-blue-50 text-blue-500" },
  MARK_PAID: { label: "Settlement", dot: "bg-indigo-500", bg: "bg-indigo-50 text-indigo-600" },
  PASSWORD_RESET: { label: "Key Reset", dot: "bg-purple-500", bg: "bg-purple-50 text-purple-600" },
  FAILED_LOGIN: { label: "Violation", dot: "bg-red-600", bg: "bg-red-50 text-red-700" },
};

const AUDIT_CSV_COLUMNS = [
  { key: "timestamp", label: "Timestamp" },
  { key: "actor", label: "Actor" },
  { key: "action", label: "Action" },
  { key: "entity", label: "Entity" },
  { key: "entity_id", label: "Entity ID" },
  { key: "old_value", label: "Old Value" },
  { key: "new_value", label: "New Value" },
];

const PAGE_SIZE = 25;

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchAudit = async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/audit");
        const d = await r.json();
        if (Array.isArray(d)) setLogs(d);
      } catch (err) {
        toast.error("Audit stream disconnected");
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = (l.full_name || "System").toLowerCase().includes(search.toLowerCase()) ||
        (l.action || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.entity_type || "").toLowerCase().includes(search.toLowerCase());
      const matchAction = actionFilter === "all" || l.action === actionFilter;
      return matchSearch && matchAction;
    });
  }, [logs, search, actionFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const actions = useMemo(() => [...new Set(logs.map(l => l.action).filter(Boolean))], [logs]);

  const handleExportCSV = () => {
    if (!filtered.length) return toast.error("No stream events to export");
    downloadCSV(filtered.map(l => ({
      timestamp: new Date(l.created_at).toLocaleString(),
      actor: l.full_name || "System",
      action: l.action,
      entity: l.entity_type?.replace(/_/g, " "),
      entity_id: l.entity_id,
      old_value: l.old_value || "—",
      new_value: l.new_value || "—",
    })), "system_audit_trail", AUDIT_CSV_COLUMNS);
  };

  const handleExportExcel = () => {
    if (!filtered.length) return toast.error("No stream events to export");
    exportToExcel(filtered.map(l => ({
      timestamp: new Date(l.created_at).toLocaleString(),
      actor: l.full_name || "System",
      action: l.action,
      entity: l.entity_type?.replace(/_/g, " "),
      entity_id: l.entity_id,
      old_value: l.old_value || "—",
      new_value: l.new_value || "—",
    })), "system_audit_trail", AUDIT_CSV_COLUMNS);
  };

  const handleExportPDF = () => {
    if (!filtered.length) return toast.error("No stream events to export");
    exportToPDF("System Audit Trail Report", AUDIT_CSV_COLUMNS, filtered.map(l => ({
      timestamp: new Date(l.created_at).toLocaleString(),
      actor: l.full_name || "System",
      action: l.action,
      entity: l.entity_type?.replace(/_/g, " "),
      entity_id: l.entity_id,
      old_value: l.old_value || "—",
      new_value: l.new_value || "—",
    })), "audit_ledger");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading text-slate-900 tracking-tight">Activity Logs</h1>
          <p className="text-sm text-slate-500 mt-1">A detailed timeline of all actions and changes within the system.</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 px-4 rounded-xl text-xs font-semibold text-slate-600 border-slate-200 bg-white">
                <Download className="h-3.5 w-3.5 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-lg border border-slate-100 bg-white">
              <DropdownMenuItem onClick={handleExportCSV} className="h-10 rounded-lg text-xs font-medium text-slate-600 cursor-pointer focus:bg-slate-50">
                CSV Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="h-10 rounded-lg text-xs font-medium text-slate-600 cursor-pointer focus:bg-slate-50">
                Excel Spreadsheet
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="h-10 rounded-lg text-xs font-medium text-slate-600 cursor-pointer focus:bg-slate-50">
                PDF Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2.5 px-3.5 h-10 rounded-xl bg-slate-900 shadow-sm">
            <Activity className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-white tracking-wide">{logs.length} Total Events</span>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "System Status", value: "Optimal", icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Records Updated", value: logs.filter(l => ["CREATE", "UPDATE", "DELETE"].includes(l.action)).length, icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Approvals", value: logs.filter(l => l.action === "APPROVE").length, icon: Target, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Active Users", value: new Set(logs.map(l => l.full_name)).size, icon: User, color: "text-cyan-600", bg: "bg-cyan-50" },
        ].map((s, i) => (
          <Card key={i} className="p-5 border border-slate-100 shadow-sm bg-white rounded-2xl group relative overflow-hidden transition-all hover:shadow-md">
            <div className="relative z-10">
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center mb-3 transition-transform group-hover:scale-110 shadow-sm border border-slate-100/50`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-2">{s.label}</p>
              <p className="text-2xl font-heading text-slate-900 leading-none tracking-tight">{s.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters Hub */}
      <Card className="p-4 border border-slate-100 shadow-sm bg-white rounded-2xl">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-[3]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by actor, action or resource..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 h-10 border-slate-100 bg-slate-50/50 rounded-xl text-sm focus-visible:ring-blue-600 shadow-none border"
            />
          </div>
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="h-10 border-slate-100 bg-slate-50/50 rounded-xl text-xs font-semibold px-4 flex-1">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-slate-100 shadow-lg p-1 bg-white">
              <SelectItem value="all" className="rounded-lg text-xs font-medium">All Actions</SelectItem>
              {actions.map(a => (
                <SelectItem key={a} value={a} className="rounded-lg text-xs font-medium">{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Activity Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600/30" />
          <p className="text-xs font-semibold text-slate-400">Loading audit trail...</p>
        </div>
      ) : (
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 border-none">
                  <TableHead className="py-4 pl-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Time</TableHead>
                  <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">User</TableHead>
                  <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Action</TableHead>
                  <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Resource</TableHead>
                  <TableHead className="py-4 pr-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <Activity className="h-8 w-8 text-slate-200" />
                        <p className="text-sm font-semibold text-slate-900">No events found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginated.map(log => {
                  const cfg = ACTION_CONFIG[log.action] || { label: log.action, dot: "bg-slate-300", bg: "bg-slate-50 text-slate-400" };
                  const date = new Date(log.created_at);
                  return (
                    <TableRow key={log.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-none">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="px-2 py-1 rounded bg-slate-100 text-[10px] font-bold text-slate-600 tabular-nums">
                            {date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-slate-900 tabular-nums">
                              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm capitalize">
                            {log.full_name ? log.full_name[0] : "S"}
                          </div>
                          <span className="font-semibold text-slate-900 text-sm tracking-tight">{log.full_name || "System"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border-none ${cfg.bg}`}>
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <p className="text-xs font-semibold text-slate-700 capitalize">{log.entity_type?.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-slate-400">ID: {log.entity_id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {(log.old_value || log.new_value) ? (
                          <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                            <span className="max-w-[100px] truncate text-[10px] font-medium text-slate-400 italic">{log.old_value || "—"}</span>
                            <ArrowRight className="h-2.5 w-2.5 text-slate-300" />
                            <span className="max-w-[100px] truncate text-[10px] font-semibold text-blue-600">{log.new_value || "—"}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Log Entry</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Page {page} of {Math.max(totalPages, 1)}
            </p>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white border-slate-200 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(3, totalPages))].map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={i}
                      onClick={() => setPage(pNum)}
                      className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${page === pNum ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <Button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white border-slate-200 disabled:opacity-30"
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
