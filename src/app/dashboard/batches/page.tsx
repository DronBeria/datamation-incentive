"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, CheckCircle2, Loader2,
  ChevronDown, Search, Download, FileText,
  List, ChevronLeft, ChevronRight as ChevRight,
  TrendingUp, Clock, Banknote, Layers, Calculator, ArrowRight, Info,
  Zap, ShieldCheck
} from "lucide-react";
import { syncToLocal } from "@/lib/hybrid-sync";
import { DateRangePicker } from "@/components/date-range-picker";
import { downloadCSV, downloadPDF } from "@/lib/export-utils";

// ── Status config ─────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; class: string; dot: string }> = {
  draft: { label: "Draft", class: "bg-slate-50 text-slate-500", dot: "bg-slate-300" },
  pending_approval: { label: "Pending", class: "bg-blue-50 text-blue-600", dot: "bg-blue-400" },
  approved: { label: "Approved", class: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  paid: { label: "Paid", class: "bg-blue-600 text-white", dot: "bg-white" },
  rejected: { label: "Rejected", class: "bg-red-50 text-red-600", dot: "bg-red-500" },
};

const BATCH_CSV_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "batch_name", label: "Batch Name" },
  { key: "status", label: "Status" },
  { key: "total_amount", label: "Total Amount" },
  { key: "created_by_name", label: "Created By" },
  { key: "created_at", label: "Created" },
];

