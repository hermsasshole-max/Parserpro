import { Capacitor } from '@capacitor/core';
import type { ReceiptData } from '../types';
import { getPreferredCurrency } from './currencyFormat';

export interface ParseOptions {
  onProgress?: (stage: string) => void;
  preferredCurrency?: string;
  signal?: AbortSignal;
}

function getConfiguredApiBaseUrl(): string {
  const raw = String((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
  return raw.replace(/\/+$/, '');
}

/**
 * Determines whether a live server-side OCR endpoint is reachable in the current runtime.
 * Standalone Capacitor Android builds and static GitHub Pages builds without VITE_API_BASE_URL
 * do not run a local Express server, so they immediately route to bundled on-device ML Kit / Tesseract.
 */
export function hasConfiguredCloudOcrEndpoint(): boolean {
  const configuredBase = getConfiguredApiBaseUrl();
  if (configuredBase.length > 0) {
    return true;
  }
  if (Capacitor.isNativePlatform()) {
    return false;
  }
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return false;
  }
  return true;
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
  if (!hasConfiguredCloudOcrEndpoint()) {
    throw new Error('ON_DEVICE_STANDALONE_MODE');
  }

  if (options.onProgress) {
    options.onProgress('Reading store name, date, and items...');
  }

  const preferredCurrency = options.preferredCurrency || getPreferredCurrency();
  const baseUrl = getConfiguredApiBaseUrl();
  const endpointUrl = baseUrl ? `${baseUrl}/api/parse-receipt` : '/api/parse-receipt';

  const res = await fetch(endpointUrl, {
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
