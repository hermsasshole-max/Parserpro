import { GoogleGenAI, Type } from '@google/genai';
import type { ReceiptData } from '../types';

export const GEMINI_API_KEY_STORAGE = 'parserpro_gemini_api_key';

/**
 * Returns the currently active Gemini API key from environment or local storage.
 */
export function getActiveGeminiApiKey(): string {
  try {
    // 1. Check Vite environment variable
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
      return envKey.trim();
    }
  } catch (e) {
    // Ignore env access errors
  }

  try {
    // 2. Check localStorage client configuration
    const savedKey = localStorage.getItem(GEMINI_API_KEY_STORAGE);
    if (savedKey && typeof savedKey === 'string' && savedKey.trim().length > 0) {
      return savedKey.trim();
    }
  } catch (e) {
    console.warn('[GeminiVision] Failed to read localStorage key:', e);
  }

  return '';
}

/**
 * Saves or clears the client-side Gemini API key.
 */
export function setClientGeminiApiKey(key: string): void {
  try {
    if (!key || key.trim().length === 0) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
    }
  } catch (e) {
    console.error('[GeminiVision] Failed to save API key to localStorage:', e);
  }
}

/**
 * JSON Schema for receipt structured extraction
 */
const singleReceiptSchema = {
  type: Type.OBJECT,
  properties: {
    vendor_name: { type: Type.STRING, description: 'Store or utility provider name (e.g. Rayton Express, Pick n Pay, Eskom)' },
    invoice_date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
    month_year: { type: Type.STRING, description: 'Month in YYYY-MM format (e.g. 2026-09)' },
    category: {
      type: Type.STRING,
      description: 'One of: Food & Groceries, Electricity & Utilities, Home Maintenance, Transport, Other'
    },
    currency: { type: Type.STRING, description: 'Currency code, e.g., ZAR, USD, EUR' },
    line_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, description: 'Item description' },
          quantity: { type: Type.NUMBER, description: 'Item quantity' },
          unit_price: { type: Type.NUMBER, description: 'Unit price' },
          total_price: { type: Type.NUMBER, description: 'Total price' }
        },
        required: ['description', 'total_price']
      }
    },
    subtotal: { type: Type.NUMBER, description: 'Subtotal amount' },
    tax: { type: Type.NUMBER, description: 'Tax or VAT amount' },
    total_amount: { type: Type.NUMBER, description: 'Total receipt spend amount' },
    notes: { type: Type.STRING, description: 'Optional receipt notes, meter reading, or slip number' }
  },
  required: ['vendor_name', 'total_amount', 'category']
};

const multiReceiptBatchResponseSchema = {
  type: Type.OBJECT,
  properties: {
    receipts: {
      type: Type.ARRAY,
      description: 'List of all distinct receipts, tax invoices, or slips visible in the uploaded image',
      items: singleReceiptSchema
    }
  },
  required: ['receipts']
};

const EXTRACTION_SYSTEM_PROMPT = `You are a high-precision receipt and tax invoice parser designed for a household expenditure tracking app.

IMPORTANT INSTRUCTION FOR MULTIPLE RECEIPTS:
The uploaded image may contain:
- A SINGLE receipt/invoice, OR
- MULTIPLE separate receipts/tax invoices laid side-by-side or photographed on a table/counter (for example, two or three separate store slips in one picture).

You MUST inspect the entire image and detect EVERY distinct receipt, tax invoice, or cash slip visible.
For EACH separate receipt identified in the image, extract:
- "vendor_name": Store or provider name (e.g., "Rayton Express", "Pick n Pay", "Checkers", "Woolworths", "Shoprite", "Eskom").
- "invoice_date": Date found on that specific receipt formatted strictly as YYYY-MM-DD. If year is 2 digits like 26, format as 2026.
- "month_year": The YYYY-MM month derived from the invoice date (e.g. "2026-09").
- "category": Choose one of: "Food & Groceries", "Electricity & Utilities", "Home Maintenance", "Transport", "Other".
- "currency": "ZAR" (South African Rand) by default unless stated otherwise.
- "line_items": Array of item descriptions, quantity, unit_price, total_price on that receipt.
- "subtotal": Subtotal before tax if available.
- "tax": VAT/Tax amount if printed.
- "total_amount": Grand total amount of that specific receipt as a clean float (e.g., 122.30, 47.50, 292.17).
- "notes": Mention slip position or detail (e.g. "Slip 1 of 3: Tax Invoice (COPY)").

Categorization Rules:
1. "Food & Groceries": Supermarket purchases, food markets, bakeries, butcheries, pantries.
2. "Electricity & Utilities": Power tokens (Eskom/municipality), water, rates, refuse, sewage, gas.
3. "Home Maintenance": Hardware stores, DIY supplies, repair services, garden care.
4. "Transport": Fuel, petrol/diesel stations, vehicle repairs, toll gates, parking.
5. "Other": Any household expense that does not fit the above categories.

Output:
Strictly return JSON conforming to the schema with the "receipts" array containing all detected receipts.`;

export interface ParseOptions {
  onProgress?: (stage: string) => void;
  apiKey?: string;
}

