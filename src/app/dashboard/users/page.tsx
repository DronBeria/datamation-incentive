"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus, Loader2, Search, MoreHorizontal, Edit2, Trash2,
  Users, Shield, UserCheck, UserX, Download, Sparkles, LayoutGrid,
  Mail, MapPin, Building2, ChevronRight, ArrowRight,
  Activity, Clock, Target, TrendingUp
} from "lucide-react";
import { downloadCSV } from "@/lib/export-utils";

const ROLE_CONFIG: Record<string, { label: string; class: string; dot: string }> = {
  admin: { label: "Admin", class: "bg-blue-50 text-blue-600 border-none", dot: "bg-blue-400" },
  manager: { label: "Manager", class: "bg-indigo-50 text-indigo-600 border-none", dot: "bg-indigo-400" },
  accounts: { label: "Accounts", class: "bg-cyan-50 text-cyan-600 border-none", dot: "bg-cyan-400" },
  salesperson: { label: "Salesperson", class: "bg-emerald-50 text-emerald-600 border-none", dot: "bg-emerald-500" },
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin: Shield,
  manager: UserCheck,
  accounts: Building2,
  salesperson: Users,
};

const ROLE_IDS: Record<string, string> = {
  admin: "1", manager: "2", accounts: "3", salesperson: "4",
};