// ── Calendar View ─────────────────────────────────────────────────
function CalendarView({ batches, onBatchClick }: { batches: any[]; onBatchClick: (b: any) => void }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const batchesByDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    batches.forEach(b => {
      const d = new Date(b.created_at || b.period_start);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(b);
      }
    });
    return map;
  }, [batches, viewYear, viewMonth]);

  const prevMonth = () => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y + 1)) : setViewMonth(m => m + 1);

  return (
    <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-8 py-6 border-b border-slate-50 bg-slate-50/30">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-9 w-9 rounded-xl border-slate-200">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-heading text-slate-900 min-w-[160px] text-center tracking-tight">
            {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(viewYear, viewMonth))}
          </h2>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-9 w-9 rounded-xl border-slate-200">
            <ChevRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="hidden md:block">
          <Badge variant="outline" className="px-4 py-1.5 rounded-xl border-slate-200 bg-white shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Monthly Total:</span>
            <span className="text-xs font-bold text-slate-900">₹{Object.values(batchesByDay).flat().reduce((s, b) => s + (b.total_amount || 0), 0).toLocaleString("en-IN")}</span>
          </Badge>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-50 bg-slate-50/10">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="min-h-[120px] border-b border-r border-slate-50 bg-slate-50/5" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayBatches = batchesByDay[day] || [];
          const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
          return (
            <div key={day} className={`min-h-[120px] p-3 border-b border-r border-slate-50 group transition-all ${isToday ? "bg-blue-50/20" : "bg-white"}`}>
              <span className={`text-[11px] font-bold h-7 w-7 rounded-lg flex items-center justify-center mb-2 ${isToday ? "bg-blue-600 text-white shadow-sm" : "text-slate-400"}`}>
                {day}
              </span>
              <div className="space-y-1">
                {dayBatches.slice(0, 3).map(b => (
                  <button key={b.id} onClick={() => onBatchClick(b)} className={`w-full text-left px-2 py-1 rounded-md text-[9px] font-bold truncate transition-all shadow-none border border-transparent ${STATUS_CONFIG[b.status]?.class} hover:opacity-80`}>
                    {b.batch_name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Batch detail modal ─────────────────────────────────────────────
function BatchDetailModal({ batch, onClose, user, onAction, actionLoading }: any) {
  if (!batch) return null;
  const cfg = STATUS_CONFIG[batch.status];
  return (
    <Dialog open={!!batch} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-3xl bg-white">
        <div className="bg-slate-900 p-8 text-white">
          <div className="flex items-center gap-4">
            <div className={`h-10 w-10 rounded-xl ${cfg.class} flex items-center justify-center shadow-sm`}>
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-heading tracking-tight leading-none">{batch.batch_name}</DialogTitle>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">ID: {batch.id} • {new Date(batch.created_at).toLocaleDateString()}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg border-none flex items-center gap-1.5 ${cfg.class}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </Badge>
          </div>
          {batch.rejection_reason && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <Info className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-100 font-medium">Rejection Reason: {batch.rejection_reason}</p>
            </div>
          )}
        </div>

        <div className="p-8 space-y-8">
          <Card className="p-6 bg-slate-50 border-slate-100 shadow-none rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Amount</p>
              <p className="text-3xl font-heading text-slate-900 tracking-tight leading-none">₹{batch.total_amount?.toLocaleString("en-IN")}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-2 uppercase tracking-tight">{batch.items?.length || 0} commissions included</p>
            </div>
            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
              <Banknote className="h-6 w-6 text-slate-400" />
            </div>
          </Card>

          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Entries</h3>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2">
              {batch.items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-100 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 tracking-tight">{item.salesperson_name}</p>
                    <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">{item.client_name || item.description}</p>
                  </div>
                  <p className="text-sm font-bold text-blue-600 tabular-nums">₹{item.amount?.toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => downloadPDF(`Batch Report: ${batch.batch_name}`, [{
              heading: "Batch Details",
              columns: [
                { key: "salesperson_name", label: "Beneficiary" },
                { key: "client_name", label: "Client" },
                { key: "amount", label: "Amount" },
              ],
              data: batch.items || [],
            }])} className="h-11 rounded-xl font-semibold text-slate-600 text-xs border-slate-200">
              <Download className="h-3.5 w-3.5 mr-2" /> Print PDF
            </Button>
            {batch.status === "draft" && (
              <Button onClick={() => onAction(batch.id, "submit")} disabled={actionLoading === batch.id} className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm font-bold text-sm">
                {actionLoading === batch.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for Approval"}
              </Button>
            )}
            {batch.status === "pending_approval" && user?.role === "admin" && (
              <>
                <Button onClick={() => onAction(batch.id, "approve")} disabled={actionLoading === batch.id} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm font-bold text-sm">
                  {actionLoading === batch.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve Batch"}
                </Button>
                <Button onClick={() => {
                  const reason = window.prompt("Reason for rejection:");
                  if (reason) onAction(batch.id, "reject", reason);
                }} disabled={actionLoading === batch.id} variant="outline" className="h-11 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-sm px-6">
                  Reject
                </Button>
              </>
            )}
            {batch.status === "approved" && (user?.role === "accounts" || user?.role === "admin") && (
              <Button onClick={() => onAction(batch.id, "mark_paid")} disabled={actionLoading === batch.id} className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm font-bold text-sm">
                {actionLoading === batch.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark as Paid"}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} className="h-11 rounded-xl font-semibold text-slate-500 text-xs px-6">Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Content ───────────────────────────────────────────────────
function BatchesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [salesLogs, setSalesLogs] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [batchName, setBatchName] = useState("");
  const [selectedLogs, setSelectedLogs] = useState<Set<number>>(new Set());
  const [logSearch, setLogSearch] = useState("");

  const filteredLogs = useMemo(() => {
    return salesLogs.filter(log =>
      (log.client_name || "").toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.salesperson_name || "").toLowerCase().includes(logSearch.toLowerCase())
    );
  }, [salesLogs, logSearch]);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    try {
      const res = await fetch(`/api/batches?${params.toString()}`);
      if (!res.ok) throw new Error("Connection lost");
      const data = await res.json();
      if (Array.isArray(data)) {
        setBatches(data);
        try { syncToLocal("incentive_batches", data); } catch (e) { console.warn("Local sync deferred", e); }
      }
    } catch (err) {
      console.error("Fetch batches error:", err);
      toast.error("Network connection unstable");
    } finally { setLoading(false); }
  }, [statusFilter, dateRange]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  useEffect(() => {
    if (showCreate) {
      fetch("/api/sales?status=earned")
        .then(async r => { if (!r.ok) throw new Error(); const d = await r.json(); if (Array.isArray(d)) setSalesLogs(d); })
        .catch(() => toast.error("Infrastructure lookup failed"));
    }
  }, [showCreate]);

  const handleAction = async (batchId: number, action: string, rejection_reason?: string) => {
    setActionLoading(batchId);
    try {
      const res = await fetch(`/api/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejection_reason })
      });
      if (res.ok) {
        toast.success("Batch lifecycle successfully updated");
        fetchBatches();
        setSelectedBatch(null);
      }
    } catch { toast.error("Action error"); }
    finally { setActionLoading(null); }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const items = selectedItemsSummary.items.map(l => ({
        salesperson_id: l.salesperson_id,
        sales_log_id: l.id,
        amount: l.calculated_commission,
        description: `Commission for ${l.client_name}`,
      }));
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_name: batchName, items }),
      });
      if (res.ok) {
        toast.success("Batch created successfully");
        setShowCreate(false);
        setBatchName("");
        setSelectedLogs(new Set());
        fetchBatches();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || "Failed to create batch — please try again");
      }
    } catch {
      toast.error("Network error — batch creation failed");
    } finally {
      setCreating(false);
    }
  };

  const selectedItemsSummary = useMemo(() => {
    const items = salesLogs.filter(l => selectedLogs.has(l.id));
    return { items, total: items.reduce((s, i) => s + i.calculated_commission, 0) };
  }, [salesLogs, selectedLogs]);

  const stats = useMemo(() => ({
    total: batches.length,
    pending: batches.filter(b => b.status === "pending_approval").length,
    activeValue: batches.filter(b => b.status !== "paid").reduce((s, b) => s + b.total_amount, 0),
  }), [batches]);

  const filtered = batches.filter(b => b.batch_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading text-slate-900 tracking-tight">Commission Batches</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and process periodic commission payouts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => downloadCSV(filtered, "batches", BATCH_CSV_COLUMNS)} variant="outline" className="h-10 rounded-xl border-slate-200 bg-white text-xs font-semibold shadow-sm hover:bg-slate-50">
            <Download className="h-3.5 w-3.5 mr-2" /> Export
          </Button>
          {(user?.role === "admin" || user?.role === "manager") && (
            <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold h-10 px-5 rounded-xl shadow-sm text-xs transition-all active:scale-95 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create Batch
            </Button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-start gap-4">
        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <Info className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-1">Manual Batching Workflow</p>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            Commissions move from <strong className="text-slate-900">Earned</strong> to <strong className="text-slate-900">Paid</strong> only when manually bundled into a batch. Finalized batches are immutable fiscal records.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Active Liability", value: `₹${fmt(stats.activeValue)}`, icon: Banknote, color: "text-blue-600", bg: "bg-blue-50/50" },
          { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50/50" },
          { label: "Total Batches", value: stats.total, icon: Layers, color: "text-slate-600", bg: "bg-slate-50/50" },
        ].map((s, i) => (
          <Card key={i} className="p-5 border border-slate-100 shadow-sm bg-white rounded-2xl group transition-all hover:bg-slate-50/30">
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                <p className="text-xl font-heading text-slate-900 mt-0.5">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4 border border-slate-100 shadow-sm bg-white rounded-2xl">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search batches by name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 border-slate-200 bg-slate-50/50 rounded-xl text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 border-slate-200 bg-white rounded-xl text-xs font-semibold px-4 w-full lg:w-[180px] shadow-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-slate-200 shadow-xl bg-white">
              <SelectItem value="all" className="text-xs">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-100 rounded-xl">
            <button onClick={() => setViewMode("list")} className={`h-8 px-4 rounded-lg text-xs font-bold transition-all ${viewMode === "list" ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>List</button>
            <button onClick={() => setViewMode("calendar")} className={`h-8 px-4 rounded-lg text-xs font-bold transition-all ${viewMode === "calendar" ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>Calendar</button>
          </div>
        </div>
      </Card>

      {/* Batch List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600/30" />
          <p className="text-xs font-semibold text-slate-400">Loading batches...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center bg-white border border-slate-100 border-dashed rounded-3xl">
          <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
            <Layers className="h-6 w-6 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-900">No batches found</p>
          <Button onClick={() => setSearch("")} variant="link" className="text-blue-600 text-xs mt-1">Clear filters</Button>
        </div>
      ) : viewMode === "calendar" ? (
        <CalendarView batches={filtered} onBatchClick={setSelectedBatch} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(batch => {
            const isExp = expandedId === batch.id;
            const cfg = STATUS_CONFIG[batch.status];
            return (
              <Card key={batch.id} className={`border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden transition-all duration-200 ${isExp ? "ring-1 ring-blue-100 shadow-md" : "hover:bg-slate-50/30"}`}>
                <div onClick={() => setExpandedId(isExp ? null : batch.id)} className="p-6 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-6 group">
                  <div className="flex items-center gap-6">
                    <div className={`h-14 w-14 rounded-xl flex items-center justify-center transition-all ${isExp ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"}`}>
                      <FileText className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-lg font-heading text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">{batch.batch_name}</h3>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                        <span className="text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">ID: {batch.id}</span>
                        <span className="opacity-30">•</span>
                        <span>{new Date(batch.created_at).toLocaleDateString()}</span>
                        <span className="opacity-30">•</span>
                        <span>{batch.created_by_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-10 justify-between lg:justify-end border-t lg:border-none pt-4 lg:pt-0 border-slate-50">
                    <div className="text-right">
                      <p className="text-xl font-heading text-slate-900 tracking-tight leading-none">₹{batch.total_amount?.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{batch.items?.length || 0} commissions</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg border-none flex items-center gap-1.5 ${cfg.class}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </Badge>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${isExp ? "bg-slate-900 text-white rotate-180" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"}`}>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                {isExp && (
                  <div className="bg-slate-50/50 border-t border-slate-100 p-6 pt-0">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mt-6">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-none">
                            <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beneficiary</TableHead>
                            <TableHead className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client / Description</TableHead>
                            <TableHead className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batch.items?.map((item: any) => (
                            <TableRow key={item.id} className="border-b border-slate-50 last:border-none hover:bg-blue-50/20 transition-all">
                              <TableCell className="px-6 py-4"><p className="font-semibold text-slate-900 text-sm">{item.salesperson_name}</p></TableCell>
                              <TableCell>
                                <p className="text-sm text-slate-600">{item.client_name || "Direct Commission"}</p>
                                <p className="text-[10px] font-medium text-slate-400 mt-1 truncate max-w-[200px]">{item.description}</p>
                              </TableCell>
                              <TableCell className="px-6 py-4 text-right"><p className="font-bold text-blue-600 tabular-nums">₹{item.amount?.toLocaleString("en-IN")}</p></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <BatchDetailModal batch={selectedBatch} onClose={() => setSelectedBatch(null)} user={user} onAction={handleAction} actionLoading={actionLoading} />

      {/* ── Create Batch Dialog ─────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[1300px] w-[98vw] p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white">
          <div className="flex flex-col h-[90vh] max-h-[900px]">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                  <Calculator className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-slate-900">Create Incentive Batch</DialogTitle>
                  <p className="text-xs text-slate-400 mt-0.5">Select approved commissions and give the batch a name</p>
                </div>
              </div>
              {selectedLogs.size > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-bold text-blue-700">
                    {selectedLogs.size} selected · ₹{selectedItemsSummary.total.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>

            {/* ── Body: 2-column layout ── */}
            <div className="flex flex-1 min-h-0">

              {/* LEFT: Commission list (60%) */}
              <div className="flex-[3] flex flex-col min-w-0 border-r border-slate-100">

                {/* Search + Select All toolbar */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by salesperson or client..."
                      value={logSearch}
                      onChange={e => setLogSearch(e.target.value)}
                      className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const visible = filteredLogs.map(l => l.id);
                      const allSelected = visible.length > 0 && visible.every(id => selectedLogs.has(id));
                      const next = new Set(selectedLogs);
                      if (allSelected) visible.forEach(id => next.delete(id));
                      else visible.forEach(id => next.add(id));
                      setSelectedLogs(next);
                    }}
                    className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all shrink-0 whitespace-nowrap"
                  >
                    {filteredLogs.length > 0 && filteredLogs.every(l => selectedLogs.has(l.id)) ? "Deselect All" : "Select All"}
                  </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                  {salesLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16 opacity-50">
                      <List className="h-10 w-10 text-slate-300 mb-3" />
                      <p className="text-sm font-semibold text-slate-600">No approved commissions available</p>
                      <p className="text-xs text-slate-400 mt-1">Commissions must be approved before batching</p>
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <p className="text-sm font-semibold text-slate-700">No results found</p>
                      <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredLogs.map(log => {
                        const active = selectedLogs.has(log.id);
                        return (
                          <div
                            key={log.id}
                            onClick={() => {
                              const next = new Set(selectedLogs);
                              active ? next.delete(log.id) : next.add(log.id);
                              setSelectedLogs(next);
                            }}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer select-none transition-all ${active
                              ? "bg-blue-50 border-blue-400 shadow-sm"
                              : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/80"
                              }`}
                          >
                            <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${active ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white"
                              }`}>
                              {active && <CheckCircle2 className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${active ? "text-blue-900" : "text-slate-900"}`}>
                                {log.client_name || "Direct Commission"}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {log.salesperson_name} · {log.sale_date}
                                {log.product && <span className="ml-1 text-slate-400">· {log.product}</span>}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-bold tabular-nums ${active ? "text-blue-700" : "text-slate-900"}`}>
                                ₹{log.calculated_commission?.toLocaleString("en-IN")}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide">commission</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer count */}
                <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
                  <span className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-900">{selectedLogs.size}</span> of {salesLogs.length} commissions selected
                  </span>
                  {selectedLogs.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedLogs(new Set())}
                      className="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </div>

              {/* RIGHT: Batch config (40%) */}
              <div className="flex-[2] flex flex-col min-w-0 bg-slate-50/30">

                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
                  {/* Batch name */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Batch Name <span className="text-red-500">*</span></label>
                    <Input
                      value={batchName}
                      onChange={e => setBatchName(e.target.value)}
                      placeholder="e.g. Feb 2026 – Direct Sales"
                      className="h-11 border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-900 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                    <p className="text-[11px] text-slate-400">This name will appear on all reports and notifications</p>
                  </div>

                  {/* Summary card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch Summary</p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Commissions selected</span>
                        <span className="text-sm font-bold text-slate-900">{selectedLogs.size}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Total payout</span>
                        <span className="text-base font-bold text-blue-600">₹{selectedItemsSummary.total.toLocaleString("en-IN")}</span>
                      </div>
                      {selectedItemsSummary.items.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-1.5 max-h-[160px] overflow-y-auto">
                          {selectedItemsSummary.items.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 truncate max-w-[150px]">{item.salesperson_name}</span>
                              <span className="text-slate-900 font-medium tabular-nums ml-2 shrink-0">₹{item.calculated_commission?.toLocaleString("en-IN")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                    <div className="flex items-start gap-3">
                      <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-amber-700">What happens next?</p>
                        <p className="text-[11px] text-amber-600 leading-relaxed">
                          Selected commissions will move from <strong>Approved</strong> to <strong>Accrued</strong> status. The batch enters a <strong>Draft</strong> state and must be submitted for admin approval before payment.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="px-6 py-5 border-t border-slate-100 bg-white flex flex-col gap-3 shrink-0">
                  <Button
                    onClick={handleCreate}
                    disabled={creating || selectedLogs.size === 0 || !batchName.trim()}
                    className="h-11 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm disabled:opacity-40 transition-all"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : `Create Batch (${selectedLogs.size} items)`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreate(false)}
                    className="h-10 w-full rounded-xl text-sm font-medium text-slate-600 border-slate-200 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BatchesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <BatchesContent />
    </Suspense>
  );
}

function fmt(n: number) {
  if (!n) return "0";
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-IN");
}

