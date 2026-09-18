import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

const RESELLER_API_BASE = process.env.RESELLER_API_BASE || "https://teakrcltgjnzxuvuvzci.supabase.co/functions/v1/bot-api";
const RESELLER_API_KEY = process.env.RESELLER_API_KEY || "ffg_live_3ed33a6031058ce4d77adeab2879bc921c7a9977a57b42a0";

// API routes FIRST
app.get("/api/balance", async (req, res) => {
  try {
    const response = await fetch(`${RESELLER_API_BASE}/balance`, {
      method: "GET",
      headers: {
        "x-api-key": RESELLER_API_KEY,
        "Accept": "application/json",
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error || data?.message || `Provider returned status ${response.status}`,
        details: data,
      });
    }

    return res.json(data);
  } catch (error: any) {
    console.error("Error fetching provider balance:", error);
    return res.status(502).json({
      error: error.message || "Failed to communicate with provider API",
    });
  }
});

function normalizeServerCode(code?: string): string {
  if (!code) return "IND";
  const clean = String(code).trim().toUpperCase();
  if (clean === "IN" || clean === "IND" || clean === "INDIA") return "IND";
  if (clean === "INDO" || clean === "ID" || clean === "INDONESIA") return "ID";
  if (clean === "BD" || clean === "BANGLADESH") return "BD";
  if (clean === "PK" || clean === "PAKISTAN") return "PK";
  return clean;
}

app.post("/api/launch", async (req, res) => {
  try {
    const { server, region, guild_server, guild_id } = req.body;

    if (!guild_id) {
      return res.status(400).json({ error: "Guild ID is required" });
    }

    const requestedServer = server || region || guild_server || "IND";
    const targetServer = normalizeServerCode(requestedServer);
    console.log(`[BOT LAUNCH] Guild ID: ${guild_id}, Target Guild Server: "${targetServer}" (received: "${requestedServer}")`);

    const payload = {
      server: targetServer,
      region: targetServer,
      guild_id: String(guild_id).trim(),
    };

    const response = await fetch(`${RESELLER_API_BASE}/launch`, {
      method: "POST",
      headers: {
        "x-api-key": RESELLER_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.warn(`[BOT LAUNCH FAILED] Provider returned ${response.status}:`, data);
      return res.status(response.status).json({
        error: data?.error || data?.message || `Provider launch failed with status ${response.status}`,
        details: data,
        selectedServer: targetServer,
      });
    }

    console.log(`[BOT LAUNCH SUCCESS] Dispatched to ${targetServer} guild server for guild ${guild_id}`, data);
    return res.json({
      ...(data || {}),
      selectedServer: targetServer,
      server: data?.server || targetServer,
    });
  } catch (error: any) {
    console.error("Error launching bot:", error);
    return res.status(502).json({
      error: error.message || "Failed to trigger bot launch via provider",
    });
  }
});

// Fonepay Automated Payment Gateways
const FONEPAY_API_BASE = "https://lgpay-setup-api.vercel.app";

app.get("/api/payment/create-qr", async (req, res) => {
  try {
    const amount = req.query.amount;
    const remark = req.query.remark;

    if (!amount || !remark) {
      return res.status(400).json({ error: "Amount and remark are required" });
    }

    const targetUrl = `${FONEPAY_API_BASE}/create-qr?amount=${encodeURIComponent(String(amount))}&remark=${encodeURIComponent(String(remark))}`;
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || `Failed to create Fonepay QR (status ${response.status})`,
        details: data,
      });
    }

    return res.json(data);
  } catch (error: any) {
    console.error("Error creating Fonepay QR:", error);
    return res.status(502).json({
      error: error.message || "Failed to communicate with Fonepay QR generator",
    });
  }
});

app.get("/api/payment/verify", async (req, res) => {
  try {
    const remark = req.query.remark;

    if (!remark) {
      return res.status(400).json({ error: "Remark is required for verification" });
    }

    const cleanRemark = String(remark).trim();
    const targetUrl = `${FONEPAY_API_BASE}/verify?remark=${encodeURIComponent(cleanRemark)}`;
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    let data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.message || `Failed to verify payment (status ${response.status})`,
        details: data,
      });
    }

    // If not verified, try alternate case (lowercase/uppercase) in case bank normalized remark
    if (data && !data.verified) {
      const altRemark =
        cleanRemark === cleanRemark.toLowerCase()
          ? cleanRemark.toUpperCase()
          : cleanRemark.toLowerCase();
      try {
        const altUrl = `${FONEPAY_API_BASE}/verify?remark=${encodeURIComponent(altRemark)}`;
        const altRes = await fetch(altUrl, {
          method: "GET",
          headers: { "Accept": "application/json" },
        });
        const altData = await altRes.json().catch(() => null);
        if (altData && altData.verified) {
          data = altData;
        }
      } catch (altErr) {
        // ignore fallback check
      }
    }

    return res.json(data);
  } catch (error: any) {
    console.error("Error verifying Fonepay payment:", error);
    return res.status(502).json({
      error: error.message || "Failed to communicate with payment verification service",
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FFGlory server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  start();
}

export default app;