const USERS_CSV_COLUMNS = [
  { key: "full_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "department", label: "Department" },
  { key: "scheme_name", label: "Scheme" },
  { key: "is_active", label: "Active" },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"directory" | "approvals">("directory");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [submitting, setSubmitting] = useState(false);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [form, setForm] = useState({
    id: "", email: "", password: "", full_name: "", role_id: "4",
    department: "", scheme_id: "", manager_id: "", is_active: true,
    approval_status: "approved"
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isPurging, setIsPurging] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    fetch("/api/users")
      .then(r => r.json())
      .then(d => {
        console.log("[USERS_PAGE] Received Raw Data:", d);
        if (Array.isArray(d)) {
          setUsers(d);
        } else if (d && d.error) {
          console.error("[USERS_PAGE] API error:", d.error, d.debug);
          toast.error("Failed to load users: " + d.error);
        }
      })
      .catch(err => {
        console.error("[USERS_PAGE] Fetch failed:", err);
        toast.error("Network error loading users");
      })
      .finally(() => setLoading(false));
  };

  const fetchSchemes = () => {
    fetch("/api/schemes").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setSchemes(d);
    });
  };

  useEffect(() => { fetchUsers(); fetchSchemes(); }, []);

  const openCreate = () => {
    setModalMode("create");
    setForm({ id: "", email: "", password: "", full_name: "", role_id: "4", department: "", scheme_id: "", manager_id: "", is_active: true, approval_status: "approved" });
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    setModalMode("edit");
    setForm({
      id: u.id, email: u.email, password: "", full_name: u.full_name,
      role_id: ROLE_IDS[u.role] || "4",
      department: u.department || "",
      scheme_id: schemes.find(s => s.name === u.scheme_name)?.id?.toString() || "",
      manager_id: u.manager_id?.toString() || "none",
      is_active: !!u.is_active,
      approval_status: u.approval_status || "approved"
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.email || !form.full_name || (modalMode === "create" && !form.password)) {
      toast.error("Required fields missing"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: modalMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: form.id ? parseInt(form.id.toString()) : null,
          role_id: parseInt(form.role_id),
          scheme_id: (form.scheme_id && form.scheme_id !== 'none') ? parseInt(form.scheme_id) : null,
          manager_id: (form.manager_id && form.manager_id !== 'none') ? parseInt(form.manager_id) : null
        }),
      });
      if (res.ok) {
        toast.success(modalMode === "create" ? "Team member indexed" : "Profile updated");
        setShowModal(false); fetchUsers();
      }
    } catch { toast.error("Operation failed"); }
    finally { setSubmitting(false); }
  };

  const handleApproval = async (id: string, action: 'approved' | 'rejected') => {
    const u = users.find(user => user.id === id);
    if (!u) return;

    // Quick validation before API call
    if (action === 'approved' && u.role === 'salesperson' && !u.scheme_name) {
      toast.error("Salesperson must have a scheme assigned. Please use 'Edit Profile' to approve.", {
        duration: 5000,
        action: {
          label: "Edit",
          onClick: () => openEdit(u)
        }
      });
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...u,
          role_id: ROLE_IDS[u.role] || "4",
          approval_status: action,
          is_active: action === 'approved'
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(action === 'approved' ? "User approved and activated" : "User request rejected");
        fetchUsers();
      } else {
        toast.error(data.error || "Account state modification failed");
      }
    } catch (err: any) {
      toast.error("Network error: Profile update failed");
    }
  };

  const handleToggleStatus = async (user: any) => {
    try {
      if (user.is_active) {
        // Deactivate (Industrial safe mode)
        const res = await fetch(`/api/users?id=${user.id}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok) {
          toast.success(data.message || "User account deactivated");
          fetchUsers();
        }
      } else {
        // Re-activate logic
        const res = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...user,
            role_id: ROLE_IDS[user.role] || "4",
            is_active: true,
            approval_status: 'approved'
          }),
        });
        if (res.ok) {
          toast.success("Staff access restored & verified");
          fetchUsers();
        }
      }
    } catch { toast.error("Operation failed"); }
  };

  const handleRemoveUser = async () => {
    if (!userToDelete || deleteConfirmText !== userToDelete.email) {
      return toast.error("Please type the user email to confirm");
    }
    setIsPurging(true);
    try {
      const res = await fetch(`/api/users?id=${userToDelete.id}&purge=true`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Record purged successfully");
        setShowDeleteModal(false);
        setUserToDelete(null);
        setDeleteConfirmText("");
        fetchUsers();
      } else {
        toast.error(data.error || "Purge failed");
      }
    } catch { toast.error("Critical error during purge"); }
    finally { setIsPurging(false); }
  };

  const filtered = useMemo(() => {
    return users.filter(u => {
      // 1. Isolation: Approval Queue vs Main Directory
      const isPending = String(u.approval_status).toLowerCase() === "pending";
      if (activeTab === "approvals") return isPending;
      if (isPending) return false;

      // 2. Search Engine (Case-insensitive)
      const term = (search || "").toLowerCase().trim();
      const name = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const dept = (u.department || "").toLowerCase();

      const matchSearch = term === "" || name.includes(term) || email.includes(term) || dept.includes(term);

      // 3. Selection Filters
      const userRole = (u.role || "").toLowerCase();
      const matchRole = roleFilter === "all" || userRole === roleFilter.toLowerCase();

      // Robust Boolean Logic
      const isActive = u.is_active === true || u.is_active === 1 || String(u.is_active).toLowerCase() === 'true';

      let matchStatus = true;
      if (statusFilter === "active") matchStatus = isActive;
      else if (statusFilter === "inactive") matchStatus = !isActive;

      const shown = matchSearch && matchRole && matchStatus;
      if (!shown && users.length > 0 && search === "" && roleFilter === "all" && statusFilter === "all") {
        console.warn("[USERS_PAGE] User filtered out unexpectedly:", u.full_name, { isPending, matchSearch, matchRole, matchStatus });
      }

      return shown;
    });
  }, [users, search, roleFilter, statusFilter, activeTab]);

  const stats = useMemo(() => {
    const totalCount = users.length;
    const activeCount = users.filter(u => u.is_active == true || u.is_active == 1 || String(u.is_active).toLowerCase() === 'true').length;
    const salesCount = users.filter(u => u.role === "salesperson").length;
    const pendingCount = users.filter(u => u.approval_status === 'pending').length;
    return { total: totalCount, active: activeCount, salesperson: salesCount, pending: pendingCount };
  }, [users]);

  const handleExport = () => {
    if (!filtered.length) return toast.error("No data available");
    downloadCSV(filtered.map(u => ({ ...u, is_active: u.is_active ? "Yes" : "No" })), "team_directory", USERS_CSV_COLUMNS);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading text-slate-900 tracking-tight">Team Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage user access, roles and associated incentive schemes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExport} variant="outline" className="h-10 px-4 rounded-xl text-xs font-semibold text-slate-600 border-slate-200">
            <Download className="h-3.5 w-3.5 mr-2" /> Export
          </Button>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 h-10 px-4 font-semibold text-white text-xs rounded-xl shadow-sm transition-all flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Member
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats.total, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active", value: stats.active, icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Sales Team", value: stats.salesperson, icon: Sparkles, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Pending Approvals", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200 shadow-inner">
        <button
          onClick={() => setActiveTab("directory")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "directory" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          Directory
        </button>
        <button
          onClick={() => setActiveTab("approvals")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === "approvals" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          Approval Queue
          {stats.pending > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-[10px] text-white flex items-center justify-center rounded-full font-bold ring-2 ring-white">
              {stats.pending}
            </span>
          )}
        </button>
      </div>

      {/* Filters Hub (Only in directory) */}
      {activeTab === "directory" && (
        <Card className="p-4 border border-slate-100 shadow-sm bg-white rounded-2xl">
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="relative flex-[3]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email or department..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-10 border-slate-100 bg-slate-50/50 rounded-xl text-sm focus-visible:ring-blue-600 shadow-none border"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 flex-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-10 border-slate-100 bg-slate-50/50 rounded-xl text-xs font-semibold px-4 flex-1">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-slate-100 shadow-lg p-1 bg-white">
                  <SelectItem value="all" className="rounded-lg text-xs font-medium">All Roles</SelectItem>
                  {Object.keys(ROLE_CONFIG).map(r => (
                    <SelectItem key={r} value={r} className="rounded-lg text-xs font-medium capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-10 border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-600 focus:ring-indigo-500 shadow-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl overflow-hidden">
                  <SelectItem value="all" className="rounded-lg text-xs font-medium text-slate-600">All Statuses</SelectItem>
                  <SelectItem value="active" className="rounded-lg text-xs font-medium text-emerald-600">Active Only</SelectItem>
                  <SelectItem value="inactive" className="rounded-lg text-xs font-medium text-amber-600">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Main Directory */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600/30" />
          <p className="text-xs font-semibold text-slate-400">Loading team members...</p>
        </div>
      ) : (
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 border-none">
                  <TableHead className="py-4 pl-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Member</TableHead>
                  <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Role</TableHead>
                  <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Grouping & Manager</TableHead>
                  <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Status</TableHead>
                  <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Activity</TableHead>
                  <TableHead className="py-4 pr-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="h-8 w-8 text-slate-200" />
                        <p className="text-sm font-semibold text-slate-900">No members found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.map(u => {
                  const RoleIcon = ROLE_ICONS[u.role] || Users;
                  return (
                    <TableRow key={u.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-none">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3.5">
                          {(() => {
                            const isActive = u.is_active == true || u.is_active == 1 || String(u.is_active).toLowerCase() === 'true';
                            return (
                              <div className={`h-10 w-10 rounded-lg ${isActive ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-300 border-slate-100"} border flex items-center justify-center font-bold text-sm shadow-sm transition-all group-hover:bg-white`}>
                                {u.full_name?.[0] || '?'}
                              </div>
                            );
                          })()}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 tracking-tight text-sm group-hover:text-blue-600 transition-colors truncate">{u.full_name}</p>
                            <p className="text-[11px] text-slate-400 truncate opacity-80">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const cfg = ROLE_CONFIG[u.role] || { label: u.role, class: "bg-slate-50 text-slate-400", dot: "bg-slate-300" };
                          return (
                            <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border-none shadow-sm flex w-fit items-center gap-1.5 ${cfg.class}`}>
                              <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-700">{u.department || "No Department"}</span>
                          {u.manager_name && (
                            <span className="text-[10px] text-slate-400 font-medium italic">Managed by: {u.manager_name}</span>
                          )}
                          {u.scheme_name && (
                            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit">{u.scheme_name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const isActive = u.is_active == true || u.is_active == 1 || String(u.is_active).toLowerCase() === 'true';

                          if (u.approval_status === "rejected") return (
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border-none bg-slate-900 text-white shadow-sm flex w-fit items-center gap-1.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Banned
                            </Badge>
                          );
                          if (!isActive) return (
                            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border-none bg-amber-50 text-amber-600 shadow-sm flex w-fit items-center gap-1.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Suspended
                            </Badge>
                          );
                          return (
                            <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border-none bg-emerald-50 text-emerald-600 shadow-sm flex w-fit items-center gap-1.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Verified
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-600 truncate">
                            {u.last_login ? new Date(u.last_login).toLocaleDateString() : "—"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {activeTab === "approvals" ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproval(u.id, 'rejected')}
                              className="h-8 text-[10px] font-bold uppercase text-rose-600 border-rose-100 hover:bg-rose-50 rounded-lg px-3"
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApproval(u.id, 'approved')}
                              className="h-8 text-[10px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 shadow-sm"
                            >
                              Approve
                            </Button>
                          </div>
                        ) : (currentUser?.role === "admin" || (currentUser?.role === "manager" && u.manager_id === currentUser?.id)) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg">
                                <MoreHorizontal className="h-4 w-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1 rounded-xl shadow-lg border border-slate-100 bg-white">
                              <DropdownMenuItem onClick={() => openEdit(u)} className="h-10 rounded-lg text-xs font-medium text-slate-600 flex items-center gap-2 cursor-pointer focus:bg-slate-50 transition-all">
                                <Edit2 className="h-3.5 w-3.5" /> Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleStatus(u)} className={`h-10 rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer focus:bg-slate-50 transition-all ${u.is_active ? "text-amber-600" : "text-emerald-600"}`}>
                                {u.is_active ? (
                                  <><UserX className="h-3.5 w-3.5" /> Deactivate Account</>
                                ) : (
                                  <><UserCheck className="h-3.5 w-3.5" /> Enable Access</>
                                )}
                              </DropdownMenuItem>
                              {currentUser?.role === "admin" && (
                                <DropdownMenuItem
                                  onClick={() => { setUserToDelete(u); setDeleteConfirmText(""); setShowDeleteModal(true); }}
                                  className="h-10 rounded-lg text-xs font-bold text-rose-600 flex items-center gap-2 cursor-pointer focus:bg-rose-50 transition-all"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Remove Permanently
                                </DropdownMenuItem>
                              )}
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
          <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/30">
            <p className="text-[11px] font-semibold text-slate-400 text-right uppercase tracking-widest">
              Visible: {filtered.length} / Global: {users.length}
            </p>
          </div>
        </Card>
      )}

      {/* User Information Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-[800px] w-[95vw] p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white">
          <div className="flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 shrink-0">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-900">
                  {modalMode === "create" ? "Add Team Member" : "Edit Profile"}
                </DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">Configure access credentials and role permissions for this user.</p>
              </div>
            </div>

            {/* Form body */}
            <div className="overflow-y-auto custom-scrollbar p-8">
              <div className="space-y-6">

                {/* Row 1: Name + Role */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Full Name <span className="text-red-500">*</span></label>
                    <Input
                      value={form.full_name}
                      onChange={e => setForm({ ...form, full_name: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="h-11 border-slate-200 bg-white rounded-lg text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">System Role <span className="text-red-500">*</span></label>
                    <Select value={form.role_id || undefined} onValueChange={v => setForm({ ...form, role_id: v })}>
                      <SelectTrigger className="h-11 border-slate-200 bg-white rounded-lg text-sm font-medium">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white p-1">
                        {currentUser?.role === "admin" && (
                          <>
                            <SelectItem value="1" className="text-sm">Admin</SelectItem>
                            <SelectItem value="2" className="text-sm">Manager</SelectItem>
                            <SelectItem value="3" className="text-sm">Accounts</SelectItem>
                          </>
                        )}
                        <SelectItem value="4" className="text-sm">Salesperson</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Email */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Email Address <span className="text-red-500">*</span></label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="john@company.com"
                      className="h-11 pl-10 border-slate-200 bg-white rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Row 3: Password + Department */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Password Access {modalMode === 'create' && <span className="text-red-500">*</span>}</label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder={modalMode === 'edit' ? "Enter new password to modify" : "Set initial password"}
                      className="h-11 border-slate-200 bg-white rounded-lg text-sm"
                    />
                    {modalMode === 'edit' && <p className="text-[10px] text-slate-400 font-medium italic pl-1">Leave blank to keep current credentials</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Department</label>
                    <Input
                      value={form.department}
                      onChange={e => setForm({ ...form, department: e.target.value })}
                      placeholder="e.g. Sales, Ops"
                      className="h-11 border-slate-200 bg-white rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Row 4: Approval Status (Industrial Control) */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Approval Workflow</label>
                    <Select value={form.approval_status} onValueChange={v => setForm({ ...form, approval_status: v })}>
                      <SelectTrigger className="h-11 border-slate-200 bg-white rounded-lg text-sm font-medium">
                        <SelectValue placeholder="Approval Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white p-1">
                        <SelectItem value="pending" className="text-sm">Pending Review</SelectItem>
                        <SelectItem value="approved" className="text-sm text-emerald-600 font-semibold">Approved (Active)</SelectItem>
                        <SelectItem value="rejected" className="text-sm text-rose-600 font-semibold">Rejected (Invalid)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end pb-1">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 flex-1">
                      <Clock className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Status Policy</p>
                        <p className="text-[11px] text-slate-500 font-medium leading-tight">Approved users gain immediate system access.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance & Hierarchy Mapping (Salesperson only) */}
                {form.role_id === "4" && (
                  <div className="p-5 rounded-xl bg-blue-50/50 border border-blue-100/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-blue-900">Alignment & Hierarchy</p>
                      {form.approval_status === "approved" && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-none text-[9px] font-black uppercase tracking-tighter">Scheme Required</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">Active Scheme <span className="text-blue-600">*</span></label>
                        <Select value={form.scheme_id || undefined} onValueChange={v => setForm({ ...form, scheme_id: v })}>
                          <SelectTrigger className="h-10 bg-white border-slate-200 rounded-lg text-sm">
                            <SelectValue placeholder="Select scheme" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white p-1">
                            <SelectItem value="none" className="text-xs text-slate-400 italic">No Incentive Scheme</SelectItem>
                            {schemes.map(s => (
                              <SelectItem key={s.id} value={String(s.id)} className="text-sm">
                                {s.name} — ({(s.base_rate * 100).toFixed(1)}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {currentUser?.role === "admin" && (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-600">Reporting Manager</label>
                          <Select value={form.manager_id || undefined} onValueChange={v => setForm({ ...form, manager_id: v })}>
                            <SelectTrigger className="h-10 bg-white border-slate-200 rounded-lg text-sm">
                              <SelectValue placeholder="Assign Manager" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white p-1">
                              <SelectItem value="none" className="text-xs text-slate-400">Directly Managed</SelectItem>
                              {users.filter(u => u.role === "manager").map(m => (
                                <SelectItem key={m.id} value={String(m.id)} className="text-sm">
                                  {m.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Account Access</p>
                    <p className="text-xs text-slate-500">Enable or disable system access for this user.</p>
                  </div>
                  <button
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`h-9 px-4 rounded-lg text-xs font-semibold transition-all border ${form.is_active
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    {form.is_active ? "Active" : "Disabled"}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-white shrink-0">
              <Button variant="outline" onClick={() => setShowModal(false)} className="h-10 px-5 rounded-lg text-sm font-medium border-slate-200">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm shadow-sm disabled:opacity-50 transition-all"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (modalMode === "create" ? "Create User" : "Save Changes")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Permanent Removal Confirmation */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-[440px] p-6 rounded-2xl bg-white border border-rose-100 shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-14 w-14 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100 mb-2">
              <Trash2 className="h-7 w-7 text-rose-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Industrial Removal</DialogTitle>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                You are about to permanently purge <span className="font-bold text-slate-900">{userToDelete?.full_name}</span>.
                This action is <span className="text-rose-600 font-bold uppercase tracking-wider">irreversible</span> and will wipe all indexed profile data.
              </p>
            </div>

            <div className="w-full space-y-3 pt-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Confirm Email to Proceed</div>
              <Input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={userToDelete?.email}
                className="h-11 border-rose-200 focus-visible:ring-rose-500 rounded-xl bg-rose-50/10 font-medium text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 w-full pt-4">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="h-11 rounded-xl text-sm font-bold border-slate-200">
                Cancel
              </Button>
              <Button
                onClick={handleRemoveUser}
                disabled={isPurging || deleteConfirmText !== userToDelete?.email}
                className="h-11 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-100 disabled:opacity-30"
              >
                {isPurging ? <Loader2 className="h-4 w-4 animate-spin" /> : "Purge Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
