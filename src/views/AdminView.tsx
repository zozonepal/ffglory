import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Server,
  RefreshCw,
  QrCode,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Save,
  Clock,
  User,
  Coins,
  Check,
  Search,
  ExternalLink,
  Trash2,
  Plus,
  Power,
  Tag,
} from "lucide-react";
import { ref, onValue, set, get, update, remove } from "firebase/database";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { fetchProviderBalance, CREDIT_RATE_INR } from "../services/api";
import { PaymentRequest, PaymentSettings, ProviderBalanceResponse, UserProfile } from "../types";
import {
  resilientOnValue,
  resilientGet,
  resilientSet,
  resilientUpdate,
  resilientRemove,
} from "../services/resilientDb";

export const AdminView: React.FC = () => {
  const { currentUser, isAdmin, rtdbPermissionDenied } = useAuth();
  const [copiedRule, setCopiedRule] = useState(false);

  // 1. Provider Balance State
  const [providerBalance, setProviderBalance] = useState<ProviderBalanceResponse | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // 2. Payment Settings State
  const [settings, setSettings] = useState<PaymentSettings>({
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=ffglory@upi&pn=ffglorynepal&cu=INR",
    upiId: "ffglory@upi",
    accountName: "ffglorynepal Official",
    instructions: "Send payment via UPI ID or scan QR. Copy the 12-digit UTR and upload screenshot.",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // 3. Payment Requests Queue
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewProof, setPreviewProof] = useState<string | null>(null);

  // 4. Users Manager State
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [creditAdjustment, setCreditAdjustment] = useState<number>(1);
  const [userSearch, setUserSearch] = useState("");

  // Load Provider Balance
  const loadBalance = async () => {
    setLoadingBalance(true);
    setBalanceError(null);
    try {
      const data = await fetchProviderBalance();
      setProviderBalance(data);
    } catch (err: any) {
      console.error("Error fetching provider balance:", err);
      setBalanceError(err.message || "Failed to fetch provider balance");
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    loadBalance();
  }, []);

  // Listen to Settings from settings/payment_qr
  useEffect(() => {
    const unsubscribe = resilientOnValue("settings/payment_qr", (val) => {
      if (val && typeof val === "object") {
        setSettings((prev) => ({ ...prev, ...val }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to all payment requests
  useEffect(() => {
    const unsubscribe = resilientOnValue("payment_requests", (val) => {
      if (val && typeof val === "object") {
        const list: PaymentRequest[] = Object.keys(val).map((k) => ({
          id: k,
          ...val[k],
        }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setRequests(list);
      } else {
        setRequests([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to all users
  useEffect(() => {
    const unsubscribe = resilientOnValue("users", (val) => {
      if (val && typeof val === "object") {
        const list: UserProfile[] = Object.keys(val).map((k) => ({
          uid: k,
          ...val[k],
        }));
        setAllUsers(list);
      } else {
        setAllUsers([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Save Payment Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(null);
    try {
      await resilientSet("settings/payment_qr", {
        ...settings,
        updatedAt: Date.now(),
      });
      setSettingsSuccess("Payment settings and QR Code saved successfully!");
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err: any) {
      console.error("Save settings error:", err);
      alert("Failed to save settings: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Approve Payment Request
  const handleApprove = async (request: PaymentRequest) => {
    if (!currentUser) return;
    setProcessingId(request.id);

    try {
      // 1. Fetch current user balance
      const userData = await resilientGet(`users/${request.userId}`, null);
      const currentCredits = userData && typeof userData.credits === "number"
        ? userData.credits
        : 0;

      const newBalance = currentCredits + request.credits;

      // 2. Add credits to users/{uid}/credits
      await resilientUpdate(`users/${request.userId}`, {
        credits: newBalance,
      });

      // 3. Mark request as approved
      await resilientUpdate(`payment_requests/${request.id}`, {
        status: "approved",
        updatedAt: Date.now(),
        processedBy: currentUser.email,
      });

      // 4. Log deposit to user history
      await resilientSet(`users/${request.userId}/history/${request.id}`, {
        server: "DEPOSIT",
        guild_id: `UTR: ${request.transactionId}`,
        status: "success",
        creditsDeducted: -request.credits, // positive credit
        timestamp: Date.now(),
        notes: `Deposit of RS ${request.amountRs} approved (+${request.credits} Credits)`,
      });
    } catch (err: any) {
      console.error("Error approving request:", err);
      alert("Approval failed: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Reject Payment Request
  const handleReject = async (request: PaymentRequest) => {
    if (!currentUser) return;
    setProcessingId(request.id);

    try {
      await resilientUpdate(`payment_requests/${request.id}`, {
        status: "rejected",
        updatedAt: Date.now(),
        processedBy: currentUser.email,
      });
    } catch (err: any) {
      console.error("Error rejecting request:", err);
      alert("Rejection failed: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Quick Manual Credit Adjust for User
  const handleAdjustCredits = async (user: UserProfile, addAmount: number) => {
    try {
      const current = typeof user.credits === "number" ? user.credits : 0;
      const next = Math.max(0, current + addAmount);
      await resilientUpdate(`users/${user.uid}`, { credits: next });
      setSelectedUser(null);
    } catch (err: any) {
      alert("Failed to adjust credits: " + err.message);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-8">
      {/* Admin Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-['Outfit']">
              ffglorynepal Admin Control Center
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
              Protected
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage provider bot balance, review deposits, and update payment gateways.
          </p>
        </div>
      </div>

      {/* RTDB Security Rules Advisory Banner if permission is restricted */}
      {rtdbPermissionDenied && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-amber-300 font-['Outfit']">
                  Firebase Realtime Database: Offline-Resilient Mode Active
                </h4>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                  Permission Denied Handled
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your Firebase Realtime Database rules currently restrict client read/write permissions.
                The app automatically switched to local offline-resilient caching so deposits, approvals, and bot launches continue to work smoothly without errors.
              </p>
              <p className="text-xs text-slate-400">
                To enable live real-time synchronization between multiple devices, update your rules in the Firebase Console:
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify({ rules: { ".read": "auth != null", ".write": "auth != null" } }, null, 2)
                    );
                    setCopiedRule(true);
                    setTimeout(() => setCopiedRule(false), 3000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-semibold text-amber-200 transition-colors"
                >
                  <Check className={`h-3.5 w-3.5 ${copiedRule ? "text-emerald-400" : "text-amber-300"}`} />
                  <span>{copiedRule ? "Rules Copied!" : "Copy Suggested Rules"}</span>
                </button>
                <a
                  href="https://console.firebase.google.com/project/ffgloryshop/database/rules"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Firebase Console Rules</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Provider System Status Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit']">
                Provider System Status & Live API Balance
              </h3>
              <p className="text-xs text-slate-400">
                Direct endpoint: <span className="font-mono text-slate-300">GET /balance</span>
              </p>
            </div>
          </div>

          <button
            onClick={loadBalance}
            disabled={loadingBalance}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingBalance ? "animate-spin text-amber-400" : ""}`} />
            <span>Check Balance</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="p-4 rounded-xl bg-[#0b0d11] border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Main Bot API Balance
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {loadingBalance ? (
                <div className="h-7 w-20 bg-slate-800 rounded animate-pulse" />
              ) : providerBalance?.credits !== undefined ? (
                `${providerBalance.credits} Credits`
              ) : providerBalance?.balance !== undefined ? (
                `${providerBalance.balance}`
              ) : (
                <span className="text-sm font-semibold text-slate-400">
                  {balanceError ? "Offline" : "Connected (0)"}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Provider Account Pool
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0b0d11] border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Edge Function Health
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`h-3 w-3 rounded-full ${balanceError ? "bg-rose-500" : "bg-emerald-400 animate-pulse"}`} />
              <span className="text-sm font-bold text-white">
                {balanceError ? "Connection Error" : "Operational (HTTP 200)"}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block truncate">
              Endpoint: .../bot-api/balance
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0b0d11] border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Pending Deposits Queue
            </span>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {pendingCount}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Awaiting your approval
            </span>
          </div>
        </div>

        {/* Raw Response Viewer */}
        {providerBalance && (
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 mb-1.5 block">
              Provider JSON Response Payload:
            </span>
            <pre className="rounded-xl bg-black/60 p-3 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-32 border border-slate-800">
              {JSON.stringify(providerBalance, null, 2)}
            </pre>
          </div>
        )}

        {balanceError && (
          <div className="mt-4 rounded-xl bg-rose-950/30 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Provider message: {balanceError}</span>
          </div>
        )}
      </div>

      {/* Row 2: Payment Requests Queue (Pending Approval) */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white font-['Outfit']">
              Payment Requests Queue
            </h3>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black">
                {pendingCount} Pending
              </span>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center rounded-xl bg-[#0b0d11] p-1 border border-slate-800 text-xs">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg capitalize font-semibold transition-all ${
                  filterStatus === s
                    ? "bg-slate-800 text-white font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No {filterStatus} payment requests found.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2.5 px-3">User Email</th>
                  <th className="py-2.5 px-3">Amount (RS)</th>
                  <th className="py-2.5 px-3">Credits</th>
                  <th className="py-2.5 px-3">UTR / Transaction ID</th>
                  <th className="py-2.5 px-3">Proof</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/20">
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-white">{req.userEmail}</div>
                      <div className="text-[10px] font-mono text-slate-500 truncate max-w-[120px]">
                        {req.userId}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-emerald-400 text-sm">
                      RS {req.amountRs.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-black text-amber-300 text-sm">
                        +{req.credits}
                      </span>{" "}
                      <span className="text-[10px] text-slate-400">Credits</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-200">
                      {req.transactionId}
                    </td>
                    <td className="py-3.5 px-3">
                      {req.proofUrl ? (
                        <button
                          onClick={() => setPreviewProof(req.proofUrl!)}
                          className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-semibold"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Proof</span>
                        </button>
                      ) : (
                        <span className="text-slate-500 text-[11px]">No proof</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-[11px] text-slate-400">
                      {new Date(req.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3">
                      {req.status === "pending" ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleApprove(req)}
                            disabled={processingId === req.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleReject(req)}
                            disabled={processingId === req.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 hover:bg-rose-900/80 font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : req.status === "approved" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px]">
                          <XCircle className="h-3.5 w-3.5" /> Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 3: Manage Payment Settings (QR Code & UPI Info) */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-6 shadow-xl">
        <div className="flex items-center gap-2 pb-4 border-b border-white/[0.06] mb-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-['Outfit']">
              Manage Payment Gateway Settings
            </h3>
            <p className="text-xs text-slate-400">
              Updates are saved directly to Realtime Database <span className="font-mono text-amber-300">settings/payment_qr</span>
            </p>
          </div>
        </div>

        {settingsSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3 text-xs text-emerald-300">
            <Check className="h-4 w-4 text-emerald-400" />
            <span>{settingsSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Payment QR Code Image URL
              </label>
              <input
                type="url"
                required
                value={settings.qrCodeUrl}
                onChange={(e) => setSettings({ ...settings, qrCodeUrl: e.target.value })}
                placeholder="https://.../qr.png"
                className="w-full rounded-xl bg-[#0b0d11] text-white border border-slate-700/80 focus:border-amber-400 px-4 py-3 text-xs font-mono focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  UPI ID (e.g. yourname@upi)
                </label>
                <input
                  type="text"
                  required
                  value={settings.upiId}
                  onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
                  placeholder="merchant@okhdfcbank"
                  className="w-full rounded-xl bg-[#0b0d11] text-white border border-slate-700/80 focus:border-amber-400 px-4 py-3 text-xs font-mono font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Account Display Name
                </label>
                <input
                  type="text"
                  value={settings.accountName || ""}
                  onChange={(e) => setSettings({ ...settings, accountName: e.target.value })}
                  placeholder="FFGlory Official Shop"
                  className="w-full rounded-xl bg-[#0b0d11] text-white border border-slate-700/80 focus:border-amber-400 px-4 py-3 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Payment Instructions / Notes for Users
              </label>
              <textarea
                rows={3}
                value={settings.instructions || ""}
                onChange={(e) => setSettings({ ...settings, instructions: e.target.value })}
                placeholder="Enter instructions for deposit approval..."
                className="w-full rounded-xl bg-[#0b0d11] text-white border border-slate-700/80 focus:border-amber-400 px-4 py-3 text-xs focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-400/20 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{savingSettings ? "Saving..." : "Save Payment Settings"}</span>
            </button>
          </div>

          {/* Live Preview of Admin QR */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-[#0b0d11] border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Live Preview
            </span>
            <div className="p-2 bg-white rounded-xl shadow">
              <img
                src={settings.qrCodeUrl}
                alt="QR Preview"
                className="w-36 h-36 object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=${encodeURIComponent(
                    settings.upiId
                  )}&pn=FFGlory&cu=INR`;
                }}
              />
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 mt-2">
              {settings.upiId}
            </span>
          </div>
        </form>
      </div>

      {/* Row 4: Users Directory & Direct Credit Adjustment */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white font-['Outfit']">
              User Directory & Manual Credit Adjustment
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs font-bold text-slate-300">
              {allUsers.length} Users
            </span>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by email or UID..."
              className="rounded-xl bg-[#0b0d11] border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Credits Balance</th>
                <th className="py-2.5 px-3">Registered</th>
                <th className="py-2.5 px-3">Quick Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {allUsers
                .filter(
                  (u) =>
                    !userSearch ||
                    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.uid.toLowerCase().includes(userSearch.toLowerCase())
                )
                .slice(0, 15)
                .map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-800/20">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{u.email}</div>
                      <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                        {u.uid}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                          u.role === "admin"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-extrabold text-sm text-emerald-400">
                        {u.credits ?? 0}
                      </span>{" "}
                      <span className="text-[10px] text-slate-400">Credits</span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAdjustCredits(u, 1)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs"
                          title="Add 1 Credit"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => handleAdjustCredits(u, 5)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs"
                          title="Add 5 Credits"
                        >
                          +5
                        </button>
                        <button
                          onClick={() => handleAdjustCredits(u, -1)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs"
                          title="Deduct 1 Credit"
                        >
                          -1
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proof Image Modal */}
      {previewProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative max-w-2xl w-full rounded-2xl bg-[#141720] border border-white/[0.1] p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="text-xs font-bold text-white">Payment Proof Document</span>
              <button
                onClick={() => setPreviewProof(null)}
                className="px-2 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="flex items-center justify-center bg-black/40 rounded-xl p-2 max-h-[70vh] overflow-auto">
              <img
                src={previewProof}
                alt="Payment Proof"
                className="max-h-[65vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
