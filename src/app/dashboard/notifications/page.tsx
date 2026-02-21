"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Bell, CheckCheck, Info, Search, Filter, Trash2, Calendar, Megaphone, ShieldAlert, Zap, Sparkles, Inbox, Trash, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const NOTIF_CONFIG: Record<string, { icon: any; color: string; bg: string; dot: string }> = {
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500" },
  alert: { icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50", dot: "bg-red-500" },
  success: { icon: CheckCheck, color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  promo: { icon: Megaphone, color: "text-purple-600", bg: "bg-purple-50", dot: "bg-purple-500" },
  system: { icon: Zap, color: "text-indigo-600", bg: "bg-indigo-50", dot: "bg-indigo-500" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications");
      const d = await r.json();
      if (Array.isArray(d)) setNotifications(d);
    } catch {
      toast.error("Inbox connection failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      toast.success("Inbox sanitized");
    } catch {
      toast.error("Operation failed");
    }
  };

  const markOneRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const deleteNotif = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success("Alert purged");
  };

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      const matchSearch = (n.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (n.message || "").toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || (filter === "unread" ? !n.is_read : n.is_read);
      return matchSearch && matchFilter;
    });
  }, [notifications, search, filter]);

  const stats = useMemo(() => ({
    unread: notifications.filter(n => !n.is_read).length,
    total: notifications.length,
  }), [notifications]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading text-slate-900 tracking-tight">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Stay updated with system activities, role changes, and alerts.</p>
        </div>
        <div className="flex items-center gap-3">
          {stats.unread > 0 && (
            <Button onClick={markAllRead} variant="outline" className="h-10 px-4 rounded-xl text-xs font-semibold text-slate-600 border-slate-200 bg-white hover:bg-slate-50">
              <CheckCheck className="h-4 w-4 mr-2 text-blue-600" /> Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Unread", value: stats.unread, icon: Inbox, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total", value: stats.total, icon: Bell, color: "text-slate-600", bg: "bg-slate-50" },
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
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="relative flex-[3]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search notifications..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-10 border-slate-100 bg-slate-50/50 rounded-xl text-sm focus-visible:ring-blue-600 shadow-none border"
            />
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-slate-50/50 rounded-xl flex-2 border border-slate-100">
            {(["all", "unread", "read"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 h-8 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${filter === f ? "bg-white text-blue-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Feed Stream */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600/30" />
          <p className="text-xs font-semibold text-slate-400">Loading notifications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-24 gap-4 bg-white border border-slate-100 shadow-sm rounded-2xl">
          <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100">
            <Bell className="h-8 w-8 text-slate-300" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-lg font-heading text-slate-900 tracking-tight">All caught up!</p>
            <p className="text-xs font-medium text-slate-400">No new notifications to display.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((n) => {
            const cfg = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.system;
            const Icon = cfg.icon;
            const date = new Date(n.created_at);
            return (
              <Card
                key={n.id}
                onClick={() => !n.is_read && markOneRead(n.id)}
                className={`group relative p-5 transition-all duration-200 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:shadow-md ${n.is_read ? "bg-white/60" : "bg-white border-blue-100 shadow-blue-900/5 ring-1 ring-blue-50/50"}`}
              >
                <div className="flex items-start gap-5 relative z-10">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${n.is_read ? "bg-slate-50 text-slate-300" : `${cfg.bg} ${cfg.color}`} border border-slate-100 shadow-sm transition-all group-hover:scale-105`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border-none ${n.is_read ? "bg-slate-100 text-slate-400" : `${cfg.bg} ${cfg.color}`}`}>
                        {n.type || 'SYSTEM'}
                      </Badge>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-base font-semibold tracking-tight mb-1 transition-colors ${n.is_read ? "text-slate-500" : "text-slate-900 group-hover:text-blue-600"}`}>{n.title}</p>
                    <p className={`text-sm leading-relaxed max-w-3xl ${n.is_read ? "text-slate-400" : "text-slate-600"}`}>
                      {n.message}
                    </p>
                  </div>
                  <div className="flex flex-col items-end justify-between self-stretch">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }}
                      className="h-8 w-8 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {!n.is_read && (
                      <div className={`h-2 w-2 rounded-full ${cfg.dot} shadow-sm animate-pulse`} />
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-slate-50/50 border border-slate-100">
              <Sparkles className="h-3 w-3 text-blue-400" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notification end</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
