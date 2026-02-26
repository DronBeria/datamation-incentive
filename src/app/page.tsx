"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, Key, Eye, EyeOff, Zap,
  ShieldCheck, TrendingUp, Users, BarChart3, ArrowRight
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  admin: "text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
  manager: "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20",
  accounts: "text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20",
  salesperson: "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20",
};

const FEATURES = [
  { icon: TrendingUp, label: "Real-time Incentive Tracking", desc: "Live commission calculations across your entire team" },
  { icon: ShieldCheck, label: "Role-based Access Control", desc: "Granular permissions for every stakeholder tier" },
  { icon: BarChart3, label: "Audit-ready Reporting", desc: "Complete trails for every financial action taken" },
];

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"login" | "forgot" | "reset" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("4");
  const [department, setDepartment] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [quickUsers, setQuickUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
    // Fetch dynamic quick logins with cache buster
    fetch(`/api/auth/quick-logins?t=${Date.now()}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setQuickUsers(d);
      })
      .catch(() => { });
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName, role_id: roleId, department }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Account Created", {
          description: "Your registration is pending administrator approval.",
        });
        setView("login");
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Recovery Initialized", {
          description: "If an account exists, a reset code has been generated.",
        });
        if (data.token) {
          // In a real app we'd email this, for now we help the user
          setResetToken(data.token);
          setView("reset");
        }
      } else {
        toast.info(data.message);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      if (res.ok) {
        toast.success("Password updated successfully");
        setView("login");
        setPassword(newPassword);
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const quickLogin = (emailVal: string) => {
    setEmail(emailVal);
    setPassword(""); // Only show the email, let user type password if needed or just clear it
    setView("login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg animate-pulse">
            <Zap className="h-6 w-6 text-white fill-white" />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-[52%] bg-slate-950 flex-col justify-between px-16 py-12 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full -mr-48 -mt-48" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/8 blur-[100px] rounded-full -ml-48 -mb-48" />
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
        </div>

        {/* Top: Brand */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <Zap className="h-5 w-5 text-white fill-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">Payout<span className="text-indigo-400">Power</span></span>
              <span className="block text-[9px] text-slate-600 font-bold uppercase tracking-[0.3em] leading-none">IMS v2.0</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">All Systems Nominal</span>
          </div>
        </div>

        {/* Center: Hero text */}
        <div className="relative z-10 space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 mb-6">
              <Zap className="h-3 w-3 text-indigo-400 fill-indigo-400" />
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Incentive Management Platform</span>
            </div>
            <h1 className="text-5xl font-black text-white leading-[1.05] tracking-tight">
              Commission<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                Managed.
              </span><br />
              Precisely.
            </h1>
            <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-sm font-medium">
              The high-performance incentive engine for sales-driven enterprises. Transparent, audit-ready, and lightning-fast.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-4 group">
                <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30 transition-all">
                  <f.icon className="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{f.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Footer */}
        <div className="relative z-10 flex items-center justify-between">
          <p className="text-[10px] text-slate-700 font-bold uppercase tracking-[0.3em]">© 2026 PayoutPower IMS</p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-700 font-semibold">Secured by</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
              <ShieldCheck className="h-3 w-3 text-slate-500" />
              <span className="text-[10px] font-bold text-slate-500">JWT + RBAC</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center px-6 bg-[#f8f9fc] relative overflow-hidden">
        {/* Subtle pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{ backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`, backgroundSize: '20px 20px' }} />

        <div className="w-full max-w-[400px] relative z-10">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white fill-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">Payout<span className="text-indigo-600">Power</span></span>
          </div>

          {/* ── LOGIN FORM ── */}
          {view === "login" && (
            <div className="space-y-8">
              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Secure Sign In</p>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back.</h2>
                <p className="text-slate-500 text-sm mt-1.5 font-medium">Enter your credentials to access your workspace.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Work Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                    className="h-12 border-slate-200 bg-white rounded-xl px-4 text-slate-900 font-medium placeholder:text-slate-300 focus-visible:ring-indigo-500 focus-visible:border-indigo-400 transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Password</label>
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="h-12 border-slate-200 bg-white rounded-xl px-4 pr-11 text-slate-900 font-medium placeholder:text-slate-300 focus-visible:ring-indigo-500 focus-visible:border-indigo-400 transition-all shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Sign In <ArrowRight className="h-3.5 w-3.5" /></>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-500 font-medium">
                    New to the platform?{" "}
                    <button
                      type="button"
                      onClick={() => setView("signup")}
                      className="font-bold text-indigo-600 hover:text-indigo-700 underline-offset-4 hover:underline"
                    >
                      Create an account
                    </button>
                  </p>
                </div>
              </form>

              {/* Quick login nodes */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Dev Quick Access</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quickUsers.map((u) => (
                    <button
                      key={u.email}
                      onClick={() => quickLogin(u.email)}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all active:scale-[0.98] ${ROLE_COLORS[u.label] || "text-slate-400 bg-slate-500/10 border-slate-500/20"}`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{u.label}</span>
                      <span className="text-[11px] font-medium truncate w-full">{u.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {view === "forgot" && (
            <div className="space-y-8">
              <button
                onClick={() => setView("login")}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-all group text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back to sign in
              </button>

              <div>
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-5">
                  <Key className="h-5 w-5 text-indigo-600" />
                </div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Account Recovery</p>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reset password.</h2>
                <p className="text-slate-500 text-sm mt-1.5 font-medium leading-relaxed">
                  Enter your email address and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleForgot} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="h-12 border-slate-200 bg-white rounded-xl px-4 font-medium placeholder:text-slate-300 focus-visible:ring-indigo-500 shadow-sm"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
                </Button>
              </form>
            </div>
          )}

          {/* ── RESET PASSWORD ── */}
          {view === "reset" && (
            <div className="space-y-8">
              <div>
                <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">New Password</p>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Set new password.</h2>
                <p className="text-slate-500 text-sm mt-1.5 font-medium">Choose a strong password (min. 8 characters).</p>
              </div>

              <form onSubmit={handleReset} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reset Token</label>
                  <Input
                    type="text"
                    value={resetToken}
                    readOnly
                    className="h-12 bg-slate-100 border-slate-200 text-slate-500 font-mono text-[11px] rounded-xl px-4"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      className="h-12 border-slate-200 bg-white rounded-xl px-4 pr-11 font-medium placeholder:text-slate-300 focus-visible:ring-emerald-500 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-[0.98]"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                </Button>
              </form>
            </div>
          )}
          {/* ── SIGNUP FORM ── */}
          {view === "signup" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => setView("login")}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-all group text-sm font-medium"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Back to sign in
              </button>

              <div>
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Registration</p>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Join the team.</h2>
                <p className="text-slate-500 text-sm mt-1.5 font-medium leading-relaxed">
                  Fill in your details to request system access.
                </p>
              </div>

              <form onSubmit={handleSignup} className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="h-11 border-slate-200 bg-white rounded-xl px-4 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Work Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="h-11 border-slate-200 bg-white rounded-xl px-4 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Desired Role</label>
                    <select
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      className="w-full h-11 border-slate-200 bg-white rounded-xl px-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
                    >
                      <option value="4">Salesperson</option>
                      <option value="2">Manager</option>
                      <option value="3">Accounts</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Department</label>
                    <Input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Sales"
                      className="h-11 border-slate-200 bg-white rounded-xl px-4 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set a secure password"
                    required
                    className="h-11 border-slate-200 bg-white rounded-xl px-4 font-medium"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg mt-2 transition-all"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Approval"}
                </Button>

                <p className="text-[10px] text-center text-slate-400 font-medium px-4">
                  By clicking Request Approval, your profile will be indexed and sent to the administrator for verification.
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
