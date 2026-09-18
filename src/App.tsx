import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthView } from "./views/AuthView";
import { DashboardView } from "./views/DashboardView";
import { DepositView } from "./views/DepositView";
import { HistoryView } from "./views/HistoryView";
import { TransactionsView } from "./views/TransactionsView";
import { SettingsView } from "./views/SettingsView";
import { AdminView } from "./views/AdminView";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";
import { CREDIT_RATE_RS } from "./services/api";

function MainApp() {
  const { currentUser, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#07090e] text-white">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#09141f] border border-cyan-400/60 shadow-[0_0_25px_rgba(0,240,255,0.4)] mb-4 overflow-hidden p-1 animate-pulse">
          <img
            src="https://www.image2url.com/r2/default/images/1788689706282-c5dba61a-62f0-4e07-91a9-b68c5dbc2bba.jpeg"
            alt="ffglorynepal"
            className="h-full w-full object-cover rounded-xl"
            referrerPolicy="no-referrer"
          />
        </div>
        <p className="text-sm font-extrabold tracking-wider uppercase text-cyan-300 font-orbitron">
          Loading ffglorynepal...
        </p>
      </div>
    );
  }

  // If not logged in, show the login/register screen
  if (!currentUser) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080a0f] text-slate-100 selection:bg-amber-400/30 selection:text-amber-200">
      {/* Top Navbar */}
      <Navbar
        onOpenDeposit={() => setActiveTab("deposit")}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Container - Extra bottom padding on mobile for fixed bottom bar */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 py-5 sm:py-7 pb-24 md:pb-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar (Desktop left sidebar + Mobile fixed bottom bar) */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {/* Main Content Viewport */}
          <div className="flex-1 min-w-0">
            {activeTab === "dashboard" && (
              <DashboardView onOpenDeposit={() => setActiveTab("deposit")} />
            )}
            {activeTab === "transactions" && (
              <TransactionsView onOpenDeposit={() => setActiveTab("deposit")} />
            )}
            {activeTab === "history" && <HistoryView />}
            {activeTab === "settings" && <SettingsView />}
            {activeTab === "deposit" && <DepositView />}
            {activeTab === "admin" && <AdminView />}
          </div>
        </div>
      </main>

      {/* Footer without any reseller management dashboard text */}
      <footer className="border-t border-white/[0.06] bg-[#07090e] py-5 text-center text-xs text-slate-500 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-amber-300 font-['Outfit'] lowercase">ffglorynepal</span>
            <span>•</span>
            <span className="text-slate-400">Official Bot Platform</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Credit Exchange: 1 Credit = RS {CREDIT_RATE_RS} • Instant Edge API Processing
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
