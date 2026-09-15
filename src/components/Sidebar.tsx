import React from "react";
import {
  Zap,
  ReceiptText,
  History,
  LifeBuoy,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingDepositsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const { isAdmin } = useAuth();

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: Zap,
    },
    {
      id: "transactions",
      label: "Transactions",
      icon: ReceiptText,
    },
    {
      id: "history",
      label: "History",
      icon: History,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  if (isAdmin) {
    navItems.push({
      id: "admin",
      label: "Admin Panel",
      icon: ShieldCheck,
    });
  }

  return (
    <>
      {/* DESKTOP SIDEBAR (hidden on mobile, visible on md and up) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col gap-4">
        {/* Navigation Card */}
        <div className="rounded-3xl border border-cyan-500/20 bg-[#08121a]/95 backdrop-blur-xl p-3 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <div className="px-3 py-2 text-[10px] font-black text-cyan-400 uppercase tracking-widest font-orbitron flex items-center justify-between">
            <span>NAV CONTROLS</span>
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <nav className="flex flex-col gap-1.5 mt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-bold transition-all text-left group cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 via-emerald-500/10 to-transparent text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? "text-cyan-400 fill-cyan-400/20" : "text-slate-500"
                      }`}
                    />
                    <span className={isActive ? "font-orbitron text-white text-[11px]" : ""}>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Support Card */}
        <div className="rounded-3xl border border-white/[0.06] bg-[#12151d]/40 p-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-bold text-slate-200 mb-1">
            <LifeBuoy className="h-3.5 w-3.5 text-amber-400" />
            Support Helpdesk
          </div>
          <p className="text-[11px] text-slate-500 mb-3">
            Contact ffglorynepal staff on WhatsApp or Telegram for immediate top-up assistance.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://wa.me/?text=Hello%20ffglorynepal%20I%20need%20credits"
              target="_blank"
              rel="noreferrer"
              className="text-center py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/60 text-[11px] font-bold transition-colors"
            >
              WhatsApp
            </a>
            <a
              href="https://t.me/"
              target="_blank"
              rel="noreferrer"
              className="text-center py-2 rounded-xl bg-sky-950/60 border border-sky-500/30 text-sky-400 hover:bg-sky-900/60 text-[11px] font-bold transition-colors"
            >
              Telegram
            </a>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR (shown ONLY on mobile, fixed at the bottom) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#060b10]/95 backdrop-blur-2xl border-t border-cyan-500/25 px-2 py-1.5 flex items-center justify-around shadow-[0_-5px_25px_rgba(0,0,0,0.8)] safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl relative transition-all ${
                isActive
                  ? "text-cyan-300 font-extrabold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  isActive
                    ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                    : "text-slate-400"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-[10px] tracking-tight mt-0.5 whitespace-nowrap ${isActive ? "font-orbitron" : ""}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
