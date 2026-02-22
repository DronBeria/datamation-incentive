"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { syncToLocal } from "@/lib/hybrid-sync";
import { downloadCSV } from "@/lib/export-utils";
import {
  Plus, Loader2, Search, CheckCircle2, XCircle, MoreHorizontal,
  ShoppingCart, TrendingUp, Clock, Banknote, Download, Info,
  Eye, ArrowRight, User, Package, Sparkles, Target,
} from "lucide-react";
import { DateRangePicker } from "@/components/date-range-picker";

const STATUS_MAP: Record<string, { label: string; class: string; dot: string }> = {
  pending_review: { label: "Review Required", class: "bg-amber-50 text-amber-600 border-amber-100", dot: "bg-amber-400" },
  earned: { label: "Approved", class: "bg-emerald-50 text-emerald-600 border-emerald-100", dot: "bg-emerald-500" },
  accrued: { label: "Batched", class: "bg-blue-50 text-blue-600 border-blue-100", dot: "bg-blue-400" },
  paid: { label: "Paid", class: "bg-slate-50 text-slate-500 border-slate-100", dot: "bg-slate-300" },
  rejected: { label: "Rejected", class: "bg-red-50 text-red-600 border-red-100", dot: "bg-red-500" },
};

const SALES_CSV_COLUMNS = [
  { key: "client_name", label: "Client" },
  { key: "salesperson_name", label: "Salesperson" },
  { key: "product", label: "Product" },
  { key: "deal_value", label: "Deal Value" },
  { key: "quantity", label: "Qty" },
  { key: "calculated_commission", label: "Commission" },
  { key: "sale_date", label: "Sale Date" },
  { key: "status", label: "Status" },
  { key: "scheme_name", label: "Scheme" },
];

