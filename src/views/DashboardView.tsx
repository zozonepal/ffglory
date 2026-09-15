import React, { useState, useEffect } from "react";
import {
  Zap,
  Globe2,
  Users,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Coins,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Clock,
  Layers,
} from "lucide-react";
import { ref, push, set, onValue, get } from "firebase/database";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { launchBotAction, CREDIT_RATE_RS } from "../services/api";
import { LaunchLog, SUPPORTED_SERVERS } from "../types";
import { resilientOnValue, resilientPush, resilientGet } from "../services/resilientDb";

interface DashboardViewProps {
  onOpenDeposit: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenDeposit }) => {
  const { currentUser, userProfile, deductUserCredits } = useAuth();

  const [guildId, setGuildId] = useState("");
  const [serverRegion, setServerRegion] = useState<string>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("ffg_guild_server") : null;
    if (saved && SUPPORTED_SERVERS.some((s) => s.code === saved)) {
      return saved;
    }
    if (saved === "IN") return "IND";
    return "IND";
  });
  const [loading, setLoading] = useState(false);
  const [launchResult, setLaunchResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleServerChange = (newServer: string) => {
    setServerRegion(newServer);
    try {
      localStorage.setItem("ffg_guild_server", newServer);
    } catch (e) {
      // ignore
    }
  };

  const [insufficientModal, setInsufficientModal] = useState(false);
  const [recentLaunches, setRecentLaunches] = useState<LaunchLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>(
    new Date().toLocaleTimeString()
  );

  const credits = userProfile?.credits ?? 0;
  const selectedServerInfo =
    SUPPORTED_SERVERS.find((s) => s.code === serverRegion) || SUPPORTED_SERVERS[0];

  // Helper to ensure ONLY squad launches are shown
  const isSquadLaunch = (l: LaunchLog) => {
    if (!l) return false;
    if (l.server === "COUPON" || l.server === "DEPOSIT") return false;
    if (l.creditsDeducted !== undefined && l.creditsDeducted < 0) return false;
    const gid = (l.guild_id || "").toLowerCase();
    const notes = ((l as any).notes || "").toLowerCase();
    if (
      gid.includes("coupon") ||
      gid.includes("redeem") ||
      gid.includes("code:") ||
      gid.includes("wallet")
    )
      return false;
    if (notes.includes("coupon") || notes.includes("deposit")) return false;
    return true;
  };

  // Realtime listener for user history
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = resilientOnValue(`users/${currentUser.uid}/history`, (val) => {
      if (val && typeof val === "object") {
        const logs: LaunchLog[] = Object.keys(val).map((k) => ({
          id: k,
          ...val[k],
        }));
        // Filter out non-launch activities (like coupon claims, wallet deposits) so only actual squad bot launches appear
        const squadLaunches = logs.filter(isSquadLaunch);
        // Sort descending by timestamp
        squadLaunches.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setRecentLaunches(squadLaunches);
      } else {
        setRecentLaunches([]);
      }
      setLoadingHistory(false);
      setLastRefreshed(new Date().toLocaleTimeString());
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || loading) return;

    if (!guildId.trim()) {
      setLaunchResult({
        success: false,
        message: "Please enter a valid Clan / Guild ID",
      });
      return;
    }

    // Business Logic: Check credits balance
    if (credits < 1) {
      setInsufficientModal(true);
      return;
    }

    setLoading(true);
    setLaunchResult(null);

    try {
      // 1. Call provider endpoint /launch strictly with user-selected guild server
      const response = await launchBotAction(guildId.trim(), serverRegion);

      // 2. Upon HTTP 200 success, deduct EXACTLY 1 credit from user balance (1 Squad = 1 Credit)
      const remainingCredits = await deductUserCredits(1);

      const confirmedServerCode = response?.server || selectedServerInfo.code;
      const matchedServerInfo =
        SUPPORTED_SERVERS.find((s) => s.code === confirmedServerCode) || selectedServerInfo;

      // 3. Log transaction history resiliently (users/{uid}/history)
      const logEntry: Omit<LaunchLog, "id"> = {
        server: confirmedServerCode,
        guild_id: guildId.trim(),
        status: "success",
        creditsDeducted: 1,
        timestamp: Date.now(),
        apiResponse: response,
      };
      await resilientPush(`users/${currentUser.uid}/history`, logEntry);

      // 4. Update UI feedback with explicit confirmation of 1 credit deduction
      const groupIdSuffix = response?.group_id ? ` (Group ID: ${response.group_id})` : "";
      setLaunchResult({
        success: true,
        message: `Bot successfully dispatched to ${matchedServerInfo.flag} ${matchedServerInfo.name} Guild Server (${confirmedServerCode})! 1 Credit deducted (Remaining: ${remainingCredits} Credits).${groupIdSuffix}`,
        details: response,
      });

      // Clear input
      setGuildId("");
    } catch (err: any) {
      console.error("Bot launch failed:", err);

      // Log failure as well for transparency
      try {
        await resilientPush(`users/${currentUser.uid}/history`, {
          server: serverRegion,
          guild_id: guildId.trim(),
          status: "failed",
          creditsDeducted: 0,
          timestamp: Date.now(),
          error: err.message || "Launch request failed",
        });
      } catch (logErr) {
        console.warn("Failed to write failure log:", logErr);
      }

      setLaunchResult({
        success: false,
        message: err.message || `Failed to trigger bot action on ${selectedServerInfo.name} Guild Server (${selectedServerInfo.code}). Check details below.`,
        details: err,
      });
    } finally {
      setLoading(false);
    }
  };

  const manualRefresh = async () => {
    if (!currentUser) return;
    setLoadingHistory(true);
    try {
      const val = await resilientGet(`users/${currentUser.uid}/history`, null);
      if (val && typeof val === "object") {
        const logs: LaunchLog[] = Object.keys(val).map((k) => ({
          id: k,
          ...val[k],
        }));
        const squadLaunches = logs.filter(isSquadLaunch);
        squadLaunches.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setRecentLaunches(squadLaunches);
      }
      setLastRefreshed(new Date().toLocaleTimeString());
    } finally {
      setLoadingHistory(false);
    }
  };

  const activeLaunchesCount = recentLaunches.filter((l) => l.status === "success").length;

  return (
    <div className="space-y-6">
      {/* Clan & Guild Automation Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight font-['Outfit'] flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400 shrink-0" />
            <span>Clan & Guild Automation</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Automated FF Glory Clan task launcher • 1 Credit = RS {CREDIT_RATE_RS}
          </p>
        </div>

        <button
          onClick={onOpenDeposit}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-[11px] sm:text-xs font-bold transition-all self-start sm:self-auto cursor-pointer"
        >
          <Coins className="h-3.5 w-3.5 shrink-0" />
          <span>Load Credits (eSewa / Khalti)</span>
        </button>
      </div>

      {/* Main Bot Launch Card - Exactly styled with Neon aesthetic */}
      <div className="rounded-2xl sm:rounded-3xl border border-cyan-500/25 bg-[#08121a]/95 backdrop-blur-xl p-4 sm:p-7 shadow-[0_0_40px_rgba(0,240,255,0.06)] relative overflow-hidden">
        {/* Neon decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-b from-cyan-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none -z-0" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 sm:mb-6 relative z-10">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
            <Zap className="h-5 w-5 sm:h-6 sm:w-6 fill-cyan-400/20" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-black text-white tracking-wider font-orbitron uppercase">
              Launch Guild Bot Action
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400">
              Select your clan's Guild Server and submit Guild ID to start automated clan glory farming.
            </p>
          </div>
        </div>

        {/* Launch Form */}
        <form onSubmit={handleLaunch} className="space-y-4 sm:space-y-5 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Guild Server / Region Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  GUILD SERVER / REGION ({SUPPORTED_SERVERS.length})
                </label>
                <span className="text-[9px] sm:text-[10px] text-cyan-400 font-orbitron font-semibold">
                  14 SERVERS ONLINE
                </span>
              </div>
              <div className="relative">
                <select
                  value={serverRegion}
                  onChange={(e) => handleServerChange(e.target.value)}
                  className="w-full appearance-none rounded-xl bg-[#0e1015] text-white border border-slate-700/80 hover:border-slate-600 focus:border-cyan-400 px-3.5 py-3 text-xs sm:text-sm font-semibold focus:outline-none transition-colors cursor-pointer truncate pr-8"
                >
                  {SUPPORTED_SERVERS.map((srv) => (
                    <option key={srv.code} value={srv.code}>
                      {srv.flag} {srv.code} • {srv.name} (Guild Server)
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-cyan-400">
                  <span className="text-xs font-mono">▼</span>
                </div>
              </div>

              {/* Active Target Server Confirmation Badge */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-[#091522] border border-cyan-500/30 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm">{selectedServerInfo.flag}</span>
                  <span className="font-bold text-white text-[11px] sm:text-[12px]">{selectedServerInfo.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 font-mono text-[9px] sm:text-[10px] font-bold">
                    {selectedServerInfo.code} GUILD SERVER
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold flex items-center gap-1 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ROUTING ACTIVE
                </span>
              </div>
            </div>

            {/* Clan / Guild ID input */}
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                CLAN ID / GUILD ID
              </label>
              <input
                type="text"
                required
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full rounded-xl bg-[#0e1015] text-white placeholder:text-slate-500 border border-slate-700/80 hover:border-slate-600 focus:border-emerald-500 px-3.5 py-3 text-xs sm:text-sm font-mono font-medium focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Cost Line matching screenshot */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-300 font-medium">Cost:</span>
              <span className="font-bold text-white">1 Credit / Squad</span>
              <span className="text-slate-500">•</span>
              <span className="font-semibold text-emerald-400">RS {CREDIT_RATE_RS}</span>
            </div>
            <div className="text-slate-400">
              Current balance: <span className="font-bold text-white">{credits} Credit{credits === 1 ? "" : "s"}</span>
            </div>
          </div>

          {/* Warning Banner matching Screenshot 2 */}
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-950/25 border border-amber-500/30 p-3 text-[11px] sm:text-xs text-amber-300/90 leading-relaxed break-words">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="leading-relaxed">
              <span>Execution consumes <strong>1 Credit per squad launch</strong> and dispatches automated bot squad to your selected Guild Server immediately. Ensure Guild ID belongs to the chosen server.</span>
            </div>
          </div>

          {/* Primary Action Button with Neon Gradient & Glow */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#00f0ff] via-[#00e599] to-[#00f0ff] bg-[length:200%_auto] hover:bg-right text-slate-950 font-black py-3.5 sm:py-4 px-3 text-xs sm:text-sm tracking-wide uppercase transition-all duration-300 shadow-[0_0_25px_rgba(0,240,255,0.35)] hover:shadow-[0_0_35px_rgba(0,240,255,0.6)] disabled:opacity-60 cursor-pointer font-orbitron text-center break-words leading-tight"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="truncate">Launching Bot on {selectedServerInfo.flag} {selectedServerInfo.code}...</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 fill-slate-950 stroke-slate-950 shrink-0" />
                <span className="line-clamp-2">Start Group on {selectedServerInfo.flag} {selectedServerInfo.code} ({selectedServerInfo.name} Guild Server)</span>
              </>
            )}
          </button>
        </form>

        {/* Feedback Message */}
        {launchResult && (
          <div
            className={`mt-4 rounded-xl border p-3.5 text-[11px] sm:text-xs break-words ${
              launchResult.success
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/40 border-rose-500/40 text-rose-200"
            }`}
          >
            <div className="flex items-start gap-2">
              {launchResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="flex-1 space-y-1 min-w-0">
                <div className="font-bold break-words">{launchResult.message}</div>
                {launchResult.details && (
                  <pre className="mt-2 rounded-lg bg-black/50 p-2 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-36">
                    {JSON.stringify(launchResult.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* "My Active Groups" / Recent Bot Launches Section matching Screenshot 2 */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base font-['Outfit']">
                  My Active Groups & Squad Launches
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                  {recentLaunches.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-500 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {lastRefreshed}
            </span>
            <button
              onClick={manualRefresh}
              disabled={loadingHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin text-amber-400" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Progress Bar / Usage Indicator matching Screenshot 2 */}
        <div className="py-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Groups Usage</span>
            <span className="font-semibold text-slate-300">{activeLaunchesCount} / 100</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(2, (activeLaunchesCount / 100) * 100))}%` }}
            />
          </div>
        </div>

        {/* Table / List */}
        {recentLaunches.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <p>No squad actions launched yet.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Enter a Clan ID above and click "Start Group" to launch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Guild / Clan ID</th>
                  <th className="py-2.5 px-3">Server</th>
                  <th className="py-2.5 px-3">Cost</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {recentLaunches.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {log.guild_id}
                    </td>
                    <td className="py-3 px-3">
                      {(() => {
                        const srv = SUPPORTED_SERVERS.find(
                          (s) =>
                            s.code === log.server ||
                            (log.server === "IND" && s.code === "IN") ||
                            (log.server === "ID" && s.code === "INDO")
                        );
                        return (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800/90 border border-slate-700/60 text-[11px] font-bold text-cyan-300 font-mono">
                            <span>{srv ? srv.flag : "🌐"}</span>
                            <span>{srv ? srv.code : log.server}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-300">
                      {log.creditsDeducted ? `${log.creditsDeducted} Credit` : "0 Credits"}
                    </td>
                    <td className="py-3 px-3">
                      {log.status === "success" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/30 text-rose-400 font-semibold text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Insufficient Credits Alert Dialog */}
      {insufficientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#141720] p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto mb-4">
              <Coins className="h-6 w-6" />
            </div>
            <h3 className="text-center text-lg font-extrabold text-white font-['Outfit']">
              Insufficient Credits
            </h3>
            <p className="text-center text-xs text-slate-400 mt-2 leading-relaxed">
              Launching a bot action requires at least <span className="text-white font-bold">1 Credit</span> (RS {CREDIT_RATE_RS}). Your current balance is <span className="text-rose-400 font-bold">{credits} Credits</span>.
            </p>

            <div className="mt-5 rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Required:</span>
                <span className="font-bold text-white">1 Credit (RS {CREDIT_RATE_RS})</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Available:</span>
                <span className="font-bold text-rose-400">{credits} Credits</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setInsufficientModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setInsufficientModal(false);
                  onOpenDeposit();
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition-all shadow-md shadow-amber-400/20"
              >
                Deposit Funds Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
