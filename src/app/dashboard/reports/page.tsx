"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, TrendingUp, Award, BarChart2, Sparkles, Target, ArrowUpRight, Crown, Clock, FileText } from "lucide-react";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { downloadCSV, downloadPDF } from "@/lib/export-utils";

const PALETTE = ["#2563eb", "#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"];

const STATUS_BADGE: Record<string, { label: string; class: string; dot: string }> = {
  draft: { label: "Draft", class: "bg-slate-50 text-slate-400 border-none", dot: "bg-slate-300" },
  pending_approval: { label: "Pending", class: "bg-amber-50 text-amber-600 border-none", dot: "bg-amber-400" },
  approved: { label: "Approved", class: "bg-emerald-50 text-emerald-600 border-none", dot: "bg-emerald-500" },
  paid: { label: "Paid", class: "bg-blue-600 text-white border-none", dot: "bg-white" },
};

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [activeTab, setActiveTab] = useState<"overview" | "performers" | "aging">("overview");

  const fetchData = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (dateRange.from) qs.set("from", dateRange.from);
    if (dateRange.to) qs.set("to", dateRange.to);
    fetch(`/api/reports${qs.toString() ? `?${qs}` : ""}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [dateRange]);

  const handleExportCSV = () => {
    if (!data) return;
    downloadCSV(data.topPerformers.map((p: any) => ({
      name: p.full_name,
      deals: p.deals,
      total_sales: p.total_sales,
      total_incentives: p.total_incentives,
    })), "performance_analytics", [
      { key: "name", label: "Name" },
      { key: "deals", label: "Deals" },
      { key: "total_sales", label: "Gross Sales (₹)" },
      { key: "total_incentives", label: "Total Commissions (₹)" },
    ]);
  };

  const handleExportPDF = () => {
    if (!data) return;
    const dateLabel = dateRange.from && dateRange.to
      ? ` (${dateRange.from} to ${dateRange.to})`
      : "";
    downloadPDF(`Performance Analytics Report${dateLabel}`, [
      {
        heading: `Revenue Summary — Total: ₹${totalRevenue.toLocaleString("en-IN")} | Commissions: ₹${totalIncentives.toLocaleString("en-IN")}`,
        columns: [
          { key: "month", label: "Month" },
          { key: "revenue", label: "Revenue (₹)" },
          { key: "incentives", label: "Commissions (₹)" },
        ],
        data: data.monthlyRevenue || [],
      },
      {
        heading: "Top Performers Leaderboard",
        columns: [
          { key: "full_name", label: "Name" },
          { key: "deals", label: "Deals" },
          { key: "total_sales", label: "Gross Sales (₹)" },
          { key: "total_incentives", label: "Commissions (₹)" },
        ],
        data: data.topPerformers || [],
      },
      {
        heading: "Batch Aging Report",
        columns: [
          { key: "batch_name", label: "Batch Name" },
          { key: "status", label: "Status" },
          { key: "total_amount", label: "Amount (₹)" },
          { key: "days_pending", label: "Days Pending" },
          { key: "created_at", label: "Created At" },
        ],
        data: (data.aging || []).map((a: any) => ({
          ...a,
          created_at: new Date(a.created_at).toLocaleDateString(),
        })),
      },
    ]);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600/30" />
        <p className="text-xs font-semibold text-slate-400">Loading performance data...</p>
      </div>
    );
  }

  if (!data) return null;

  const totalRevenue = data.monthlyRevenue?.reduce((s: number, m: any) => s + (m.revenue || 0), 0) || 0;
  const totalIncentives = data.monthlyRevenue?.reduce((s: number, m: any) => s + (m.incentives || 0), 0) || 0;

  return (
    <div className="space-y-6 pb-10 sans-serif">
      {/* Header Area */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading text-slate-900 tracking-tight">Performance Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Review team performance and payment timelines.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button onClick={handleExportCSV} variant="outline" className="h-10 px-4 rounded-xl font-semibold text-xs border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm">
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button onClick={handleExportPDF} variant="outline" className="h-10 px-4 rounded-xl font-semibold text-xs border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm">
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: `₹${fmt(totalRevenue)}`, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50/50" },
          { label: "Total Commissions", value: `₹${fmt(totalIncentives)}`, icon: Award, color: "text-indigo-600", bg: "bg-indigo-50/50" },
          { label: "Top Sellers", value: data.topPerformers?.length || 0, icon: Target, color: "text-emerald-600", bg: "bg-emerald-50/50" },
          { label: "Pending Payments", value: data.aging?.length || 0, icon: Clock, color: "text-rose-500", bg: "bg-rose-50/50" },
        ].map((s, i) => (
          <Card key={i} className="p-5 border border-slate-100 shadow-sm bg-white rounded-2xl group transition-all hover:bg-slate-50/30">
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">{s.label}</p>
                <p className="text-xl font-heading text-slate-900 leading-none">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/50 rounded-xl w-fit border border-slate-200/50">
        {(["overview", "performers", "aging"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`h-9 px-6 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>
            {tab === "overview" ? "Overview" : tab === "performers" ? "Leaderboard" : "Batch Aging"}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 p-8 border border-slate-100 shadow-sm bg-white rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl font-heading text-slate-900 tracking-tight">Revenue vs Payouts</h3>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-1">Revenue income vs commission payouts</p>
              </div>
              <div className="flex items-center gap-6 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600 shadow-sm" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-indigo-300 shadow-sm" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Commission</span>
                </div>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", fontSize: "11px", padding: "12px", fontWeight: "bold" }}
                    cursor={{ stroke: '#2563eb', strokeWidth: 2, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colRev)" dot={{ r: 3, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} />
                  <Bar dataKey="incentives" name="Commissions" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Revenue Forecast Panel */}
          <Card className="p-8 border border-slate-100 shadow-lg bg-slate-900 text-white rounded-2xl flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />

            <div className="relative">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 w-fit mb-8 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Revenue Forecast</span>
              </div>
              <h3 className="text-2xl font-heading tracking-tight mb-2">Cycle Core</h3>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest opacity-80">Projected outcomes for current period</p>
            </div>

            <div className="relative space-y-8 my-10">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 mb-2">Current Month</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-heading tabular-nums">₹{data.forecast?.currentMonth?.toLocaleString("en-IN") || "—"}</p>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-1 mb-2">Projected EOM</p>
                <p className="text-4xl font-heading text-white tabular-nums">₹{data.forecast?.projectedEOM?.toLocaleString("en-IN") || "—"}</p>
              </div>
            </div>

            <div className="relative pt-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</span>
                <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-lg border-blue-500/30 text-blue-400 px-2 shadow-sm bg-blue-500/5">
                  {data.forecast?.confidence || "Stable"}
                </Badge>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: data.forecast?.confidence === "High" ? "92%" : "70%" }} />
              </div>
            </div>
          </Card>

          {/* Distribution Map */}
          <Card className="lg:col-span-3 p-8 border border-slate-100 shadow-sm bg-white rounded-2xl">
            <h3 className="text-xl font-heading text-slate-900 tracking-tight mb-8">Commission Distribution</h3>
            <div className="flex flex-col xl:flex-row items-center gap-12">
              <div className="h-64 w-64 shrink-0 relative bg-slate-50/50 rounded-full p-6 border border-slate-100 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.statusDist?.map((s: any) => ({ name: s.status.replace(/_/g, " "), value: s.count }))} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none">
                      {data.statusDist?.map((_: any, idx: number) => <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} className="hover:opacity-80 transition-opacity cursor-pointer" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", fontSize: "11px", fontWeight: "bold" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-2xl font-heading text-slate-900 tabular-nums">{data.statusDist?.reduce((s: number, i: any) => s + i.count, 0)}</p>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                {data.statusDist?.map((s: any, idx: number) => (
                  <div key={s.status} className="flex items-center gap-4 p-5 rounded-2xl bg-slate-50/50 border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest break-all">{s.status.replace(/_/g, " ")}</p>
                      <p className="text-lg font-heading text-slate-900 tabular-nums mt-0.5">{s.count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Leaderboard tab */}
      {activeTab === "performers" && (
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md">
                <Crown className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-heading text-slate-900 tracking-tight">Top Sellers</h3>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Top personnel by revenue generation</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 border-none">
                  <TableHead className="pl-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-24 text-center">Rank</TableHead>
                  <TableHead className="py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personnel</TableHead>
                  <TableHead className="py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Sales</TableHead>
                  <TableHead className="py-5 pr-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Commissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topPerformers?.map((p: any, idx: number) => (
                  <TableRow key={idx} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-none">
                    <TableCell className="pl-8 py-5 text-center">
                      <div className={`inline-flex h-8 w-8 rounded-lg items-center justify-center font-bold text-xs shadow-sm
                        ${idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-slate-100 text-slate-600" : idx === 2 ? "bg-orange-50 text-orange-700" : "bg-white text-slate-400 border border-slate-100"}`}>
                        {idx + 1}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center font-bold text-sm">
                          {p.full_name?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 tracking-tight text-sm">{p.full_name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sales Executive</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-slate-900 tabular-nums text-sm">₹{p.total_sales?.toLocaleString("en-IN")}</p>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <p className="font-bold text-blue-600 tabular-nums text-base">₹{p.total_incentives?.toLocaleString("en-IN")}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Batch Aging tab */}
      {activeTab === "aging" && (
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
            <h3 className="text-lg font-heading text-slate-900 tracking-tight">Payment Timelines</h3>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-1">Pending disbursements queue analysis</p>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 border-none">
                  <TableHead className="pl-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Batch Identifier</TableHead>
                  <TableHead className="py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</TableHead>
                  <TableHead className="py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</TableHead>
                  <TableHead className="py-5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maturity</TableHead>
                  <TableHead className="py-5 pr-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.aging?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-24">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                          <Clock className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">No pending batches</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data.aging?.map((a: any) => (
                  <TableRow key={a.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-none">
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-blue-500 transition-all">
                          <BarChart2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 tracking-tight text-sm">{a.batch_name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {a.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const cfg = STATUS_BADGE[a.status] || { label: a.status, class: "bg-slate-50 text-slate-400", dot: "bg-slate-300" };
                        return (
                          <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border-none shadow-sm flex w-fit items-center gap-1.5 ${cfg.class}`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold text-slate-900 tabular-nums text-sm">₹{a.total_amount?.toLocaleString("en-IN")}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-[10px] border shadow-sm
                        ${(a.days_pending || 0) > 7 ? "bg-red-50 text-red-600 border-red-100" : (a.days_pending || 0) > 3 ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
                        <Clock className="h-3 w-3" /> {(a.days_pending || 0)} Days
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <p className="text-[10px] font-semibold text-slate-500">
                        {new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
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
