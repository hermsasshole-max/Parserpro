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

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    vendor_name: { type: Type.STRING, description: "Store or utility provider name" },
    invoice_date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
    month_year: { type: Type.STRING, description: "Month in YYYY-MM format" },
    category: {
      type: Type.STRING,
      description: "One of: Food & Groceries, Electricity & Utilities, Home Maintenance, Transport, Other"
    },
    currency: { type: Type.STRING, description: "Currency code, e.g., ZAR, USD, EUR" },
    line_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: "Item description" },
          quantity: { type: Type.NUMBER, description: "Item quantity" },
          unit_price: { type: Type.NUMBER, description: "Unit price" },
          total_price: { type: Type.NUMBER, description: "Total price" },
        },
        required: ["description", "total_price"]
      }
    },
    subtotal: { type: Type.NUMBER, description: "Subtotal amount" },
    tax: { type: Type.NUMBER, description: "Tax amount" },
    total_amount: { type: Type.NUMBER, description: "Total receipt amount" },
    notes: { type: Type.STRING, description: "Optional notes, account number or meter reading" }
  },
  required: ["vendor_name", "total_amount", "category"]
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

async function parseReceiptWithRetry(
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const ai = getAiClient();
  const cleanedData = cleanBase64(base64Data);
  // Prioritize active flash models with automatic graceful fallback
  const models = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];
  let lastError: any = null;

  for (const model of models) {
    const maxRetriesForModel = 2;
    for (let attempt = 1; attempt <= maxRetriesForModel; attempt++) {
      try {
        console.log(`[Gemini API] Requesting receipt OCR with model: ${model} (attempt ${attempt}/${maxRetriesForModel})...`);
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
            responseSchema: receiptSchema,
            temperature: 0.1,
          }
        });

        const text = response.text;
        if (text && text.trim().length > 0) {
          console.log(`[Gemini API] Model ${model} successfully extracted receipt details.`);
          return text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("high demand") ||
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("rate limit") ||
          errMsg.includes("fetch failed");

        console.warn(`[Gemini API] Error on model ${model} (attempt ${attempt}): ${errMsg}`);

        // If it's a 404 or model deprecated, immediately jump to the next model
        if (errMsg.includes("404") || errMsg.includes("NOT_FOUND") || errMsg.includes("no longer available")) {
          break;
        }

        // On transient errors, do 1 quick retry, then try next model
        if (isTransient && attempt < maxRetriesForModel) {
          const delay = 400 + Math.random() * 200;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        break;
      }
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
    id: "com.parserpro.app",
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
const CACHE_NAME = 'parserpro-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
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

  // Receipt OCR extraction endpoint supporting both Multipart Form and JSON payloads
  app.post(["/api/parse-receipt", "/api/parse-receipt/"], upload.single("receipt"), async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
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

      const prompt = `You are a precise receipt and invoice parser designed for a household grocery and expenditure tracking app.

Analyze the uploaded image or document of the receipt/invoice and extract the data strictly into the following JSON format:

{
  "vendor_name": "Store / Utility Provider Name",
  "invoice_date": "YYYY-MM-DD",
  "month_year": "YYYY-MM",
  "category": "Food & Groceries | Electricity & Utilities | Home Maintenance | Transport | Other",
  "currency": "ZAR",
  "line_items": [
    {
      "description": "Item description",
      "quantity": 1.0,
      "unit_price": 0.00,
      "total_price": 0.00
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total_amount": 0.00,
  "notes": "Any extra detail like account number or meter reading"
}

Categorization Rules:
1. "Food & Groceries": Supermarket purchases, food markets, pantry supplies.
2. "Electricity & Utilities": Power tokens, municipal water/lights, gas, refuse, sewage.
3. "Home Maintenance": Hardware, DIY supplies, repair services.
4. "Transport": Fuel, vehicle repairs, toll fees.
5. "Other": Any household expense that does not fit the above categories.

Output Rules:
- Return ONLY valid, raw JSON. Do not include markdown code fences (\`\`\`json ... \`\`\`) or conversational commentary.
- If a date format is ambiguous on the receipt, format it as YYYY-MM-DD.
- Ensure all numeric values are standard floats/integers without currency symbols.`;

      let responseText = await parseReceiptWithRetry(base64Data, mimeType, prompt);
      
      if (!responseText) {
        throw new Error("Empty response from AI model");
      }

      // Clean markdown code blocks if present
      responseText = responseText.trim();
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      }

      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseErr) {
        console.error("[Gemini API] Failed to parse JSON from AI response:", responseText);
        throw new Error("AI returned invalid JSON format");
      }

      // Validate & normalize output
      if (!parsed.vendor_name) {
        parsed.vendor_name = "Household Expense";
      }
      if (!parsed.currency) {
        parsed.currency = "ZAR";
      }
      if (!parsed.category) {
        parsed.category = "Food & Groceries";
      }
      if (typeof parsed.total_amount !== "number") {
        parsed.total_amount = Number(parsed.total_amount) || 0;
      }
      if (!Array.isArray(parsed.line_items)) {
        parsed.line_items = [];
      }

      console.log(`[Gemini API] Successfully parsed receipt for ${parsed.vendor_name}: ${parsed.currency} ${parsed.total_amount}`);
      res.json(parsed);

    } catch (error: any) {
      console.error("[Gemini API] Error parsing receipt:", error);
      const isOverloaded =
        error?.message?.includes("503") ||
        error?.message?.includes("UNAVAILABLE") ||
        error?.message?.includes("high demand") ||
        error?.message?.includes("429");

      const userMessage = isOverloaded
        ? "AI service is experiencing high traffic. Please retry in a moment."
        : (error.message || "Failed to parse receipt");

      res.status(isOverloaded ? 503 : 500).json({ error: userMessage });
    }
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
