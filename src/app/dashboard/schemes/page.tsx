"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    Plus, Loader2, Zap, Target, TrendingUp,
    Percent, Hash, Box, Layers, ArrowRight,
    CheckCircle2, Calculator, Sparkles, Edit2, Trash2, Download
} from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const SCHEME_COLUMNS = [
    { key: "name", label: "Scheme Name" },
    { key: "calculation_type", label: "Type" },
    { key: "base_rate", label: "Base Rate" },
    { key: "target_threshold", label: "Threshold" },
    { key: "bonus_rate", label: "Bonus Rate" },
];

const SCHEME_TYPES = [
    {
        val: "percentage",
        label: "Percentage",
        icon: Percent,
        color: "text-blue-600",
        bg: "bg-blue-50",
        desc: "Pay a fixed % of each deal's total value",
    },
    {
        val: "tier_based",
        label: "Tiered Bonus",
        icon: Layers,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        desc: "Higher rate unlocks once a revenue target is crossed",
    },
    {
        val: "quantity_threshold",
        label: "Qty Threshold",
        icon: Hash,
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        desc: "Surge bonus per unit after crossing a unit milestone",
    },
    {
        val: "fixed_per_qty",
        label: "Fixed Per Unit",
        icon: Box,
        color: "text-violet-600",
        bg: "bg-violet-50",
        desc: "Flat rupee amount for every unit sold",
    },
];

const EMPTY_FORM = {
    name: "",
    description: "",
    calculation_type: "percentage",
    base_rate: "",
    target_threshold: "",
    bonus_rate: "",
    max_payable: "",
};

