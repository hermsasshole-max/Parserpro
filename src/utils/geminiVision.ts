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
const receiptResponseSchema = {
  type: Type.OBJECT,
  properties: {
    vendor_name: { type: Type.STRING, description: 'Store or utility provider name' },
    invoice_date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' },
    month_year: { type: Type.STRING, description: 'Month in YYYY-MM format (e.g. 2026-08)' },
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

const EXTRACTION_SYSTEM_PROMPT = `You are a high-precision receipt and invoice parser designed for a household grocery and expenditure tracking app.

Analyze the uploaded receipt image carefully and extract all information strictly into valid JSON matching the requested schema.

Categorization Rules:
1. "Food & Groceries": Supermarket purchases, food markets, bakeries, butcheries, pantries.
2. "Electricity & Utilities": Power tokens (Eskom/municipality), water, rates, refuse, sewage, gas.
3. "Home Maintenance": Hardware stores, DIY supplies, repair services, garden care.
4. "Transport": Fuel, petrol/diesel stations, vehicle repairs, toll gates, parking.
5. "Other": Any household expense that does not fit the above categories.

Extraction Requirements:
- If date is found on the receipt (e.g. "23.08.26" or "23/08/2026"), format strictly as YYYY-MM-DD (e.g. "2026-08-23").
- Compute "month_year" as the first 7 characters: "YYYY-MM" (e.g. "2026-08"). If no date is visible, use today's date.
- Default currency is "ZAR" unless indicated otherwise on the receipt (e.g. $, €, £).
- All numbers must be clean numeric floats without currency symbols (e.g. 241.71, not "R241.71").
- Extract individual line items whenever legible. If line items are partially truncated, provide best-effort summaries.
- Return ONLY valid raw JSON conforming to the schema.`;

export interface ParseOptions {
  onProgress?: (stage: string) => void;
  apiKey?: string;
}

/**
 * Parses a receipt image directly via client-side Gemini Vision API with
 * an AbortController 45s timeout and automatic 3-attempt exponential backoff.
 */
export async function parseReceiptWithGemini(
  base64Data: string,
  mimeType: string,
  options: ParseOptions = {}
): Promise<ReceiptData> {
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

  // Candidate models: prioritize the latest flash model
  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest'
  ];

  const maxAttempts = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const modelToUse = candidateModels[(attempt - 1) % candidateModels.length];
    const controller = new AbortController();
    const timeoutDurationMs = 45000; // 45-second timeout as required

    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Timeout: Gemini API took longer than ${timeoutDurationMs / 1000}s to respond.`));
    }, timeoutDurationMs);

    try {
      if (options.onProgress) {
        if (attempt === 1) {
          options.onProgress('Scanning receipt with Gemini Vision...');
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
          responseSchema: receiptResponseSchema,
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
        options.onProgress('Extracting vendor, date, & line items...');
      }

      const responseText = response.text;
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Received empty response from Gemini model.');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(responseText.trim());
      } catch (jsonErr) {
        // Strip markdown codeblocks if accidentally included
        const cleanJson = responseText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
        parsed = JSON.parse(cleanJson);
      }

      // Normalization of fields
      const normalizedDate = parsed.invoice_date || new Date().toISOString().split('T')[0];
      const normalizedMonth = parsed.month_year || normalizedDate.substring(0, 7);
      const normalizedTotal = typeof parsed.total_amount === 'number' ? parsed.total_amount : parseFloat(parsed.total_amount) || 0;

      const result: ReceiptData = {
        vendor_name: parsed.vendor_name || 'Store Expense',
        invoice_date: normalizedDate,
        month_year: normalizedMonth,
        category: parsed.category || 'Food & Groceries',
        currency: parsed.currency || 'ZAR',
        line_items: Array.isArray(parsed.line_items) ? parsed.line_items.map((item: any) => ({
          description: String(item.description || 'Item'),
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || Number(item.total_price) || 0,
          total_price: Number(item.total_price) || 0
        })) : [],
        subtotal: typeof parsed.subtotal === 'number' ? parsed.subtotal : (parsed.total_amount || 0),
        tax: typeof parsed.tax === 'number' ? parsed.tax : 0,
        total_amount: normalizedTotal,
        notes: parsed.notes || ''
      };

      console.log('[GeminiVision] Receipt OCR successfully completed:', result.vendor_name, result.total_amount);
      return result;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      const errMsg = err?.message || String(err);
      console.warn(`[GeminiVision] Attempt ${attempt} failed:`, errMsg);

      // If user provided invalid API key or permission denied, stop retrying immediately
      if (
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('API key not valid') ||
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('MISSING_API_KEY')
      ) {
        throw new Error('Invalid Gemini API Key. Please check and re-enter your API key in Settings.');
      }

      if (attempt < maxAttempts) {
        // Exponential backoff: 1.5s, 3s
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
