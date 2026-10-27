import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeReceiptOcrResult {
  text: string;
  rawText: string;
  engine: 'native_mlkit';
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
 * Runs on-device bundled Google ML Kit Latin Text Recognition with horizontal receipt row reconstruction.
 */
export async function performNativeMlKitOcr(
  base64Data: string,
  onProgress?: (stage: string) => void
): Promise<string> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return '';
  }

  if (onProgress) {
    onProgress('Reading receipt on your phone...');
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Native ML Kit OCR timed out after 15s')), 15000)
  );

  const result = await Promise.race([
    NativeReceiptOcr.recognizeReceipt({ imageBase64: base64Data }),
    timeoutPromise,
  ]);

  return (result?.text || result?.rawText || '').trim();
}
