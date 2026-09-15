import React, { useState, useRef } from "react";
import {
  Zap,
  User,
  Lock,
  Mail,
  LogIn,
  ArrowRight,
  MessageSquare,
  Send,
  AlertCircle,
  Sparkles,
  Trophy,
  Shield,
  ShieldCheck,
  CheckCircle2,
  X,
  HelpCircle,
  Coins,
  ChevronRight,
  ExternalLink,
  Flame,
  Radio,
  Server,
  Star,
  Activity,
  Cpu,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CREDIT_RATE_RS } from "../services/api";
import { SUPPORTED_SERVERS } from "../types";
import heroBannerImg from "../assets/images/ff_hero_banner_1788688375850.jpg";

export const OFFICIAL_LOGO_URL =
  "https://www.image2url.com/r2/default/images/1788689706282-c5dba61a-62f0-4e07-91a9-b68c5dbc2bba.jpeg";

export const AuthView: React.FC = () => {
  const { signInWithEmail, signUpWithEmail } = useAuth();

  // Check if user has visited before:
  // First time visitor => show landing page ("landing")
  // Returning visitor => show direct login portal ("direct")
  const [viewMode, setViewMode] = useState<"landing" | "direct">(() => {
    try {
      const visited = localStorage.getItem("ffglory_has_visited");
      return visited === "true" ? "direct" : "landing";
    } catch {
      return "landing";
    }
  });

  const markVisited = () => {
    try {
      localStorage.setItem("ffglory_has_visited", "true");
    } catch {
      // ignore
    }
  };

  const markVisitedAndSwitchToDirect = () => {
    markVisited();
    setViewMode("direct");
  };

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Active navigation tab for scrolling
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const openAuth = (initialMode: "signin" | "signup" = "signin") => {
    markVisited();
    setMode(initialMode);
    setError(null);
    setAuthModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!email || !password) {
          throw new Error("Please enter both email and password");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        await signUpWithEmail(email, password, username || email.split("@")[0]);
      } else {
        if (!email || !password) {
          throw new Error("Please provide your email and password");
        }
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = err.message || "Failed to authenticate";
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/user-not-found"
      ) {
        msg = "Invalid email or password. Please try again or create an account.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "An account with this email already exists. Please sign in.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const pricingPacks = [
    {
      credits: 1,
      priceRs: CREDIT_RATE_RS * 1,
      title: "Starter Single",
      desc: "1 Guild glory match boost",
      popular: false,
    },
    {
      credits: 3,
      priceRs: CREDIT_RATE_RS * 3,
      title: "Tactical Trio",
      desc: "3 Full tournament rounds",
      popular: false,
    },
    {
      credits: 5,
      priceRs: CREDIT_RATE_RS * 5,
      title: "Standard Clan Pack",
      desc: "5 Rounds glory automation",
      popular: true,
    },
    {
      credits: 10,
      priceRs: CREDIT_RATE_RS * 10,
      title: "Pro Tournament Pack",
      desc: "10 Rounds maximum push",
      popular: false,
    },
  ];

  const faqs = [
    {
      q: "Is my Free Fire account safe from bans?",
      a: "Yes, 100% account safe. Our proprietary cloud automation communicates via secure encrypted game packets mimicking legitimate game clients. We never inject client-side memory hacks or unauthorized modified APKs.",
    },
    {
      q: "How does payment work in Nepal?",
      a: `You can load credits instantly using Fonepay, eSewa, or Khalti QR code. Simply scan, transfer RS ${CREDIT_RATE_RS} per credit, verify the transaction remark, and your credits are credited promptly.`,
    },
    {
      q: "How quickly does glory accumulate on Free Fire?",
      a: "Once launched with your target clan account UID, the cloud bots match and finish qualifying matches every 2-4 minutes, delivering thousands of glory points straight to your guild leaderboard.",
    },
    {
      q: "Do I need to keep my phone or computer turned on?",
      a: "No! All automation runs 24/7 on our dedicated low-latency cloud infrastructure. Once started, you can close your browser or turn off your device.",
    },
    {
      q: "Which Free Fire server regions are supported?",
      a: "We support 14 official regional game servers: IN (India), BD (Bangladesh), PK (Pakistan), US (United States), EU (Europe), RU (Russia), BR (Brazil), INDO (Indonesia), SG (Singapore), VN (Vietnam), TH (Thailand), ME (Middle East), NA (North America), and SAC (South & Central America).",
    },
  ];

  // Reusable Auth Card (used in modal AND in direct login view)
  const renderAuthCard = (inModal: boolean) => (
    <div
      className={`relative w-full max-w-md rounded-3xl border border-cyan-500/30 bg-[#08121a]/95 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,240,255,0.2)]`}
    >
      {/* Close Button if in modal */}
      {inModal && (
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Glowing Official Logo Box */}
      <div className="flex justify-center mb-5">
        <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-[#091522] border-2 border-cyan-400/80 shadow-[0_0_30px_rgba(0,240,255,0.5),inset_0_0_15px_rgba(0,240,255,0.3)] overflow-hidden p-1">
          <img
            src={OFFICIAL_LOGO_URL}
            alt="ffglorynepal"
            className="h-full w-full object-cover rounded-xl"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center mb-5">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="font-orbitron font-black text-xl sm:text-2xl text-white tracking-wide">
            FFGLORY<span className="text-[#00f0ff]">NEPAL</span>
          </span>
        </div>
        <h3 className="text-base sm:text-lg font-bold text-slate-200 font-orbitron">
          {mode === "signin" ? "MEMBER SIGN IN" : "CREATE ACCOUNT"}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {mode === "signin"
            ? "Access your automated clan glory console"
            : "Register now to start earning Free Fire guild glory"}
        </p>
      </div>

      {/* Segmented Switcher */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900/90 border border-slate-800 mb-5">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError(null);
          }}
          className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer font-orbitron ${
            mode === "signin"
              ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer font-orbitron ${
            mode === "signup"
              ? "bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-950/50 border border-rose-500/40 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Auth Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Display Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. NepalSniper"
                className="w-full rounded-xl bg-[#09141f] text-white placeholder:text-slate-500 pl-10 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 border border-slate-700"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail className="h-4 w-4" />
            </div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@ffglorynepal.com"
              className="w-full rounded-xl bg-[#09141f] text-white placeholder:text-slate-500 pl-10 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 border border-slate-700"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-xl bg-[#09141f] text-white placeholder:text-slate-500 pl-10 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 border border-slate-700"
            />
          </div>
        </div>

        {mode === "signup" && (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full rounded-xl bg-[#09141f] text-white placeholder:text-slate-500 pl-10 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 border border-slate-700"
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00f0ff] via-[#00e599] to-[#00f0ff] hover:opacity-90 text-slate-950 font-black py-3 text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)] disabled:opacity-50 cursor-pointer font-orbitron active:scale-95"
        >
          {loading ? (
            <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              <span>
                {mode === "signin" ? "Sign In Now" : "Create My Account"}
              </span>
            </>
          )}
        </button>
      </form>

      {/* Rates info */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
        <span className="text-slate-400">
          1 Credit = <strong className="text-amber-300 font-mono">RS {CREDIT_RATE_RS}</strong>
        </span>
        <span className="text-emerald-400 font-mono">eSewa & Khalti Instant</span>
      </div>

      {/* Link back to landing page if in direct mode */}
      {!inModal && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setViewMode("landing")}
            className="text-xs text-slate-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>← Explore features, rates & FAQ homepage</span>
          </button>
        </div>
      )}
    </div>
  );

  // DIRECT LOGIN VIEW (shown for returning visitors who haven't logged in, without needing to browse the full landing page)
  if (viewMode === "direct") {
    return (
      <div className="min-h-screen w-full bg-[#050a0f] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200 relative flex flex-col justify-between overflow-x-hidden font-['Outfit',sans-serif]">
        {/* Ambient atmospheric background glows */}
        <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
        <div className="fixed bottom-10 right-10 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[160px] pointer-events-none -z-10" />

        {/* Top Header */}
        <header className="sticky top-0 z-40 w-full px-4 sm:px-8 py-3.5 border-b border-cyan-500/20 bg-[#08121a]/85 backdrop-blur-xl shadow-lg">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-2">
            {/* Left Brand with official logo image */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-[#09141f] border border-cyan-400/60 shadow-[0_0_18px_rgba(0,240,255,0.45)] overflow-hidden p-0.5">
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="ffglorynepal"
                  className="h-full w-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black tracking-wider font-orbitron flex items-baseline">
                  <span className="text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">
                    FFGLORY
                  </span>
                  <span className="text-[#fef9c3] drop-shadow-[0_0_8px_rgba(254,240,138,0.4)] ml-1">
                    NEPAL
                  </span>
                </span>
                <span className="inline-flex items-center rounded-md bg-[#072018]/90 border border-[#00e599]/60 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black text-[#00e599] font-orbitron uppercase tracking-wider shadow-[0_0_10px_rgba(0,229,153,0.3)]">
                  ONLINE
                </span>
              </div>
            </div>

            {/* Right Buttons: Explore Homepage & Telegram */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setViewMode("landing")}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-bold text-cyan-300 hover:text-white border border-cyan-500/40 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/40 transition-all shadow-[0_0_15px_rgba(0,240,255,0.15)] cursor-pointer"
              >
                <span>← Explore Homepage</span>
              </button>
              <a
                href="https://t.me/"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 border border-slate-800 rounded-xl bg-slate-900/50 px-3 py-2 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Telegram</span>
              </a>
            </div>
          </div>
        </header>

        {/* Center Portal Box */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-8">
          {renderAuthCard(false)}
        </main>

        {/* Bottom Footer */}
        <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-800/80 bg-[#060b10]/80">
          © 2026 ffglorynepal. All rights reserved. · Nepal's #1 Automated Free Fire Glory Engine
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#050a0f] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-x-hidden font-['Outfit',sans-serif]">
      {/* BACKGROUND ATMOSPHERIC GLOWS */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-10 w-[600px] h-[600px] bg-orange-500/10 rounded-full blur-[160px] pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-10 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* TOP FLOATING NAVBAR matching screenshot */}
      <header className="sticky top-0 z-40 w-full px-3 sm:px-6 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-2 rounded-2xl bg-[#08121a]/85 backdrop-blur-xl border border-cyan-500/25 px-4 py-2.5 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
          {/* Left: FFGLORYNEPAL Brand */}
          <div
            onClick={() => scrollToSection("hero")}
            className="flex items-center gap-2.5 cursor-pointer group select-none"
          >
            {/* Glowing Official Logo Icon */}
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#091520] border border-cyan-400/60 shadow-[0_0_15px_rgba(0,240,255,0.4)] group-hover:scale-105 transition-transform overflow-hidden p-0.5">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="ffglorynepal"
                className="h-full w-full object-cover rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Brand Title + LIVE Badge */}
            <div className="flex items-center gap-2">
              <span className="font-orbitron font-black text-base sm:text-lg tracking-wider">
                <span className="text-white">FFGLORY</span>
                <span className="text-[#00f0ff] italic ml-1">NEPAL</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-black text-emerald-400 font-orbitron uppercase tracking-wider shadow-[0_0_8px_rgba(0,229,153,0.3)]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
          </div>

          {/* Middle Nav Pill (Features, How It Works, Pricing, FAQ) */}
          <nav className="hidden md:flex items-center gap-1 rounded-full bg-[#050c12]/90 border border-slate-800/80 px-3 py-1 shadow-inner">
            <button
              onClick={() => scrollToSection("features")}
              className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              FAQ
            </button>
          </nav>

          {/* Right Side: Direct Login, Telegram, Sign In, Get Started */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Direct Login Button */}
            <button
              onClick={markVisitedAndSwitchToDirect}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:text-white border border-cyan-500/30 rounded-xl bg-cyan-950/30 hover:bg-cyan-950/60 transition-colors cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Direct Login</span>
            </button>

            {/* Telegram Link */}
            <a
              href="https://t.me/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-cyan-300 transition-colors px-2 py-1"
            >
              <Send className="h-3.5 w-3.5 text-sky-400" />
              <span>Telegram</span>
            </a>

            {/* Sign In Button */}
            <button
              onClick={() => openAuth("signin")}
              className="px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              Sign In
            </button>

            {/* ✨ Get Started Button */}
            <button
              onClick={() => openAuth("signup")}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#00b4d8] via-[#0096c7] to-[#0077b6] hover:from-[#00c5ee] hover:to-[#0088cc] text-white px-3.5 sm:px-4 py-1.5 text-xs font-black tracking-wide uppercase transition-all shadow-[0_0_20px_rgba(0,180,216,0.5)] hover:shadow-[0_0_25px_rgba(0,180,216,0.75)] cursor-pointer font-orbitron active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5 fill-white" />
              <span>Get Started</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION matching screenshot */}
      <section
        id="hero"
        className="relative min-h-[85vh] flex items-center justify-center pt-8 pb-16 px-4 sm:px-6 overflow-hidden"
      >
        {/* HERO CINEMATIC BACKGROUND IMAGE with dark cinematic gradient overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroBannerImg}
            alt="Free Fire Cinematic Battle"
            className="w-full h-full object-cover object-right md:object-center opacity-40 mix-blend-luminosity filter contrast-125"
          />
          {/* Gradients blending top, bottom, and left sides */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050a0f] via-[#050a0f]/80 to-[#050a0f]/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050a0f] via-[#050a0f]/70 to-transparent" />
          {/* Subtle Orange battlefield glow */}
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* HERO CONTENT */}
        <div className="relative z-10 mx-auto max-w-5xl text-center flex flex-col items-center">
          {/* Top Pill Badge: • TRUSTED BY 3.1M+ PLAYERS */}
          <div className="inline-flex items-center gap-2 rounded-full bg-[#071f1d]/90 border border-emerald-500/40 px-3.5 py-1 text-xs font-bold text-emerald-300 font-mono shadow-[0_0_15px_rgba(0,229,153,0.2)] mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="tracking-widest uppercase text-[10px] sm:text-xs font-black font-orbitron">
              TRUSTED BY 3.1M+ PLAYERS
            </span>
          </div>

          {/* Center Glowing Logo Icon Box */}
          <div className="mb-4">
            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-[#091522] border-2 border-cyan-400/80 shadow-[0_0_35px_rgba(0,240,255,0.6),inset_0_0_20px_rgba(0,240,255,0.3)] overflow-hidden p-1">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="ffglorynepal"
                className="h-full w-full object-cover rounded-xl"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-2 text-[8px] font-bold text-cyan-300 tracking-widest uppercase bg-slate-950 px-2 py-0.5 rounded border border-cyan-400/50 font-mono shadow-md">
                ffglorynepal
              </div>
            </div>
          </div>

          {/* Huge Main Headline: FFGLORY NEPAL */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight font-orbitron mb-3 drop-shadow-[0_5px_25px_rgba(0,0,0,0.9)] flex flex-wrap items-center justify-center gap-x-3">
            <span className="text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              FF
            </span>
            <span className="italic bg-gradient-to-r from-[#ff9e00] via-[#ff6a00] to-[#ff4800] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(255,106,0,0.6)]">
              GLORY
            </span>
            <span className="italic bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(0,240,255,0.6)]">
              NEPAL
            </span>
          </h1>

          {/* Subtitle: Push Your Guild to Top Ranks */}
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight mb-3">
            Push Your Guild to{" "}
            <span className="italic font-black text-amber-400 font-orbitron drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]">
              Top Ranks
            </span>
          </h2>

          {/* Paragraph */}
          <p className="max-w-2xl text-sm sm:text-base text-slate-300/90 leading-relaxed mb-8">
            The most trusted guild glory automation platform in the World.
            24/7 fully automated bots with instant Nepal eSewa & Khalti load.
          </p>

          {/* Action CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-4">
            {/* Primary: Start Earning Glory → */}
            <button
              onClick={() => openAuth("signup")}
              className="flex items-center gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#00b4d8] via-[#0096c7] to-[#0077b6] hover:from-[#00c5ee] hover:to-[#0088cc] text-white px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-black tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(0,180,216,0.6)] hover:shadow-[0_0_35px_rgba(0,180,216,0.85)] cursor-pointer font-orbitron active:scale-95"
            >
              <span>Start Earning Glory</span>
              <ArrowRight className="h-4 w-4 stroke-[3]" />
            </button>

            {/* Secondary: How It Works */}
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="flex items-center gap-2 rounded-xl sm:rounded-2xl bg-[#08121a]/90 hover:bg-[#0c1a27] border border-slate-700/80 hover:border-cyan-400/50 text-slate-200 px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-bold tracking-wide transition-all cursor-pointer shadow-lg"
            >
              <span>How It Works</span>
            </button>
          </div>

          {/* Direct Member Sign In Fast-Track */}
          <div className="mb-12">
            <button
              onClick={markVisitedAndSwitchToDirect}
              className="text-xs text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <span>Already registered? Skip directly to Member Sign In</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Three Metric / Stat Cards matching screenshot */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
            {/* Stat 1: 10M+ GLORY DELIVERED */}
            <div className="rounded-2xl bg-[#08121a]/90 border border-amber-500/30 p-4 sm:p-5 text-center shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md hover:border-amber-400/60 transition-all">
              <div className="flex justify-center mb-1.5">
                <Trophy className="h-5 w-5 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-orbitron">
                10M+
              </div>
              <div className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-400 mt-1 font-orbitron">
                GLORY DELIVERED
              </div>
            </div>

            {/* Stat 2: 100% ACCOUNT SAFE */}
            <div className="rounded-2xl bg-[#08121a]/90 border border-emerald-500/30 p-4 sm:p-5 text-center shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md hover:border-emerald-400/60 transition-all">
              <div className="flex justify-center mb-1.5">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-orbitron">
                100%
              </div>
              <div className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-400 mt-1 font-orbitron">
                ACCOUNT SAFE
              </div>
            </div>

            {/* Stat 3: 24/7 BOT UPTIME */}
            <div className="rounded-2xl bg-[#08121a]/90 border border-cyan-500/30 p-4 sm:p-5 text-center shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md hover:border-cyan-400/60 transition-all">
              <div className="flex justify-center mb-1.5">
                <Zap className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-orbitron">
                24/7
              </div>
              <div className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-400 mt-1 font-orbitron">
                BOT UPTIME
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-20 px-4 sm:px-6 relative">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 text-xs font-bold font-orbitron uppercase tracking-widest mb-3">
              <Cpu className="h-3.5 w-3.5" /> High-Performance Infrastructure
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white font-orbitron tracking-tight">
              BUILT FOR ELITE GUILDS & CLANS
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mt-2">
              Everything you need to boost your Free Fire clan glory safely,
              reliably, and completely on autopilot.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-3xl border border-cyan-500/20 bg-[#08121a]/90 p-6 shadow-xl hover:border-cyan-400/50 transition-all group">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                <Radio className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white font-orbitron mb-2">
                24/7 Cloud Automated Bots
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Matches are continuously simulated on powerful dedicated cloud
                servers. No overheating, zero battery drain, and no high ping.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-3xl border border-emerald-500/20 bg-[#08121a]/90 p-6 shadow-xl hover:border-emerald-400/50 transition-all group">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white font-orbitron mb-2">
                Zero-Ban Protection
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Advanced encrypted packet handling simulates genuine gameplay.
                Guaranteed safe from blacklists, bans, and suspicious activity
                flags.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-3xl border border-amber-500/20 bg-[#08121a]/90 p-6 shadow-xl hover:border-amber-400/50 transition-all group">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                <Coins className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white font-orbitron mb-2">
                Nepal Local Pay (RS {CREDIT_RATE_RS})
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Direct integration with Fonepay, eSewa, and Khalti QR. Instant credit
                recharge at RS {CREDIT_RATE_RS} per credit with prompt verification.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-3xl border border-rose-500/20 bg-[#08121a]/90 p-6 shadow-xl hover:border-rose-400/50 transition-all group">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 mb-4 group-hover:scale-110 transition-transform">
                <Flame className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white font-orbitron mb-2">
                Leaderboard Glory Farming
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Accelerate your guild leveling to level 6 and secure #1 region
                ranking faster than competing clans in Nepal and South Asia.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-3xl border border-sky-500/20 bg-[#08121a]/90 p-6 shadow-xl hover:border-sky-400/50 transition-all group">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 mb-4 group-hover:scale-110 transition-transform">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white font-orbitron mb-2">
                Real-Time Live Console
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Track every active session, bot state, connected region, and
                round count live directly from your web dashboard.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-3xl border border-purple-500/20 bg-[#08121a]/90 p-6 shadow-xl hover:border-purple-400/50 transition-all group">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                <Server className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white font-orbitron mb-2">
                14 Supported Servers
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Seamless support for <strong className="text-cyan-300">IN, BD, PK, US, EU, RU, BR, INDO, SG, VN, TH, ME, NA, and SAC</strong> with sub-20ms packet response and dedicated cloud workers.
              </p>
            </div>
          </div>

          {/* 14 SUPPORTED SERVERS REGIONAL SHOWCASE */}
          <div className="mt-12 rounded-3xl border border-cyan-500/30 bg-[#071018]/90 backdrop-blur-xl p-6 sm:p-8 shadow-[0_0_35px_rgba(0,240,255,0.12)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-cyan-500/20">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#00e599] animate-ping" />
                  <h3 className="text-lg sm:text-xl font-black text-white font-orbitron tracking-wide">
                    OFFICIALLY SUPPORTED SERVERS ({SUPPORTED_SERVERS.length})
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Active automated clan glory nodes across all major Free Fire regions.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl bg-cyan-950/40 border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-300 font-orbitron font-bold">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>ALL NODES OPERATIONAL</span>
              </div>
            </div>

            {/* 14 Server Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {SUPPORTED_SERVERS.map((srv) => (
                <div
                  key={srv.code}
                  className="rounded-2xl bg-[#091522]/90 border border-slate-800 hover:border-cyan-400/50 p-3 transition-all hover:scale-105 group text-center flex flex-col items-center justify-between"
                >
                  <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                    {srv.flag}
                  </div>
                  <div className="font-orbitron font-black text-sm text-cyan-400 tracking-wider">
                    {srv.code}
                  </div>
                  <div className="text-[11px] font-bold text-slate-200 truncate w-full mt-0.5">
                    {srv.name}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 truncate w-full">
                    {srv.region}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[9px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30 w-full justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>ONLINE</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section
        id="how-it-works"
        className="py-20 px-4 sm:px-6 bg-[#060c12]/90 border-y border-cyan-500/15 relative"
      >
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-400 text-xs font-bold font-orbitron uppercase tracking-widest mb-3">
              <Zap className="h-3.5 w-3.5" /> 4 Simple Steps
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white font-orbitron tracking-tight">
              HOW IT WORKS
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mt-2">
              From registration to active glory farming in under 2 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="rounded-3xl bg-[#08121a] border border-cyan-500/20 p-5 relative">
              <div className="text-xs font-mono font-black text-cyan-400 mb-2">
                STEP 01
              </div>
              <h4 className="text-base font-bold text-white font-orbitron mb-1.5">
                Create Account
              </h4>
              <p className="text-xs text-slate-400">
                Register with your email and choose a display name to get your
                personal dashboard.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-3xl bg-[#08121a] border border-emerald-500/20 p-5 relative">
              <div className="text-xs font-mono font-black text-emerald-400 mb-2">
                STEP 02
              </div>
              <h4 className="text-base font-bold text-white font-orbitron mb-1.5">
                Load Credits
              </h4>
              <p className="text-xs text-slate-400">
                Scan Fonepay, eSewa, or Khalti QR code to buy credits at RS {CREDIT_RATE_RS} each with
                instant gateway verification.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-3xl bg-[#08121a] border border-amber-500/20 p-5 relative">
              <div className="text-xs font-mono font-black text-amber-400 mb-2">
                STEP 03
              </div>
              <h4 className="text-base font-bold text-white font-orbitron mb-1.5">
                Enter Clan UID
              </h4>
              <p className="text-xs text-slate-400">
                Provide your target Free Fire player UID or group room code on
                the bot launcher.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-3xl bg-[#08121a] border border-rose-500/20 p-5 relative">
              <div className="text-xs font-mono font-black text-rose-400 mb-2">
                STEP 04
              </div>
              <h4 className="text-base font-bold text-white font-orbitron mb-1.5">
                Earn Glory
              </h4>
              <p className="text-xs text-slate-400">
                Hit launch and watch your clan glory climb on the official
                leaderboard 24/7.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-20 px-4 sm:px-6 relative">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-400 text-xs font-bold font-orbitron uppercase tracking-widest mb-3">
              <Coins className="h-3.5 w-3.5" /> Transparent Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white font-orbitron tracking-tight">
              CREDIT PACKAGES (RS {CREDIT_RATE_RS} / CREDIT)
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mt-2">
              Pay securely via eSewa or Khalti QR. No monthly recurring
              contracts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPacks.map((pack, idx) => (
              <div
                key={idx}
                className={`rounded-3xl p-6 relative flex flex-col justify-between transition-all ${
                  pack.popular
                    ? "bg-gradient-to-b from-[#0e1d29] to-[#08121a] border-2 border-cyan-400 shadow-[0_0_30px_rgba(0,240,255,0.25)] scale-105"
                    : "bg-[#08121a]/90 border border-slate-800 hover:border-slate-700"
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 px-3 py-0.5 text-[10px] font-black uppercase font-orbitron tracking-wider shadow-md">
                    POPULAR
                  </div>
                )}

                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-orbitron">
                    {pack.title}
                  </div>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl sm:text-4xl font-black text-white font-orbitron">
                      {pack.credits}
                    </span>
                    <span className="text-xs font-bold text-slate-400 uppercase">
                      Credit{pack.credits > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-xl font-extrabold text-amber-400 font-mono mt-1">
                    RS {pack.priceRs.toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{pack.desc}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => openAuth("signup")}
                    className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider font-orbitron transition-all cursor-pointer ${
                      pack.popular
                        ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                        : "bg-slate-800 hover:bg-slate-700 text-white"
                    }`}
                  >
                    Get Started
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center text-xs text-slate-400">
            Accepting <span className="text-emerald-400 font-bold">eSewa</span>{" "}
            and <span className="text-purple-400 font-bold">Khalti</span> with
            1-click slip upload on your dashboard.
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section
        id="faq"
        className="py-20 px-4 sm:px-6 bg-[#060c12]/80 border-t border-cyan-500/15 relative"
      >
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-400 text-xs font-bold font-orbitron uppercase tracking-widest mb-3">
              <HelpCircle className="h-3.5 w-3.5" /> Have Questions?
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white font-orbitron tracking-tight">
              FREQUENTLY ASKED QUESTIONS
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-[#08121a]/90 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm sm:text-base font-bold text-white hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span className="text-cyan-400 font-bold text-lg ml-4">
                    {openFaq === idx ? "−" : "+"}
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="p-4 sm:p-5 pt-0 text-xs sm:text-sm text-slate-300 border-t border-slate-800/60 leading-relaxed bg-[#050a0f]/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-cyan-500/20 bg-[#04080c] py-10 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#091520] border border-cyan-400/60 overflow-hidden p-0.5 shadow-[0_0_12px_rgba(0,240,255,0.3)]">
              <img
                src={OFFICIAL_LOGO_URL}
                alt="ffglorynepal"
                className="h-full w-full object-cover rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="font-orbitron font-black text-white text-base">
                FFGLORY<span className="text-[#00f0ff]">NEPAL</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Nepal's #1 Automated Free Fire Glory Engine
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <button
              onClick={() => scrollToSection("features")}
              className="hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="hover:text-cyan-300 transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollToSection("faq")}
              className="hover:text-cyan-300 transition-colors cursor-pointer"
            >
              FAQ
            </button>
            <a
              href="https://t.me/"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline flex items-center gap-1"
            >
              <Send className="h-3 w-3" /> Telegram
            </a>
          </div>

          <div className="text-xs text-slate-500">
            © 2026 ffglorynepal. All rights reserved.
          </div>
        </div>
      </footer>

      {/* SIGN IN & SIGN UP MODAL */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          {renderAuthCard(true)}
        </div>
      )}
    </div>
  );
};
