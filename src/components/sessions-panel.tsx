"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Monitor, Smartphone, ShieldCheck, LogOut, X } from "lucide-react";
import { toast } from "sonner";

function parseBrowser(ua: string) {
  if (!ua) return "Unknown";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Opera")) return "Opera";
  return "Browser";
}

function parseDevice(ua: string) {
  if (!ua) return "Desktop";
  return /Mobile|Android|iPhone|iPad/.test(ua) ? "Mobile" : "Desktop";
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SessionsPanel() {
  const qc = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery<any[]>({
    queryKey: ["sessions"],
    queryFn: () => fetch("/api/auth/sessions").then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    staleTime: 30_000,
  });

  const revokeMut = useMutation({
    mutationFn: (body: object) => fetch("/api/auth/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sessions"] }); toast.success("Session revoked"); },
    onError: () => toast.error("Failed to revoke session"),
  });

  const otherSessions = sessions.filter(s => !s.is_current);
  const currentSession = sessions.find(s => s.is_current);

  if (isLoading) return (
    <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  );

  return (
    <div className="space-y-4">
      {otherSessions.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{otherSessions.length} other active session{otherSessions.length !== 1 ? "s" : ""}</p>
          <Button size="sm" variant="outline"
            onClick={() => revokeMut.mutate({ revoke_all: true })}
            disabled={revokeMut.isPending}
            className="h-8 text-xs font-semibold text-red-600 border-red-100 hover:bg-red-50 rounded-lg px-3">
            {revokeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><LogOut className="h-3.5 w-3.5 mr-1.5" />Sign out all others</>}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {sessions.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-6">No session data available</p>
        )}
        {sessions.map((s: any) => {
          const device = parseDevice(s.user_agent || "");
          const browser = parseBrowser(s.user_agent || "");
          const DeviceIcon = device === "Mobile" ? Smartphone : Monitor;
          return (
            <div key={s.id}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${s.is_current ? "border-blue-200 bg-blue-50/30" : "border-slate-100 bg-white hover:border-slate-200"}`}>
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.is_current ? "bg-blue-100" : "bg-slate-100"}`}>
                <DeviceIcon className={`h-4 w-4 ${s.is_current ? "text-blue-600" : "text-slate-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900">{browser} on {device}</p>
                  {s.is_current && (
                    <Badge variant="outline" className="text-[9px] font-bold px-2 py-0.5 border-none bg-blue-100 text-blue-700 flex items-center gap-1">
                      <ShieldCheck className="h-2.5 w-2.5" /> Current
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {s.ip_address || "Unknown IP"} · Active {relativeTime(s.last_active)}
                </p>
              </div>
              {!s.is_current && (
                <button
                  onClick={() => revokeMut.mutate({ session_id: s.id })}
                  disabled={revokeMut.isPending}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                  title="Revoke session"
                >
                  {revokeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
