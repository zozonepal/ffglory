import React, { useState, useEffect } from "react";
import {
  Coins,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Search,
  ReceiptText,
  Filter,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PaymentRequest } from "../types";
import { resilientOnValue } from "../services/resilientDb";
import { CREDIT_RATE_RS } from "../services/api";

interface TransactionsViewProps {
  onOpenDeposit: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ onOpenDeposit }) => {
  const { currentUser } = useAuth();
  const [deposits, setDeposits] = useState<PaymentRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!currentUser) return;

    // Listen to user's payment / deposit requests
    const unsubReq = resilientOnValue("payment_requests", (val) => {
      if (val && typeof val === "object") {
        const list: PaymentRequest[] = Object.keys(val)
          .map((k) => ({ id: k, ...val[k] }))
          .filter((r) => r.userId === currentUser.uid);
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setDeposits(list);
      } else {
        setDeposits([]);
      }
    });

    return () => {
      unsubReq();
    };
  }, [currentUser]);

  // Filtered deposits
  const filteredDeposits = deposits.filter((d) => {
    const matchesSearch =
      (d.transactionId || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.paymentMethod || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const approvedDeposits = deposits.filter((d) => d.status === "approved");
  const totalApprovedCredits = approvedDeposits.reduce((acc, curr) => acc + (curr.credits || 0), 0);
  const totalLoadedCredits = totalApprovedCredits;
  const totalRsDeposited = approvedDeposits.reduce((acc, curr) => acc + (curr.amountRs || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-['Outfit'] flex items-center gap-2.5">
            <ReceiptText className="h-6 w-6 text-amber-400" />
            Deposit & Credit Transactions
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Official record of verified credits loaded via Fonepay, eSewa, and Khalti QR.
          </p>
        </div>

        {/* Load Credits Button */}
        <button
          onClick={onOpenDeposit}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-400/20 self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Load Credits (eSewa / Khalti)</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-4 shadow-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Credits Loaded</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 flex items-baseline gap-1.5">
            <span>+{totalLoadedCredits}</span>
            <span className="text-xs font-semibold text-slate-400">Credits</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Approved top-ups
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-4 shadow-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Amount Deposited</span>
          <div className="text-2xl font-black text-white mt-1 flex items-baseline gap-1.5">
            <span>RS {totalRsDeposited.toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Exchange rate: 1 Credit = RS {CREDIT_RATE_RS}
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-4 shadow-xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Verified Deposits</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 flex items-baseline gap-1.5">
            <span>{deposits.filter((d) => d.status === "approved").length}</span>
            <span className="text-xs font-semibold text-slate-400">Completed</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Automated settlement via Fonepay
          </span>
        </div>
      </div>

      {/* Main Transactions Table Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-5 sm:p-6 shadow-xl">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference or transaction ID..."
              className="w-full rounded-xl bg-[#0b0d11] border border-slate-800 pl-8 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <div className="flex rounded-xl bg-[#0b0d11] border border-slate-800 p-0.5 text-xs">
              {(["all", "approved", "pending", "rejected"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-bold capitalize transition-colors ${
                    statusFilter === st
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        {filteredDeposits.length === 0 ? (
          <div className="py-14 text-center text-slate-500 text-xs">
            <ReceiptText className="h-8 w-8 mx-auto text-slate-600 mb-2 opacity-50" />
            No deposit transactions found {statusFilter !== "all" ? `with status "${statusFilter}"` : ""}.
            <div className="mt-3">
              <button
                onClick={onOpenDeposit}
                className="text-amber-400 hover:underline font-bold"
              >
                Click here to submit your first deposit request
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-3">Gateway / Method</th>
                  <th className="py-3 px-3">Ref / Transaction ID</th>
                  <th className="py-3 px-3">Amount (RS)</th>
                  <th className="py-3 px-3">Credits Loaded</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredDeposits.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[11px] uppercase bg-slate-800 text-slate-200 border border-slate-700/60">
                        {d.paymentMethod === "esewa" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        )}
                        {d.paymentMethod === "khalti" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                        )}
                        {d.paymentMethod || "Nepali QR / eSewa"}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-white">
                      {d.transactionId}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-200">
                      RS {d.amountRs.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-extrabold text-emerald-400">
                      +{d.credits} Credits
                    </td>
                    <td className="py-3 px-3">
                      {d.status === "approved" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="h-3 w-3" /> Approved
                        </span>
                      )}
                      {d.status === "rejected" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/30 text-rose-400 font-semibold text-[11px]">
                          <XCircle className="h-3 w-3" /> Rejected
                        </span>
                      )}
                      {d.status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300 font-semibold text-[11px]">
                          <Clock className="h-3 w-3 animate-spin" /> Under Review
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
