import React, { useState, useEffect } from "react";
import {
  History,
  Zap,
  CheckCircle2,
  XCircle,
  Search,
  Server,
  Filter,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LaunchLog, SUPPORTED_SERVERS } from "../types";
import { resilientOnValue } from "../services/resilientDb";

export const HistoryView: React.FC = () => {
  const { currentUser } = useAuth();
  const [launches, setLaunches] = useState<LaunchLog[]>([]);
  const [search, setSearch] = useState("");
  const [serverFilter, setServerFilter] = useState<string>("all");

  useEffect(() => {
    if (!currentUser) return;

    // Listen to user's bot launches and credits deducted
    const unsubHist = resilientOnValue(`users/${currentUser.uid}/history`, (val) => {
      if (val && typeof val === "object") {
        const list: LaunchLog[] = Object.keys(val).map((k) => ({
          id: k,
          ...val[k],
        }));
        // Filter out any pure deposit logs so this table is purely Guild Launches
        const botLaunches = list.filter((l) => l.server !== "DEPOSIT" && l.server !== "COUPON");
        botLaunches.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setLaunches(botLaunches);
      } else {
        setLaunches([]);
      }
    });

    return () => unsubHist();
  }, [currentUser]);

  // Filtered launches
  const filteredLaunches = launches.filter((l) => {
    const matchesSearch =
      (l.guild_id || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.server || "").toLowerCase().includes(search.toLowerCase());
    const matchesServer =
      serverFilter === "all" ||
      l.server === serverFilter ||
      ((serverFilter === "IND" || serverFilter === "IN") && (l.server === "IND" || l.server === "IN")) ||
      ((serverFilter === "ID" || serverFilter === "INDO") && (l.server === "ID" || l.server === "INDO"));
    return matchesSearch && matchesServer;
  });

  const totalSuccessful = launches.filter((l) => l.status === "success").length;
  const totalCreditsUsed = launches
    .filter((l) => l.status === "success")
    .reduce((acc, curr) => acc + (curr.creditsDeducted || 1), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-['Outfit'] flex items-center gap-2.5">
          <History className="h-6 w-6 text-emerald-400" />
          Guild Launch & Usage History
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Detailed history of automated clan guild launches, regional server deployments, and credits used.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-4 shadow-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Guild Launches</span>
          <div className="text-2xl font-black text-white mt-1 flex items-baseline gap-1.5">
            <span>{launches.length}</span>
            <span className="text-xs font-semibold text-slate-400">Total</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Automated tasks deployed across regional clusters
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-4 shadow-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Successful Executions</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 flex items-baseline gap-1.5">
            <span>{totalSuccessful}</span>
            <span className="text-xs font-semibold text-slate-400">Success</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Completed with HTTP 200 provider acknowledgment
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-4 shadow-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Credits Used</span>
          <div className="text-2xl font-black text-amber-300 mt-1 flex items-baseline gap-1.5">
            <span>-{totalCreditsUsed}</span>
            <span className="text-xs font-semibold text-slate-400">Credits</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            1 Credit deducted per verified guild launch
          </span>
        </div>
      </div>

      {/* Main Launches Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6 shadow-xl">
        {/* Search & Filter Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Clan / Guild ID..."
              className="w-full rounded-xl bg-[#0b0d11] border border-slate-800 pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <div className="relative">
              <select
                value={serverFilter}
                onChange={(e) => setServerFilter(e.target.value)}
                className="appearance-none rounded-xl bg-[#0b0d11] border border-slate-800 hover:border-slate-700 text-xs text-white pl-3 pr-8 py-2 font-medium focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                <option value="all">All Guild Servers ({launches.length})</option>
                {SUPPORTED_SERVERS.map((srv) => (
                  <option key={srv.code} value={srv.code}>
                    {srv.flag} {srv.code} • {srv.name} (Guild Server)
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400">
                <span className="text-[10px]">▼</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredLaunches.length === 0 ? (
          <div className="py-14 text-center text-slate-500 text-xs">
            <Zap className="h-8 w-8 mx-auto text-slate-600 mb-2 opacity-50" />
            No guild launches recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-3">Guild / Clan ID</th>
                  <th className="py-3 px-3">Guild Server</th>
                  <th className="py-3 px-3">Credits Consumed</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Launch Timestamp</th>
                  <th className="py-3 px-3">Provider Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredLaunches.map((l) => {
                  const srv = SUPPORTED_SERVERS.find(
                    (s) =>
                      s.code === l.server ||
                      ((s.code === "IND" || s.code === "IN") && (l.server === "IND" || l.server === "IN")) ||
                      ((s.code === "ID" || s.code === "INDO") && (l.server === "ID" || l.server === "INDO"))
                  );
                  return (
                    <tr key={l.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        {l.guild_id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/90 text-[11px] font-semibold text-cyan-300 border border-slate-700/60 font-mono">
                          <span>{srv?.flag || "🌐"}</span>
                          <span>{srv ? `${srv.code} (${srv.name})` : l.server}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-300">
                        -{l.creditsDeducted || 1} Credit
                      </td>
                      <td className="py-3 px-3">
                        {l.status === "success" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Executed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px]">
                            <XCircle className="h-3.5 w-3.5" /> Failed
                          </span>
                        )}
                      </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-[200px]">
                      {l.error || (l.apiResponse ? "HTTP 200 OK • Processed" : "Action Completed")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
