"use client";

import { useEffect, useState, useMemo } from "react";
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
import { toast } from "sonner";
import { Plus, Loader2, ArrowDownCircle, ArrowUpCircle, Search, Download, Sliders, TrendingDown, TrendingUp, Minus, Sparkles, User, ArrowRight, Wallet, History } from "lucide-react";
import { downloadCSV, exportToExcel, exportToPDF } from "@/lib/export-utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; amountClass: string; bg: string; dot: string; sign: string }> = {
    clawback: { label: "Clawback", icon: ArrowDownCircle, amountClass: "text-red-600", bg: "bg-red-50 text-red-600", dot: "bg-red-500", sign: "−" },
    bonus: { label: "Performance Bonus", icon: ArrowUpCircle, amountClass: "text-emerald-600", bg: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500", sign: "+" },
    correction: { label: "Correction", icon: Sliders, amountClass: "text-blue-600", bg: "bg-blue-50 text-blue-600", dot: "bg-blue-500", sign: "±" },
};

const ADJ_CSV_COLUMNS = [
    { key: "full_name", label: "Salesperson" },
    { key: "type", label: "Type" },
    { key: "reason", label: "Reason" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Date" },
];

export default function AdjustmentsPage() {
    const [adjustments, setAdjustments] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [form, setForm] = useState({
        user_id: "", amount: "", reason: "", type: "clawback",
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [adjRes, userRes] = await Promise.all([
                fetch("/api/adjustments"),
                fetch("/api/users"),
            ]);
            const adjData = await adjRes.json();
            const userData = await userRes.json();
            if (Array.isArray(adjData)) setAdjustments(adjData);
            if (Array.isArray(userData)) setUsers(userData.filter((u: any) => u.role === "salesperson"));
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = async () => {
        if (!form.user_id || !form.amount || !form.reason) {
            toast.error("Required fields missing"); return;
        }
        setCreating(true);
        try {
            const res = await fetch("/api/adjustments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, user_id: parseInt(form.user_id), amount: parseFloat(form.amount) }),
            });
            if (res.ok) {
                toast.success("Fiscal adjustment successfully indexed");
                setShowCreate(false);
                setForm({ user_id: "", amount: "", reason: "", type: "clawback" });
                fetchData();
            }
        } finally { setCreating(false); }
    };

    const handleUpdateStatus = async (id: number, status: string) => {
        try {
            const res = await fetch(`/api/adjustments/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                toast.success(`Adjustment ${status} successfully`);
                fetchData();
            }
        } catch { toast.error("Update failed"); }
    };

    const filtered = useMemo(() => {
        return adjustments.filter(a => {
            const matchSearch = (a.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
                (a.reason || "").toLowerCase().includes(search.toLowerCase());
            const matchType = typeFilter === "all" || a.type === typeFilter;
            return matchSearch && matchType;
        });
    }, [adjustments, search, typeFilter]);

    const stats = useMemo(() => ({
        total: adjustments.length,
        clawbacks: adjustments.filter(a => a.type === "clawback").reduce((s, a) => s + a.amount, 0),
        bonuses: adjustments.filter(a => a.type === "bonus").reduce((s, a) => s + a.amount, 0),
        net: adjustments.reduce((s, a) => s + (a.type === "clawback" ? -a.amount : a.amount), 0),
    }), [adjustments]);

    const handleExportCSV = () => {
        if (!filtered.length) return toast.error("No records available");
        downloadCSV(filtered.map(a => ({
            ...a,
            amount: `${TYPE_CONFIG[a.type]?.sign || ""}₹${Math.abs(a.amount).toLocaleString("en-IN")}`,
            created_at: new Date(a.created_at).toLocaleDateString(),
        })), "financial_adjustments", ADJ_CSV_COLUMNS);
    };

    const handleExportExcel = () => {
        if (!filtered.length) return toast.error("No records available");
        exportToExcel(filtered.map(a => ({
            ...a,
            amount: `${TYPE_CONFIG[a.type]?.sign || ""}₹${Math.abs(a.amount).toLocaleString("en-IN")}`,
            created_at: new Date(a.created_at).toLocaleDateString(),
        })), "financial_adjustments", ADJ_CSV_COLUMNS);
    };

    const handleExportPDF = () => {
        if (!filtered.length) return toast.error("No records available");
        exportToPDF("Financial Adjustments Report", ADJ_CSV_COLUMNS, filtered.map(a => ({
            ...a,
            amount: `${TYPE_CONFIG[a.type]?.sign || ""}₹${Math.abs(a.amount).toLocaleString("en-IN")}`,
            created_at: new Date(a.created_at).toLocaleDateString(),
        })), "adjustments_ledger");
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-heading text-slate-900 tracking-tight">Adjustments</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage manual commission corrections and performance bonuses.</p>
                </div>
                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-10 px-4 rounded-xl text-xs font-semibold text-slate-600 border-slate-200 bg-white">
                                <Download className="h-3.5 w-3.5 mr-2" /> Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-lg border border-slate-100 bg-white">
                            <DropdownMenuItem onClick={handleExportCSV} className="h-10 rounded-lg text-xs font-medium text-slate-600 cursor-pointer focus:bg-slate-50">
                                CSV Document
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportExcel} className="h-10 rounded-lg text-xs font-medium text-slate-600 cursor-pointer focus:bg-slate-50">
                                Excel Spreadsheet
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportPDF} className="h-10 rounded-lg text-xs font-medium text-slate-600 cursor-pointer focus:bg-slate-50">
                                PDF Document
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-500 h-10 px-5 font-semibold text-xs text-white rounded-xl shadow-sm transition-all flex items-center gap-2">
                        <Plus className="h-4 w-4" /> New Adjustment
                    </Button>
                </div>
            </div>

            {/* KPI Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Edits", value: adjustments.length, icon: History, color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Clawbacks", value: `₹${fmt(stats.clawbacks)}`, icon: TrendingDown, color: "text-red-600", bg: "bg-red-50" },
                    { label: "Bonuses", value: `₹${fmt(stats.bonuses)}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Net Impact", value: `₹${fmt(Math.abs(stats.net))}`, icon: Wallet, color: stats.net >= 0 ? "text-indigo-600" : "text-amber-600", bg: stats.net >= 0 ? "bg-indigo-50" : "bg-amber-50" },
                ].map((s, i) => (
                    <Card key={i} className="p-5 border border-slate-100 shadow-sm bg-white rounded-2xl group relative overflow-hidden transition-all hover:shadow-md">
                        <div className="relative z-10">
                            <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center mb-3 transition-transform group-hover:scale-110 shadow-sm border border-slate-100/50`}>
                                <s.icon className={`h-5 w-5 ${s.color}`} />
                            </div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-2">{s.label}</p>
                            <p className={`text-2xl font-heading ${s.color} leading-none tracking-tight tabular-nums`}>
                                {i > 0 && (s.label === "Clawbacks" ? "−" : s.label === "Bonuses" ? "+" : (stats.net >= 0 ? "+" : "−"))}
                                {s.value}
                            </p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Filters Hub */}
            <Card className="p-4 border border-slate-100 shadow-sm bg-white rounded-2xl">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-[3]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by salesperson or reason..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 h-10 border-slate-100 bg-slate-50/50 rounded-xl text-sm focus-visible:ring-blue-600 shadow-none border"
                        />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="h-10 border-slate-100 bg-slate-50/50 rounded-xl text-xs font-semibold px-4 flex-1">
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border border-slate-100 shadow-lg p-1 bg-white">
                            <SelectItem value="all" className="rounded-lg text-xs font-medium">All Types</SelectItem>
                            <SelectItem value="clawback" className="rounded-lg text-xs font-medium text-red-600">Clawbacks</SelectItem>
                            <SelectItem value="bonus" className="rounded-lg text-xs font-medium text-emerald-600">Bonuses</SelectItem>
                            <SelectItem value="correction" className="rounded-lg text-xs font-medium text-blue-600">Corrections</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            {/* Adjustments Table */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600/30" />
                    <p className="text-xs font-semibold text-slate-400">Loading adjustments...</p>
                </div>
            ) : (
                <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 border-none">
                                    <TableHead className="py-4 pl-6 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Recipient</TableHead>
                                    <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Type</TableHead>
                                    <TableHead className="py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Reason</TableHead>
                                    <TableHead className="py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest">Amount</TableHead>
                                    <TableHead className="py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-widest">Status</TableHead>
                                    <TableHead className="py-4 pr-6 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-20">
                                            <div className="flex flex-col items-center gap-3">
                                                <Sliders className="h-8 w-8 text-slate-200" />
                                                <p className="text-sm font-semibold text-slate-900">No adjustments found</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.map(a => {
                                    const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.manual_adjustment;
                                    return (
                                        <TableRow key={a.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-none">
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                                        {(a.full_name || "?")[0]}
                                                    </div>
                                                    <span className="font-semibold text-slate-900 text-sm tracking-tight">{a.full_name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border-none flex items-center gap-1.5 ${cfg.bg}`}>
                                                    <div className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                                    {cfg.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-600 text-sm max-w-xs truncate">
                                                <div className="font-medium text-slate-800">{a.reason}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">REF: {a.reference_number || `ADJ-${a.id}`}</div>
                                            </TableCell>
                                            <TableCell className={`text-right font-bold tabular-nums text-sm ${cfg.amountClass}`}>
                                                {cfg.sign} ₹{Math.abs(a.amount).toLocaleString("en-IN")}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {a.status === 'pending' ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50 rounded-md" onClick={() => handleUpdateStatus(a.id, 'applied')}>
                                                                <TrendingUp className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 rounded-md" onClick={() => handleUpdateStatus(a.id, 'cancelled')}>
                                                                <Minus className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className={`text-[9px] font-bold uppercase ${a.status === 'applied' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'} border-none px-2 py-0.5`}>
                                                            {a.status}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <span className="text-xs font-semibold text-slate-400">
                                                    {new Date(a.created_at).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* Create Adjustment Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-w-[800px] w-[95vw] p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white">
                    <div className="flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 shrink-0">
                            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                                <Sparkles className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-semibold text-slate-900">New Adjustment</DialogTitle>
                                <p className="text-xs text-slate-400 mt-0.5">Record a manual correction or performance bonus — reflected immediately in ledgers.</p>
                            </div>
                        </div>

                        {/* Form body */}
                        <div className="overflow-y-auto custom-scrollbar p-8">
                            <div className="space-y-6">

                                {/* Recipient */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-700">Beneficiary Assignment <span className="text-red-500">*</span></label>
                                    <Select value={form.user_id || undefined} onValueChange={v => setForm({ ...form, user_id: v })}>
                                        <SelectTrigger className="h-11 border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 focus:ring-blue-500/20 focus:border-blue-400">
                                            <SelectValue placeholder="Select Recipient Staff" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white p-1">
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

                                {/* Config Grid */}
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-700">Adjustment Protocol <span className="text-red-500">*</span></label>
                                        <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                                            <SelectTrigger className="h-11 border-slate-200 bg-white rounded-lg text-sm font-medium">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-200 shadow-xl bg-white p-1">
                                                <SelectItem value="clawback" className="text-sm font-semibold text-red-600">Clawback (−)</SelectItem>
                                                <SelectItem value="bonus" className="text-sm font-semibold text-emerald-600">Bonus (+)</SelectItem>
                                                <SelectItem value="correction" className="text-sm font-semibold text-blue-600">Correction (±)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-700">Fiscal Value (₹) <span className="text-red-500">*</span></label>
                                        <div className="relative group">
                                            <Wallet className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                type="number"
                                                value={form.amount}
                                                onChange={e => setForm({ ...form, amount: e.target.value })}
                                                placeholder="0.00"
                                                className="h-11 pl-10 border-slate-200 bg-white rounded-lg text-sm font-bold tabular-nums"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Statement */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-700">Fiscal Reason / Statement <span className="text-red-500">*</span></label>
                                    <Input
                                        value={form.reason}
                                        onChange={e => setForm({ ...form, reason: e.target.value })}
                                        placeholder="Detailed justification for this adjustment..."
                                        className="h-11 border-slate-200 bg-white rounded-lg text-sm"
                                    />
                                </div>

                                {/* Summary */}
                                {form.amount && (
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                                                <TrendingUp className="h-4 w-4" />
                                            </div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widerAlpha">Ledger Impact</p>
                                        </div>
                                        <p className={`text-lg font-bold tabular-nums ${form.type === 'clawback' ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {form.type === 'clawback' ? '-' : ''}₹{Number(form.amount || 0).toLocaleString("en-IN")}
                                        </p>
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
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deploy Adjustment"}
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

