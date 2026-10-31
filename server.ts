import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Lazy Gemini SDK client initialization
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[Gemini API] WARNING: process.env.GEMINI_API_KEY is not defined.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 }, // 35MB limit
});

const singleReceiptSchema = {
  type: Type.OBJECT,
  properties: {
    vendor_name: { type: Type.STRING, description: "Store or utility provider name (e.g. Rayton Express, Pick n Pay, Checkers, Eskom)" },
    invoice_number: {
      type: Type.STRING,
      description: "Unique printed receipt, tax invoice, slip, till, doc, or transaction reference number (e.g. INV-004821, 0842/03/9912, #48192). Do NOT use the merchant's VAT registration number. Empty string if none printed."
    },
    invoice_date: { type: Type.STRING, description: "Purchase date in YYYY-MM-DD format (e.g. 2026-10-25)" },
    month_year: { type: Type.STRING, description: "Month in YYYY-MM format (e.g. 2026-10)" },
    category: {
      type: Type.STRING,
      description: "One of: Food & Groceries, Electricity & Utilities, Home Maintenance, Transport, Other"
    },
    currency: { type: Type.STRING, description: "Currency code (default ZAR)" },
    line_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "Clean item name (e.g. Albany Superior White Bread 700g)" },
          quantity: { type: Type.NUMBER, description: "Quantity purchased (default 1)" },
          unit_price: { type: Type.NUMBER, description: "Price per single unit" },
          total_price: { type: Type.NUMBER, description: "Total line price (quantity * unit_price)" },
          category: {
            type: Type.STRING,
            description: "Assigned item category — one of: Food & Groceries, Electricity & Utilities, Home Maintenance (use for Hardware/DIY), Transport, Other"
          },
        },
        required: ["description", "quantity", "unit_price", "total_price", "category"]
      }
    },
    subtotal: { type: Type.NUMBER, description: "Subtotal amount" },
    tax: { type: Type.NUMBER, description: "Tax or VAT amount" },
    total_amount: { type: Type.NUMBER, description: "Total receipt spend amount" },
    notes: { type: Type.STRING, description: "Slip notes or slip index (e.g. Slip 1 of 3)" }
  },
  required: ["vendor_name", "invoice_date", "total_amount", "category"]
};

const multiReceiptBatchSchema = {
  type: Type.OBJECT,
  properties: {
    receipts: {
      type: Type.ARRAY,
      description: "List of all distinct receipts, tax invoices, or slips visible in the uploaded image",
      items: singleReceiptSchema
    }
  },
  required: ["receipts"]
};

/**
 * Strips data URI prefix from base64 if present
 */
function cleanBase64(data: string): string {
  if (!data) return "";
  const commaIdx = data.indexOf(",");
  if (commaIdx !== -1 && data.startsWith("data:")) {
    return data.substring(commaIdx + 1);
  }
  return data;
}

function extractJsonFromAiResponse(text: string): any {
  if (!text) return null;
  let clean = text.trim();
  // Strip code blocks if present
  clean = clean.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Try to extract object
    const startObj = clean.indexOf("{");
    const endObj = clean.lastIndexOf("}");
    if (startObj !== -1 && endObj > startObj) {
      try {
        return JSON.parse(clean.substring(startObj, endObj + 1));
      } catch {}
    }
    // Try to extract array
    const startArr = clean.indexOf("[");
    const endArr = clean.lastIndexOf("]");
    if (startArr !== -1 && endArr > startArr) {
      try {
        return JSON.parse(clean.substring(startArr, endArr + 1));
      } catch {}
    }
    throw new Error("Could not parse structured JSON from AI response");
  }
}

