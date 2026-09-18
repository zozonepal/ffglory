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
 * Fetch FFGlory provider balance via internal server proxy
 * Keeps external provider URL and API keys completely hidden from client DevTools
 */
export async function fetchProviderBalance(): Promise<ProviderBalanceResponse> {
  try {
    // Primary secured backend route with fallback
    let res = await fetch("/api/ffglory/balance", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      res = await fetch("/api/balance", {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    }

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
    const msg = extractErrorMessage(err, "Failed to connect to FFGlory provider service.");
    throw new Error(msg);
  }
}

const VALID_PROVIDER_SERVERS = ["IND", "BD", "PK", "US", "EU", "RU", "SA"];

export function normalizeServerCode(code?: string): string {
  if (!code) return "IND";
  const clean = String(code).trim().toUpperCase();
  if (clean === "IN" || clean === "IND" || clean === "INDIA" || clean === "NP" || clean === "NEPAL") return "IND";
  if (clean === "BD" || clean === "BANGLADESH") return "BD";
  if (clean === "PK" || clean === "PAKISTAN") return "PK";
  if (clean === "US" || clean === "USA" || clean === "NA" || clean === "AMERICA") return "US";
  if (clean === "EU" || clean === "EUROPE") return "EU";
  if (clean === "RU" || clean === "RUSSIA") return "RU";
  if (clean === "SA" || clean === "SAC" || clean === "BR" || clean === "BRAZIL") return "SA";
  if (clean === "ID" || clean === "SG" || clean === "TH" || clean === "VN" || clean === "ME") return "IND";
  return VALID_PROVIDER_SERVERS.includes(clean) ? clean : "IND";
}

/**
 * Trigger bot action via internal FFGlory server proxy
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
    let res = await fetch("/api/ffglory/launch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 404) {
      res = await fetch("/api/launch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
    }

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
 * Generate Merchant (Fonepay) QR Code strictly via internal server proxy
 */
export async function createFonepayQr(amount: number, remark: string): Promise<FonepayCreateQrResponse> {
  const cleanAmount = Number(amount).toFixed(2);
  const cleanRemark = String(remark).trim().toUpperCase();

  try {
    let res = await fetch(
      `/api/merchant/create-qr?amount=${encodeURIComponent(cleanAmount)}&remark=${encodeURIComponent(cleanRemark)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      }
    );

    if (res.status === 404) {
      res = await fetch(
        `/api/payment/create-qr?amount=${encodeURIComponent(cleanAmount)}&remark=${encodeURIComponent(cleanRemark)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );
    }

    const data = await res.json().catch(() => null);
    if (res.ok && data && data.success) {
      return data;
    }

    const errorMsg = extractErrorMessage(
      data?.error || data?.message || data,
      `Failed to generate Merchant QR (Status ${res.status}). Please try again.`
    );
    throw new Error(errorMsg);
  } catch (err: any) {
    const msg = extractErrorMessage(
      err,
      "Failed to connect to Merchant QR generator. Please check your network or try again."
    );
    throw new Error(msg);
  }
}

/**
 * Verify Merchant (Fonepay) payment strictly via internal server proxy
 */
export async function verifyFonepayPayment(remark: string): Promise<FonepayVerifyResponse> {
  const cleanRemark = String(remark).trim().toUpperCase();

  try {
    let res = await fetch(`/api/merchant/verify?remark=${encodeURIComponent(cleanRemark)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      res = await fetch(`/api/payment/verify?remark=${encodeURIComponent(cleanRemark)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    }

    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      return data;
    }

    const errorMsg = extractErrorMessage(
      data?.error || data?.message || data,
      `Failed to verify payment (Status ${res.status}).`
    );
    throw new Error(errorMsg);
  } catch (err: any) {
    const msg = extractErrorMessage(err, "Unable to reach Merchant verification server. Please try again.");
    throw new Error(msg);
  }
}

/**
 * Check connectivity to FFGlory backend service
 */
export async function checkFFGloryStatus(): Promise<{ status: string; statusCode?: number }> {
  try {
    const res = await fetch("/api/ffglory/status");
    const data = await res.json().catch(() => null);
    return data || { status: res.ok ? "connected" : "unknown" };
  } catch {
    return { status: "offline" };
  }
}

/**
 * Check connectivity to Merchant payment backend service
 */
export async function checkMerchantStatus(): Promise<{ status: string; statusCode?: number }> {
  try {
    const res = await fetch("/api/merchant/status");
    const data = await res.json().catch(() => null);
    return data || { status: res.ok ? "connected" : "unknown" };
  } catch {
    return { status: "offline" };
  }
}


