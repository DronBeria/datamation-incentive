"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuotas, useUsers, QUERY_KEYS } from "@/lib/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Target, TrendingUp, TrendingDown, Loader2, Plus, BarChart3 } from "lucide-react";

function fmt(n: number) {
  if (!n) return "0";
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-IN");
}

function getStatus(pct: number) {
  if (pct >= 100) return { label: "Achieved", cls: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" };
  if (pct >= 80) return { label: "On Track", cls: "bg-blue-50 text-blue-700", bar: "bg-blue-500" };
  if (pct >= 60) return { label: "At Risk", cls: "bg-amber-50 text-amber-700", bar: "bg-amber-400" };
  return { label: "Behind", cls: "bg-red-50 text-red-700", bar: "bg-red-500" };
}

function thisMonth() {
  const n = new Date();
  return {
    start: new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split("T")[0],
    end: new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split("T")[0],
  };
}
function lastMonth() {
  const n = new Date();
  return {
    start: new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString().split("T")[0],
    end: new Date(n.getFullYear(), n.getMonth(), 0).toISOString().split("T")[0],
  };
}

function CircularProgress({ pct }: { pct: number }) {
  const size = 128; const r = (size - 14) / 2; const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const color = pct >= 100 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={10} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}

export default function QuotasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: quotas = [], isLoading } = useQuotas();
  const { data: allUsers = [] } = useUsers();
  const salespersons = (allUsers as any[]).filter((u: any) => u.role === "salesperson");

  const [period, setPeriod] = useState<"this" | "last" | "all">("this");
  const [spFilter, setSpFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ user_id: "", period_start: "", period_end: "", target_amount: "" });

  const isManager = user?.role === "admin" || user?.role === "manager";

  const filtered = useMemo(() => {
    let qs = quotas as any[];
    if (period === "this") { const r = thisMonth(); qs = qs.filter(q => q.period_start <= r.end && q.period_end >= r.start); }
    else if (period === "last") { const r = lastMonth(); qs = qs.filter(q => q.period_start <= r.end && q.period_end >= r.start); }
    if (spFilter !== "all") qs = qs.filter(q => q.user_id === spFilter);
    return qs;
  }, [quotas, period, spFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const avg = total > 0 ? Math.round(filtered.reduce((s: number, q: any) => s + q.attainment_pct, 0) / total) : 0;
    return { total, avg, onTrack: filtered.filter((q: any) => q.attainment_pct >= 80).length, behind: filtered.filter((q: any) => q.attainment_pct < 80).length };
  }, [filtered]);

  const handleSave = async () => {
    if (!form.user_id || !form.period_start || !form.period_end || !form.target_amount) { toast.error("All fields required"); return; }
    if (form.period_end < form.period_start) { toast.error("End date must be after start"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/quotas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, target_amount: parseFloat(form.target_amount) }) });
      if (res.ok) {
        toast.success("Quota saved");
        setShowCreate(false);
        setForm({ user_id: "", period_start: "", period_end: "", target_amount: "" });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.quotas() });
      } else { const d = await res.json().catch(() => ({})); toast.error(d?.error || "Failed to save quota"); }
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  };

  // ── Salesperson view ──────────────────────────────────────────
  if (!isManager) {
    const { start, end } = thisMonth();
    const current = (quotas as any[]).find(q => q.period_start <= end && q.period_end >= start);
    const history = (quotas as any[]).filter(q => !(q.period_start <= end && q.period_end >= start));
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-heading text-slate-900 tracking-tight">My Quota</h1><p className="text-sm text-slate-500 mt-1">Track your revenue targets and commission earnings</p></div>
        {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-600/40" /></div>
          : current ? (
            <>
              <Card className="p-8 border border-slate-100 shadow-sm bg-white rounded-2xl">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="relative shrink-0">
                    <CircularProgress pct={current.attainment_pct} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-heading text-slate-900 leading-none">{current.attainment_pct}%</span>
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Attained</span>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {[
                      { label: "Target", value: `₹${fmt(current.target_amount)}`, cls: "text-slate-900" },
                      { label: "Achieved", value: `₹${fmt(current.achieved_amount)}`, cls: "text-blue-600" },
                      { label: "Commission", value: `₹${fmt(current.commission_earned)}`, cls: "text-emerald-600" },
                      { label: "Remaining", value: `₹${fmt(Math.max(0, current.target_amount - current.achieved_amount))}`, cls: "text-amber-600" },
                    ].map(s => (
                      <div key={s.label} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                        <p className={`text-xl font-heading tracking-tight ${s.cls}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-6">
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${getStatus(current.attainment_pct).bar}`} style={{ width: `${Math.min(current.attainment_pct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-slate-400">0%</span>
                    <Badge variant="outline" className={`text-[9px] font-bold px-2 py-0.5 border-none ${getStatus(current.attainment_pct).cls}`}>{getStatus(current.attainment_pct).label}</Badge>
                    <span className="text-[10px] text-slate-400">100%</span>
                  </div>
                </div>
              </Card>
              {history.length > 0 && (
                <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-50"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Historical Quotas</p></div>
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50/50 border-none">{["Period", "Target", "Achieved", "Commission", "Attainment"].map(h => <TableHead key={h} className="py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                      {history.map((q: any) => {
                        const st = getStatus(q.attainment_pct);
                        return (
                          <TableRow key={q.id} className="border-b border-slate-50 hover:bg-slate-50/30">
                            <TableCell className="py-4 text-xs text-slate-600 font-medium">{q.period_start} → {q.period_end}</TableCell>
                            <TableCell className="text-sm font-semibold text-slate-900">₹{fmt(q.target_amount)}</TableCell>
                            <TableCell className="text-sm font-semibold text-blue-600">₹{fmt(q.achieved_amount)}</TableCell>
                            <TableCell className="text-sm font-semibold text-emerald-600">₹{fmt(q.commission_earned)}</TableCell>
                            <TableCell><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${st.bar}`} style={{ width: `${Math.min(q.attainment_pct, 100)}%` }} /></div><span className="text-xs font-bold text-slate-700">{q.attainment_pct}%</span></div></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </>
          ) : (
            <div className="py-20 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
              <Target className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">No quota set for this month</p>
              <p className="text-xs text-slate-400 mt-1">Contact your manager to set a revenue target</p>
            </div>
          )}
      </div>
    );
  }

  // ── Admin / Manager view ──────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-heading text-slate-900 tracking-tight">Quota Management</h1><p className="text-sm text-slate-500 mt-1">Set and track revenue targets for your sales team</p></div>
        <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold h-10 px-5 rounded-xl shadow-sm text-xs flex items-center gap-2"><Plus className="h-4 w-4" /> Set Quota</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Quotas", value: stats.total, icon: Target, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Avg Attainment", value: `${stats.avg}%`, icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "On Track (≥80%)", value: stats.onTrack, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Behind (<80%)", value: stats.behind, icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
        ].map((s, i) => (
          <Card key={i} className="p-5 border border-slate-100 shadow-sm bg-white rounded-2xl hover:shadow-md transition-all">
            <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-heading ${s.color} tracking-tight`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 border border-slate-100 shadow-sm bg-white rounded-2xl">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-100 rounded-xl">
            {(["this", "last", "all"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`h-8 px-4 rounded-lg text-xs font-bold transition-all ${period === p ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>
                {p === "this" ? "This Month" : p === "last" ? "Last Month" : "All Time"}
              </button>
            ))}
          </div>
          <Select value={spFilter} onValueChange={setSpFilter}>
            <SelectTrigger className="h-10 border-slate-200 bg-white rounded-xl text-xs font-semibold w-[180px]"><SelectValue placeholder="All Salespeople" /></SelectTrigger>
            <SelectContent className="rounded-xl border border-slate-200 shadow-xl bg-white">
              <SelectItem value="all" className="text-xs">All Salespeople</SelectItem>
              {salespersons.map((u: any) => <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-600/40" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
          <Target className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">No quotas found</p>
          <p className="text-xs text-slate-400 mt-1">Set quotas for your sales team to track performance</p>
        </div>
      ) : (
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 border-none">
                  {["Salesperson", "Period", "Target", "Achieved", "Commission", "Attainment", "Status"].map(h => (
                    <TableHead key={h} className="py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest first:pl-6 last:pr-6">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q: any) => {
                  const st = getStatus(q.attainment_pct);
                  return (
                    <TableRow key={q.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-all">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">{(q.full_name || "?")[0]}</div>
                          <div className="min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{q.full_name}</p><p className="text-[10px] text-slate-400 truncate">{q.email}</p></div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium whitespace-nowrap">{q.period_start} → {q.period_end}</TableCell>
                      <TableCell className="text-sm font-semibold text-slate-900">₹{fmt(q.target_amount)}</TableCell>
                      <TableCell className="text-sm font-semibold text-blue-600">₹{fmt(q.achieved_amount)}</TableCell>
                      <TableCell className="text-sm font-semibold text-emerald-600">₹{fmt(q.commission_earned)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${st.bar}`} style={{ width: `${Math.min(q.attainment_pct, 100)}%` }} /></div>
                          <span className="text-xs font-bold text-slate-700 tabular-nums w-10 text-right">{q.attainment_pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6">
                        <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border-none ${st.cls}`}>{st.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white">
          <div className="flex flex-col">
            <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center"><Target className="h-5 w-5 text-white" /></div>
              <div><DialogTitle className="text-base font-semibold text-slate-900">Set Revenue Quota</DialogTitle><p className="text-[11px] text-slate-400 mt-0.5">Updating an existing quota will replace it</p></div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Salesperson <span className="text-red-500">*</span></label>
                <Select value={form.user_id || undefined} onValueChange={v => setForm({ ...form, user_id: v })}>
                  <SelectTrigger className="h-10 border-slate-200 bg-white rounded-lg text-sm"><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white p-1">
                    {salespersons.map((u: any) => <SelectItem key={u.id} value={u.id} className="text-sm">{u.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[{ key: "period_start", label: "Period Start" }, { key: "period_end", label: "Period End" }].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">{f.label} <span className="text-red-500">*</span></label>
                    <Input type="date" value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="h-10 border-slate-200 bg-white rounded-lg text-sm" />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Target Amount (₹) <span className="text-red-500">*</span></label>
                <Input type="number" value={form.target_amount} placeholder="e.g. 500000" onChange={e => setForm({ ...form, target_amount: e.target.value })} className="h-10 border-slate-200 bg-white rounded-lg text-sm font-medium" />
                {form.target_amount && parseFloat(form.target_amount) > 0 && (
                  <p className="text-[11px] text-blue-600 font-medium">= ₹{parseFloat(form.target_amount).toLocaleString("en-IN")}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1 h-10 rounded-xl text-sm font-medium border-slate-200">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Quota"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
