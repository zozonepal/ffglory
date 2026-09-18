import { ProviderBalanceResponse, FonepayCreateQrResponse, FonepayVerifyResponse } from "../types";

export const CREDIT_RATE_RS = 235; // 1 Credit = RS 235 (Nepali Rupees)
export const CREDIT_RATE_INR = CREDIT_RATE_RS; // Backwards compatibility alias

/**
 * Robustly extracts a clean string error message from any error or response object.
 * Completely prevents '[object Object]' from ever appearing in the UI.
 */
export function extractErrorMessage(err: any, fallback: string = "An unexpected error occurred"): string {
  if (!err) return fallback;

  if (typeof err === "string") {
    const trimmed = err.trim();
    if (trimmed && trimmed !== "[object Object]") {
      return trimmed;
    }
    return fallback;
  }

  if (typeof err === "object") {
    // 1. Check if err.message is a string
    if (typeof err.message === "string") {
      const msg = err.message.trim();
      if (msg && msg !== "[object Object]") {
        return msg;
      }
    }

    // 2. Check if err.error is a string or object
    if (typeof err.error === "string") {
      const errStr = err.error.trim();
      if (errStr && errStr !== "[object Object]") {
        return errStr;
      }
    } else if (typeof err.error === "object" && err.error !== null) {
      const nested = extractErrorMessage(err.error, "");
      if (nested && nested !== fallback) return nested;
    }

    // 3. Check if err.details is a string or object
    if (typeof err.details === "string") {
      const detStr = err.details.trim();
      if (detStr && detStr !== "[object Object]") {
        return detStr;
      }
    } else if (typeof err.details === "object" && err.details !== null) {
      const nested = extractErrorMessage(err.details, "");
      if (nested && nested !== fallback) return nested;
    }

    // 4. Try JSON stringifying non-empty objects
    try {
      const str = JSON.stringify(err);
      if (str && str !== "{}" && str !== "[]" && str !== `{"message":"[object Object]"}`) {
        return str;
      }
    } catch {
      // ignore stringify errors
    }
  }

  const strVal = String(err);
  if (strVal && strVal !== "[object Object]") {
    return strVal;
  }

  return fallback;
}

/**
 * Fetch provider balance via internal server proxy
 * Keeps external provider URL and API keys completely hidden from client inspect
 */
export async function fetchProviderBalance(): Promise<ProviderBalanceResponse> {
  try {
    const res = await fetch("/api/balance", {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      const errorMsg = extractErrorMessage(
        data?.error || data?.message || data,
        `Balance request failed with status ${res.status}`
      );
      throw new Error(errorMsg);
    }

    return data;
  } catch (err: any) {
    const msg = extractErrorMessage(err, "Failed to connect to provider balance service.");
    throw new Error(msg);
  }
}

export function normalizeServerCode(code?: string): string {
  if (!code) return "IND";
  const clean = String(code).trim().toUpperCase();
  if (clean === "IN" || clean === "IND" || clean === "INDIA") return "IND";
  if (clean === "INDO" || clean === "ID" || clean === "INDONESIA") return "ID";
  if (clean === "BD" || clean === "BANGLADESH") return "BD";
  if (clean === "PK" || clean === "PAKISTAN") return "PK";
  return clean;
}

/**
 * Trigger bot action via internal server proxy
 * Prevents provider credentials and endpoint URLs from leaking in browser DevTools
 */
export async function launchBotAction(guildId: string, server: string = "IND"): Promise<any> {
  const targetServer = normalizeServerCode(server);
  const payload = {
    server: targetServer,
    region: targetServer,
    guild_id: guildId.trim(),
  };

  try {
    const res = await fetch("/api/launch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      const errorMsg = extractErrorMessage(
        data?.error || data?.message || data,
        `Launch failed with status ${res.status}`
      );
      throw new Error(errorMsg);
    }

    return {
      ...(data || {}),
      selectedServer: targetServer,
      server: data?.server || targetServer,
    };
  } catch (err: any) {
    const msg = extractErrorMessage(err, "Failed to launch bot match via server.");
    throw new Error(msg);
  }
}

/**
 * Generate Fonepay QR Code via internal server proxy with direct fallback support
 */
export async function createFonepayQr(amount: number, remark: string): Promise<FonepayCreateQrResponse> {
  const cleanAmount = Number(amount).toFixed(2);
  const cleanRemark = String(remark).trim().toUpperCase();

  // 1. Try server proxy endpoint first
  try {
    const res = await fetch(`/api/payment/create-qr?amount=${encodeURIComponent(cleanAmount)}&remark=${encodeURIComponent(cleanRemark)}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data && data.success) {
      return data;
    }
    console.warn("Server proxy QR creation returned non-success, attempting direct fallback...", data);
  } catch (proxyErr) {
    console.warn("Server proxy QR creation request failed, attempting direct fallback...", proxyErr);
  }

  // 2. Direct fallback to Fonepay Setup API
  try {
    const directUrl = `https://lgpay-setup-api.vercel.app/create-qr?amount=${encodeURIComponent(cleanAmount)}&remark=${encodeURIComponent(cleanRemark)}`;
    const directRes = await fetch(directUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const directData = await directRes.json().catch(() => null);
    if (directRes.ok && directData && directData.success) {
      return directData;
    }

    const errorMsg = extractErrorMessage(
      directData?.error || directData?.message || directData,
      `Failed to generate Fonepay QR (Status ${directRes.status}). Please try again.`
    );
    throw new Error(errorMsg);
  } catch (directErr: any) {
    const msg = extractErrorMessage(directErr, "Failed to connect to Fonepay QR generator. Please check your network or try again.");
    throw new Error(msg);
  }
}

/**
 * Verify Fonepay payment via internal server proxy with direct fallback support
 */
export async function verifyFonepayPayment(remark: string): Promise<FonepayVerifyResponse> {
  const cleanRemark = String(remark).trim().toUpperCase();

  // 1. Try server proxy endpoint first
  try {
    const res = await fetch(`/api/payment/verify?remark=${encodeURIComponent(cleanRemark)}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      return data;
    }
    console.warn("Server proxy verification returned non-ok, attempting direct fallback...", data);
  } catch (proxyErr) {
    console.warn("Server proxy verification request failed, attempting direct fallback...", proxyErr);
  }

  // 2. Direct fallback to Fonepay Setup API
  try {
    const directUrl = `https://lgpay-setup-api.vercel.app/verify?remark=${encodeURIComponent(cleanRemark)}`;
    const directRes = await fetch(directUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    let directData = await directRes.json().catch(() => null);
    if (directRes.ok && directData) {
      // If not verified, try alternate case (lowercase/uppercase)
      if (!directData.verified) {
        const altRemark =
          cleanRemark === cleanRemark.toLowerCase()
            ? cleanRemark.toUpperCase()
            : cleanRemark.toLowerCase();
        try {
          const altUrl = `https://lgpay-setup-api.vercel.app/verify?remark=${encodeURIComponent(altRemark)}`;
          const altRes = await fetch(altUrl, {
            method: "GET",
            headers: { "Accept": "application/json" },
          });
          const altData = await altRes.json().catch(() => null);
          if (altData && altData.verified) {
            directData = altData;
          }
        } catch {
          // ignore
        }
      }
      return directData;
    }

    const errorMsg = extractErrorMessage(
      directData?.error || directData?.message || directData,
      `Failed to verify payment (Status ${directRes.status}).`
    );
    throw new Error(errorMsg);
  } catch (directErr: any) {
    const msg = extractErrorMessage(directErr, "Unable to reach Fonepay verification server. Please try again.");
    throw new Error(msg);
  }
}


