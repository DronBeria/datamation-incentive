"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Shield, Info, ShieldCheck } from "lucide-react";
import { SessionsPanel } from "@/components/sessions-panel";

type Settings = { tds_enabled: boolean; tds_rate: number; tds_threshold_yearly: number };

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({ tds_enabled: false, tds_rate: 10, tds_threshold_yearly: 30000 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(d => { if (d && !d.error) setSettings(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const patchSetting = async (key: string, value: string | boolean | number) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: String(value) }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d?.error || "Failed to save");
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        patchSetting("tds_enabled", settings.tds_enabled),
        patchSetting("tds_rate", settings.tds_rate),
        patchSetting("tds_threshold_yearly", settings.tds_threshold_yearly),
      ]);
      toast.success("Settings saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="p-8 border border-red-100 bg-red-50/30 rounded-2xl text-center max-w-sm">
          <Shield className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Access Restricted</p>
          <p className="text-xs text-slate-400 mt-1">Only administrators can access System Settings.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure tax compliance and manage active sessions</p>
      </div>

      {/* TDS Section */}
      <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100 bg-slate-50/30">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Tax & Compliance (TDS)</h2>
            <p className="text-xs text-slate-400 mt-0.5">Section 194H — Tax Deducted at Source on commission payments</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-slate-900">Enable TDS Deduction</p>
                <p className="text-xs text-slate-500 mt-0.5">Automatically deduct TDS when marking batches as paid</p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, tds_enabled: !s.tds_enabled }))}
                className={`h-9 px-5 rounded-lg text-xs font-semibold transition-all border ${settings.tds_enabled
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
              >
                {settings.tds_enabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            {/* Rate inputs */}
            <div className={`grid grid-cols-2 gap-4 transition-opacity ${settings.tds_enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">TDS Rate (%)</label>
                <Input
                  type="number"
                  value={settings.tds_rate}
                  onChange={e => setSettings(s => ({ ...s, tds_rate: parseFloat(e.target.value) || 0 }))}
                  disabled={!settings.tds_enabled}
                  min={0} max={100} step={0.1}
                  className="h-10 border-slate-200 bg-white rounded-lg text-sm font-medium"
                />
                <p className="text-[10px] text-slate-400">Standard rate under Section 194H is 10%</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Annual Threshold (₹)</label>
                <Input
                  type="number"
                  value={settings.tds_threshold_yearly}
                  onChange={e => setSettings(s => ({ ...s, tds_threshold_yearly: parseFloat(e.target.value) || 0 }))}
                  disabled={!settings.tds_enabled}
                  min={0}
                  className="h-10 border-slate-200 bg-white rounded-lg text-sm font-medium"
                />
                <p className="text-[10px] text-slate-400">TDS applies when annual commission exceeds this amount</p>
              </div>
            </div>

            {/* Info box */}
            <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${settings.tds_enabled ? "bg-blue-50/40 border-blue-100" : "bg-slate-50 border-slate-100"}`}>
              <Info className={`h-4 w-4 shrink-0 mt-0.5 ${settings.tds_enabled ? "text-blue-600" : "text-slate-400"}`} />
              <div>
                <p className={`text-xs font-semibold ${settings.tds_enabled ? "text-blue-800" : "text-slate-600"}`}>
                  {settings.tds_enabled
                    ? `TDS at ${settings.tds_rate}% will be deducted on commissions exceeding ₹${settings.tds_threshold_yearly.toLocaleString("en-IN")}/year per payee under Section 194H.`
                    : "TDS deduction is currently disabled. Toggle ON to apply tax deductions automatically during payment processing."}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  Toggle OFF if your organisation handles TDS separately through payroll software.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveAll} disabled={saving}
                className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Active Sessions */}
      <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-5 border-b border-slate-100 bg-slate-50/30">
          <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Active Sessions</h2>
            <p className="text-xs text-slate-400 mt-0.5">Devices currently logged in to your account</p>
          </div>
        </div>
        <div className="p-6">
          <SessionsPanel />
        </div>
      </Card>
    </div>
  );
}
