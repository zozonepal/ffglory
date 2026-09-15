import { ProviderBalanceResponse, FonepayCreateQrResponse, FonepayVerifyResponse } from "../types";

export const CREDIT_RATE_RS = 235; // 1 Credit = RS 235 (Nepali Rupees)
export const CREDIT_RATE_INR = CREDIT_RATE_RS; // Backwards compatibility alias

/**
 * Fetch provider balance via internal server proxy
 * Keeps external provider URL and API keys completely hidden from client inspect
 */
export async function fetchProviderBalance(): Promise<ProviderBalanceResponse> {
  const res = await fetch("/api/balance", {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Balance request failed with status ${res.status}`);
  }

  return data;
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

  const res = await fetch("/api/launch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Launch failed with status ${res.status}`);
  }

  return {
    ...(data || {}),
    selectedServer: targetServer,
    server: data?.server || targetServer,
  };
}

/**
 * Generate Fonepay QR Code via internal server proxy
 * External payment provider URL is never exposed in browser Network/Sources inspect
 */
export async function createFonepayQr(amount: number, remark: string): Promise<FonepayCreateQrResponse> {
  const cleanAmount = Number(amount).toFixed(2);
  const cleanRemark = String(remark).trim().toUpperCase();

  const res = await fetch(`/api/payment/create-qr?amount=${encodeURIComponent(cleanAmount)}&remark=${encodeURIComponent(cleanRemark)}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.success) {
    throw new Error(data?.error || data?.message || `Fonepay QR generation failed with status ${res.status}`);
  }

  return data;
}

/**
 * Verify Fonepay payment via internal server proxy
 * Verifies transaction remark on server side without exposing payment gateway directly
 */
export async function verifyFonepayPayment(remark: string): Promise<FonepayVerifyResponse> {
  const cleanRemark = String(remark).trim().toUpperCase();

  const res = await fetch(`/api/payment/verify?remark=${encodeURIComponent(cleanRemark)}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.error || data?.message || `Payment verification failed with status ${res.status}`);
  }

  return data;
}


