"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  ClipboardList,
  CreditCard,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Menu,
  X,
  Zap,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SyncStatusIcon } from "@/components/ui/sync-status";

const NAV_ITEMS: Record<string, { label: string; href: string; icon: any; roles: string[] }[]> = {
  main: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "accounts", "salesperson"] },
    { label: "Settlements", href: "/dashboard/batches", icon: ClipboardList, roles: ["admin", "manager", "accounts", "salesperson"] },
    { label: "Sales Pipeline", href: "/dashboard/sales", icon: FileText, roles: ["admin", "manager", "salesperson"] },
    { label: "Adjustments", href: "/dashboard/adjustments", icon: CreditCard, roles: ["admin", "manager", "accounts"] },
    { label: "Analytics", href: "/dashboard/reports", icon: BarChart3, roles: ["admin", "manager", "accounts"] },
  ],
  admin: [
    { label: "Team Management", href: "/dashboard/users", icon: Users, roles: ["admin", "manager"] },
    { label: "Commission Rules", href: "/dashboard/schemes", icon: Zap, roles: ["admin", "manager"] },
    { label: "System Audit", href: "/dashboard/audit", icon: ClipboardList, roles: ["admin"] },
  ],
};

const ROLE_THEME: Record<string, { color: string; bg: string; label: string }> = {
  admin: { color: "text-blue-600", bg: "bg-blue-50", label: "Administrator" },
  manager: { color: "text-indigo-600", bg: "bg-indigo-50", label: "Manager" },
  accounts: { color: "text-cyan-600", bg: "bg-cyan-50", label: "Accounts" },
  salesperson: { color: "text-blue-500", bg: "bg-blue-50/50", label: "Sales Team" },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setUnreadCount(d.filter((n: any) => !n.is_read).length);
        }
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const roleTheme = ROLE_THEME[user.role] || ROLE_THEME.salesperson;
  const filteredNav = [...NAV_ITEMS.main, ...NAV_ITEMS.admin].filter(i => i.roles.includes(user.role));
  const currentPage = filteredNav.find(n => pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href)));

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const Sidebar = ({ isMobile = false }) => (
    <div className="flex flex-col h-full bg-white border-r border-slate-100">
      {/* Brand */}
      <div className="h-16 flex items-center px-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white fill-white" />
          </div>
          {(!collapsed || isMobile) && (
            <span className="font-heading text-slate-900 tracking-tight text-xl">IncenSys</span>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group
                ${isActive
                  ? "bg-slate-100 text-slate-900 shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
              {isActive && !collapsed && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" />}
            </Link>
          );
        })}
      </div>

      {/* Collapse Toggle (desktop only) */}
      {!isMobile && (
        <div className="px-3 py-2 border-t border-slate-100">
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <><ChevronLeft className="h-4 w-4 shrink-0" /><span>Collapse</span></>}
          </button>
        </div>
      )}

      {/* Profile */}
      <div className="p-4 border-t border-slate-100 mt-auto">
        <div className={`p-2 rounded-xl bg-slate-50 flex items-center gap-3 ${collapsed && !isMobile ? "justify-center" : ""}`}>
          <div className={`h-8 w-8 rounded-lg ${roleTheme.bg} flex items-center justify-center shrink-0 border border-slate-200`}>
            <span className={`text-[10px] font-bold ${roleTheme.color}`}>{user.full_name[0]}</span>
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate tracking-tight">{user.full_name.split(" ")[0]}</p>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{user.role}</p>
            </div>
          )}
          {(!collapsed || isMobile) && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLogout}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200 shadow-sm hover:shadow-inner group"
              title="Secure Logout"
            >
              <LogOut className="h-3.5 w-3.5 group-hover:animate-pulse" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:block border-r border-slate-100 transition-all duration-300 ${collapsed ? "w-20" : "w-64"}`}>
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-white border-r border-slate-100 animate-in slide-in-from-left duration-300">
            <Sidebar isMobile />
          </div>
          <div className="flex-1 bg-slate-900/10 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Simple Header */}
        <header className="h-16 bg-white/50 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5 text-slate-600" />
            </Button>
            {currentPage && (
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-heading font-semibold text-slate-900 tracking-tight">{currentPage.label}</h1>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <SyncStatusIcon />
            <Link href="/dashboard/notifications" className="relative h-9 w-9 rounded-lg hover:bg-slate-50 flex items-center justify-center transition-colors border border-slate-100">
              <Bell className="h-4 w-4 text-slate-400" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 ring-2 ring-white flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white leading-none">{unreadCount > 9 ? "9+" : unreadCount}</span>
                </div>
              )}
            </Link>
            <div className={`h-9 pr-3 pl-1.5 rounded-lg ${roleTheme.bg} flex items-center gap-2 border border-slate-100 shadow-sm transition-all`}>
              <div className="h-6 w-6 rounded bg-white flex items-center justify-center border border-slate-100">
                <span className={`text-[10px] font-bold ${roleTheme.color}`}>{user.full_name[0]}</span>
              </div>
              <span className={`text-[11px] font-semibold ${roleTheme.color} hidden sm:block tracking-tight`}>{user.full_name}</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto min-h-[calc(100vh-10rem)] flex flex-col">
            <div className="flex-1">
              {children}
            </div>

            {/* Minimal Dashboard Footer */}
            <div className="mt-12 py-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">© 2026 PayoutPower IMS</p>
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 tracking-tight">
                Developed and Powered by{" "}
                <a
                  href="https://arcwebworks.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 hover:text-blue-600 transition-colors font-semibold"
                >
                  Arc WebWorks
                </a>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
