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
  Settings,
  ChevronUp,
  ChevronDown,
  Copy,
  Edit3,
  Sparkles,
} from "lucide-react";
import { ref, push, set, onValue, get } from "firebase/database";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { launchBotAction, CREDIT_RATE_RS, extractErrorMessage } from "../services/api";
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
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [customGuildName, setCustomGuildName] = useState("w00000000ss3");
  const [customGlory, setCustomGlory] = useState("429498 / 4200");
  const [customLevel, setCustomLevel] = useState("1");
  const [isCardEditOpen, setIsCardEditOpen] = useState(false);
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

  const handleLaunchSubmit = (e: React.FormEvent) => {
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

    // Set a realistic prefilled name if they haven't customized it yet
    const cleanId = guildId.trim();
    if (customGuildName === "w00000000ss3" || !customGuildName) {
      setCustomGuildName("w" + cleanId.substring(0, Math.min(3, cleanId.length)) + "ooooo" + cleanId.substring(Math.max(0, cleanId.length - 3)));
    }

    setConfirmModalOpen(true);
  };

  const executeLaunch = async () => {
    if (!currentUser || loading) return;
    setConfirmModalOpen(false);
    setLoading(true);
    setLaunchResult(null);

    const targetGuildId = guildId.trim();

    try {
      // 1. Call provider endpoint /launch strictly with user-selected guild server
      const response = await launchBotAction(targetGuildId, serverRegion);

      // 2. Upon HTTP 200 success, deduct EXACTLY 1 credit from user balance (1 Squad = 1 Credit)
      const remainingCredits = await deductUserCredits(1);

      const confirmedServerCode = response?.server || selectedServerInfo.code;
      const matchedServerInfo =
        SUPPORTED_SERVERS.find((s) => s.code === confirmedServerCode) || selectedServerInfo;

      // 3. Log transaction history resiliently (users/{uid}/history)
      const logEntry: Omit<LaunchLog, "id"> = {
        server: confirmedServerCode,
        guild_id: targetGuildId,
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
      const errMsg = extractErrorMessage(err, `Failed to trigger bot action on ${selectedServerInfo.name} Guild Server (${selectedServerInfo.code}).`);

      // Log failure as well for transparency
      try {
        await resilientPush(`users/${currentUser.uid}/history`, {
          server: serverRegion,
          guild_id: targetGuildId,
          status: "failed",
          creditsDeducted: 0,
          timestamp: Date.now(),
          error: errMsg,
        });
      } catch (logErr) {
        console.warn("Failed to write failure log:", logErr);
      }

      setLaunchResult({
        success: false,
        message: errMsg,
        details: typeof err === "object" ? err : { message: errMsg },
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
        <form onSubmit={handleLaunchSubmit} className="space-y-4 sm:space-y-5 relative z-10">
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

      {/* Confirm Launch Modal with Free Fire Custom Guild Card & Settings Mockup */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-slate-800 bg-[#0c0d12] p-4 sm:p-7 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative animate-in fade-in zoom-in-95 my-8">
            
            {/* Header */}
            <div className="flex items-center gap-2 mb-6 border-b border-slate-800/60 pb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-white font-orbitron uppercase tracking-wider">
                Confirm Launch
              </h3>
            </div>

            {/* Grid of Two Columns (Configure Card vs Allow Bots) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              
              {/* Column 1: Step 1: Configure */}
              <div className="space-y-2">
                <div className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1 uppercase">
                  <span className="text-emerald-400">Step 1:</span> Configure
                </div>
                
                {/* Simulated high-fidelity Free Fire Card (Screenshot 1 & 2) */}
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#1b1e2c] via-[#0d0e14] to-[#0a0b0e] border border-slate-700/80 p-4 min-h-[280px] flex flex-col justify-between shadow-lg">
                  {/* Hexagon Settings cog + orange alert dot at top left (Screenshot 1 & 2) */}
                  <div className="absolute top-3.5 left-3.5 flex items-center justify-center">
                    <div className="relative flex items-center justify-center h-8 w-8 bg-[#1e2338] border border-slate-600/70 rounded-lg shadow-inner">
                      <Settings className="h-4 w-4 text-slate-300 animate-spin" style={{ animationDuration: '8s' }} />
                      {/* Orange alert dot pointing at settings gear */}
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-amber-500 rounded-full border border-[#0d0e14] animate-pulse" />
                    </div>
                  </div>

                  {/* Level Badge ribbon (Screenshot 1 & 2) - Top right or bottom center */}
                  <div className="absolute top-3.5 right-3.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </div>

                  {/* Center: Wolf / Fox Emblem in Vector SVG */}
                  <div className="my-auto pt-6 flex flex-col items-center justify-center text-center">
                    <div className="relative w-24 h-24 mb-3">
                      {/* Shield background wrapper */}
                      <svg viewBox="0 0 100 100" className="w-full h-full text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                        {/* Shield border */}
                        <polygon points="50,5 92,25 80,75 50,95 20,75 8,25" fill="#0c0e18" stroke="#3b82f6" strokeWidth="3" />
                        {/* Wolf head lines */}
                        <path d="M50,20 L35,42 L42,44 L32,55 L42,56 L35,70 L50,85 L65,70 L58,56 L68,55 L58,44 L65,42 Z" fill="#1e2235" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="miter" />
                        {/* Eyes */}
                        <polygon points="43,48 47,49 45,51" fill="#bef264" />
                        <polygon points="57,48 53,49 55,51" fill="#bef264" />
                        {/* Nose/mouth details */}
                        <path d="M50,68 L48,72 L52,72 Z" fill="#1d4ed8" />
                        <path d="M40,30 L45,35 M60,30 L55,35" stroke="#3b82f6" strokeWidth="1.5" />
                      </svg>
                    </div>

                    {/* Guild/Clan Name (Screenshot 2: w00000000ss3) */}
                    <div className="text-white font-black text-sm sm:text-base tracking-wide font-mono uppercase truncate max-w-[180px]">
                      {customGuildName || "w00000000ss3"}
                    </div>

                    {/* Guild ID (Screenshot 2: GUILD ID 3047718301) */}
                    <div className="text-[10px] sm:text-[11px] text-slate-400/90 font-mono flex items-center gap-1 mt-1">
                      <span>GUILD ID</span>
                      <span className="text-slate-200 font-bold tracking-wider">{guildId}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(guildId);
                        }}
                        className="p-1 hover:bg-slate-800 rounded transition-colors text-cyan-400 cursor-pointer"
                        title="Copy Guild ID"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom details of the card */}
                  <div className="border-t border-slate-800/80 pt-2.5 mt-2 flex flex-col items-center">
                    {/* Glory bar: e.g. 429498 / 4200 (Screenshot 1 & 2) */}
                    <div className="w-full">
                      <div className="flex justify-between items-center text-[9px] font-mono text-amber-400 font-bold mb-1">
                        <span className="flex items-center gap-0.5">
                          <Sparkles className="h-2.5 w-2.5 text-amber-400 animate-pulse" />
                          GLORY
                        </span>
                        <span>{customGlory}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-[1px]">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full" style={{ width: "85%" }} />
                      </div>
                    </div>

                    {/* Level Badge ribbon (Screenshot 2: Lv.1) */}
                    <div className="mt-2 text-white font-mono text-xs font-black tracking-wider flex items-center gap-1 bg-[#151929] px-3 py-0.5 rounded-full border border-slate-700/60 shadow-sm">
                      <span className="text-amber-400 font-bold">Lv.</span> {customLevel}
                      <ChevronUp className="h-3.5 w-3.5 text-emerald-400 animate-bounce" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Step 2: Allow Bots (Mocking Screenshot 2) */}
              <div className="space-y-2">
                <div className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1 uppercase">
                  <span className="text-emerald-400">Step 2:</span> Allow Bots
                </div>

                <div className="rounded-2xl bg-gradient-to-b from-[#10121a] to-[#07080b] border border-slate-800 p-4 min-h-[280px] flex flex-col justify-between">
                  <div>
                    {/* Game-like Title Header (Screenshot 2: I APPROVAL METHOD) */}
                    <div className="border-b border-slate-800 pb-2 mb-3">
                      <div className="text-[10px] font-black text-slate-400 font-mono tracking-wider flex items-center gap-1.5 uppercase">
                        <div className="h-3 w-1 bg-amber-500" />
                        <span>I Approval Method</span>
                      </div>
                    </div>

                    {/* Simulation list */}
                    <div className="space-y-3 font-mono text-[11px]">
                      
                      {/* Auto Approval row */}
                      <div className="flex items-center justify-between py-1 px-2 rounded bg-slate-900/40 border border-slate-800/40">
                        <span className="text-slate-300 font-semibold">AUTO APPROVAL</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-500 font-bold">OFF</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/30">ON</span>
                        </div>
                      </div>

                      {/* LV row */}
                      <div className="flex items-center justify-between py-1 px-2 rounded bg-slate-900/20">
                        <span className="text-slate-400">LV.</span>
                        <span className="text-slate-200 font-bold bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px]">DEFAULT</span>
                      </div>

                      {/* BR Ranked row */}
                      <div className="flex items-center justify-between py-1 px-2 rounded bg-slate-900/20">
                        <span className="text-slate-400">BR-RANKED</span>
                        <span className="text-slate-200 font-bold bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px]">DEFAULT</span>
                      </div>

                      {/* CS Ranked row */}
                      <div className="flex items-center justify-between py-1 px-2 rounded bg-slate-900/20">
                        <span className="text-slate-400">CS-RANKED</span>
                        <span className="text-slate-200 font-bold bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px]">DEFAULT</span>
                      </div>
                    </div>
                  </div>

                  {/* Visual hint indicator */}
                  <div className="mt-4 p-2.5 rounded-xl bg-cyan-950/15 border border-cyan-500/10 text-[10px] text-cyan-400/90 leading-relaxed font-mono">
                    <div className="font-bold flex items-center gap-1 mb-0.5">
                      <ShieldCheck className="h-3 w-3 text-cyan-400" />
                      <span>CLAN PROTECTION ACTIVE</span>
                    </div>
                    Bot automatic login is allowed and ready to bypass security limits instantly.
                  </div>
                </div>
              </div>

            </div>

            {/* Customization Toggle Panel for screenshots */}
            <div className="mb-6 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 text-xs">
              <button 
                type="button"
                onClick={() => setIsCardEditOpen(!isCardEditOpen)}
                className="w-full flex items-center justify-between text-slate-300 font-bold hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Customize Guild Card Details for Screenshots</span>
                </span>
                <span className="text-slate-500 font-mono text-[10px]">
                  {isCardEditOpen ? "Hide Options ▲" : "Show Options ▼"}
                </span>
              </button>

              {isCardEditOpen && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/60 animate-in fade-in-50 duration-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">GUILD NAME</label>
                    <input 
                      type="text"
                      value={customGuildName}
                      onChange={(e) => setCustomGuildName(e.target.value)}
                      placeholder="e.g. w00000000ss3"
                      className="w-full bg-[#0a0b0e] text-white border border-slate-800 hover:border-slate-700 focus:border-cyan-400 rounded p-1.5 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">GUILD GLORY</label>
                    <input 
                      type="text"
                      value={customGlory}
                      onChange={(e) => setCustomGlory(e.target.value)}
                      placeholder="e.g. 429498 / 4200"
                      className="w-full bg-[#0a0b0e] text-white border border-slate-800 hover:border-slate-700 focus:border-cyan-400 rounded p-1.5 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">GUILD LEVEL</label>
                    <input 
                      type="text"
                      value={customLevel}
                      onChange={(e) => setCustomLevel(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-full bg-[#0a0b0e] text-white border border-slate-800 hover:border-slate-700 focus:border-cyan-400 rounded p-1.5 text-xs font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Subtitle check */}
            <p className="text-center text-sm font-semibold text-slate-300 mb-5 tracking-tight font-['Outfit']">
              Are you sure you want to launch a new group?
            </p>

            {/* Details Summary grid matching Screenshot 1 */}
            <div className="rounded-xl bg-slate-950 border border-slate-900 px-4 py-3 text-xs sm:text-sm font-medium space-y-2 mb-6">
              <div className="flex justify-between items-center text-slate-400 py-1 border-b border-slate-900/40">
                <span>Region:</span>
                <span className="font-bold text-white flex items-center gap-1">
                  <span>{selectedServerInfo.flag}</span>
                  <span>{selectedServerInfo.name}</span>
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 py-1 border-b border-slate-900/40">
                <span>Clan ID:</span>
                <span className="font-mono font-bold text-white tracking-wider">{guildId}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 py-1">
                <span>Cost:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <span>1 Credit</span>
                  <span className="text-slate-600 font-normal">•</span>
                  <span className="text-slate-300 text-xs">RS {CREDIT_RATE_RS}</span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-xs sm:text-sm font-bold text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeLaunch}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs sm:text-sm tracking-wide uppercase shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer font-orbitron"
              >
                Proceed
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};
