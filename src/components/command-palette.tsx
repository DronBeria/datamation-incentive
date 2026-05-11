"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "cmdk";
import { Layers, Sliders, ShoppingCart, ArrowRight, Loader2 } from "lucide-react";

function fmt(n: number) {
  if (!n) return "₹0";
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function statusColor(s: string) {
  const m: Record<string, string> = { earned: "text-emerald-600", pending_review: "text-amber-600", paid: "text-slate-400", accrued: "text-blue-600", approved: "text-emerald-600", draft: "text-slate-400", pending_approval: "text-blue-600", rejected: "text-red-500", bonus: "text-emerald-600", clawback: "text-red-600", correction: "text-blue-600" };
  return m[s] || "text-slate-400";
}

interface Props { open: boolean; onClose: () => void; userRole: string; }

export function CommandPalette({ open, onClose, userRole }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const isManager = ["admin", "manager"].includes(userRole);
  const opts = { staleTime: 30_000, enabled: open };

  const { data: sales = [], isLoading: lS } = useQuery<any[]>({ queryKey: ["cmd-sales"], queryFn: () => fetch("/api/sales").then(r => r.json()).then(d => Array.isArray(d) ? d : []), ...opts });
  const { data: batches = [], isLoading: lB } = useQuery<any[]>({ queryKey: ["cmd-batches"], queryFn: () => fetch("/api/batches").then(r => r.json()).then(d => Array.isArray(d) ? d : []), ...opts });
  const { data: adjustments = [], isLoading: lA } = useQuery<any[]>({ queryKey: ["cmd-adj"], queryFn: () => fetch("/api/adjustments").then(r => r.json()).then(d => Array.isArray(d) ? d : []), ...opts });
  const { data: users = [], isLoading: lU } = useQuery<any[]>({ queryKey: ["cmd-users"], queryFn: () => fetch("/api/users").then(r => r.json()).then(d => Array.isArray(d) ? d : []), staleTime: 30_000, enabled: open && isManager });

  const loading = lS || lB || lA || (isManager && lU);
  const q = query.toLowerCase();

  const f = useMemo(() => ({
    sales: (q ? sales.filter((s: any) => `${s.client_name} ${s.salesperson_name} ${s.reference_number}`.toLowerCase().includes(q)) : sales).slice(0, 5),
    batches: (q ? batches.filter((b: any) => `${b.batch_name} ${b.reference_number}`.toLowerCase().includes(q)) : batches).slice(0, 5),
    adj: q ? adjustments.filter((a: any) => `${a.full_name} ${a.reason}`.toLowerCase().includes(q)).slice(0, 5) : [],
    users: isManager && q ? users.filter((u: any) => `${u.full_name} ${u.email}`.toLowerCase().includes(q)).slice(0, 5) : [],
  }), [q, sales, batches, adjustments, users, isManager]);

  const empty = !f.sales.length && !f.batches.length && !f.adj.length && !f.users.length;

  useEffect(() => { if (!open) setQuery(""); }, [open]);
  if (!open) return null;

  const go = (href: string) => { router.push(href); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        <Command shouldFilter={false}>
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
            {loading ? <Loader2 className="h-4 w-4 text-slate-400 animate-spin shrink-0" /> : <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />}
            <CommandInput placeholder="Search sales, batches, people, adjustments…" value={query} onValueChange={setQuery}
              className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent outline-none border-none focus:ring-0" autoFocus />
            <kbd className="hidden sm:flex h-5 items-center px-1.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-mono text-slate-400">Esc</kbd>
          </div>
          <CommandList className="max-h-[400px] overflow-y-auto py-2">
            {empty && !loading && <CommandEmpty className="py-10 text-center text-sm text-slate-400">{query ? `No results for "${query}"` : "Start typing to search…"}</CommandEmpty>}
            {f.sales.length > 0 && (
              <CommandGroup heading="Sales">
                {f.sales.map((s: any) => (
                  <CommandItem key={`s-${s.id}`} value={`sale-${s.id}`} onSelect={() => go("/dashboard/sales")}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 rounded-lg mx-1 aria-selected:bg-blue-50">
                    <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0"><ShoppingCart className="h-3.5 w-3.5 text-amber-600" /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{s.client_name}</p><p className="text-[10px] text-slate-400 truncate">{s.salesperson_name} · {s.sale_date}</p></div>
                    <div className="text-right shrink-0"><p className="text-xs font-bold text-slate-800">{fmt(s.deal_value)}</p><p className={`text-[9px] font-bold uppercase ${statusColor(s.status)}`}>{s.status}</p></div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {f.batches.length > 0 && (
              <CommandGroup heading="Settlements">
                {f.batches.map((b: any) => (
                  <CommandItem key={`b-${b.id}`} value={`batch-${b.id}`} onSelect={() => go("/dashboard/batches")}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 rounded-lg mx-1 aria-selected:bg-blue-50">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Layers className="h-3.5 w-3.5 text-blue-600" /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{b.batch_name}</p><p className="text-[10px] text-slate-400 truncate">REF: {b.reference_number || b.id}</p></div>
                    <div className="text-right shrink-0"><p className="text-xs font-bold text-slate-800">{fmt(b.total_amount)}</p><p className={`text-[9px] font-bold uppercase ${statusColor(b.status)}`}>{b.status}</p></div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {f.adj.length > 0 && (
              <CommandGroup heading="Adjustments">
                {f.adj.map((a: any) => (
                  <CommandItem key={`a-${a.id}`} value={`adj-${a.id}`} onSelect={() => go("/dashboard/adjustments")}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 rounded-lg mx-1 aria-selected:bg-blue-50">
                    <div className="h-7 w-7 rounded-lg bg-purple-50 flex items-center justify-center shrink-0"><Sliders className="h-3.5 w-3.5 text-purple-600" /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{a.full_name}</p><p className="text-[10px] text-slate-400 truncate">{a.reason}</p></div>
                    <div className="text-right shrink-0"><p className={`text-xs font-bold ${statusColor(a.type)}`}>{fmt(Math.abs(a.amount))}</p><p className="text-[9px] text-slate-400 uppercase">{a.type}</p></div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {f.users.length > 0 && (
              <CommandGroup heading="Team">
                {f.users.map((u: any) => (
                  <CommandItem key={`u-${u.id}`} value={`user-${u.id}`} onSelect={() => go("/dashboard/users")}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 rounded-lg mx-1 aria-selected:bg-blue-50">
                    <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center text-white text-xs font-bold shrink-0">{(u.full_name || "?")[0]}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{u.full_name}</p><p className="text-[10px] text-slate-400 truncate">{u.email}</p></div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0">{u.role}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              {[["↑↓", "navigate"], ["↵", "select"], ["Esc", "close"]].map(([k, l]) => (
                <span key={k}><kbd className="font-mono bg-white border border-slate-200 rounded px-1 text-[9px]">{k}</kbd> {l}</span>
              ))}
            </div>
            <span className="text-[10px] text-slate-300 font-mono">⌘K</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