/**
 * Parses an image containing one or more receipts directly via client-side Gemini Vision API.
 * Returns an array of all detected receipts.
 */
export async function parseMultipleReceiptsWithGemini(
  base64Data: string,
  mimeType: string,
  options: ParseOptions = {}
): Promise<ReceiptData[]> {
  const apiKey = (options.apiKey || getActiveGeminiApiKey()).trim();

  if (!apiKey) {
    throw new Error('MISSING_API_KEY: Please configure your Gemini API key to scan receipts.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Candidate models: prioritize the latest 3.8 flash models
  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite'
  ];

  const maxAttempts = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const modelToUse = candidateModels[(attempt - 1) % candidateModels.length];
    const controller = new AbortController();
    const timeoutDurationMs = 45000;

    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Timeout: Gemini API took longer than ${timeoutDurationMs / 1000}s to respond.`));
    }, timeoutDurationMs);

    try {
      if (options.onProgress) {
        if (attempt === 1) {
          options.onProgress('Scanning receipts with Gemini Vision...');
        } else {
          options.onProgress(`Retrying OCR with model ${modelToUse} (attempt ${attempt}/${maxAttempts})...`);
        }
      }

      console.log(`[GeminiVision] Attempt ${attempt}/${maxAttempts} using ${modelToUse}...`);

      const callPromise = ai.models.generateContent({
        model: modelToUse,
        contents: [
          {
            role: 'user',
            parts: [
              { text: EXTRACTION_SYSTEM_PROMPT },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType || 'image/jpeg',
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: multiReceiptBatchResponseSchema,
          temperature: 0.1,
        },
      });

      // Race with abort controller signal
      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(controller.signal.reason || new Error('Request aborted due to timeout.'));
        });
      });

      const response = await Promise.race([callPromise, abortPromise]);
      clearTimeout(timeoutId);

      if (options.onProgress) {
        options.onProgress('Extracting multiple receipts, dates, & line items...');
      }

      const responseText = response.text;
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Received empty response from Gemini model.');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(responseText.trim());
      } catch (jsonErr) {
        const cleanJson = responseText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        parsed = JSON.parse(cleanJson);
      }

      let rawReceipts: any[] = [];
      if (Array.isArray(parsed?.receipts) && parsed.receipts.length > 0) {
        rawReceipts = parsed.receipts;
      } else if (Array.isArray(parsed)) {
        rawReceipts = parsed;
      } else if (parsed && typeof parsed === 'object') {
        rawReceipts = [parsed];
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const todayMonth = todayStr.substring(0, 7);

      const results: ReceiptData[] = rawReceipts.map((r: any, idx: number) => {
        const normalizedDate = r.invoice_date || todayStr;
        const normalizedMonth = r.month_year || normalizedDate.substring(0, 7) || todayMonth;
        const normalizedTotal = typeof r.total_amount === 'number' ? r.total_amount : parseFloat(r.total_amount) || 0;

        return {
          vendor_name: r.vendor_name || `Store Expense ${idx + 1}`,
          invoice_date: normalizedDate,
          month_year: normalizedMonth,
          category: r.category || 'Food & Groceries',
          currency: r.currency || 'ZAR',
          line_items: Array.isArray(r.line_items) ? r.line_items.map((item: any) => ({
            description: String(item.description || 'Item'),
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || Number(item.total_price) || 0,
            total_price: Number(item.total_price) || 0
          })) : [],
          subtotal: typeof r.subtotal === 'number' ? r.subtotal : normalizedTotal,
          tax: typeof r.tax === 'number' ? r.tax : 0,
          total_amount: normalizedTotal,
          notes: r.notes || (rawReceipts.length > 1 ? `Slip ${idx + 1} of ${rawReceipts.length}` : '')
        };
      });

      console.log(`[GeminiVision] OCR completed: Extracted ${results.length} receipt(s)`);
      return results;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(`[GeminiVision] Attempt ${attempt} failed:`, errMsg);

      if (
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('API key not valid') ||
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('MISSING_API_KEY')
      ) {
        throw new Error('Invalid Gemini API Key. Please check and re-enter your API key in Settings.');
      }

      if (attempt < maxAttempts) {
        const backoffMs = attempt * 1500;
        if (options.onProgress) {
          options.onProgress(`Network delay encountered. Retrying in ${(backoffMs / 1000).toFixed(1)}s...`);
        }
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  throw lastError || new Error('Failed to parse receipt after 3 attempts. Please check network connection or retry.');
}

/**
 * Backward-compatible single receipt parser (returns primary detected receipt)
 */
export async function parseReceiptWithGemini(
  base64Data: string,
  mimeType: string,
  options: ParseOptions = {}
): Promise<ReceiptData> {
  const receipts = await parseMultipleReceiptsWithGemini(base64Data, mimeType, options);
  if (receipts.length > 0) {
    return receipts[0];
  }
  return {
    vendor_name: 'Store Expense',
    invoice_date: new Date().toISOString().split('T')[0],
    month_year: new Date().toISOString().substring(0, 7),
    category: 'Food & Groceries',
    currency: 'ZAR',
    line_items: [],
    subtotal: 0,
    tax: 0,
    total_amount: 0,
    notes: ''
  };
}