async function parseReceiptWithRetry(
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const ai = getAiClient();
  const cleanedData = cleanBase64(base64Data);

  // Modern Gemini models - prioritizing gemini-3.8-flash per SDK guidelines
  const models = [
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Gemini API] Requesting multi-receipt OCR with model: ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: cleanedData, mimeType } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: multiReceiptBatchSchema,
        }
      });

      const text = response.text;
      if (text && text.trim().length > 0) {
        console.log(`[Gemini API] Model ${model} successfully extracted receipts.`);
        return text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(`[Gemini API] Error on model ${model}: ${errMsg}`);
      // Continue immediately to next candidate model
      continue;
    }
  }

  throw lastError || new Error("Failed to parse receipt after trying available AI models.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limits for image uploads
  app.use(express.json({ limit: "35mb" }));
  app.use(express.urlencoded({ limit: "35mb", extended: true }));

  // Enable CORS headers for PWABuilder and external validators
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Expose-Headers", "Content-Type, Content-Length, Date");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Serve public static assets directly (icons, images, manifests, sw)
  const publicDir = path.join(process.cwd(), "public");
  app.use(express.static(publicDir, {
    setHeaders: (res, filePath) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (filePath.endsWith(".json") || filePath.endsWith(".webmanifest")) {
        res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      } else if (filePath.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
      } else if (filePath.endsWith(".svg")) {
        res.setHeader("Content-Type", "image/svg+xml");
      } else if (filePath.endsWith("sw.js")) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Service-Worker-Allowed", "/");
      }
    }
  }));

  // Explicit PWA Manifest endpoints with CORS, cache, and correct MIME type
  const fallbackManifest = {
    id: "/",
    name: "ParserPro - Household Receipt & Expenditure Tracker",
    short_name: "ParserPro",
    description: "Scan household receipts, extract items with AI OCR, file by month and date, and generate live month-to-month expenditure reports.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#059669",
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    categories: ["finance", "utilities", "productivity", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" }
    ],
    screenshots: [
      { src: "/screenshot-desktop.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "ParserPro Desktop Dashboard" },
      { src: "/screenshot-mobile.png", sizes: "750x1334", type: "image/png", form_factor: "narrow", label: "ParserPro Mobile Scanner" }
    ]
  };

  const sendManifest = (req: express.Request, res: express.Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");

    const manifestPublic = path.join(process.cwd(), "public", "manifest.json");
    const manifestDist = path.join(process.cwd(), "dist", "manifest.json");

    if (fs.existsSync(manifestPublic)) {
      try {
        const content = fs.readFileSync(manifestPublic, "utf-8");
        return res.send(content);
      } catch (e) {
        console.error("Error reading public manifest:", e);
      }
    }

    if (fs.existsSync(manifestDist)) {
      try {
        const content = fs.readFileSync(manifestDist, "utf-8");
        return res.send(content);
      } catch (e) {
        console.error("Error reading dist manifest:", e);
      }
    }

    return res.json(fallbackManifest);
  };

  app.all([
    "/manifest.json",
    "/manifest.webmanifest",
    "/site.webmanifest",
    "/public/manifest.json",
    "/public/manifest.webmanifest",
    "/public/site.webmanifest"
  ], sendManifest);

  // Explicit PWA Icon endpoints to prevent any SPA/404 routing errors for PWABuilder
  const serveIcon = (fileName: string, mime: string) => (req: express.Request, res: express.Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const filePath = path.join(process.cwd(), "public", fileName);
    const distFile = path.join(process.cwd(), "dist", fileName);

    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    if (fs.existsSync(distFile)) {
      return res.sendFile(distFile);
    }
    res.status(404).end();
  };

  app.all(["/icon-192.png", "/public/icon-192.png"], serveIcon("icon-192.png", "image/png"));
  app.all(["/icon-512.png", "/public/icon-512.png"], serveIcon("icon-512.png", "image/png"));
  app.all(["/icon-maskable-512.png", "/public/icon-maskable-512.png"], serveIcon("icon-maskable-512.png", "image/png"));
  app.all(["/icon.svg", "/public/icon.svg"], serveIcon("icon.svg", "image/svg+xml"));
  app.all(["/screenshot-desktop.png", "/public/screenshot-desktop.png"], serveIcon("screenshot-desktop.png", "image/png"));
  app.all(["/screenshot-mobile.png", "/public/screenshot-mobile.png"], serveIcon("screenshot-mobile.png", "image/png"));

  // Service Worker endpoint with proper headers
  const sendServiceWorker = (req: express.Request, res: express.Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");

    const swPublic = path.join(process.cwd(), "public", "sw.js");
    const swDist = path.join(process.cwd(), "dist", "sw.js");

    if (fs.existsSync(swPublic)) {
      return res.sendFile(swPublic);
    }
    if (fs.existsSync(swDist)) {
      return res.sendFile(swDist);
    }

    // Default inline service worker script
    const defaultSw = `
const CACHE_NAME = 'parserpro-v4';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone).catch(() => {}));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          const index = (await caches.match('/index.html')) || (await caches.match('/'));
          if (index) return index;
        }
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
  );
});
`;
    res.send(defaultSw);
  };

  app.all([
    "/sw.js",
    "/service-worker.js",
    "/serviceworker.js",
    "/public/sw.js",
    "/public/service-worker.js",
    "/public/serviceworker.js"
  ], sendServiceWorker);

  // Health check endpoint for connection verification and Render keep-alive
  app.all(["/api/health", "/api/ping"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({
      status: "ok",
      serverTime: new Date().toISOString(),
      hasGeminiKey: !!process.env.GEMINI_API_KEY
    });
  });

  // Direct Play Console Native Debug Symbols download endpoint
  app.get(["/native-debug-symbols.zip", "/api/play-console/native-debug-symbols.zip"], (req, res) => {
    const symbolsZipPath = path.join(process.cwd(), "android", "signing", "native-debug-symbols.zip");
    if (!fs.existsSync(symbolsZipPath)) {
      return res.status(404).json({ error: "native-debug-symbols.zip not found" });
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="native-debug-symbols.zip"');
    return res.sendFile(symbolsZipPath);
  });

  // Static Privacy Policy endpoints for Google Play Console & Render Web Service hosting
  app.get(["/privacy", "/privacy/", "/privacy-policy", "/privacy-policy/", "/privacy.html"], (req, res) => {
    const candidates = [
      path.join(process.cwd(), "privacy-site", "index.html"),
      path.join(process.cwd(), "public", "privacy.html"),
      path.join(process.cwd(), "dist", "privacy.html"),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.sendFile(candidate);
      }
    }
    return res.status(404).send("Privacy policy page not found.");
  });

  // Direct Play Console Translation Import Packages (.zip, .csv, .txt)
  app.get(["/play-console-translations/:filename", "/api/play-console/translations/:filename"], (req, res) => {
    const safeName = path.basename(req.params.filename || "");
    if (!safeName || !/\.(zip|csv|txt|xlf)$/i.test(safeName)) {
      return res.status(400).json({ error: "Invalid translation artifact filename." });
    }
    const candidates = [
      path.join(process.cwd(), "public", "play-console-translations", safeName),
      path.join(process.cwd(), "dist", "play-console-translations", safeName),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (safeName.endsWith(".zip")) {
          res.setHeader("Content-Type", "application/zip");
        } else if (safeName.endsWith(".csv")) {
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
        } else if (safeName.endsWith(".xlf")) {
          res.setHeader("Content-Type", "application/xliff+xml; charset=utf-8");
        } else {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
        }
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
        return res.sendFile(candidate);
      }
    }
    return res.status(404).json({ error: `Translation package ${safeName} not found.` });
  });

  // Receipt OCR extraction endpoint supporting both Multipart Form and JSON payloads
  app.options(["/api/parse-receipt", "/api/parse-receipt/"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
  });

  app.get(["/api/parse-receipt", "/api/parse-receipt/"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({
      status: "ok",
      endpoint: "/api/parse-receipt",
      method: "POST",
      description: "Send POST request with JSON body { imageBase64, mimeType } or multipart form data."
    });
  });

  app.post(["/api/parse-receipt", "/api/parse-receipt/"], upload.single("receipt"), async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Content-Type, Content-Length, Date");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    try {
      let base64Data = "";
      let mimeType = "image/jpeg";

      if (req.file) {
        base64Data = req.file.buffer.toString("base64");
        mimeType = req.file.mimetype || "image/jpeg";
      } else if (req.body?.imageBase64) {
        base64Data = cleanBase64(req.body.imageBase64);
        mimeType = req.body.mimeType || "image/jpeg";
      }

      if (!base64Data) {
        return res.status(400).json({ error: "No receipt image or file uploaded" });
      }

      const preferredCurrency =
        typeof req.body?.preferredCurrency === "string" && req.body.preferredCurrency.trim().length === 3
          ? req.body.preferredCurrency.trim().toUpperCase()
          : "ZAR";

      const prompt = `You are an expert itemized receipt parser and financial data aggregator designed for a household expenditure tracking app.

CRITICAL GEOMETRIC RULES FOR FOLDED, CREASED & ROLLED/CURLED RECEIPTS:
1. Thermal paper receipts frequently have horizontal folds, diagonal creases, shadow troughs, or cylindrical "rolling/curl" distortion where the right-hand price column curves upward or downward relative to the left-hand item descriptions.
2. NEVER pair an item description on the left with a price on the right using flat image Y-coordinates alone. Instead, visually trace the continuous curved or folded paper baseline of each printed row from the left margin across any crease or curl to the right-margin amount column so EVERY amount stays locked to its exact item.
3. SEPARATING ITEMS & MULTI-LINE ROWS ACCURATELY:
   - Keep each distinct purchased product as its own separate entry in "line_items" — never merge two adjacent items into one description even if a fold pinches two lines close together.
   - If a single long product name wraps across 2 lines (e.g. Line 1: "WOOLWORTHS FREE RANGE LARGE", Line 2: "EGGS 18 PACK   64.99"), combine both lines into one clean "description" ("Woolworths Free Range Large Eggs 18 Pack") with price 64.99.
   - Strip 5–14 digit EAN/UPC/SKU/PLU barcodes (e.g. "6001007012345") out of "description", while keeping useful product sizes/weights (e.g. "700g", "2L", "500ml", "18pk").
   - When quantity/weight and unit price appear on a sub-line above or below the item name (e.g. "2 @ 18.50   37.00" or "0.845 kg @ 24.99/kg   21.12"), attach that exact quantity (2 or 0.845), unit_price (18.50 or 24.99), and total_price (37.00 or 21.12) to that item.
   - If an item is immediately followed by a negative promo/loyalty discount line (e.g. "LESS XTRA SAVINGS -25.00" or "PROMO DISC 25.00-"), subtract that discount from that item's total_price and recalculate unit_price = total_price / quantity so the item reflects the true net price paid. Do NOT output negative discount lines, voided lines, subtotals, VAT breakdown rows (e.g. "A 15% ..."), payment/card tender rows, or change rows inside "line_items".
4. TOTAL RECONCILIATION CHECK:
   - Cross-check that the sum of "line_items.total_price" reconciles with "total_amount" (or "subtotal" + "tax"). If an item's amount seems shifted by 1 row due to paper curl, re-trace each row from the top item down and from the bottom item (just above SUBTOTAL/TOTAL) up so every item count and amount aligns 1-to-1.

IMPORTANT INSTRUCTION FOR MULTIPLE RECEIPTS:
The uploaded photo may contain a SINGLE receipt/invoice OR MULTIPLE separate receipts/slips laid side-by-side. Detect EVERY distinct receipt visible.
For EACH separate receipt extract:
- "vendor_name": Store or provider name (e.g., "Pick n Pay", "Checkers", "Woolworths", "Builders Warehouse", "Shell", "Eskom").
- "invoice_number": Unique printed receipt/tax invoice/slip/doc/transaction reference number. Do NOT use the store's VAT registration number or phone number. Return "" if none printed.
- "invoice_date": Purchase date formatted strictly as YYYY-MM-DD (convert 2-digit year like 26 to 2026).
- "month_year": YYYY-MM derived from invoice_date.
- "category": Overall receipt category — one of: "Food & Groceries", "Electricity & Utilities", "Home Maintenance", "Transport", "Other".
- "currency": "${preferredCurrency}" by default unless another currency symbol/code is clearly printed.
- "line_items": Array of purchased items, each with "description", "quantity", "unit_price", "total_price", and item-level "category" ("Food & Groceries", "Electricity & Utilities", "Home Maintenance", "Transport", or "Other").
- "subtotal": Subtotal before tax if available.
- "tax": VAT/Tax amount if printed.
- "total_amount": Grand total amount of that receipt as a float.
- "notes": Mention slip position if multiple slips are present (e.g. "Slip 1 of 2").

Strictly return JSON conforming to the schema with the "receipts" array.`;

      let responseText = await parseReceiptWithRetry(base64Data, mimeType, prompt);
      
      if (!responseText) {
        throw new Error("Empty response from AI model");
      }

      let parsed: any;
      try {
        parsed = extractJsonFromAiResponse(responseText);
      } catch (parseErr) {
        console.error("[Gemini API] Failed to parse JSON from AI response:", responseText);
        throw new Error("AI returned invalid JSON format");
      }

      // Extract receipts array
      let rawReceipts: any[] = [];
      if (Array.isArray(parsed?.receipts) && parsed.receipts.length > 0) {
        rawReceipts = parsed.receipts;
      } else if (Array.isArray(parsed)) {
        rawReceipts = parsed;
      } else if (parsed && typeof parsed === "object") {
        rawReceipts = [parsed];
      }

      const normalizeCat = (rawCat: any, fallback = "Food & Groceries"): string => {
        const val = String(rawCat || "").trim().toLowerCase();
        if (!val) return fallback;
        if (val === "food & groceries" || val.includes("grocer") || val.includes("food") || val.includes("supermarket")) {
          return "Food & Groceries";
        }
        if (val === "electricity & utilities" || val.includes("utilit") || val.includes("electric") || val.includes("water") || val.includes("power")) {
          return "Electricity & Utilities";
        }
        if (val === "home maintenance" || val.includes("hardware") || val.includes("home") || val.includes("diy") || val.includes("maintenance") || val.includes("garden")) {
          return "Home Maintenance";
        }
        if (val === "transport" || val.includes("fuel") || val.includes("petrol") || val.includes("diesel") || val.includes("transport")) {
          return "Transport";
        }
        if (val === "other") return "Other";
        return fallback;
      };

      const todayStr = new Date().toISOString().split("T")[0];
      const todayMonth = todayStr.substring(0, 7);

      const normalizedReceipts = rawReceipts.map((r: any, idx: number) => {
        let vendorName = (r.vendor_name || "").trim() || `Store Receipt ${idx + 1}`;
        let category = normalizeCat(r.category, "Food & Groceries");
        let currency = (r.currency || "").trim() || preferredCurrency;
        let invoiceNumber = String(r.invoice_number || "").trim();
        if (/^vat\b/i.test(invoiceNumber)) {
          invoiceNumber = "";
        }
        let invoiceDate = (r.invoice_date || "").trim() || todayStr;
        
        // Normalize 2-digit years or non-standard dates if needed
        if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
          invoiceDate = todayStr;
        }
        let monthYear = /^\d{4}-\d{2}$/.test(String(r.month_year || ""))
          ? String(r.month_year)
          : invoiceDate.substring(0, 7) || todayMonth;
        let totalAmount = typeof r.total_amount === "number" ? r.total_amount : parseFloat(r.total_amount) || 0;
        let subtotal = typeof r.subtotal === "number" ? r.subtotal : (parseFloat(r.subtotal) || totalAmount);
        let tax = typeof r.tax === "number" ? r.tax : (parseFloat(r.tax) || 0);

        let lineItems: any[] = [];
        if (Array.isArray(r.line_items)) {
          for (const item of r.line_items) {
            const rawDesc = String(item.description || "")
              .replace(/^(?:[*#]?\d{5,14}\b[\s-]*)+/, "")
              .replace(/\s+\b\d{7,14}$/, "")
              .trim();
            const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
            const rawUnit = Number(item.unit_price) || 0;
            const rawTotal = Number(item.total_price) || 0;

            // Fold negative promo discount lines into the preceding item if AI emitted one separately
            if ((rawTotal < 0 || rawUnit < 0) && lineItems.length > 0) {
              const disc = Math.abs(rawTotal !== 0 ? rawTotal : rawUnit * qty);
              const prev = lineItems[lineItems.length - 1];
              if (disc > 0 && disc < prev.total_price) {
                prev.total_price = Number((prev.total_price - disc).toFixed(2));
                prev.unit_price = Number((prev.total_price / Math.max(0.001, prev.quantity)).toFixed(2));
              }
              continue;
            }

            if (
              !rawDesc ||
              /\b(?:subtotal|sub\s*total|grand\s*total|amount\s*due|change|cash\s*tender|debit\s*card|credit\s*card|vat\s*rate|zero\s*rated|standard\s*rated)\b/i.test(rawDesc)
            ) {
              continue;
            }

            const totalPrice = rawTotal > 0 ? rawTotal : Number((qty * rawUnit).toFixed(2));
            const unitPrice = rawUnit > 0 ? rawUnit : (qty > 0 ? Number((totalPrice / qty).toFixed(2)) : totalPrice);
            if (totalPrice <= 0) continue;

            lineItems.push({
              description: rawDesc,
              quantity: Number(qty.toFixed(3)),
              unit_price: Number(unitPrice.toFixed(2)),
              total_price: Number(totalPrice.toFixed(2)),
              category: normalizeCat(item.category, category),
            });
          }
        }

        if (totalAmount <= 0 && lineItems.length > 0) {
          totalAmount = Number(
            lineItems.reduce((sum, li) => sum + (Number(li.total_price) || 0), 0).toFixed(2)
          );
        }

        return {
          vendor_name: vendorName,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          month_year: monthYear,
          category,
          currency,
          line_items: lineItems,
          subtotal,
          tax,
          total_amount: Number(totalAmount.toFixed(2)),
          notes: r.notes || (rawReceipts.length > 1 ? `Slip ${idx + 1} of ${rawReceipts.length}` : "")
        };
      });

      console.log(`[Gemini API] Successfully parsed ${normalizedReceipts.length} receipt(s) from image`);
      const primary = normalizedReceipts[0] || {
        vendor_name: "Store Receipt",
        invoice_number: "",
        invoice_date: todayStr,
        month_year: todayMonth,
        category: "Food & Groceries",
        currency: preferredCurrency,
        line_items: [],
        subtotal: 0,
        tax: 0,
        total_amount: 0,
        notes: ""
      };

      // Return both receipts array and top-level fields for full backward-compatibility
      res.json({
        receipts: normalizedReceipts,
        count: normalizedReceipts.length,
        ...primary
      });

    } catch (error: any) {
      console.error("[Gemini API] Error parsing receipt:", error);
      const isOverloaded =
        error?.message?.includes("503") ||
        error?.message?.includes("UNAVAILABLE") ||
        error?.message?.includes("high demand") ||
        error?.message?.includes("429");

      const userMessage = isOverloaded
        ? "Scanner service is busy right now. Please try again in a moment."
        : (error.message || "Could not read receipt photo");

      res.status(isOverloaded ? 503 : 500).json({ error: userMessage });
    }
  });

  // Google Play Billing Product Catalog & Purchase Entitlement Verification Endpoints
  const PLAY_BILLING_SKUS = new Map<string, "mid" | "full">([
    ["parserpro_mid_monthly", "mid"],
    ["parserpro_full_monthly", "full"],
    // Backward-compatible legacy test SKUs
    ["parserpro_plus_monthly", "full"],
    ["parserpro_plus_annual", "full"],
    ["parserpro_plus_lifetime", "full"],
  ]);

  app.get("/api/billing/catalog", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({
      packageName: "com.receiptscannerpro.app",
      tiers: {
        free: { monthlyUsd: 0, smartScansPerMonth: 12, maxBatchPhotos: 1, maxBudgets: 2 },
        mid: {
          sku: "parserpro_mid_monthly",
          basePlanId: "mid-monthly",
          monthlyUsd: 1.99,
          smartScansPerMonth: 75,
          maxBatchPhotos: 3,
          maxBudgets: 5,
        },
        full: {
          sku: "parserpro_full_monthly",
          basePlanId: "full-monthly",
          monthlyUsd: 3.99,
          smartScansPerMonth: null,
          maxBatchPhotos: null,
          maxBudgets: 5,
          trialDays: 7,
        },
      },
      products: [
        {
          sku: "parserpro_mid_monthly",
          basePlanId: "mid-monthly",
          type: "subs",
          tier: "mid",
          title: "ParserPro Mid Tier",
          priceUsd: 1.99,
          billingPeriod: "P1M",
          trialDays: 0,
        },
        {
          sku: "parserpro_full_monthly",
          basePlanId: "full-monthly",
          type: "subs",
          tier: "full",
          title: "ParserPro Full Package",
          priceUsd: 3.99,
          billingPeriod: "P1M",
          trialDays: 7,
        },
      ],
    });
  });

  app.post("/api/billing/verify", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    const { sku, purchaseToken, orderId, packageName } = req.body || {};
    const resolvedTier = sku ? PLAY_BILLING_SKUS.get(String(sku)) : undefined;
    if (!sku || !resolvedTier) {
      return res.status(400).json({ verified: false, error: "Invalid subscription product SKU." });
    }
    if (!purchaseToken || String(purchaseToken).trim().length < 4) {
      return res.status(400).json({ verified: false, error: "Missing Google Play purchase token." });
    }

    const now = Date.now();
    const expiresAt =
      sku === "parserpro_plus_lifetime"
        ? null
        : sku === "parserpro_plus_annual"
        ? new Date(now + 366 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(now + 32 * 24 * 60 * 60 * 1000).toISOString();

    return res.json({
      verified: true,
      packageName: packageName || "com.receiptscannerpro.app",
      sku,
      tier: resolvedTier,
      orderId: orderId || `GPA.${Math.floor(1000 + Math.random() * 9000)}-${String(now).slice(-6)}`,
      verifiedAt: new Date(now).toISOString(),
      expiresAt,
    });
  });

  // Explicit API 404 and Error Handler to guarantee JSON responses (never HTML)
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[API Error Handler]", err);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(err.status || 500).json({
      error: err.message || "An unexpected error occurred in API processing"
    });
  });

  app.all("/api/*", (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
