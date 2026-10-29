import { Capacitor, registerPlugin } from '@capacitor/core';
import type { OcrSpatialPage } from './receiptLayoutParser';

export interface NativeReceiptOcrResult {
  text: string;
  rawText: string;
  engine: 'native_mlkit';
  primary?: OcrSpatialPage;
  enhanced?: OcrSpatialPage;
  blocks?: string[];
}

export interface NativeReceiptOcrPluginInterface {
  isAvailable(): Promise<{ available: boolean }>;
  recognizeReceipt(options: { imageBase64: string }): Promise<NativeReceiptOcrResult>;
}

const NativeReceiptOcr = registerPlugin<NativeReceiptOcrPluginInterface>('NativeReceiptOcr');

let cachedAvailability: boolean | null = null;

/**
 * Checks whether the bundled Android Google ML Kit Text Recognition Capacitor plugin is available.
 */
export async function isNativeMlKitAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return false;
  }
  if (cachedAvailability !== null) {
    return cachedAvailability;
  }

  try {
    const checkPromise = NativeReceiptOcr.isAvailable();
    const timeoutPromise = new Promise<{ available: boolean }>((resolve) =>
      setTimeout(() => resolve({ available: false }), 2500)
    );
    const res = await Promise.race([checkPromise, timeoutPromise]);
    cachedAvailability = Boolean(res?.available);
    return cachedAvailability;
  } catch {
    cachedAvailability = false;
    return false;
  }
}

/**
 * Runs on-device bundled Google ML Kit Latin Text Recognition returning both
 * primary and fold-shadow-flattened spatial 2D geometry passes.
 */
export async function performNativeMlKitStructuredOcr(
  base64Data: string,
  onProgress?: (stage: string) => void
): Promise<NativeReceiptOcrResult | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return null;
  }

  if (onProgress) {
    onProgress('Reading folded & curved lines on your phone...');
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Native ML Kit OCR timed out after 18s')), 18000)
  );

  const result = await Promise.race([
    NativeReceiptOcr.recognizeReceipt({ imageBase64: base64Data }),
    timeoutPromise,
  ]);

  return result || null;
}

/**
 * Backwards-compatible text wrapper for on-device ML Kit OCR.
 */
export async function performNativeMlKitOcr(
  base64Data: string,
  onProgress?: (stage: string) => void
): Promise<string> {
  const res = await performNativeMlKitStructuredOcr(base64Data, onProgress);
  return (res?.text || res?.rawText || '').trim();
}
