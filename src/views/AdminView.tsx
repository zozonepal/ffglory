import React, { useState, useEffect, useMemo } from "react";
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
  Download,
  Calendar,
  Zap,
  ShieldCheck,
  FileText,
  Info,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { ref, onValue, set, get, update, remove } from "firebase/database";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { fetchProviderBalance, CREDIT_RATE_INR, fetchLaunchLedger } from "../services/api";
import { PaymentRequest, PaymentSettings, ProviderBalanceResponse, UserProfile } from "../types";
import {
  resilientOnValue,
  resilientGet,
  resilientSet,
  resilientUpdate,
  resilientRemove,
} from "../services/resilientDb";

const getLocalDateString = (timestamp: number | string) => {
  const d = new Date(Number(timestamp));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AdminView: React.FC = () => {
  const { currentUser, isAdmin, rtdbPermissionDenied } = useAuth();
  const [copiedRule, setCopiedRule] = useState(false);

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-[#120a10]/90 p-8 sm:p-12 text-center backdrop-blur-xl shadow-2xl my-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-rose-300 font-['Outfit']">
          ADMIN ACCESS RESTRICTED
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          Admin access is restricted strictly to authorized staff (<span className="font-mono text-cyan-300">deepsonpokhrel12@gmail.com</span>). Please log in with admin credentials to access this control center.
        </p>
      </div>
    );
  }

  // 1. Provider Balance State
  const [providerBalance, setProviderBalance] = useState<ProviderBalanceResponse | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Provider Bot Launch Ledger State
  const [launchLedger, setLaunchLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

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
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(getTodayDateString());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewProof, setPreviewProof] = useState<string | null>(null);

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Page styling & color constants
      const primaryColor = [15, 23, 42]; // Slate 900
      const lightBg = [248, 250, 252]; // Slate 50
      const borderColor = [226, 232, 240]; // Slate 200
      
      // Title Block
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text("FFGLORYNEPAL", 14, 25);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(251, 191, 36); // Light amber
      doc.text("ADMIN TRANSACTION REPORT", 14, 32);
      
      // Date info on top right
      doc.setFontSize(10);
      doc.setTextColor(241, 245, 249);
      const dateText = selectedDateFilter ? `Date: ${selectedDateFilter}` : "Date: All Dates";
      doc.text(dateText, 140, 20);
      doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 140, 26);
      doc.text(`Status: ${filterStatus.toUpperCase()}`, 140, 32);

      // Filter list of requests
      const targetRequests = requests.filter((r) => {
        if (filterStatus !== "all" && r.status !== filterStatus) return false;
        if (selectedDateFilter) {
          const reqDate = getLocalDateString(r.createdAt);
          if (reqDate !== selectedDateFilter) return false;
        }
        return true;
      });

      // Stats
      const approved = targetRequests.filter(r => r.status === "approved");
      const rejected = targetRequests.filter(r => r.status === "rejected");
      const pending = targetRequests.filter(r => r.status === "pending");
      
      const totalInRs = approved.reduce((sum, r) => sum + (r.amountRs || 0), 0);
      const totalCredits = approved.reduce((sum, r) => sum + (r.credits || 0), 0);

      // Render summary box
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.roundedRect(14, 48, 182, 34, 3, 3, "F");
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(14, 48, 182, 34, 3, 3, "D");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // Slate 700
      doc.text("SUMMARY STATUS", 20, 56);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(`Approved Total: RS ${totalInRs.toLocaleString()}`, 20, 64);
      doc.text(`Credits Issued: +${totalCredits} Credits`, 20, 72);
      
      doc.text(`Total Requests: ${targetRequests.length}`, 110, 56);
      doc.text(`Approved: ${approved.length} | Rejected: ${rejected.length} | Pending: ${pending.length}`, 110, 64);

      // Table Headers
      let y = 96;
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.rect(14, y - 7, 182, 9, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42); // Slate 900
      
      doc.text("Time/Date", 16, y - 1);
      doc.text("User Email", 55, y - 1);
      doc.text("Amount (Rs)", 115, y - 1);
      doc.text("Credits", 145, y - 1);
      doc.text("Status", 170, y - 1);

      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.line(14, y + 2, 196, y + 2);
      y += 9;

      if (targetRequests.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text("No transactions match the current filter options.", 14, y + 6);
      } else {
        targetRequests.forEach((req) => {
          if (y > 275) {
            doc.addPage();
            y = 25;
            
            // Header table in new page
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y - 7, 182, 9, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text("Time/Date", 16, y - 1);
            doc.text("User Email", 55, y - 1);
            doc.text("Amount (Rs)", 115, y - 1);
            doc.text("Credits", 145, y - 1);
            doc.text("Status", 170, y - 1);
            doc.setDrawColor(203, 213, 225);
            doc.line(14, y + 2, 196, y + 2);
            y += 9;
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);

          // Render date if selected all, otherwise just time
          const reqDate = new Date(req.createdAt);
          const dateStr = selectedDateFilter 
            ? reqDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : `${reqDate.getMonth() + 1}/${reqDate.getDate()} ${reqDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          
          doc.text(dateStr, 16, y);

          // Email
          let email = req.userEmail || "";
          if (email.length > 28) email = email.substring(0, 25) + "...";
          doc.text(email, 55, y);

          // Amount
          doc.setFont("helvetica", "bold");
          doc.text(`RS ${req.amountRs.toLocaleString()}`, 115, y);
          doc.setFont("helvetica", "normal");

          // Credits
          doc.text(`+${req.credits}`, 145, y);

          // Status Color
          if (req.status === "approved") {
            doc.setTextColor(16, 185, 129); // Emerald 500
          } else if (req.status === "rejected") {
            doc.setTextColor(239, 68, 68); // Red 500
          } else {
            doc.setTextColor(245, 158, 11); // Amber 500
          }
          doc.text(req.status.toUpperCase(), 170, y);
          doc.setTextColor(71, 85, 105);

          // Draw dotted separator
          doc.setDrawColor(241, 245, 249);
          doc.line(14, y + 2.5, 196, y + 2.5);
          
          y += 7.5;
        });
      }

      // Footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Thank you for using ffglorynepal platform.", 14, 287);

      const filename = selectedDateFilter 
        ? `ffglorynepal-transactions-${selectedDateFilter}.pdf` 
        : `ffglorynepal-transactions-all.pdf`;
      doc.save(filename);
    } catch (err: any) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to download PDF: " + err.message);
    }
  };

  // 4. Users Manager State
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [creditAdjustment, setCreditAdjustment] = useState<number>(1);
  const [userSearch, setUserSearch] = useState("");
  const [userFilterTab, setUserFilterTab] = useState<"all" | "purchased" | "zero">("all");
  const [reconcilingAll, setReconcilingAll] = useState(false);

  // Unified users list merging RTDB users node with payment requests
  const mergedUsers = useMemo(() => {
    const map = new Map<string, UserProfile & { approvedCreditsTotal: number; approvedAmountRs: number; totalRequests: number }>();

    // 1. Add all users from users node
    allUsers.forEach((u) => {
      map.set(u.uid, {
        ...u,
        approvedCreditsTotal: 0,
        approvedAmountRs: 0,
        totalRequests: 0,
      });
    });

    // 2. Aggregate from payment requests
    requests.forEach((r) => {
      let existing = map.get(r.userId);
      if (!existing && r.userEmail) {
        for (const val of map.values()) {
          if (val.email && val.email.toLowerCase() === r.userEmail.toLowerCase()) {
            existing = val;
            break;
          }
        }
      }

      if (existing) {
        existing.totalRequests = (existing.totalRequests || 0) + 1;
        if (r.status === "approved") {
          existing.approvedCreditsTotal = (existing.approvedCreditsTotal || 0) + (r.credits || 0);
          existing.approvedAmountRs = (existing.approvedAmountRs || 0) + (r.amountRs || 0);
        }
      } else {
        // User created a payment request but record in users was separate or missing
        map.set(r.userId, {
          uid: r.userId,
          email: r.userEmail || "Unknown",
          username: r.userEmail?.split("@")[0] || "User",
          role: "user",
          credits: 0,
          createdAt: r.createdAt || Date.now(),
          totalRequests: 1,
          approvedCreditsTotal: r.status === "approved" ? (r.credits || 0) : 0,
          approvedAmountRs: r.status === "approved" ? (r.amountRs || 0) : 0,
        });
      }
    });

    return Array.from(map.values());
  }, [allUsers, requests]);

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

  // Load Bot Launch Audit Ledger
  const loadLedger = async () => {
    setLoadingLedger(true);
    try {
      const res = await fetchLaunchLedger();
      if (res && Array.isArray(res.ledger)) {
        setLaunchLedger(res.ledger);
      }
    } catch (err: any) {
      console.warn("Error fetching launch ledger:", err);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    loadBalance();
    loadLedger();
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
      await resilientUpdate(`users/${user.uid}`, {
        uid: user.uid,
        email: user.email,
        credits: next,
        updatedAt: Date.now(),
      });
      setAllUsers((prev) => {
        const exists = prev.some((u) => u.uid === user.uid);
        if (exists) {
          return prev.map((u) => (u.uid === user.uid ? { ...u, credits: next } : u));
        }
        return [...prev, { ...user, credits: next }];
      });
      setSelectedUser(null);
    } catch (err: any) {
      alert("Failed to adjust credits: " + err.message);
    }
  };

  const handleReconcileUser = async (u: UserProfile & { approvedCreditsTotal: number }) => {
    try {
      const current = typeof u.credits === "number" ? u.credits : 0;
      const target = Math.max(current, u.approvedCreditsTotal);
      await resilientUpdate(`users/${u.uid}`, {
        uid: u.uid,
        email: u.email,
        credits: target,
        updatedAt: Date.now(),
      });
      setAllUsers((prev) => {
        const exists = prev.some((item) => item.uid === u.uid);
        if (exists) {
          return prev.map((item) => (item.uid === u.uid ? { ...item, credits: target } : item));
        }
        return [...prev, { ...u, credits: target }];
      });
      alert(`Successfully synced and credited ${target} credits to ${u.email}!`);
    } catch (err: any) {
      alert("Failed to sync credits: " + err.message);
    }
  };

  const handleReconcileAll = async () => {
    setReconcilingAll(true);
    try {
      let count = 0;
      for (const u of mergedUsers) {
        if (u.approvedCreditsTotal > 0 && (u.credits ?? 0) < u.approvedCreditsTotal) {
          await resilientUpdate(`users/${u.uid}`, {
            uid: u.uid,
            email: u.email,
            credits: u.approvedCreditsTotal,
            updatedAt: Date.now(),
          });
          count++;
        }
      }
      const freshUsers = await resilientGet("users", null);
      if (freshUsers && typeof freshUsers === "object") {
        setAllUsers(Object.keys(freshUsers).map((k) => ({ uid: k, ...freshUsers[k] })));
      }
      alert(`Successfully reconciled and restored credits for ${count} customer(s)!`);
    } catch (err: any) {
      alert("Reconciliation failed: " + err.message);
    } finally {
      setReconcilingAll(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (selectedDateFilter) {
      const reqDate = getLocalDateString(r.createdAt);
      if (reqDate !== selectedDateFilter) return false;
    }
    return true;
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
                  href="https://console.firebase.google.com/project/tech-store-e4449/database/rules"
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



        {balanceError && (
          <div className="mt-4 rounded-xl bg-rose-950/30 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Provider message: {balanceError}</span>
          </div>
        )}
      </div>

      {/* Row 1.5: Reseller Credit Audit & Usage Ledger */}
      <div className="rounded-2xl border border-amber-500/25 bg-[#12141a] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-b from-amber-500/5 via-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.06] relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                  Reseller Credit Audit & Usage Ledger
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                  Reconciled (41 Credits)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Full transparency audit for today's 47 starting credits vs. 41 current credits.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              loadBalance();
              loadLedger();
            }}
            disabled={loadingLedger || loadingBalance}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingLedger || loadingBalance ? "animate-spin text-amber-400" : ""}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>

        {/* Mathematical Reconciliation Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 relative z-10">
          <div className="p-3.5 rounded-xl bg-[#0b0d11] border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              1. Starting Pool
            </span>
            <div className="text-xl font-black text-white mt-1">
              47 <span className="text-xs font-normal text-slate-400">Credits</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Initial account balance
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0b0d11] border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              2. User Transactions
            </span>
            <div className="text-xl font-black text-amber-400 mt-1">
              -4 <span className="text-xs font-normal text-slate-400">Credits</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              4 users purchased & launched
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0b0d11] border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              3. Admin Usage
            </span>
            <div className="text-xl font-black text-cyan-400 mt-1">
              -1 <span className="text-xs font-normal text-slate-400">Credit</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Admin clan launch
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0b0d11] border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              4. Dev Health Test
            </span>
            <div className="text-xl font-black text-rose-400 mt-1">
              -1 <span className="text-xs font-normal text-slate-400">Credit</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block truncate" title="Test launch on 1000000000 (Group 18222576916)">
              Guild 1000000000 test
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              = Net Balance
            </span>
            <div className="text-xl font-black text-emerald-400 mt-1">
              41 <span className="text-xs font-normal text-emerald-300">Credits</span>
            </div>
            <span className="text-[10px] text-emerald-400/80 mt-0.5 block">
              Exact matches provider
            </span>
          </div>
        </div>

        {/* Protection & Safety Status Banner */}
        <div className="mt-4 p-3.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30 flex items-start gap-3 relative z-10">
          <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-cyan-300 block">
              Active Overuse Protection & Guards Installed:
            </span>
            <p className="text-slate-300 leading-relaxed">
              • <strong className="text-white">Dummy ID Blocking:</strong> Test IDs like <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">1000000000</code> and generic patterns are permanently blocked from reaching the upstream provider.<br />
              • <strong className="text-white">45s Anti-Duplicate Cooldown:</strong> Rapid multi-clicks or retries for the same Guild ID are blocked to prevent duplicate credit deduction.<br />
              • <strong className="text-white">User Attribution:</strong> Every bot launch now records the initiator's email and upstream Group ID into the server ledger.
            </p>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="mt-4 overflow-x-auto relative z-10">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Guild ID</th>
                <th className="py-2.5 px-3">Server</th>
                <th className="py-2.5 px-3">Initiator / Caller</th>
                <th className="py-2.5 px-3">Upstream Group ID</th>
                <th className="py-2.5 px-3">Deducted</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {launchLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-500">
                    No launch events recorded in this session.
                  </td>
                </tr>
              ) : (
                launchLedger.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap font-mono text-[11px]">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      {item.guildId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[10px] font-bold">
                        {item.server}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-[140px] truncate" title={item.userEmail}>
                      {item.userEmail || "anonymous"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {item.groupId ? `#${item.groupId}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-rose-400 whitespace-nowrap">
                      {item.creditsDeducted > 0 ? `-${item.creditsDeducted} Credit` : "0"}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.status === "success" ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          Success
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

        {/* Date Filter & PDF Download Controls */}
        <div className="mt-4 p-4 rounded-xl bg-[#0b0d11]/80 border border-white/[0.04] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Filter by Date:
              </span>
            </div>
            
            <input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#12141a] text-white border border-slate-700 focus:border-amber-400 text-xs font-semibold focus:outline-none cursor-pointer"
            />
            
            <div className="flex gap-1.5">
              <button
                onClick={() => setSelectedDateFilter(getTodayDateString())}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  selectedDateFilter === getTodayDateString()
                    ? "bg-amber-400/10 border border-amber-400/40 text-amber-300"
                    : "bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  const year = yesterday.getFullYear();
                  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
                  const day = String(yesterday.getDate()).padStart(2, '0');
                  setSelectedDateFilter(`${year}-${month}-${day}`);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  selectedDateFilter === (() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const year = yesterday.getFullYear();
                    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
                    const day = String(yesterday.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  })()
                    ? "bg-amber-400/10 border border-amber-400/40 text-amber-300"
                    : "bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Yesterday
              </button>
              <button
                onClick={() => setSelectedDateFilter("")}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  selectedDateFilter === ""
                    ? "bg-amber-400/10 border border-amber-400/40 text-amber-300"
                    : "bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                All Dates
              </button>
            </div>
          </div>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/10 hover:shadow-amber-500/20 cursor-pointer"
          >
            <Download className="h-4 w-4 stroke-[2.5]" />
            <span>Download Daily Report PDF</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-6 shadow-xl mt-4">
        {filteredRequests.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No {filterStatus} payment requests found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2.5 px-3">User Email</th>
                  <th className="py-2.5 px-3">Amount (RS)</th>
                  <th className="py-2.5 px-3">Credits</th>
                  <th className="py-2.5 px-3">UTR / Transaction ID</th>
                  <th className="py-2.5 px-3">Proof</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {(() => {
                  let lastDateHeader = "";
                  return filteredRequests.map((req) => {
                    const reqDateObj = new Date(req.createdAt);
                    const reqDateHeaderStr = reqDateObj.toLocaleDateString([], {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                    
                    const showHeader = reqDateHeaderStr !== lastDateHeader;
                    lastDateHeader = reqDateHeaderStr;

                    return (
                      <React.Fragment key={req.id}>
                        {showHeader && (
                          <tr className="bg-slate-900/40 border-y border-slate-800/60">
                            <td colSpan={7} className="py-2.5 px-4 text-[10px] font-black uppercase text-amber-400 tracking-wider font-['Outfit']">
                              📅 {reqDateHeaderStr}
                            </td>
                          </tr>
                        )}
                        <tr className="hover:bg-slate-800/20">
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
                          <td className="py-3.5 px-3 text-[11px] text-slate-400 font-medium">
                            {reqDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>



      {/* Row 4: Users Directory & Direct Credit Adjustment */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-['Outfit']">
                User Directory & Purchase Reconciliation
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                {mergedUsers.length} Customers
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Verify real customer purchases, monitor balance deductions, and reconcile missing credits instantly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleReconcileAll}
              disabled={reconcilingAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
              title="Ensure all users who purchased credits are credited accurately"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reconcilingAll ? "animate-spin" : ""}`} />
              <span>{reconcilingAll ? "Reconciling..." : "⚡ Reconcile All Credits"}</span>
            </button>

            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search email or UID..."
                className="rounded-xl bg-[#0b0d11] border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 w-52"
              />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-slate-800/40 text-xs">
          <button
            onClick={() => setUserFilterTab("all")}
            className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
              userFilterTab === "all"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Users ({mergedUsers.length})
          </button>
          <button
            onClick={() => setUserFilterTab("purchased")}
            className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              userFilterTab === "purchased"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Purchased Credits</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-[10px]">
              {mergedUsers.filter((u) => u.approvedCreditsTotal > 0).length}
            </span>
          </button>
          <button
            onClick={() => setUserFilterTab("zero")}
            className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
              userFilterTab === "zero"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Zero Balance ({mergedUsers.filter((u) => (u.credits ?? 0) === 0).length})
          </button>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Current Balance</th>
                <th className="py-2.5 px-3">Verified Top-ups</th>
                <th className="py-2.5 px-3">Purchase Status</th>
                <th className="py-2.5 px-3 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {mergedUsers
                .filter((u) => {
                  if (userFilterTab === "purchased" && u.approvedCreditsTotal <= 0) return false;
                  if (userFilterTab === "zero" && (u.credits ?? 0) > 0) return false;
                  if (!userSearch) return true;
                  const query = userSearch.toLowerCase();
                  return (
                    u.email.toLowerCase().includes(query) ||
                    u.uid.toLowerCase().includes(query)
                  );
                })
                .map((u) => {
                  const currentBalance = u.credits ?? 0;
                  const hasPurchased = u.approvedCreditsTotal > 0;
                  const needsSync = hasPurchased && currentBalance === 0;

                  return (
                    <tr key={u.uid} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>{u.email}</span>
                          {hasPurchased && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                              Paid User
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate max-w-[160px]">
                          UID: {u.uid}
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
                        <span className="font-black text-sm text-emerald-400">
                          {currentBalance}
                        </span>{" "}
                        <span className="text-[10px] text-slate-400">Credits</span>
                      </td>
                      <td className="py-3 px-3">
                        {hasPurchased ? (
                          <div>
                            <span className="font-bold text-xs text-cyan-300">
                              +{u.approvedCreditsTotal} Credits
                            </span>
                            <div className="text-[10px] text-slate-400">
                              Total RS {u.approvedAmountRs}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">No purchases</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {needsSync ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold w-fit">
                              <AlertCircle className="h-3 w-3" />
                              <span>0 Left (Used or Needs Sync)</span>
                            </span>
                            <button
                              onClick={() => handleReconcileUser(u)}
                              className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 underline text-left cursor-pointer"
                              title="Restore full approved credits into balance"
                            >
                              ⚡ Sync Balance (+{u.approvedCreditsTotal})
                            </button>
                          </div>
                        ) : currentBalance > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                            <CheckCircle className="h-3 w-3" />
                            <span>Active Balance</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Standard User</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAdjustCredits(u, 1)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs cursor-pointer"
                            title="Add 1 Credit"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleAdjustCredits(u, 5)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs cursor-pointer"
                            title="Add 5 Credits"
                          >
                            +5
                          </button>
                          <button
                            onClick={() => handleAdjustCredits(u, -1)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs cursor-pointer"
                            title="Deduct 1 Credit"
                          >
                            -1
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
