import express from "express";

const app = express();

app.use(express.json());

// ==========================================
// Upstream Configuration (Server-Side Secrets)
// ==========================================
// FFGlory Bot Provider
const FFGLORY_API_BASE =
  process.env.FFGLORY_API_BASE ||
  process.env.RESELLER_API_BASE ||
  "https://teakrcltgjnzxuvuvzci.supabase.co/functions/v1/bot-api";

const FFGLORY_API_KEY =
  process.env.FFGLORY_API_KEY ||
  process.env.RESELLER_API_KEY ||
  "ffg_live_3ed33a6031058ce4d77adeab2879bc921c7a9977a57b42a0";

// Merchant Payment Gateway (Fonepay / LGPay)
const MERCHANT_API_BASE =
  process.env.MERCHANT_API_BASE ||
  process.env.FONEPAY_API_BASE ||
  "https://lgpay-setup-api.vercel.app";

const MERCHANT_API_KEY = process.env.MERCHANT_API_KEY || "";
const MERCHANT_SECRET = process.env.MERCHANT_SECRET || "";

/**
 * Strips any sensitive credentials, authorization tokens, or internal keys
 * from upstream response objects before sending them down to the client.
 */
function sanitizeUpstreamData(data: any): any {
  if (!data || typeof data !== "object") return data;
  const clone = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveTokens = [
    "x-api-key",
    "api_key",
    "apikey",
    "secret",
    "token",
    "auth",
    "authorization",
    "password",
    "private",
  ];

  for (const key of Object.keys(clone)) {
    if (sensitiveTokens.some((token) => key.toLowerCase().includes(token))) {
      delete clone[key];
    } else if (typeof clone[key] === "object" && clone[key] !== null) {
      clone[key] = sanitizeUpstreamData(clone[key]);
    }
  }
  return clone;
}

const VALID_PROVIDER_SERVERS = ["IND", "BD", "PK", "US", "EU", "RU", "SA"];

