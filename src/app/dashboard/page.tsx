"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, DollarSign, FileCheck, Clock, TrendingUp, CheckCircle2,
  AlertCircle, CreditCard, BarChart3, Loader2, ShieldCheck, Zap,
  Activity, ArrowUpRight, ClipboardCheck, ArrowRight, Sparkles, TrendingDown
} from "lucide-react";
import { syncToLocal } from "@/lib/hybrid-sync";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function PerformanceChart({ data }: { data: any[] }) {
  return (
    <div className="h-[280px] w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="chartBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
            tickFormatter={(v) => `₹${v / 1000}k`}
          />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', padding: '12px' }}
            cursor={{ stroke: '#2563eb', strokeWidth: 2, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#chartBlue)"
            dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, trend, colorClass, bgClass }: any) {
  return (
    <Card className="p-6 border border-slate-100 shadow-sm bg-white rounded-2xl group relative overflow-hidden transition-all hover:shadow-md">
      <div className="relative z-10">
        <div className={`h-11 w-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 transition-colors group-hover:bg-blue-50 group-hover:border-blue-100`}>
          <Icon className={`h-5 w-5 ${colorClass}`} />
        </div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <h3 className="text-2xl font-heading text-slate-900 tracking-tight">{value}</h3>
          {trend && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${trend.startsWith('+') ? 'text-emerald-600' : 'text-rose-600'} flex items-center`}>
              {trend}
            </span>
          )}
        </div>
        {sub && <p className="text-[10px] text-slate-400 font-medium mt-1 tracking-tight">{sub}</p>}
      </div>
    </Card>
  );
}

const MOCK_PERFORMANCE = [
  { name: 'Sep', value: 420000 },
  { name: 'Oct', value: 380000 },
  { name: 'Nov', value: 510000 },
  { name: 'Dec', value: 490000 },
  { name: 'Jan', value: 650000 },
  { name: 'Feb', value: 590000 },
  { name: 'Mar', value: 720000 },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setStats(d); syncToLocal("dashboard_stats", d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600/30" />
      <p className="text-xs font-semibold text-slate-400">Loading dashboard...</p>
    </div>
  );

  if (!stats || !user) return null;

  const fmt = (n: number) => {
    if (!n) return "0";
    if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString("en-IN");
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-white border border-slate-100 shadow-sm rounded-2xl p-8">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-50/50 blur-[100px] rounded-full -mr-32 -mt-32" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dashboard / {user.role}</span>
            </div>

            <div className="space-y-1">
              <h1 className="text-3xl font-heading text-slate-900 tracking-tight leading-tight">
                Good morning, {user.full_name.split(" ")[0]}
              </h1>
              <p className="text-slate-500 text-sm leading-relaxed max-w-lg">
                Here's what's happening with your commissions today. You have {stats.pendingBatches || 0} items pending review
                {stats.activeSchemes !== undefined && ` and ${stats.activeSchemes} active commission rules`}.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl h-10 px-5 shadow-sm transition-all active:scale-95 group text-xs">
                View Reports <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Goal Progress</p>
              <div className="flex items-center justify-end gap-2">
                <span className="text-2xl font-heading text-slate-900">94.2%</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
            <div className="w-px h-10 bg-slate-100" />
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">System Status</p>
              <div className="flex items-center justify-end gap-2">
                <span className="text-2xl font-heading text-slate-900">Online</span>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Total Revenue" value={`₹${fmt(stats.totalSales)}`} trend="+14.2%" colorClass="text-blue-600" />
        <KpiCard icon={ShieldCheck} label="Pending Review" value={stats.pendingBatches} sub="Review required" colorClass="text-indigo-600" />
        <KpiCard icon={DollarSign} label="Payouts" value={`₹${fmt(stats.totalCommissions)}`} sub="Settled total" trend="+8.4%" colorClass="text-emerald-600" />
        <KpiCard icon={Users} label="Team Members" value={stats.activeUsers || 0} sub={`${stats.totalUsers || 0} Total Staff Headcount`} trend="+3.2%" colorClass="text-slate-600" />
      </div>

      {/* Chart & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 border border-slate-100 shadow-sm bg-white rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-heading text-slate-900 tracking-tight">Revenue Overview</h3>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mt-1">Monthly performance</p>
            </div>
          </div>
          <PerformanceChart data={MOCK_PERFORMANCE} />
        </Card>

        <Card className="p-0 border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Recent Activity</h3>
          </div>
          <div className="p-6 space-y-6">
            {stats.recentAudit?.slice(0, 5).map((log: any) => (
              <div key={log.id} className="flex items-center gap-4 group">
                <div className="h-9 w-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-white group-hover:border-blue-100 transition-colors">
                  <Activity className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate tracking-tight">{log.full_name || "System"}</p>
                  <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">
                    {log.action === 'CREATE' ? 'Created' : log.action === 'UPDATE' ? 'Updated' : log.action} {' '}
                    {log.entity_type?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-5 border-t border-slate-50">
            <button className="w-full text-[11px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-500 transition-all flex items-center justify-center gap-2">
              View Activity Feed <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

