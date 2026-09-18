import React, { useState, useEffect, useRef } from "react";
import {
  Coins,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  QrCode,
  X,
  AlertCircle,
  Smartphone,
  ChevronRight,
  RefreshCw,
  Zap,
  Building2,
  CheckCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import {
  CREDIT_RATE_RS,
  createFonepayQr,
  verifyFonepayPayment,
  extractErrorMessage,
} from "../services/api";
import { FonepayCreateQrResponse, PaymentRequest } from "../types";
import { resilientOnValue, resilientPush, resilientUpdate, resilientSet, resilientGet } from "../services/resilientDb";

interface DepositViewProps {
  onClose?: () => void;
}

interface CreditPack {
  credits: number;
  label: string;
  subtitle: string;
  popular?: boolean;
}

const CREDIT_PACKS: CreditPack[] = [
  { credits: 1, label: "1 Credit", subtitle: "Single Clan Match" },
  { credits: 3, label: "3 Credits", subtitle: "3 Matches Pack" },
  { credits: 5, label: "5 Credits", subtitle: "Standard Clan Pack", popular: true },
  { credits: 10, label: "10 Credits", subtitle: "Pro Tournament Pack" },
  { credits: 20, label: "20 Credits", subtitle: "Clan Master Pack" },
];

const SUPPORTED_APPS = [
  { name: "Fonepay", color: "text-rose-400 border-rose-500/30 bg-rose-950/40" },
  { name: "eSewa", color: "text-emerald-400 border-emerald-500/30 bg-emerald-950/40" },
  { name: "Khalti", color: "text-purple-400 border-purple-500/30 bg-purple-950/40" },
  { name: "IME Pay", color: "text-amber-400 border-amber-500/30 bg-amber-950/40" },
  { name: "Global IME", color: "text-cyan-400 border-cyan-500/30 bg-cyan-950/40" },
  { name: "NIC Asia", color: "text-blue-400 border-blue-500/30 bg-blue-950/40" },
  { name: "Nabil Bank", color: "text-teal-400 border-teal-500/30 bg-teal-950/40" },
  { name: "All Mobile Banking", color: "text-slate-300 border-slate-700 bg-slate-900/60" },
];

export const DepositView: React.FC<DepositViewProps> = ({ onClose }) => {
  const { currentUser, userProfile, updateUserCredits } = useAuth();

  // Selection states
  const [selectedPackCredits, setSelectedPackCredits] = useState<number>(5);
  const [customCredits, setCustomCredits] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);

  // Fonepay QR & verification state
  const [generatingQr, setGeneratingQr] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [qrData, setQrData] = useState<FonepayCreateQrResponse | null>(null);
  const [activeRemark, setActiveRemark] = useState<string>("");
  const [qrError, setQrError] = useState<string | null>(null);
  const [verifyStatusText, setVerifyStatusText] = useState<string>("");
  const [manualVerifyAlert, setManualVerifyAlert] = useState<{
    type: "error" | "info";
    title: string;
    message: string;
  } | null>(null);

  // Payment completed success modal
  const [paymentSuccess, setPaymentSuccess] = useState<{
    credits: number;
    amountRs: number;
    billId?: string;
    remark: string;
  } | null>(null);

  const [copied, setCopied] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<PaymentRequest[]>([]);

  // Polling ref to prevent multiple timers
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Derived calculations
  const activeCredits = isCustom
    ? Math.max(1, parseInt(customCredits, 10) || 1)
    : selectedPackCredits;
  const totalPayableRs = activeCredits * CREDIT_RATE_RS;

  // Load user's recent verified payment history
  useEffect(() => {
    if (!currentUser) return;
    const unsubReqs = resilientOnValue("payment_requests", (data) => {
      if (data && typeof data === "object") {
        const list: PaymentRequest[] = Object.keys(data)
          .map((id) => ({ id, ...data[id] }))
          .filter((r) => r.userId === currentUser.uid && r.status === "approved");
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setMyRequests(list);
      } else {
        setMyRequests([]);
      }
    });

    return () => unsubReqs();
  }, [currentUser]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  /**
   * Finalize approved payment: credit user and save record in RTDB
   */
  const handlePaymentApproved = async (
    confirmedRemark: string,
    confirmedBillId: string,
    confirmedCredits: number,
    confirmedAmount: number
  ) => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    try {
      // 1. Credit the user balance safely by fetching latest balance first
      let currentCredits = userProfile?.credits || 0;
      if (currentUser) {
        try {
          const userSnap = await resilientGet(`users/${currentUser.uid}`, null);
          if (userSnap && typeof userSnap.credits === "number") {
            currentCredits = userSnap.credits;
          }
        } catch (fetchErr) {
          console.warn("Could not prefetch RTDB balance:", fetchErr);
        }
      }
      const updatedCredits = currentCredits + confirmedCredits;
      await updateUserCredits(updatedCredits);

      // 2. Log transaction and user profile details in database
      if (currentUser) {
        const timestamp = Date.now();
        const txId = confirmedBillId || confirmedRemark;

        const newRecord: Omit<PaymentRequest, "id"> & { credited?: boolean; creditedBalance?: number } = {
          userId: currentUser.uid,
          userEmail: currentUser.email || "Unknown",
          amountRs: confirmedAmount,
          credits: confirmedCredits,
          transactionId: txId,
          paymentMethod: "fonepay",
          status: "approved",
          credited: true,
          creditedBalance: updatedCredits,
          createdAt: timestamp,
        };
        // Global payment requests node
        await resilientPush("payment_requests", newRecord);

        // User-specific transaction history node
        await resilientPush(`users/${currentUser.uid}/transactions`, {
          transactionId: txId,
          remark: confirmedRemark,
          billId: confirmedBillId || null,
          amountRs: confirmedAmount,
          credits: confirmedCredits,
          paymentMethod: "fonepay",
          status: "approved",
          timestamp,
        });

        // Store / update user profile record in database with last topup details
        await resilientUpdate(`users/${currentUser.uid}`, {
          uid: currentUser.uid,
          email: currentUser.email || "Unknown",
          credits: updatedCredits,
          lastTopupAmountRs: confirmedAmount,
          lastTopupCredits: confirmedCredits,
          lastTopupAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // 3. Trigger success UI
      setPaymentSuccess({
        credits: confirmedCredits,
        amountRs: confirmedAmount,
        billId: confirmedBillId,
        remark: confirmedRemark,
      });
      setQrData(null);
      setVerifyStatusText("");
    } catch (err: any) {
      console.error("Error finalizing credit deposit:", err);
      setQrError("Payment was verified but failed to update balance. Please contact support.");
    }
  };

  /**
   * Check Fonepay payment verification
   * If isManualClick is true and payment is not received, directly show "Payment Not Received"
   * and NEVER write/save anything into the database as pending!
   */
  const checkVerification = async (
    remark: string,
    billId: string,
    credits: number,
    amount: number,
    isManualClick: boolean = false
  ) => {
    const cleanRemark = (remark || activeRemark || "").trim().toUpperCase();
    if (!cleanRemark) return false;
    setVerifying(true);

    if (isManualClick) {
      setManualVerifyAlert(null);
      setVerifyStatusText("Querying Fonepay settlement gateway...");
    }

    try {
      const res = await verifyFonepayPayment(cleanRemark);
      if (res && res.verified) {
        setManualVerifyAlert(null);
        setVerifyStatusText("Payment Verified! Crediting your account...");
        await handlePaymentApproved(cleanRemark, billId || cleanRemark, credits, amount);
        return true;
      } else {
        // Payment NOT received yet
        setManualVerifyAlert({
          type: "error",
          title: "Payment Not Received",
          message: `No payment was received on Fonepay for remark "${cleanRemark}". Please scan the QR code and pay RS ${amount.toLocaleString()} in your mobile banking or wallet app (eSewa, Khalti, etc.) before clicking "Verify Payment".`,
        });
        setVerifyStatusText("Payment not detected. Please complete transfer in your app and click 'Verify Payment'.");
        return false;
      }
    } catch (err: any) {
      console.warn("Fonepay verification error:", err);
      const msg = extractErrorMessage(err, "Unable to confirm payment from Fonepay gateway at this moment.");
      setManualVerifyAlert({
        type: "error",
        title: "Payment Not Received",
        message: msg.includes("Payment Not Received") ? msg : `${msg} If you haven't paid yet, please complete the transfer first.`,
      });
      setVerifyStatusText("Ready for verification. Click 'Verify Payment' after paying.");
      return false;
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Generate new Fonepay Dynamic QR Code
   */
  const handleGenerateQr = async () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setGeneratingQr(true);
    setQrError(null);
    setManualVerifyAlert(null);
    setVerifyStatusText("");

    // Generate clean unique uppercase alphanumeric remark formatted like PRN-123456780867-563
    const part1 = String(Date.now()).slice(-12).padStart(12, "0");
    const part2 = String(Math.floor(100 + Math.random() * 900));
    const uniqueRemark = `PRN-${part1}-${part2}`;

    setActiveRemark(uniqueRemark);

    try {
      const data = await createFonepayQr(totalPayableRs, uniqueRemark);
      setQrData(data);
      setVerifyStatusText("Fonepay QR generated! Scan with any banking app & click 'Verify Payment' below.");
    } catch (err: any) {
      console.error("Failed to generate Fonepay QR:", err);
      const msg = extractErrorMessage(err, "Failed to generate dynamic Fonepay QR. Please try again.");
      setQrError(msg);
    } finally {
      setGeneratingQr(false);
    }
  };

  /**
   * Cancel active QR and return to pack selection
   */
  const handleCancelQr = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setQrData(null);
    setActiveRemark("");
    setQrError(null);
    setManualVerifyAlert(null);
    setVerifyStatusText("");
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* SUCCESS CELEBRATION MODAL */}
      {paymentSuccess && (
        <div className="rounded-3xl border border-emerald-500/50 bg-[#061410]/95 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,229,153,0.3)] relative overflow-hidden text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-1/4 right-1/4 h-24 bg-gradient-to-b from-emerald-500/20 to-transparent blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center max-w-md mx-auto">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(0,229,153,0.5)] mb-4 animate-bounce">
              <CheckCheck className="h-8 w-8 stroke-[3]" />
            </div>

            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 font-orbitron">
              FONEPAY PAYMENT CONFIRMED
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-orbitron mt-1">
              +{paymentSuccess.credits} Credits Added!
            </h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Your payment of <strong className="text-amber-300 font-mono">RS {paymentSuccess.amountRs.toLocaleString()}</strong> has been verified via Fonepay. Your new account balance is ready for launching bot matches.
            </p>

            <div className="w-full mt-4 p-3 rounded-2xl bg-[#0a1f18] border border-emerald-500/30 text-[11px] text-slate-300 space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction Remark:</span>
                <span className="text-emerald-300 font-bold">{paymentSuccess.remark}</span>
              </div>
              {paymentSuccess.billId && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Fonepay Bill ID:</span>
                  <span className="text-slate-200">{paymentSuccess.billId}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-6">
              <button
                type="button"
                onClick={() => setPaymentSuccess(null)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00f0ff] via-[#00e599] to-[#00f0ff] text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.4)] cursor-pointer font-orbitron"
              >
                Top Up More Credits
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider border border-slate-700 transition-colors cursor-pointer"
                >
                  Close Window
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN RECHARGE CARD */}
      {!paymentSuccess && (
        <div className="rounded-3xl border border-cyan-500/25 bg-[#08121a]/95 backdrop-blur-2xl p-5 sm:p-7 shadow-[0_0_50px_rgba(0,240,255,0.08)] relative overflow-hidden">
          {/* Ambient Top Neon Glow */}
          <div className="absolute top-0 left-1/4 right-1/4 h-24 bg-gradient-to-b from-cyan-500/10 via-emerald-500/5 to-transparent blur-2xl pointer-events-none" />

          {/* Top Header Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10 mb-5 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                <Coins className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-white uppercase tracking-wider font-orbitron">
                  RECHARGE CREDITS
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Instant automated Fonepay QR • Scanned by all Nepali Banks & Wallets
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="rounded-full bg-[#0a1e1e] border border-emerald-500/40 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold text-emerald-400 tracking-wide font-mono">
                RS {CREDIT_RATE_RS} / Credit
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* ERROR ALERT */}
          {qrError && (
            <div className="relative z-10 mb-5 flex items-start gap-2.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 p-3.5 text-xs text-rose-300 break-words">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{qrError}</span>
            </div>
          )}

          {/* VIEW A: SELECT CREDIT PACK (when no QR is generated yet) */}
          {!qrData && (
            <div className="relative z-10 space-y-5 sm:space-y-6">
              <div>
                <div className="text-[10px] sm:text-[11px] font-bold text-cyan-400 uppercase tracking-widest mb-3 font-orbitron flex items-center gap-1.5">
                  <span>1. SELECT CREDIT PACK</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {CREDIT_PACKS.map((pack) => {
                    const isSelected = !isCustom && selectedPackCredits === pack.credits;
                    const packPrice = pack.credits * CREDIT_RATE_RS;
                    return (
                      <div
                        key={pack.credits}
                        onClick={() => {
                          setSelectedPackCredits(pack.credits);
                          setIsCustom(false);
                        }}
                        className={`relative p-3 sm:p-4 rounded-2xl cursor-pointer transition-all duration-200 border ${
                          isSelected
                            ? "bg-[#0c1822] border-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/50"
                            : "bg-[#0a131b] border-slate-800/90 hover:border-slate-700 hover:bg-[#0d1a24]"
                        }`}
                      >
                        {pack.popular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[8px] sm:text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.6)]">
                            POPULAR
                          </div>
                        )}

                        <div className="text-xs sm:text-base font-black text-white font-orbitron tracking-tight">
                          {pack.label}
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-amber-400 mt-0.5 sm:mt-1 font-mono">
                          RS {packPrice.toLocaleString()}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
                          {pack.subtitle}
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom Amount Option */}
                  <div
                    onClick={() => setIsCustom(true)}
                    className={`p-3 sm:p-4 rounded-2xl cursor-pointer transition-all duration-200 border ${
                      isCustom
                        ? "bg-[#0c1822] border-cyan-400/90 shadow-[0_0_20px_rgba(0,240,255,0.3)] ring-1 ring-cyan-400/50"
                        : "bg-[#0a131b] border-slate-800/90 hover:border-slate-700 hover:bg-[#0d1a24]"
                    }`}
                  >
                    <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      CUSTOM AMOUNT
                    </div>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty..."
                      value={customCredits}
                      onChange={(e) => {
                        setIsCustom(true);
                        setCustomCredits(e.target.value);
                      }}
                      className="w-full mt-1 bg-[#050a0f] border border-slate-700/80 rounded-xl px-2 py-1 text-xs font-mono text-cyan-300 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                    <div className="text-[9px] sm:text-[10px] text-slate-400 mt-1 truncate">
                      {isCustom && customCredits
                        ? `RS ${(Math.max(1, parseInt(customCredits, 10) || 1) * CREDIT_RATE_RS).toLocaleString()}`
                        : "Custom Qty"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Supported Payment Channels */}
              <div>
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-orbitron flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>SUPPORTED PAYMENT APPS (ALL SCANNABLE)</span>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {SUPPORTED_APPS.map((app) => (
                    <span
                      key={app.name}
                      className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl border ${app.color}`}
                    >
                      {app.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* TOTAL PAYABLE & VERIFIED GATEWAY BAR */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3.5 sm:p-4 rounded-2xl bg-[#070e14] border border-slate-800/90">
                <div className="text-xs text-slate-300 font-medium">
                  TOTAL PAYABLE:{" "}
                  <span className="text-sm sm:text-lg font-black text-amber-400 font-mono">
                    RS {totalPayableRs.toLocaleString()}
                  </span>{" "}
                  <span className="text-slate-400 text-[10px] sm:text-[11px]">
                    ({activeCredits} × RS {CREDIT_RATE_RS})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-emerald-400 font-semibold">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Fonepay Automated Gateway</span>
                </div>
              </div>

              {/* CTA BUTTON */}
              <button
                type="button"
                disabled={generatingQr}
                onClick={handleGenerateQr}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#00f0ff] via-[#00e599] to-[#00f0ff] bg-[length:200%_auto] hover:bg-right text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider py-3.5 sm:py-4 px-3 transition-all duration-300 shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:shadow-[0_0_40px_rgba(0,240,255,0.7)] cursor-pointer font-orbitron disabled:opacity-50 text-center break-words leading-tight"
              >
                {generatingQr ? (
                  <>
                    <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Generating Secure Fonepay QR...</span>
                  </>
                ) : (
                  <>
                    <span className="truncate">
                      GENERATE FONEPAY QR & PAY RS {totalPayableRs.toLocaleString()}
                    </span>
                    <ArrowRight className="h-4 w-4 stroke-[3] shrink-0" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* VIEW B: ACTIVE FONEPAY DYNAMIC QR SCREEN (Awaiting Payment & Verifying) */}
          {qrData && (
            <div className="relative z-10 space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* QR Code Container */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-5 rounded-2xl bg-[#060b10] border border-cyan-500/30">
                  <div className="relative p-3 rounded-2xl bg-white shadow-[0_0_25px_rgba(0,240,255,0.35)]">
                    <QRCodeSVG
                      value={qrData.qrMessage || "fonepay-qr"}
                      size={210}
                      level="M"
                      marginSize={1}
                    />
                  </div>

                  <div className="w-full mt-4 text-center">
                    <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase font-orbitron">
                      SCAN WITH ANY BANKING APP / WALLET
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Fonepay • eSewa • Khalti • IME Pay • Mobile Banking
                    </p>
                  </div>
                </div>

                {/* Payment Details & Live Verification Status */}
                <div className="md:col-span-7 space-y-4">
                  {/* Settlement Merchant Details */}
                  <div className="p-4 rounded-2xl bg-[#070f17] border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Merchant:</span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-cyan-400" />
                        {qrData.terminalName || "ffglorynepal"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Fonepay PAN:</span>
                      <span className="font-mono text-slate-200">{qrData.fonepayPanNumber || "Registered Merchant"}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Location:</span>
                      <span className="text-slate-300">{qrData.location || "Nepal"}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                      <span className="text-slate-400">Total Amount:</span>
                      <span className="text-base font-black text-amber-400 font-mono">
                        RS {totalPayableRs.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Payment Remark Box with 1-click copy & manual edit support */}
                  <div className="p-4 rounded-2xl bg-[#091522] border border-cyan-500/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-cyan-400 font-orbitron tracking-wider">
                        TRANSACTION REMARK
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Auto-Matched (PRN Format)
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-[#04080c] border border-cyan-500/30 rounded-xl p-2 gap-2">
                      <input
                        type="text"
                        value={activeRemark}
                        onChange={(e) => setActiveRemark(e.target.value.toUpperCase().trim())}
                        title="Remark used to read and verify your payment"
                        placeholder="e.g. PRN-123456780867-563"
                        className="font-mono text-sm font-black text-amber-300 tracking-wider bg-transparent border-none focus:outline-none w-full px-1 uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(activeRemark, "remark")}
                        className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-400/40 text-cyan-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {copied === "remark" ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-snug">
                      Your mobile banking or wallet app (eSewa, Khalti, Mobile Banking) includes remark <strong className="text-amber-300 font-mono">{activeRemark}</strong>. After completing the payment in your app, click "Verify Payment" below to verify and credit your account.
                    </p>
                  </div>

                  {/* Alert Banner for Manual Verification (Payment Not Received) */}
                  {manualVerifyAlert && (
                    <div
                      className={`p-4 rounded-2xl border flex items-start gap-3 text-xs animate-in fade-in zoom-in-95 duration-200 ${
                        manualVerifyAlert.type === "error"
                          ? "bg-rose-950/70 border-rose-500/50 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
                          : "bg-cyan-950/70 border-cyan-500/50 text-cyan-200"
                      }`}
                    >
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-400" />
                      <div className="space-y-1">
                        <div className="font-black text-rose-300 uppercase tracking-wide font-orbitron text-xs">
                          {manualVerifyAlert.title}
                        </div>
                        <div className="text-xs leading-relaxed text-slate-200">
                          {manualVerifyAlert.message}
                        </div>
                        <div className="text-[10px] text-amber-300/90 font-mono pt-1">
                          Note: No transaction was saved as pending. Please complete the QR payment first, then verify again.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Live Status Radar & Manual Verify Button */}
                  <div className="p-4 rounded-2xl bg-[#06121b] border border-emerald-500/30 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </div>
                      <span className="text-xs text-emerald-300 font-medium font-mono">
                        {verifyStatusText || "Awaiting payment settlement from Fonepay network..."}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={verifying}
                        onClick={() =>
                          checkVerification(
                            activeRemark,
                            qrData.billId || activeRemark,
                            activeCredits,
                            totalPayableRs,
                            true // isManualClick = true
                          )
                        }
                        className="w-full sm:flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer font-orbitron shadow-[0_0_20px_rgba(0,229,153,0.35)] disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${verifying ? "animate-spin" : ""}`} />
                        <span>{verifying ? "Checking Fonepay API..." : "Verify Payment"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCancelQr}
                        className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancel / Change Pack
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User's Recent Deposit History */}
      {myRequests.length > 0 && (
        <div className="rounded-3xl border border-cyan-500/20 bg-[#08121a]/95 backdrop-blur-xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-orbitron flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              Recent Verified Deposits
            </h3>
            <span className="text-[11px] text-slate-400">{myRequests.length} Verified</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2 px-2">Gateway</th>
                  <th className="py-2 px-2">Ref / Bill ID</th>
                  <th className="py-2 px-2">Amount</th>
                  <th className="py-2 px-2">Credits</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {myRequests.slice(0, 5).map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/20">
                    <td className="py-2.5 px-2 uppercase font-bold text-[10px] text-cyan-400">
                      {req.paymentMethod || "Fonepay"}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-white text-[11px]">
                      {req.transactionId}
                    </td>
                    <td className="py-2.5 px-2 font-semibold text-slate-200">
                      RS {req.amountRs.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-emerald-400">
                      +{req.credits} Credits
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-slate-400 text-[10px]">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
