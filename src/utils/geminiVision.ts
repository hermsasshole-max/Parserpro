import type { ReceiptData } from '../types';
import { getPreferredCurrency } from './currencyFormat';

export interface ParseOptions {
  onProgress?: (stage: string) => void;
  preferredCurrency?: string;
  signal?: AbortSignal;
}

/**
 * Sends receipt image to the secure server-side OCR endpoint (/api/parse-receipt).
 * Client code never imports @google/genai or exposes API keys.
 */
export async function parseMultipleReceiptsViaServer(
  base64Data: string,
  mimeType: string,
  options: ParseOptions = {}
): Promise<ReceiptData[]> {
  if (options.onProgress) {
    options.onProgress('Reading store name, date, and items...');
  }

  const preferredCurrency = options.preferredCurrency || getPreferredCurrency();

  const res = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageBase64: base64Data,
      mimeType: mimeType || 'image/jpeg',
      preferredCurrency,
    }),
    signal: options.signal,
  });

  const rawText = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(rawText.trim());
  } catch {
    const startObj = rawText.indexOf('{');
    const endObj = rawText.lastIndexOf('}');
    if (startObj !== -1 && endObj > startObj) {
      try {
        json = JSON.parse(rawText.substring(startObj, endObj + 1));
      } catch {
        // Ignore parse fallback failure
      }
    }
  }

  if (json && typeof json === 'object') {
    if (res.ok) {
      if (Array.isArray(json.receipts) && json.receipts.length > 0) {
        return json.receipts;
      }
      if (json.vendor_name) {
        return [json];
      }
      throw new Error('Could not clearly read receipt items from this photo.');
    }
    throw new Error(json.error || `Scanner service returned status ${res.status}`);
  }

  throw new Error(`Scanner service unavailable (HTTP ${res.status})`);
}
