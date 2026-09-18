import React, { useState } from "react";
import {
  User,
  Mail,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Coins,
  Calendar,
  Send,
  Sparkles,
} from "lucide-react";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { CREDIT_RATE_RS } from "../services/api";

export const SettingsView: React.FC = () => {
  const { currentUser, userProfile, isAdmin } = useAuth();

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status State
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Email Reset State
  const [resetEmailSending, setResetEmailSending] = useState(false);
  const [resetEmailSuccess, setResetEmailSuccess] = useState(false);

  // Handle direct password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.email) {
      setErrorMsg("You must be logged in to change your password.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New passwords do not match. Please re-type carefully.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Re-authenticate user if current password is provided
      if (currentPassword.trim()) {
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          currentPassword.trim()
        );
        await reauthenticateWithCredential(currentUser, credential);
      }

      // 2. Update password
      await updatePassword(currentUser, newPassword);

      setSuccessMsg("Password successfully updated! Your account is now secured with the new password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.warn("Password update error:", err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErrorMsg("Incorrect current password. Please verify and try again.");
      } else if (err.code === "auth/requires-recent-login") {
        setErrorMsg(
          "For security reasons, please enter your current password to confirm your identity before updating."
        );
      } else if (err.code === "auth/weak-password") {
        setErrorMsg("Password is too weak. Please use a stronger combination of letters and numbers.");
      } else {
        setErrorMsg(err.message || "Failed to update password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle 1-click password reset email to Gmail
  const handleSendResetEmail = async () => {
    if (!currentUser || !currentUser.email) return;

    setResetEmailSending(true);
    setErrorMsg(null);
    try {
      await sendPasswordResetEmail(auth, currentUser.email);
      setResetEmailSuccess(true);
      setSuccessMsg(`A password reset link has been dispatched to ${currentUser.email}. Check your Gmail inbox or spam folder.`);
      setTimeout(() => setResetEmailSuccess(false), 8000);
    } catch (err: any) {
      console.warn("Reset email error:", err);
      setErrorMsg("Failed to send reset email: " + (err.message || "Unknown error"));
    } finally {
      setResetEmailSending(false);
    }
  };

  const userCredits = userProfile?.credits ?? 0;
  const userRole = isAdmin ? "Administrator" : "Standard User";
  const memberDate = userProfile?.createdAt
    ? new Date(userProfile.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Active Member";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-['Outfit']">
          Account Settings
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage your verified Gmail credentials, account profile, and security preferences.
        </p>
      </div>

      {/* Top Profile Summary Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 via-amber-400/20 to-amber-300/10 border border-amber-400/30 text-amber-300 shadow-inner">
              <User className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                  {currentUser?.displayName || currentUser?.email?.split("@")[0] || "User"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-mono font-medium text-amber-300">
                  {currentUser?.email || "No email linked"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            <div className="text-left sm:text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Available Credits</span>
              <span className="text-sm font-extrabold text-emerald-400">
                {userCredits} Credits <span className="text-[11px] text-slate-400 font-normal">(RS {(userCredits * CREDIT_RATE_RS).toLocaleString()})</span>
              </span>
            </div>
          </div>
        </div>

        {/* Profile Attributes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div className="rounded-xl bg-[#0b0d11] p-3 border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Account Role</span>
            <span className="text-xs font-bold text-slate-200 mt-0.5 block">{userRole}</span>
          </div>
          <div className="rounded-xl bg-[#0b0d11] p-3 border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Member Since</span>
            <span className="text-xs font-bold text-slate-200 mt-0.5 block">{memberDate}</span>
          </div>
          <div className="rounded-xl bg-[#0b0d11] p-3 border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Account UID</span>
            <span className="text-[11px] font-mono font-medium text-slate-400 truncate mt-0.5 block" title={currentUser?.uid}>
              {currentUser?.uid || "UID unavailable"}
            </span>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12141a] p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/[0.06]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-['Outfit']">
              Change Account Password
            </h3>
            <p className="text-xs text-slate-400">
              Update your login password or send an official reset email directly to your Gmail.
            </p>
          </div>
        </div>

        {/* Feedback banners */}
        {successMsg && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 p-3.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password (if required)"
                className="w-full rounded-xl bg-[#0b0d11] text-white placeholder:text-slate-500 border border-slate-700/80 hover:border-slate-600 focus:border-amber-400 px-4 py-3 text-sm focus:outline-none transition-colors pr-11"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Required by security protocols to verify your identity before applying changes.
            </p>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter minimum 6 character password"
                className="w-full rounded-xl bg-[#0b0d11] text-white placeholder:text-slate-500 border border-slate-700/80 hover:border-slate-600 focus:border-amber-400 px-4 py-3 text-sm focus:outline-none transition-colors pr-11"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type new password"
              className="w-full rounded-xl bg-[#0b0d11] text-white placeholder:text-slate-500 border border-slate-700/80 hover:border-slate-600 focus:border-amber-400 px-4 py-3 text-sm focus:outline-none transition-colors"
            />
          </div>

          {/* Buttons Row */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs transition-all shadow-md shadow-amber-400/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Saving Password...</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Update Password</span>
                </>
              )}
            </button>

            {/* Quick Gmail Reset Link Button */}
            <button
              type="button"
              onClick={handleSendResetEmail}
              disabled={resetEmailSending}
              className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {resetEmailSending ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                  <span>Sending to Gmail...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 text-amber-400" />
                  <span>Send Reset Link to Gmail</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
