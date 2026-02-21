"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
    CheckCircle2, Calculator, Sparkles, Edit2, Trash2
} from "lucide-react";

// ── Scheme type definitions ──────────────────────────────────────────
const SCHEME_TYPES = [
    {
        val: "percentage",
        label: "Percentage",
        icon: Percent,
        color: "text-blue-600",
        bg: "bg-blue-50",
        desc: "Pay a fixed % of each deal's total value",
        example: "5% of ₹1,00,000 deal → ₹5,000 commission",
    },
    {
        val: "tier_based",
        label: "Tiered Bonus",
        icon: Layers,
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        desc: "Higher rate unlocks once a revenue target is crossed",
        example: "5% base, escalates to 8% above ₹5L threshold",
    },
    {
        val: "quantity_threshold",
        label: "Qty Threshold",
        icon: Hash,
        color: "text-cyan-600",
        bg: "bg-cyan-50",
        desc: "Surge bonus per unit after crossing a unit milestone",
        example: "₹200/unit standard, ₹350/unit after 50 units sold",
    },
    {
        val: "fixed_per_qty",
        label: "Fixed Per Unit",
        icon: Box,
        color: "text-violet-600",
        bg: "bg-violet-50",
        desc: "Flat rupee amount for every unit sold, regardless of deal size",
        example: "₹500 per unit sold, always",
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

// ── Main page ────────────────────────────────────────────────────────
export default function SchemesPage() {
    const [schemes, setSchemes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    const fetchSchemes = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch("/api/schemes");
            if (!r.ok) throw new Error("Connection failed");
            const d = await r.json();
            if (Array.isArray(d)) setSchemes(d);
        } catch (err) {
            console.error("Fetch schemes error:", err);
            toast.error("Network synchronization failed");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSchemes(); }, [fetchSchemes]);

    const resetForm = () => setForm(EMPTY_FORM);

    const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value }));

    const handleSubmit = async () => {
        if (!form.name.trim()) { toast.error("Scheme name is mandatory"); return; }
        if (!form.base_rate) { toast.error("Primary rate must be defined"); return; }

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
            toast.error("Network error — please try again");
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
            base_rate: isPercent ? (s.base_rate * 100).toString() : s.base_rate.toString(),
            target_threshold: s.target_threshold.toString(),
            bonus_rate: isBonusPercent ? (s.bonus_rate * 100).toString() : s.bonus_rate.toString(),
            max_payable: s.max_payable?.toString() || "",
        });
        setEditingId(s.id);
        setModalMode("edit");
        setShowCreate(true);
    };

    const isPercent = ["percentage", "tier_based"].includes(form.calculation_type);
    const hasTier = ["tier_based", "quantity_threshold"].includes(form.calculation_type);

    const stats = useMemo(() => ([
        { label: "Active Schemes", value: `${schemes.length}`, icon: Target, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Tiered Rules", value: `${schemes.filter(s => s.calculation_type !== "percentage").length}`, icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50" },
        {
            label: "Base Rate Avg",
            value: schemes.length
                ? `${(schemes.filter(s => !["fixed_per_qty", "quantity_threshold"].includes(s.calculation_type))
                    .reduce((a, s) => a + s.base_rate * 100, 0) /
                    Math.max(schemes.filter(s => !["fixed_per_qty", "quantity_threshold"].includes(s.calculation_type)).length, 1)).toFixed(1)}%`
                : "0.0%",
            icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50",
        },
    ]), [schemes]);

    const currentType = SCHEME_TYPES.find(x => x.val === form.calculation_type)!;

    const calcExample = (val: number) => {
        const { calculation_type, base_rate, bonus_rate, target_threshold } = form;
        const br = Number(base_rate) || 0;
        const bnr = Number(bonus_rate) || 0;
        const tt = Number(target_threshold) || 0;

        if (calculation_type === "percentage") return val * (br / 100);
        if (calculation_type === "fixed_per_qty") return 10 * br; // Assume 10 units
        if (calculation_type === "tier_based") return val >= tt ? val * (bnr / 100) : val * (br / 100);
        if (calculation_type === "quantity_threshold") return 10 > tt ? 10 * bnr : 10 * br;
        return 0;
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-heading text-slate-900 tracking-tight">Commission Schemes</h1>
                    <p className="text-sm text-slate-500 mt-1">Configure automated rules for commission calculations</p>
                </div>
                <Button
                    onClick={() => { resetForm(); setModalMode("create"); setShowCreate(true); }}
                    className="bg-blue-600 hover:bg-blue-500 h-10 px-5 font-bold text-xs uppercase tracking-widest text-white rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95"
                >
                    <Plus className="h-4 w-4" /> New Scheme
                </Button>
            </div>

            {/* KPI Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map((s, i) => (
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

            {/* Schemes List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600/30" />
                    <p className="text-xs font-semibold text-slate-400">Loading schemes...</p>
                </div>
            ) : schemes.length === 0 ? (
                <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl py-24 flex flex-col items-center text-center">
                    <Zap className="h-10 w-10 text-slate-200 mb-3" />
                    <p className="text-base font-semibold text-slate-900">No schemes found</p>
                    <p className="text-xs font-medium text-slate-400 mt-1">Create your first commission scheme to get started.</p>
                    <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-6 rounded-xl h-9 px-6 text-xs font-semibold">Create Scheme</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {schemes.map((s) => {
                        const t = SCHEME_TYPES.find(x => x.val === s.calculation_type) || SCHEME_TYPES[0];
                        const isFixedOrQty = ["fixed_per_qty", "quantity_threshold"].includes(s.calculation_type);
                        return (
                            <Card key={s.id} className="border border-slate-100 shadow-sm bg-white rounded-2xl hover:shadow-md transition-all duration-300 overflow-hidden group">
                                <div className="p-6 space-y-5">
                                    <div className="flex items-start justify-between">
                                        <div className={`h-11 w-11 rounded-xl ${t.bg} flex items-center justify-center shadow-sm`}>
                                            <t.icon className={`h-5 w-5 ${t.color}`} />
                                        </div>
                                        <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border-none flex items-center gap-1.5 ${t.bg} ${t.color}`}>
                                            {t.label}
                                        </Badge>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-heading text-slate-900 tracking-tight leading-none mb-2 group-hover:text-blue-600 transition-colors">{s.name}</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{s.description || t.desc}</p>
                                    </div>
                                    <div className="flex items-end justify-between border-t border-slate-50 pt-5">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Payout Rate</p>
                                            <p className={`text-3xl font-heading ${t.color} tabular-nums tracking-tighter leading-none`}>
                                                {isFixedOrQty ? `₹${s.base_rate}` : `${(s.base_rate * 100).toFixed(1)}%`}
                                            </p>
                                        </div>
                                        {s.target_threshold > 0 && (
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Threshold</p>
                                                <p className="text-base font-bold text-slate-900 tabular-nums leading-none">
                                                    {s.calculation_type === "quantity_threshold" ? `${s.target_threshold} units` : `₹${fmt(s.target_threshold)}`}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {s.bonus_rate > 0 && (
                                        <div className="bg-blue-50/50 border border-blue-100/30 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm group-hover:bg-blue-50 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                                                <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Bonus Model</span>
                                            </div>
                                            <span className="text-xs font-bold text-blue-600">
                                                {s.calculation_type === "tier_based" ? `${(s.bonus_rate * 100).toFixed(1)}%` : `₹${s.bonus_rate}/unit`}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button onClick={() => openEdit(s)} variant="outline" className="flex-1 h-9 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-2">
                                            <Edit2 className="h-3 w-3" /> Edit
                                        </Button>
                                        <Button onClick={() => handleDelete(s)} variant="outline" className="h-9 w-9 rounded-xl text-rose-600 border-rose-100 hover:bg-rose-50 hover:border-rose-200">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* ── Scheme Creation Dialog ── */}
            <Dialog open={showCreate} onOpenChange={o => { setShowCreate(o); if (!o) resetForm(); }}>
                <DialogContent className="max-w-[800px] w-[95vw] p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white">
                    <div className="flex flex-col max-h-[90vh]">

                        {/* Header */}
                        <div className="flex items-center gap-4 px-8 py-5 border-b border-slate-100 shrink-0">
                            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                                {modalMode === "create" ? <Plus className="h-5 w-5 text-white" /> : <Edit2 className="h-5 w-5 text-white" />}
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-semibold text-slate-900">
                                    {modalMode === "create" ? "Define Commission Scheme" : "Modify Blueprint"}
                                </DialogTitle>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {modalMode === "create" ? "Configure the payout logic and rules for this scheme." : "Update the calculation parameters for this blueprint."}
                                </p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto custom-scrollbar p-8">
                            <div className="space-y-8">
                                {/* ① Identity */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-bold text-white">1</div>
                                        <p className="text-sm font-semibold text-slate-900">General Identity</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-700">Scheme Name <span className="text-red-500">*</span></label>
                                            <Input
                                                value={form.name}
                                                onChange={f("name")}
                                                placeholder="e.g. Q1 Premium High-Value Sales"
                                                className="h-11 border-slate-200 bg-white rounded-lg text-sm font-medium"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-700">Description</label>
                                            <Input
                                                value={form.description}
                                                onChange={f("description")}
                                                placeholder="Briefly describe the purpose of this scheme..."
                                                className="h-11 border-slate-200 bg-white rounded-lg text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ② Calculation Type */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-bold text-white">2</div>
                                        <p className="text-sm font-semibold text-slate-900">Calculation Engine</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {SCHEME_TYPES.map(t => {
                                            const active = form.calculation_type === t.val;
                                            return (
                                                <button
                                                    key={t.val}
                                                    type="button"
                                                    onClick={() => setForm(p => ({
                                                        ...p,
                                                        calculation_type: t.val,
                                                        base_rate: "",
                                                        bonus_rate: "",
                                                        target_threshold: "",
                                                    }))}
                                                    className={`p-4 rounded-xl border text-left transition-all ${active
                                                        ? "bg-slate-900 border-slate-900 shadow-md"
                                                        : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${active ? "bg-white/10 text-white" : `${t.bg} ${t.color}`}`}>
                                                            <t.icon className="h-4 w-4" />
                                                        </div>
                                                        <span className={`text-sm font-bold ${active ? "text-white" : "text-slate-900"}`}>{t.label}</span>
                                                    </div>
                                                    <p className={`text-[10px] leading-relaxed ${active ? "text-slate-400" : "text-slate-500"}`}>{t.desc}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* ③ Rate Parameters */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-bold text-white">3</div>
                                        <p className="text-sm font-semibold text-slate-900">Rate Parameters</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-700">
                                                {isPercent ? "Base Rate (%)" : "Base Amount (₹ / unit)"} <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={form.base_rate}
                                                    onChange={f("base_rate")}
                                                    placeholder="0"
                                                    className="h-11 border-slate-200 bg-white rounded-lg text-sm pr-10"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                    {isPercent ? "%" : "₹"}
                                                </span>
                                            </div>
                                        </div>
                                        {hasTier && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-700">
                                                    {form.calculation_type === "tier_based" ? "Bonus Rate (%)" : "Surge Rate (₹ / unit)"}
                                                </label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={form.bonus_rate}
                                                        onChange={f("bonus_rate")}
                                                        placeholder="0"
                                                        className="h-11 border-slate-200 bg-white rounded-lg text-sm pr-10"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                        {form.calculation_type === "tier_based" ? "%" : "₹"}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {hasTier && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-700">
                                                    {form.calculation_type === "tier_based" ? "Activation Threshold (₹)" : "Unit Milestone"}
                                                </label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        value={form.target_threshold}
                                                        onChange={f("target_threshold")}
                                                        placeholder="0"
                                                        className="h-11 border-slate-200 bg-white rounded-lg text-sm pr-14"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                                        {form.calculation_type === "tier_based" ? "₹" : "units"}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-700">Payout Cap (Optional)</label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    value={form.max_payable}
                                                    onChange={f("max_payable")}
                                                    placeholder="No cap"
                                                    className="h-11 border-slate-200 bg-white rounded-lg text-sm pr-12"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₹ max</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-white shrink-0">
                            <Button variant="outline" onClick={() => setShowCreate(false)} className="h-10 px-5 rounded-lg text-sm font-medium border-slate-200">
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={creating || !form.name.trim() || !form.base_rate}
                                className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm shadow-sm disabled:opacity-50 transition-all"
                            >
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