export default function SchemesPage() {
    const { user } = useAuth();
    const [schemes, setSchemes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [form, setForm] = useState(EMPTY_FORM);

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setModalMode("create");
    };

    const fetchSchemes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/schemes");
            const data = await res.json();
            if (Array.isArray(data)) setSchemes(data);
        } catch {
            toast.error("Failed to fetch schemes");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSchemes();
    }, [fetchSchemes]);

    const handleExportExcel = () => {
        if (!schemes.length) return toast.error("No data available");
        exportToExcel(schemes, "commission_schemes", SCHEME_COLUMNS);
    };

    const handleExportPDF = () => {
        if (!schemes.length) return toast.error("No data available");
        exportToPDF("Commission Logic Blueprints", SCHEME_COLUMNS, schemes, "schemes_config");
    };

    const handleSubmit = async () => {
        if (!form.name.trim() || !form.base_rate) {
            toast.error("Required fields missing");
            return;
        }
        setCreating(true);
        try {
            const isPercent = ["percentage", "tier_based"].includes(form.calculation_type);
            const baseVal = isPercent ? parseFloat(form.base_rate) / 100 : parseFloat(form.base_rate);
            const isBonusPercent = form.calculation_type === "tier_based";
            const bonusVal = isBonusPercent ? parseFloat(form.bonus_rate) / 100 : parseFloat(form.bonus_rate) || 0;

            const url = modalMode === "create" ? "/api/schemes" : `/api/schemes/${editingId}`;
            const method = modalMode === "create" ? "POST" : "PUT";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    description: form.description,
                    calculation_type: form.calculation_type,
                    base_rate: baseVal,
                    target_threshold: parseFloat(form.target_threshold) || 0,
                    bonus_rate: bonusVal,
                    max_payable: form.max_payable ? parseFloat(form.max_payable) : null,
                }),
            });

            if (res.ok) {
                toast.success(modalMode === "create" ? "Commission scheme successfully created" : "Scheme updated");
                setShowCreate(false);
                resetForm();
                fetchSchemes();
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error || "Failed to process scheme");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (scheme: any) => {
        if (!window.confirm(`Are you sure you want to delete "${scheme.name}"? This action cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/schemes/${scheme.id}`, { method: "DELETE" });
            const data = await res.json();

            if (res.ok) {
                toast.success(data.message || "Scheme deleted");
                fetchSchemes();
            } else {
                toast.error(data.error || "Failed to delete scheme");
            }
        } catch {
            toast.error("Connection error during deletion");
        }
    };

    const openEdit = (s: any) => {
        const isPercent = ["percentage", "tier_based"].includes(s.calculation_type);
        const isBonusPercent = s.calculation_type === "tier_based";
        setForm({
            name: s.name,
            description: s.description || "",
            calculation_type: s.calculation_type,
            base_rate: (isPercent ? s.base_rate * 100 : s.base_rate).toString(),
            target_threshold: (s.target_threshold || 0).toString(),
            bonus_rate: (isBonusPercent ? (s.bonus_rate || 0) * 100 : (s.bonus_rate || 0)).toString(),
            max_payable: (s.max_payable || "").toString(),
        });
        setEditingId(s.id);
        setModalMode("edit");
        setShowCreate(true);
    };

    const f = (field: keyof typeof EMPTY_FORM) => (e: any) => setForm({ ...form, [field]: e.target.value });

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-heading text-slate-900 tracking-tight">Commission Schemes</h1>
                    <p className="text-sm text-slate-500 mt-1">Configure automated payout logic and performance thresholds.</p>
                </div>
                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-10 px-4 rounded-xl text-xs font-semibold text-slate-600 border-slate-200 bg-white">
                                <Download className="h-3.5 w-3.5 mr-2" /> Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-lg border border-slate-100 bg-white">
                            <DropdownMenuItem onClick={handleExportExcel} className="h-10 rounded-lg text-xs font-medium cursor-pointer focus:bg-slate-50">
                                Excel Spreadsheet
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportPDF} className="h-10 rounded-lg text-xs font-medium cursor-pointer focus:bg-slate-50">
                                PDF Document
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {["admin", "manager"].includes(user?.role || "") && (
                        <Button onClick={() => { resetForm(); setShowCreate(true); }} className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Create Scheme
                        </Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600/30" />
                    <p className="text-xs font-semibold text-slate-400">Syncing logic fingerprints...</p>
                </div>
            ) : schemes.length === 0 ? (
                <div className="py-20 text-center bg-white border border-slate-100 border-dashed rounded-3xl">
                    <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-sm">
                        <Zap className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 font-heading">No schemes defined</p>
                    <p className="text-xs text-slate-400 mt-1">Create your first commission blueprint to start tracking.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {schemes.map((s) => {
                        const hasBonus = ["tier_based", "quantity_threshold"].includes(s.calculation_type);
                        return (
                            <Card key={s.id} className="group relative border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1 transition-all duration-300">
                                <div className="p-6 pb-4">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                            {s.calculation_type === "percentage" ? <Percent className="h-6 w-6" /> :
                                                s.calculation_type === "fixed_per_qty" ? <Box className="h-6 w-6" /> :
                                                    <Layers className="h-6 w-6" />}
                                        </div>
                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-slate-100">
                                            {s.calculation_type.replace(/_/g, " ")}
                                        </Badge>
                                    </div>

                                    <h3 className="text-lg font-heading text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors uppercase">{s.name}</h3>
                                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">{s.description || "System logic blueprint."}</p>

                                    <div className="mt-6 p-4 rounded-xl bg-slate-50/50 border border-slate-100 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Target className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Base Rate</span>
                                            </div>
                                            <span className="text-xs font-bold text-slate-900">
                                                {s.calculation_type === "percentage" || s.calculation_type === "tier_based" ? `${(s.base_rate * 100).toFixed(1)}%` : `₹${s.base_rate}/unit`}
                                            </span>
                                        </div>
                                        {hasBonus && (
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                                                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Bonus Model</span>
                                                </div>
                                                <span className="text-xs font-bold text-blue-600">
                                                    {s.calculation_type === "tier_based" ? `${(s.bonus_rate * 100).toFixed(1)}%` : `₹${s.bonus_rate}/unit`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {["admin", "manager"].includes(user?.role || "") && (
                                        <div className="flex items-center gap-2 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button onClick={() => openEdit(s)} variant="outline" className="flex-1 h-9 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-2">
                                                <Edit2 className="h-3 w-3" /> Edit
                                            </Button>
                                            <Button onClick={() => handleDelete(s)} variant="outline" className="h-9 w-9 rounded-xl text-rose-600 border-rose-100 hover:bg-rose-50 hover:border-rose-200">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) resetForm(); }}>
                <DialogContent className="max-w-[800px] w-[95vw] p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white">
                    <div className="flex flex-col max-h-[90vh]">
                        <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 shrink-0">
                            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                                {modalMode === "create" ? <Plus className="h-5 w-5 text-white" /> : <Edit2 className="h-5 w-5 text-white" />}
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-semibold text-slate-900">
                                    {modalMode === "create" ? "Define Commission Scheme" : "Modify Blueprint"}
                                </DialogTitle>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {modalMode === "create" ? "Configure the payout logic." : "Update parameters."}
                                </p>
                            </div>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar p-8">
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-700">Scheme Name</label>
                                        <Input
                                            value={form.name}
                                            onChange={f("name")}
                                            placeholder="e.g. Standard Direct Sales"
                                            className="h-11 border-slate-200"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-700">Description</label>
                                        <Input
                                            value={form.description}
                                            onChange={f("description")}
                                            placeholder="Internal notes"
                                            className="h-11 border-slate-200"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Calculation Architecture</label>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {SCHEME_TYPES.map((t) => (
                                            <button
                                                key={t.val}
                                                onClick={() => setForm({ ...form, calculation_type: t.val })}
                                                className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${form.calculation_type === t.val ? "bg-blue-50 border-blue-600 text-blue-700" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"}`}
                                            >
                                                <t.icon className="h-5 w-5 mb-2" />
                                                <span className="text-[10px] font-bold uppercase">{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-700">
                                            {["percentage", "tier_based"].includes(form.calculation_type) ? "Base Rate (%)" : "Base Amount (₹)"}
                                        </label>
                                        <Input type="number" value={form.base_rate} onChange={f("base_rate")} className="h-11" />
                                    </div>
                                    {["tier_based", "quantity_threshold"].includes(form.calculation_type) && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-700">Bonus Rate</label>
                                                <Input type="number" value={form.bonus_rate} onChange={f("bonus_rate")} className="h-11" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-700">Threshold</label>
                                                <Input type="number" value={form.target_threshold} onChange={f("target_threshold")} className="h-11" />
                                            </div>
                                        </>
                                    )}
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-700">Max Cap</label>
                                        <Input type="number" value={form.max_payable} onChange={f("max_payable")} className="h-11" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-white shrink-0">
                            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                            <Button onClick={handleSubmit} disabled={creating || !form.name.trim() || !form.base_rate} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (modalMode === "create" ? "Create Scheme" : "Update Scheme")}
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
