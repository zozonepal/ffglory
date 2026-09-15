import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  LogOut,
  Bell,
  Coins,
  ChevronDown,
  Radio,
  Plus,
  Settings,
  ShieldCheck,
  User,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CREDIT_RATE_RS } from "../services/api";

interface NavbarProps {
  onOpenDeposit: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const OFFICIAL_LOGO_URL =
  "https://www.image2url.com/r2/default/images/1788689706282-c5dba61a-62f0-4e07-91a9-b68c5dbc2bba.jpeg";

export const Navbar: React.FC<NavbarProps> = ({
  onOpenDeposit,
  activeTab,
  setActiveTab,
}) => {
  const { userProfile, currentUser, isAdmin, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const credits = userProfile?.credits ?? 0;
  // Format username nicely like Player_xxxx or username
  const rawUsername = userProfile?.username || currentUser?.email?.split("@")[0] || "Player";
  const formattedUsername = rawUsername.startsWith("Player_")
    ? rawUsername
    : rawUsername.length > 12
    ? rawUsername.slice(0, 11) + ".."
    : rawUsername;

  const roleDisplay = isAdmin ? "ADMIN" : (userProfile?.role?.toUpperCase() || "USER");

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-cyan-500/20 bg-[#060b10]/95 backdrop-blur-xl px-2 sm:px-5 py-2.5 shadow-[0_4px_30px_rgba(0,0,0,0.7)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4">
        {/* Left Side: Glowing Icon Box + FFGLORY + ONLINE + Low Latency Node */}
        <div
          onClick={() => setActiveTab("dashboard")}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group"
        >
          {/* Official Logo Container */}
          <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-[#09141f] border border-cyan-400/60 shadow-[0_0_18px_rgba(0,240,255,0.45),inset_0_0_10px_rgba(0,240,255,0.2)] group-hover:scale-105 transition-all overflow-hidden p-0.5">
            <img
              src={OFFICIAL_LOGO_URL}
              alt="ffglorynepal logo"
              className="h-full w-full object-cover rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Title & Subtitle */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-black tracking-wider font-orbitron flex items-baseline">
                <span className="text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">FFGLORY</span>
                <span className="text-[#fef9c3] drop-shadow-[0_0_8px_rgba(254,240,138,0.4)] ml-1">NEPAL</span>
              </span>

              {/* ONLINE Pill */}
              <span className="inline-flex items-center rounded-md bg-[#072018]/90 border border-[#00e599]/60 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-black text-[#00e599] font-orbitron uppercase tracking-wider shadow-[0_0_10px_rgba(0,229,153,0.3)]">
                ONLINE
              </span>
            </div>

            {/* Subtitle with broadcast icon and rate */}
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-cyan-400/90 font-mono tracking-tight -mt-0.5">
              <Radio className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span className="text-cyan-300 font-medium">Low Latency Node</span>
              <span className="text-slate-500 font-bold">·</span>
              <span className="text-slate-300">
                1 Credit = <span className="font-bold text-amber-300 font-mono">RS {CREDIT_RATE_RS}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Player Pill, Credits with +, Bell, Exit */}
        <div ref={dropdownRef} className="flex items-center gap-1.5 sm:gap-2.5 relative">
          {/* Player Pill */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#08131d] hover:bg-[#0c1a27] border border-cyan-500/35 hover:border-cyan-400/60 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-white transition-all shadow-[0_0_12px_rgba(0,240,255,0.15)] cursor-pointer"
            >
              {/* Glowing Cyan Status Dot */}
              <span className="h-2 w-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              <span className="font-bold text-white max-w-[90px] sm:max-w-[130px] truncate tracking-wide">
                {formattedUsername}
              </span>
              <span className="text-[10px] font-mono text-cyan-400/80 font-bold">
                [{roleDisplay}]
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#08121a] border border-cyan-500/30 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400 font-orbitron">Account</div>
                  <div className="text-xs font-bold text-white truncate mt-0.5">{currentUser?.email}</div>
                  <div className="text-[10px] text-emerald-400 font-medium mt-0.5">Status: Verified Player</div>
                </div>

                <div className="py-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setActiveTab("settings");
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 text-left transition-colors cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Security & Password</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("transactions");
                      setUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 text-left transition-colors cursor-pointer"
                  >
                    <Coins className="h-3.5 w-3.5 text-amber-400" />
                    <span>Transaction History</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Credits Pill (Gold/Amber Neon matching screenshot) */}
          <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#0d1217] border border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)] px-2.5 sm:px-3 py-1">
            {/* Double Coins Icon */}
            <div className="flex items-center -space-x-1 text-amber-400">
              <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>

            {/* CREDITS: X */}
            <div className="text-[11px] sm:text-xs font-bold text-slate-200 uppercase tracking-wider font-orbitron flex items-center gap-1">
              <span className="hidden xs:inline text-amber-400/90 text-[10px] sm:text-[11px]">CREDITS:</span>
              <span className="text-amber-400 font-mono font-black text-xs sm:text-sm">
                {credits}
              </span>
            </div>

            {/* Orange Plus Button */}
            <button
              onClick={onOpenDeposit}
              className="flex h-5 w-5 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all active:scale-95 cursor-pointer ml-0.5"
              title="Recharge Credits (eSewa / Khalti)"
            >
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
            </button>
          </div>

          {/* Notification Bell Icon Button */}
          <div className="relative">
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-[#08121a] border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-white transition-all cursor-pointer shadow-sm"
              title="System Alerts & Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#00f0ff]" />
            </button>

            {notificationOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#08121a] border border-cyan-500/30 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 animate-in fade-in">
                <div className="text-[10px] uppercase font-bold text-cyan-400 font-orbitron mb-2">
                  System Alerts
                </div>
                <div className="rounded-xl bg-[#050a0f] border border-slate-800 p-2.5 text-xs text-slate-300">
                  <div className="font-bold text-white text-[11px] flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    All Gateway Nodes Online
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Free Fire Clan & Guild automated task launcher is active with 0% latency delay.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* EXIT Button (Pink/Rose neon outline matching screenshot "[→ EXIT") */}
          <button
            onClick={logout}
            className="flex items-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl bg-[#140a10] hover:bg-[#1f0e19] border border-rose-500/40 hover:border-rose-400/80 px-2.5 sm:px-3.5 py-1.5 text-xs font-black text-rose-300 hover:text-rose-200 transition-all shadow-[0_0_12px_rgba(244,63,94,0.2)] hover:shadow-[0_0_18px_rgba(244,63,94,0.4)] cursor-pointer font-orbitron"
            title="Sign out of account"
          >
            <LogOut className="h-3.5 w-3.5 stroke-[2.5]" />
            <span className="text-[10px] sm:text-xs tracking-wider">EXIT</span>
          </button>
        </div>
      </div>
    </header>
  );
};