function normalizeServerCode(code?: string): string {
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

// ==========================================
// 1. FFGlory Backend Routes (Secured)
// ==========================================

// FFGlory: Check Balance (Internal Server Proxy)
const handleFFGloryBalance = async (req: express.Request, res: express.Response) => {
  try {
    const response = await fetch(`${FFGLORY_API_BASE}/balance`, {
      method: "GET",
      headers: {
        "x-api-key": FFGLORY_API_KEY,
        "Accept": "application/json",
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error || data?.message || `FFGlory provider returned status ${response.status}`,
        details: sanitizeUpstreamData(data),
      });
    }

    return res.json(sanitizeUpstreamData(data));
  } catch (error: any) {
    console.error("Error fetching FFGlory provider balance:", error);
    return res.status(502).json({
      error: error.message || "Failed to communicate with FFGlory provider API",
    });
  }
};

app.get("/api/ffglory/balance", handleFFGloryBalance);
app.get("/api/balance", handleFFGloryBalance); // Backwards compatibility alias

// FFGlory: Launch Bot (Internal Server Proxy)
const handleFFGloryLaunch = async (req: express.Request, res: express.Response) => {
  try {
    const { server, region, guild_server, guild_id } = req.body;

    if (!guild_id || typeof guild_id !== "string" || !guild_id.trim()) {
      return res.status(400).json({ error: "Valid Guild ID is required" });
    }

    const requestedServer = server || region || guild_server || "IND";
    const targetServer = normalizeServerCode(requestedServer);
    console.log(`[FFGLORY BOT LAUNCH] Guild ID: ${guild_id}, Server: "${targetServer}"`);

    const payload = {
      server: targetServer,
      guild_id: String(guild_id).trim(),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    const response = await fetch(`${FFGLORY_API_BASE}/launch`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": FFGLORY_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.warn(`[FFGLORY LAUNCH FAILED] Provider returned ${response.status}:`, data);
      let errorMsg = data?.error || data?.message || `FFGlory launch failed with status ${response.status}`;
      if (response.status === 409 || String(errorMsg).includes("already in progress")) {
        errorMsg = "A bot match is currently in progress for this cluster. Please wait 60 seconds for the active match to complete and retry. Your credits were NOT deducted.";
      } else if (response.status === 423 || String(errorMsg).includes("maintenance") || String(errorMsg).includes("LOCKED")) {
        errorMsg = `${targetServer} server region is temporarily locked or undergoing maintenance. Please select IND or another regional cluster. Your credits were NOT deducted.`;
      }
      return res.status(response.status).json({
        error: errorMsg,
        details: sanitizeUpstreamData(data),
        selectedServer: targetServer,
      });
    }

    console.log(`[FFGLORY LAUNCH SUCCESS] Dispatched to ${targetServer} for guild ${guild_id}`);
    const sanitized = sanitizeUpstreamData(data) || {};
    return res.json({
      ...sanitized,
      selectedServer: targetServer,
      server: sanitized?.server || targetServer,
    });
  } catch (error: any) {
    console.error("Error launching FFGlory bot:", error);
    const isTimeout = error.name === "AbortError" || error.message?.includes("aborted");
    return res.status(502).json({
      error: isTimeout
        ? "FFGlory provider connection timed out after 50 seconds. The server might be experiencing high load. Please check if bot entered or retry in 1 minute."
        : error.message || "Failed to trigger bot launch via provider",
    });
  }
};

app.post("/api/ffglory/launch", handleFFGloryLaunch);
app.post("/api/launch", handleFFGloryLaunch); // Backwards compatibility alias

// FFGlory: Service Status Check
app.get("/api/ffglory/status", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const checkRes = await fetch(`${FFGLORY_API_BASE}/balance`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "x-api-key": FFGLORY_API_KEY,
        "Accept": "application/json",
      },
    });
    clearTimeout(timeoutId);
    return res.json({
      status: checkRes.ok ? "connected" : "degraded",
      statusCode: checkRes.status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(503).json({
      status: "unreachable",
      error: err.message || "Cannot reach FFGlory service",
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// 2. Merchant Payment Backend Routes (Secured)
// ==========================================

// Merchant: Generate Dynamic Payment QR (Internal Server Proxy)
const handleMerchantCreateQr = async (req: express.Request, res: express.Response) => {
  try {
    const rawAmount = req.query.amount;
    const rawRemark = req.query.remark;

    if (!rawAmount || !rawRemark) {
      return res.status(400).json({ error: "Amount and remark query parameters are required" });
    }

    const numAmount = Number(rawAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount specified" });
    }

    const cleanAmount = numAmount.toFixed(2);
    const cleanRemark = String(rawRemark).trim().toUpperCase();

    const targetUrl = `${MERCHANT_API_BASE}/create-qr?amount=${encodeURIComponent(cleanAmount)}&remark=${encodeURIComponent(cleanRemark)}`;
    
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    if (MERCHANT_API_KEY) {
      headers["x-api-key"] = MERCHANT_API_KEY;
    }
    if (MERCHANT_SECRET) {
      headers["x-merchant-secret"] = MERCHANT_SECRET;
    }

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || `Failed to create Merchant QR (status ${response.status})`,
        details: sanitizeUpstreamData(data),
      });
    }

    return res.json(sanitizeUpstreamData(data));
  } catch (error: any) {
    console.error("Error creating Merchant payment QR:", error);
    return res.status(502).json({
      error: error.message || "Failed to communicate with Merchant QR generator",
    });
  }
};

app.get("/api/merchant/create-qr", handleMerchantCreateQr);
app.get("/api/payment/create-qr", handleMerchantCreateQr); // Backwards compatibility alias

// Merchant: Verify Payment (Internal Server Proxy)
const handleMerchantVerify = async (req: express.Request, res: express.Response) => {
  try {
    const rawRemark = req.query.remark;

    if (!rawRemark) {
      return res.status(400).json({ error: "Remark is required for payment verification" });
    }

    const cleanRemark = String(rawRemark).trim();
    const targetUrl = `${MERCHANT_API_BASE}/verify?remark=${encodeURIComponent(cleanRemark)}`;
    
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    if (MERCHANT_API_KEY) {
      headers["x-api-key"] = MERCHANT_API_KEY;
    }
    if (MERCHANT_SECRET) {
      headers["x-merchant-secret"] = MERCHANT_SECRET;
    }

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    let data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || `Failed to verify merchant payment (status ${response.status})`,
        details: sanitizeUpstreamData(data),
      });
    }

    // If not verified, try alternate casing in case banking switch transformed the case
    if (data && !data.verified) {
      const altRemark =
        cleanRemark === cleanRemark.toLowerCase()
          ? cleanRemark.toUpperCase()
          : cleanRemark.toLowerCase();
      try {
        const altUrl = `${MERCHANT_API_BASE}/verify?remark=${encodeURIComponent(altRemark)}`;
        const altRes = await fetch(altUrl, {
          method: "GET",
          headers,
        });
        const altData = await altRes.json().catch(() => null);
        if (altData && altData.verified) {
          data = altData;
        }
      } catch {
        // ignore fallback error
      }
    }

    return res.json(sanitizeUpstreamData(data));
  } catch (error: any) {
    console.error("Error verifying Merchant payment:", error);
    return res.status(502).json({
      error: error.message || "Failed to communicate with Merchant verification service",
    });
  }
};

app.get("/api/merchant/verify", handleMerchantVerify);
app.get("/api/payment/verify", handleMerchantVerify); // Backwards compatibility alias

// Merchant: Service Status Check
app.get("/api/merchant/status", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    // Ping create-qr with dummy check
    const checkRes = await fetch(`${MERCHANT_API_BASE}/verify?remark=PING_HEALTH_CHECK`, {
      method: "GET",
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeoutId);
    return res.json({
      status: checkRes.status < 500 ? "connected" : "degraded",
      statusCode: checkRes.status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(503).json({
      status: "unreachable",
      error: err.message || "Cannot reach Merchant payment service",
      timestamp: new Date().toISOString(),
    });
  }
});

// System Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    services: {
      ffglory: "routed",
      merchant: "routed",
    },
    timestamp: new Date().toISOString(),
  });
});

export default app;