export default function SalesPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [detailLog, setDetailLog] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [form, setForm] = useState({
    salesperson_id: "", client_name: "", deal_value: "", product: "",
    sale_date: "", notes: "", quantity: "1",
    is_custom: false, custom_commission: "", scheme_id: "",
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set("from", dateRange.from);
      if (dateRange.to) params.set("to", dateRange.to);
      const qs = params.toString();
      const res = await fetch(`/api/sales${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Connection lost");
      const d = await res.json();
      if (Array.isArray(d)) {
        setLogs(d);
        try { syncToLocal("sales_logs", d); } catch (e) { console.warn("Local sync deferred", e); }
      }
    } catch (err) {
      console.error("Fetch sales logs error:", err);
      toast.error("Network connection unstable");
    } finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => {
    fetchLogs();
    fetch("/api/users")
      .then(async r => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (Array.isArray(d)) setUsers(d.filter((u: any) => u.role === "salesperson"));
      })
      .catch(() => { });

    fetch("/api/schemes")
      .then(async r => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (Array.isArray(d)) setSchemes(d);
      })
      .catch(() => { });
  }, [fetchLogs]);

  const handleCreate = async () => {
    if (!form.client_name || !form.deal_value || !form.sale_date) {
      toast.error("Required fields missing"); return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          deal_value: parseFloat(form.deal_value),
          quantity: parseFloat(form.quantity),
          custom_commission: form.is_custom ? parseFloat(form.custom_commission) : undefined,
          scheme_id: (form.scheme_id && form.scheme_id !== "none") ? parseInt(form.scheme_id) : undefined,
          salesperson_id: user?.role === "salesperson" ? user.id : form.salesperson_id,
        }),
      });
      if (res.ok) {
        toast.success("Deal successfully archived");
        setShowCreate(false);
        setForm({ salesperson_id: "", client_name: "", deal_value: "", product: "", sale_date: "", notes: "", quantity: "1", is_custom: false, custom_commission: "", scheme_id: "" });
        fetchLogs();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Submission rejected by server");
      }
    } catch (err: any) {
      toast.error("Network synchronization failed");
    }
    finally { setCreating(false); }
  };

  const handleReview = async (logId: string, action: "approve" | "reject") => {
    setReviewing(logId);
    try {
      const res = await fetch(`/api/sales/${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) { toast.success(`Transaction successfully ${action}d`); fetchLogs(); }
    } catch { toast.error("Review failed"); }
    finally { setReviewing(null); }
  };

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch =
        l.client_name.toLowerCase().includes(search.toLowerCase()) ||
        (l.product || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.salesperson_name || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [logs, search, statusFilter]);

  const stats = useMemo(() => ({
    total: logs.length,
    pending: logs.filter(l => l.status === "pending_review").length,
    totalValue: logs.filter(l => ["earned", "accrued", "paid"].includes(l.status)).reduce((s, l) => s + l.deal_value, 0),
    totalComm: logs.filter(l => ["earned", "accrued", "paid"].includes(l.status)).reduce((s, l) => s + l.calculated_commission, 0),
  }), [logs]);

  const isManager = ["admin", "manager"].includes(user?.role || "");

  const handleExport = () => {
    if (!filtered.length) return toast.error("No data available");
    downloadCSV(filtered.map(l => ({ ...l, status: STATUS_MAP[l.status]?.label || l.status })), "revenue_stream", SALES_CSV_COLUMNS);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading text-slate-900 tracking-tight">Sales Records</h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage individual sales transactions and commissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExport} variant="outline" className="h-10 rounded-xl border-slate-200 bg-white text-xs font-semibold shadow-sm hover:bg-slate-50">
            <Download className="h-3.5 w-3.5 mr-2" /> Export
          </Button>
          <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold h-10 px-5 rounded-xl shadow-sm text-xs transition-all active:scale-95 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Log Sale
          </Button>
        </div>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Sales", value: stats.total, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50/50", sub: "Total deals" },
          { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50/50", sub: "Awaiting approval" },
          { label: "Revenue", value: `₹${fmt(stats.totalValue)}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50/50", sub: "Net revenue" },
          { label: "Commissions", value: `₹${fmt(stats.totalComm)}`, icon: Banknote, color: "text-purple-600", bg: "bg-purple-50/50", sub: "Total incentives" },
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

      {/* Filters Hub */}
      <Card className="p-4 border border-slate-100 shadow-sm bg-white rounded-2xl">
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="relative flex-[2]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search client, product or staff..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 border-slate-200 bg-slate-50/50 rounded-xl text-sm" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 flex-[3]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 border-slate-200 bg-white rounded-xl text-xs font-semibold px-4 w-full sm:w-[180px] shadow-sm">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-slate-200 shadow-xl bg-white">
                <SelectItem value="all" className="text-xs">All Status</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </div>
      </Card>

      {/* Main Ledger */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600/30" />
          <p className="text-xs font-semibold text-slate-400">Loading sales records...</p>
        </div>
      ) : (
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-none">
                  <TableHead className="py-5 pl-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client / Salesperson</TableHead>
                  <TableHead className="py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product / Units</TableHead>
                  <TableHead className="py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deal Value</TableHead>
                  <TableHead className="py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Commission</TableHead>
                  <TableHead className="py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</TableHead>
                  <TableHead className="py-5 pr-8 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
                          <ShoppingCart className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">No records found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.map(log => {
                  const cfg = STATUS_MAP[log.status];
                  return (
                    <TableRow key={log.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-none">
                      <TableCell className="pl-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-blue-100 group-hover:text-blue-600 transition-all shadow-sm">
                            <User className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 tracking-tight text-sm truncate">{log.client_name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                              {log.sale_date} <span className="h-1 w-1 rounded-full bg-slate-300" /> {log.salesperson_name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-slate-700 tracking-tight text-sm">{log.product || "General Assets"}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Qty: {log.quantity || 1}</p>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900 tabular-nums text-sm">₹{log.deal_value.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right">
                        <p className="font-bold text-blue-600 tabular-nums text-sm">₹{log.calculated_commission.toLocaleString("en-IN")}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[120px] ml-auto">{log.scheme_name || (log.is_custom ? "Override" : "Standard")}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border-none flex w-fit items-center gap-1.5 ${cfg.class}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        {log.status === "pending_review" && isManager ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" onClick={() => handleReview(log.id, "approve")} disabled={!!reviewing}
                              className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm">
                              {reviewing === log.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleReview(log.id, "reject")} disabled={!!reviewing}
                              className="h-8 w-8 p-0 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDetailLog(log)}
                              className="h-8 w-8 p-0 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-lg">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg">
                                <MoreHorizontal className="h-4 w-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl border-slate-200 shadow-xl bg-white">
                              <DropdownMenuItem onClick={() => setDetailLog(log)} className="rounded-lg text-xs font-semibold py-2 cursor-pointer">
                                <Info className="h-3.5 w-3.5 mr-2 text-slate-400" /> View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 0 && (
            <div className="px-8 py-5 border-t border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filtered.length} Entries matching search</p>
              </div>
              <div className="flex items-center gap-6 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Payout</p>
                  <p className="text-base font-bold text-blue-600 tabular-nums leading-none">₹{filtered.reduce((s, l) => s + l.calculated_commission, 0).toLocaleString("en-IN")}</p>
                </div>
                <div className="h-6 w-[1px] bg-slate-100" />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Value</p>
                  <p className="text-base font-bold text-slate-900 tabular-nums leading-none">₹{fmt(filtered.reduce((s, l) => s + l.deal_value, 0))}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Detail Overlay */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-3xl bg-white">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="relative z-10">
              <Badge variant="outline" className={`mb-4 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg border-none ${detailLog ? STATUS_MAP[detailLog.status]?.class : ''}`}>
                Transaction Blueprint
              </Badge>
              <DialogTitle className="text-2xl font-heading tracking-tight leading-none mb-2">{detailLog?.client_name}</DialogTitle>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {detailLog?.id} • {detailLog?.sale_date}</p>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Salesperson", val: detailLog?.salesperson_name, icon: User },
                { label: "Product", val: detailLog?.product || "General", icon: Package },
                { label: "Items", val: detailLog?.quantity || 1, icon: ShoppingCart },
                { label: "Scheme", val: detailLog?.scheme_name || "Standard", icon: Target },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm"><item.icon className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold text-slate-900 truncate tracking-tight">{item.val}</p>
                  </div>
                </div>
              ))}
            </div>

            <Card className="p-6 bg-slate-50 border-slate-100 shadow-none rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Net Commission</p>
                <p className="text-3xl font-heading text-blue-600 tracking-tight leading-none">₹{detailLog?.calculated_commission.toLocaleString("en-IN")}</p>
                <p className="text-[10px] font-medium text-slate-400 mt-2 uppercase tracking-tight">Derived from ₹{detailLog?.deal_value.toLocaleString("en-IN")} GTV</p>
              </div>
              <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                <Banknote className="h-6 w-6 text-slate-400" />
              </div>
            </Card>

            {detailLog?.notes && (
              <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100/50">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">Note</p>
                <p className="text-xs font-medium text-slate-600 italic">"{detailLog.notes}"</p>
              </div>
            )}

            <Button onClick={() => setDetailLog(null)} className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-xs transition-all active:scale-95">
              Dismiss Details
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Creation Wizard */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[860px] w-[95vw] p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white">
          <div className="flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 shrink-0">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-900">Log New Sale</DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">Fill in the transaction details — commission is calculated automatically</p>
              </div>
            </div>

            {/* Form body */}
            <div className="overflow-y-auto custom-scrollbar">
              <div className="px-8 py-6 space-y-6">

                {/* Row 1: Salesperson (if manager/admin) + Client */}
                <div className={`grid gap-5 ${user?.role !== "salesperson" ? "grid-cols-2" : "grid-cols-1"}`}>
                  {user?.role !== "salesperson" && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Salesperson <span className="text-red-500">*</span></label>
                      <Select value={form.salesperson_id || undefined} onValueChange={v => setForm({ ...form, salesperson_id: v })}>
                        <SelectTrigger className="h-11 border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 focus:ring-blue-500/20 focus:border-blue-400">
                          <SelectValue placeholder="Select salesperson" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white">
                          {users.map(u => (
                            <SelectItem key={u.id} value={String(u.id)} className="text-sm">
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                {u.full_name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Client Name <span className="text-red-500">*</span></label>
                    <Input
                      value={form.client_name}
                      onChange={e => setForm({ ...form, client_name: e.target.value })}
                      placeholder="e.g. Tata Motors, Reliance Industries"
                      className="h-11 border-slate-200 bg-white rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Row 2: Deal Value + Quantity */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Deal Value (₹) <span className="text-red-500">*</span></label>
                    <Input
                      type="number"
                      value={form.deal_value}
                      onChange={e => setForm({ ...form, deal_value: e.target.value })}
                      placeholder="e.g. 500000"
                      className="h-11 border-slate-200 bg-white rounded-lg text-sm font-semibold tabular-nums"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Quantity</label>
                    <Input
                      type="number"
                      value={form.quantity}
                      onChange={e => setForm({ ...form, quantity: e.target.value })}
                      placeholder="1"
                      className="h-11 border-slate-200 bg-white rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Row 3: Product + Sale Date */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Product / Service</label>
                    <Input
                      value={form.product}
                      onChange={e => setForm({ ...form, product: e.target.value })}
                      placeholder="e.g. Enterprise Suite, Hardware"
                      className="h-11 border-slate-200 bg-white rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Sale Date <span className="text-red-500">*</span></label>
                    <Input
                      type="date"
                      value={form.sale_date}
                      onChange={e => setForm({ ...form, sale_date: e.target.value })}
                      className="h-11 border-slate-200 bg-white rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Commission Override (manager/admin only) */}
                {isManager && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Commission Override</p>
                        <p className="text-xs text-blue-600 mt-0.5">Manually set commission or pick a specific scheme</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, is_custom: !form.is_custom })}
                        className={`h-8 px-4 rounded-lg text-xs font-semibold transition-all border ${form.is_custom
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                          }`}
                      >
                        {form.is_custom ? "Manual Amount" : "Auto Calculate"}
                      </button>
                    </div>

                    {!form.is_custom ? (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">Commission Scheme</label>
                        <Select value={form.scheme_id || undefined} onValueChange={v => setForm({ ...form, scheme_id: v })}>
                          <SelectTrigger className="h-10 bg-white border-slate-200 rounded-lg text-sm">
                            <SelectValue placeholder="Auto-assign by scheme" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white">
                            <SelectItem value="none" className="text-sm">Auto-assign (default scheme)</SelectItem>
                            {schemes.map(s => (
                              <SelectItem key={s.id} value={String(s.id)} className="text-sm">
                                {s.name} — {(s.base_rate * 100).toFixed(1)}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">Fixed Commission Amount (₹)</label>
                        <Input
                          type="number"
                          value={form.custom_commission}
                          onChange={e => setForm({ ...form, custom_commission: e.target.value })}
                          placeholder="Enter exact commission amount"
                          className="h-10 border-slate-200 bg-white rounded-lg text-sm font-semibold text-blue-600 tabular-nums"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Notes</label>
                  <Input
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="Optional — audit notes, references, special terms..."
                    className="h-11 border-slate-200 bg-white rounded-lg text-sm text-slate-600"
                  />
                </div>

                {/* Commission preview */}
                {form.deal_value && (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500">Deal Value</p>
                      <p className="text-sm font-semibold text-slate-900">₹{Number(form.deal_value).toLocaleString("en-IN")}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Est. Commission</p>
                      <p className="text-sm font-bold text-blue-600">
                        {form.is_custom && form.custom_commission
                          ? `₹${Number(form.custom_commission).toLocaleString("en-IN")}`
                          : "Auto-calculated on submit"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-white shrink-0">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="h-10 px-5 rounded-lg text-sm font-medium border-slate-200">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm shadow-sm disabled:opacity-50 transition-all"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log Sale"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmt(n: number) {
  if (!n) return "0";
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-IN");
}
