import React, { useState } from "react";
import {
  Wrench,
  Cpu,
  Zap,
  ShieldCheck,
  Clock,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Radio,
  ArrowRight,
  Lock,
  Mail,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  LogIn,
  X,
  Flame,
  Shield,
  Coins,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { MaintenanceConfig } from "../types";
import { setAdminBypassActive } from "../services/maintenanceService";

const OFFICIAL_LOGO_URL =
  "https://www.image2url.com/r2/default/images/1788689706282-c5dba61a-62f0-4e07-91a9-b68c5dbc2bba.jpeg";

interface MaintenanceViewProps {
  config: MaintenanceConfig;
  isPreviewing?: boolean;
  onExitPreview?: () => void;
  onBypass?: () => void;
  onRefresh?: () => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  config,
  isPreviewing,
  onExitPreview,
  onBypass,
  onRefresh,
}) => {
  const { currentUser, isAdmin, signInWithEmail, loginWithGoogle } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string>("");

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword.trim()) {
      setLoginError("Please enter your admin email and password.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError("");
    try {
      await signInWithEmail(adminEmail.trim(), adminPassword.trim());
      // Admin authenticated successfully
      setAdminBypassActive(true);
      setShowAdminLogin(false);
      if (onBypass) onBypass();
    } catch (err: any) {
      console.error("Admin login error:", err);
      setLoginError(err.message || "Invalid admin credentials.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setIsLoggingIn(true);
    setLoginError("");
    try {
      await loginWithGoogle();
      setAdminBypassActive(true);
      setShowAdminLogin(false);
      if (onBypass) onBypass();
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setLoginError(err.message || "Failed to authenticate with Google.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDirectBypass = () => {
    setAdminBypassActive(true);
    if (onBypass) onBypass();
  };

  const handleCheckStatus = () => {
    setIsRefreshing(true);
    setRefreshMessage("");
    setTimeout(() => {
      setIsRefreshing(false);
      if (onRefresh) {
        onRefresh();
      }
      setRefreshMessage("Checked system status: Upgrades are still actively in progress. Please check back shortly.");
      setTimeout(() => setRefreshMessage(""), 5000);
    }, 800);
  };

  return (
    <div className="min-h-screen w-full bg-[#050a0f] text-slate-100 flex flex-col justify-between selection:bg-amber-400/30 selection:text-amber-200 relative overflow-hidden">
      {/* Background ambient decorative glows */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-amber-500/10 via-cyan-500/10 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-cyan-500/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 -right-40 w-[450px] h-[450px] bg-amber-500/5 blur-[100px] pointer-events-none" />

      {/* Grid line background overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Admin Preview Top Banner */}
      {isPreviewing && (
        <div className="relative z-30 w-full bg-cyan-950/90 border-b border-cyan-500/40 px-4 py-2 flex items-center justify-between text-xs text-cyan-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-bold uppercase tracking-wider font-orbitron text-[11px]">
              ADMIN PREVIEW MODE:
            </span>
            <span>You are previewing how regular visitors see the Update in Progress screen.</span>
          </div>
          {onExitPreview && (
            <button
              type="button"
              onClick={onExitPreview}
              className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider font-orbitron transition-all cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.4)]"
            >
              Exit Preview & Return to Workspace
            </button>
          )}
        </div>
      )}

      {/* Top Bar */}
      <header className="relative z-10 w-full border-b border-white/[0.06] bg-[#060b10]/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-[#09141f] border border-cyan-400/50 shadow-[0_0_15px_rgba(0,240,255,0.3)] overflow-hidden p-0.5">
            <img
              src={OFFICIAL_LOGO_URL}
              alt="ffglorynepal"
              className="h-full w-full object-cover rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white tracking-wider text-sm sm:text-base font-orbitron">
                FFGLORYNEPAL
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold tracking-wider font-orbitron uppercase">
                Under Maintenance
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Official Free Fire Glory Farming & Automated Bot Network
            </p>
          </div>
        </div>

        {/* Top Right: Admin Portal Link / Bypass */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAdmin ? (
            <button
              type="button"
              onClick={handleDirectBypass}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider font-orbitron shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Admin Workspace</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdminLogin(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              title="Site owner & developer access"
            >
              <Lock className="h-3 w-3 text-cyan-400" />
              <span>Staff Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center justify-center text-center">
        {/* Status Radar Pulsing Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-widest uppercase font-orbitron shadow-[0_0_20px_rgba(245,158,11,0.15)] mb-6 animate-pulse">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <span>SYSTEM UPDATE IN PROGRESS</span>
        </div>

        {/* Primary Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight font-orbitron uppercase leading-[1.1] max-w-3xl">
          Website Temporarily Closed For{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-cyan-400">
            Major Upgrades
          </span>
        </h1>

        {/* Subtitle / User message */}
        <p className="mt-5 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          {config.message ||
            "We are currently updating our systems, restructuring the platform architecture, and rolling out new features to provide a smoother, faster, and more reliable experience. The website is temporarily closed to the public."}
        </p>

        {/* Live Timeline & Status Strip */}
        <div className="w-full max-w-xl mt-8 p-4 rounded-2xl bg-[#09121c]/90 border border-cyan-500/25 backdrop-blur-xl shadow-[0_0_30px_rgba(0,240,255,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono mb-2.5">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              Current Status:
            </span>
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Platform Restructuring & Rollout
            </span>
          </div>

          {/* Progress bar visual */}
          <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-400 rounded-full animate-pulse"
              style={{ width: "65%" }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono">
            <span>Core Updates (Phase 2/3)</span>
            <span className="text-cyan-300 font-semibold">{config.estimatedReturn || "Returning Soon"}</span>
          </div>
        </div>

        {/* Upgrade Highlights Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-2xl mt-8 text-left">
          <div className="p-4 rounded-2xl bg-[#0a111a]/80 border border-white/[0.08] hover:border-cyan-500/40 transition-all">
            <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-xs uppercase tracking-wider font-orbitron mb-1.5">
              <Zap className="h-4 w-4" />
              <span>Bot Engine 2.0</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ultra-low latency Free Fire clan matchmaking with optimized India, Bangladesh, and global game server routing.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a111a]/80 border border-white/[0.08] hover:border-amber-500/40 transition-all">
            <div className="flex items-center gap-2.5 text-amber-400 font-bold text-xs uppercase tracking-wider font-orbitron mb-1.5">
              <Coins className="h-4 w-4" />
              <span>Enhanced Wallet & QR</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Faster Fonepay and local bank transfer verification with direct admin approval queues and zero credit deductions.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a111a]/80 border border-white/[0.08] hover:border-emerald-500/40 transition-all">
            <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-xs uppercase tracking-wider font-orbitron mb-1.5">
              <ShieldCheck className="h-4 w-4" />
              <span>Airtight Security</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Multi-layer server validation, test ID blocking, and zero-loss credit safeguards permanently protecting your balance.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0a111a]/80 border border-white/[0.08] hover:border-purple-500/40 transition-all">
            <div className="flex items-center gap-2.5 text-purple-400 font-bold text-xs uppercase tracking-wider font-orbitron mb-1.5">
              <Sparkles className="h-4 w-4" />
              <span>New UI & Controls</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Refined, mobile-first player dashboard with instant server telemetry, clean transaction tracking, and direct actions.
            </p>
          </div>
        </div>

        {/* User Balance & Safety Reassurance Note */}
        <div className="w-full max-w-2xl mt-6 p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3 text-left">
          <Shield className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-emerald-300 block font-orbitron">
              All User Balances & Data Are 100% Safe
            </span>
            <p className="text-slate-300 leading-relaxed">
              Your registered account, current credit balance, and complete transaction history are securely preserved in cloud database storage. Nothing will be lost or reset during this maintenance window.
            </p>
          </div>
        </div>

        {/* Action Controls & Support */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 w-full max-w-md">
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={isRefreshing}
            className="w-full sm:flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider font-orbitron transition-all shadow-[0_0_20px_rgba(0,240,255,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Checking Systems..." : "Check If Site Is Live"}</span>
          </button>

          {config.telegramChannel && (
            <a
              href={config.telegramChannel}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider font-orbitron transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
              <span>Announcements</span>
            </a>
          )}
        </div>

        {/* Status check response notification if clicked */}
        {refreshMessage && (
          <p className="mt-3 text-xs text-amber-300 font-mono animate-in fade-in duration-200">
            {refreshMessage}
          </p>
        )}

        {/* Support inquiries */}
        <div className="mt-8 text-xs text-slate-400 flex flex-wrap items-center justify-center gap-4">
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-cyan-400" />
            <span>Support:</span>
            <a href={`mailto:${config.contactEmail || "support@ffglorynepal.com"}`} className="text-cyan-300 hover:underline">
              {config.contactEmail || "support@ffglorynepal.com"}
            </a>
          </span>
          {config.whatsappContact && (
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
              <span>WhatsApp Helpline:</span>
              <span className="text-slate-200 font-mono">{config.whatsappContact}</span>
            </span>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/[0.06] bg-[#060b10]/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} ffglorynepal. All rights reserved.</span>
          <span className="text-[11px] text-slate-600">
            Undergoing Scheduled Upgrades & Infrastructure Maintenance
          </span>
        </div>
      </footer>

      {/* ADMIN LOGIN MODAL (For Owner / Staff Bypass) */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-cyan-500/40 bg-[#08121c] p-6 sm:p-7 shadow-[0_0_50px_rgba(0,240,255,0.2)] relative">
            <button
              type="button"
              onClick={() => setShowAdminLogin(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Lock className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-bold text-white font-orbitron">
                Owner & Staff Login
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Log in with your administrator account to access the workspace, make site changes, or toggle maintenance mode.
            </p>

            {loginError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminSignIn} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider font-orbitron mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@ffglorynepal.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider font-orbitron mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider font-orbitron transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="h-4 w-4" />
                <span>{isLoggingIn ? "Verifying..." : "Enter Workspace"}</span>
              </button>
            </form>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative bg-[#08121c] px-2 text-[10px] uppercase text-slate-500 font-mono">
                or sign in with
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleAdminLogin}
              disabled={isLoggingIn}
              className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign In With Google (Admin Account)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
