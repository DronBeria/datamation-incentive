"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Loader2, ShieldCheck, Zap, Eye, EyeOff, ArrowRight,
    CheckCircle2, XCircle, AlertTriangle, Lock
} from "lucide-react";

function PasswordStrength({ password }: { password: string }) {
    const checks = [
        { label: "At least 8 characters", pass: password.length >= 8 },
        { label: "Contains uppercase letter", pass: /[A-Z]/.test(password) },
        { label: "Contains lowercase letter", pass: /[a-z]/.test(password) },
        { label: "Contains a number", pass: /\d/.test(password) },
        { label: "Contains special character", pass: /[!@#$%^&*(),.?\":{}|<>]/.test(password) },
    ];
    const score = checks.filter(c => c.pass).length;
    const barColor = score <= 1 ? "bg-red-500" : score <= 2 ? "bg-orange-500" : score <= 3 ? "bg-amber-500" : score <= 4 ? "bg-blue-500" : "bg-emerald-500";
    const label = score <= 1 ? "Very Weak" : score <= 2 ? "Weak" : score <= 3 ? "Fair" : score <= 4 ? "Strong" : "Very Strong";

    if (!password) return null;

    return (
        <div className="space-y-3 mt-3">
            <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${(score / 5) * 100}%` }} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${score >= 4 ? "text-emerald-600" : score >= 3 ? "text-amber-600" : "text-red-600"}`}>
                    {label}
                </span>
            </div>
            <div className="grid grid-cols-1 gap-1">
                {checks.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                        {c.pass ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        ) : (
                            <XCircle className="h-3 w-3 text-slate-300 shrink-0" />
                        )}
                        <span className={`text-[11px] font-medium ${c.pass ? "text-emerald-600" : "text-slate-400"}`}>{c.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) {
            setError("Missing reset token. Please use the link from your email.");
        }
    }, [token]);

    const isPasswordStrong = () => {
        return (
            newPassword.length >= 8 &&
            /[A-Z]/.test(newPassword) &&
            /[a-z]/.test(newPassword) &&
            /\d/.test(newPassword)
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast.error("Invalid reset link.");
            return;
        }

        if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters.");
            return;
        }

        if (!isPasswordStrong()) {
            toast.error("Password must contain uppercase, lowercase, and a number.");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await res.json();

            if (res.ok) {
                setDone(true);
                toast.success("Password updated successfully!");
            } else {
                toast.error(data.error || "Failed to reset password.");
                if (data.error?.includes("expired") || data.error?.includes("Invalid")) {
                    setError(data.error);
                }
            }
        } catch (err: any) {
            toast.error("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    // ─── SUCCESS STATE ───
    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc] px-4" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                <div className="w-full max-w-[440px] text-center space-y-8">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-50 border border-emerald-100 mx-auto">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Password Updated</h1>
                        <p className="text-slate-500 text-sm mt-2 font-medium leading-relaxed">
                            Your security credentials have been successfully updated. You can now sign in with your new password.
                        </p>
                    </div>
                    <Button
                        onClick={() => router.push("/")}
                        className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
                    >
                        Go to Sign In <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    // ─── ERROR STATE (invalid/expired token) ───
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc] px-4" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                <div className="w-full max-w-[440px] text-center space-y-8">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-red-50 border border-red-100 mx-auto">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Invalid Reset Link</h1>
                        <p className="text-slate-500 text-sm mt-2 font-medium leading-relaxed">
                            {error}
                        </p>
                        <p className="text-slate-400 text-xs mt-3 font-medium">
                            Reset links expire after 60 minutes for security. Please request a new one.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={() => router.push("/")}
                            className="h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all"
                        >
                            Back to Sign In
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── RESET FORM ───
    return (
        <div className="min-h-screen flex" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Left panel */}
            <div className="hidden lg:flex lg:w-[45%] bg-slate-950 flex-col justify-center items-center px-16 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-600/10 blur-[120px] rounded-full -mr-48 -mt-48" />
                    <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-600/8 blur-[100px] rounded-full -ml-48 -mb-48" />
                </div>

                <div className="relative z-10 space-y-8 max-w-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Zap className="h-5 w-5 text-white fill-white" />
                        </div>
                        <div>
                            <span className="text-lg font-bold text-white tracking-tight">Payout<span className="text-indigo-400">Power</span></span>
                            <span className="block text-[9px] text-slate-600 font-bold uppercase tracking-[0.3em]">IMS v2.0</span>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-3xl font-black text-white leading-tight tracking-tight">
                            Set your<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">new password.</span>
                        </h2>
                        <p className="mt-4 text-slate-400 text-sm leading-relaxed font-medium">
                            Choose a strong, unique password that you don't use on other sites. Your security is our priority.
                        </p>
                    </div>

                    <div className="space-y-4 pt-4">
                        {[
                            { icon: Lock, text: "Passwords are encrypted with bcrypt (cost factor 12)" },
                            { icon: ShieldCheck, text: "Reset tokens expire after 60 minutes" },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                    <item.icon className="h-4 w-4 text-emerald-400" />
                                </div>
                                <span className="text-xs text-slate-400 font-medium">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel - Form */}
            <div className="flex-1 flex items-center justify-center px-6 bg-[#f8f9fc] relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
                    style={{ backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />

                <div className="w-full max-w-[420px] relative z-10">
                    {/* Mobile brand */}
                    <div className="lg:hidden flex items-center gap-2.5 mb-10">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-white fill-white" />
                        </div>
                        <span className="text-lg font-bold text-slate-900 tracking-tight">Payout<span className="text-indigo-600">Power</span></span>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-5">
                                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                            </div>
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Secure Reset</p>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create new password</h2>
                            <p className="text-slate-500 text-sm mt-1.5 font-medium leading-relaxed">
                                Enter and confirm your new password below.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* New Password */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">New Password</label>
                                <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter your new password"
                                        required
                                        autoComplete="new-password"
                                        className="h-12 border-slate-200 bg-white rounded-xl px-4 pr-11 text-slate-900 font-medium placeholder:text-slate-300 focus-visible:ring-emerald-500 focus-visible:border-emerald-400 transition-all shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <PasswordStrength password={newPassword} />
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Confirm Password</label>
                                <div className="relative">
                                    <Input
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter your new password"
                                        required
                                        autoComplete="new-password"
                                        className={`h-12 border-slate-200 bg-white rounded-xl px-4 pr-11 text-slate-900 font-medium placeholder:text-slate-300 transition-all shadow-sm ${confirmPassword && confirmPassword !== newPassword
                                                ? "border-red-300 focus-visible:ring-red-500"
                                                : confirmPassword && confirmPassword === newPassword
                                                    ? "border-emerald-300 focus-visible:ring-emerald-500"
                                                    : "focus-visible:ring-emerald-500"
                                            }`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                                    >
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {confirmPassword && confirmPassword !== newPassword && (
                                    <p className="text-[11px] font-semibold text-red-500 flex items-center gap-1.5 mt-1">
                                        <XCircle className="h-3 w-3" /> Passwords do not match
                                    </p>
                                )}
                                {confirmPassword && confirmPassword === newPassword && newPassword.length >= 8 && (
                                    <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1.5 mt-1">
                                        <CheckCircle2 className="h-3 w-3" /> Passwords match
                                    </p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                disabled={submitting || !newPassword || !confirmPassword || newPassword !== confirmPassword || !isPasswordStrong()}
                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>Update Password <ArrowRight className="h-3.5 w-3.5" /></>
                                )}
                            </Button>

                            <p className="text-[10px] text-center text-slate-400 font-medium px-4">
                                After resetting, you will be redirected to the sign-in page to log in with your new credentials.
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
