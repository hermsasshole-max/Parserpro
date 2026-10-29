import type { ReceiptData, OcrEngineType, OcrEngineMode, CachedReceiptJob } from '../types';
import { performLocalTesseractOcr, parseLocalOcrTextToReceipts } from './localTesseractOcr';
import { isNativeMlKitAvailable, performNativeMlKitOcr } from './nativeReceiptOcr';
import {
  enqueueUnprocessedReceipt,
  updateQueueJob,
  recordJobFailure,
  getPendingRetryJobs,
} from './offlineOcrQueue';
import {
  parseMultipleReceiptsViaServer,
  hasConfiguredCloudOcrEndpoint,
} from './geminiVision';
import { getPreferredCurrency } from './currencyFormat';
import { computeImageFingerprint } from './duplicateDetection';

const OCR_MODE_STORAGE_KEY = 'parserpro_ocr_engine_mode_v1';
const OCR_TIMEOUT_STORAGE_KEY = 'parserpro_ocr_timeout_ms_v1';

export function getStoredOcrMode(): OcrEngineMode {
  try {
    const val = localStorage.getItem(OCR_MODE_STORAGE_KEY);
    if (val === 'cloud_only' || val === 'local_tesseract_only') {
      return val;
    }
  } catch {}
  return 'auto_fallback';
}

export function setStoredOcrMode(mode: OcrEngineMode): void {
  try {
    localStorage.setItem(OCR_MODE_STORAGE_KEY, mode);
  } catch {}
}

export function getStoredApiTimeoutMs(): number {
  try {
    const val = localStorage.getItem(OCR_TIMEOUT_STORAGE_KEY);
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 5000 && num <= 60000) return num;
    }
  } catch {}
  return 12000;
}

export function setStoredApiTimeoutMs(timeoutMs: number): void {
  try {
    localStorage.setItem(OCR_TIMEOUT_STORAGE_KEY, String(timeoutMs));
  } catch {}
}

export interface FailSafeOptions {
  timeoutMs?: number;
  mode?: OcrEngineMode;
  preferredCurrency?: string;
  onStage?: (stage: string) => void;
  onEngineSwitched?: (engine: OcrEngineType, reason: string) => void;
}

export interface FailSafeOcrResult {
  receipts: ReceiptData[];
  engineUsed: OcrEngineType;
  fallbackTriggered: boolean;
  warning?: string;
  cachedJobId?: string;
}

async function callSmartOcrWithTimeout(
  base64Data: string,
  mimeType: string,
  timeoutMs: number,
  preferredCurrency?: string,
  onStage?: (stage: string) => void
): Promise<ReceiptData[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('SCAN_TIMEOUT'));
  }, timeoutMs);

  try {
    const receipts = await parseMultipleReceiptsViaServer(base64Data, mimeType, {
      onProgress: onStage,
      preferredCurrency: preferredCurrency || getPreferredCurrency(),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const fingerprint = computeImageFingerprint(base64Data);
    return receipts.map((r) => ({
      ...r,
      engine_used: 'cloud_api',
      image_fingerprint: r.image_fingerprint || fingerprint || undefined,
    }));
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Runs the fastest, highest-accuracy on-device OCR engine available:
 * 1. Bundled Android Google ML Kit Text Recognition (native C++/JNI, ~200ms, row-reconstructed)
 * 2. Bundled WebAssembly Tesseract.js fallback (works in any browser/WebView offline)
 */
async function performBestOnDeviceOcr(params: {
  base64Data: string;
  mimeType: string;
  fileName: string;
  preferredCurrency: string;
  onStage?: (stage: string) => void;
}): Promise<{ receipts: ReceiptData[]; engineUsed: 'native_mlkit' | 'local_tesseract'; hadText: boolean }> {
  const { base64Data, mimeType, fileName, preferredCurrency, onStage } = params;
  const fingerprint = computeImageFingerprint(base64Data);

  // Tier A: Native Android ML Kit
  if (await isNativeMlKitAvailable()) {
    try {
      const mlText = await performNativeMlKitOcr(base64Data, onStage);
      if (mlText && mlText.trim().length > 0) {
        const parsed = parseLocalOcrTextToReceipts(mlText, fileName, {
          preferredCurrency,
          engineLabel: 'native_mlkit',
        }).map((r) => ({
          ...r,
          image_fingerprint: r.image_fingerprint || fingerprint || undefined,
        }));
        return {
          receipts: parsed,
          engineUsed: 'native_mlkit',
          hadText: true,
        };
      }
    } catch (mlErr) {
      console.warn('[FailSafeOCR] Native ML Kit encountered an issue, trying Tesseract fallback:', mlErr);
    }
  }

  // Tier B: Bundled WebAssembly Tesseract.js
  const tessText = await performLocalTesseractOcr(base64Data, mimeType, (stage) => {
    if (onStage) onStage(stage || 'Reading items on your device...');
  });
  const parsed = parseLocalOcrTextToReceipts(tessText, fileName, {
    preferredCurrency,
    engineLabel: 'local_tesseract',
  }).map((r) => ({
    ...r,
    image_fingerprint: r.image_fingerprint || fingerprint || undefined,
  }));

  return {
    receipts: parsed,
    engineUsed: 'local_tesseract',
    hadText: Boolean(tessText && tessText.trim().length > 0),
  };
}

/**
 * 3-Tier Fail-Safe Receipt Scanner:
 * 1. Smart Cloud Scanner (when online and a backend API endpoint is configured)
 * 2. Bundled Android Google ML Kit On-Device OCR (instant offline native extraction)
 * 3. Bundled WebAssembly Tesseract.js On-Device OCR (universal offline fallback)
 */
export async function executeFailSafeOcr(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
  previewUrl?: string;
  options?: FailSafeOptions;
}): Promise<FailSafeOcrResult> {
  const {
    base64Data,
    mimeType,
    fileName = 'receipt_scan.jpg',
    fileSize = 0,
    previewUrl,
    options = {},
  } = params;

  const mode = options.mode || getStoredOcrMode();
  const timeoutMs = options.timeoutMs || getStoredApiTimeoutMs();
  const preferredCurrency = options.preferredCurrency || getPreferredCurrency();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const cloudAvailable = hasConfiguredCloudOcrEndpoint();

  // Direct on-device path when standalone Android (no cloud URL), offline, or user-forced offline
  if (!cloudAvailable || mode === 'local_tesseract_only' || !isOnline) {
    if (options.onStage) {
      options.onStage('Reading receipt on your phone...');
    }

    const onDevice = await performBestOnDeviceOcr({
      base64Data,
      mimeType,
      fileName,
      preferredCurrency,
      onStage: options.onStage,
    });

    if (options.onEngineSwitched) {
      options.onEngineSwitched(
        onDevice.engineUsed,
        !isOnline
          ? 'No internet connection — scanned directly on your phone.'
          : 'Scanned directly on your phone.'
      );
    }

    let cachedJobId: string | undefined;
    // Only queue for background cloud retry if a cloud endpoint exists, we were temporarily offline, and total was unreadable
    if (
      cloudAvailable &&
      !isOnline &&
      mode !== 'local_tesseract_only' &&
      (!onDevice.hadText || onDevice.receipts.every((r) => (r.total_amount || 0) === 0))
    ) {
      const job = await enqueueUnprocessedReceipt({
        fileName,
        fileSize,
        mimeType,
        base64Data,
        previewUrl,
        initialError: 'Captured offline — queued for smart sync when online.',
        engineUsed: onDevice.engineUsed,
        extractedReceipts: onDevice.receipts,
        status: 'fallback_extracted',
      });
      cachedJobId = job.id;
    }

    return {
      receipts: onDevice.receipts,
      engineUsed: onDevice.engineUsed,
      fallbackTriggered: !cloudAvailable ? false : true,
      warning: onDevice.hadText
        ? 'Scanned on your device — please confirm the store name and total below before saving.'
        : 'Receipt photo captured. Please enter or confirm the store name and total below.',
      cachedJobId,
    };
  }

  // Online smart scan with automatic instant failover to ML Kit / Tesseract
  try {
    if (options.onStage) {
      options.onStage('Reading store name, date & line items...');
    }

    const cloudReceipts = await callSmartOcrWithTimeout(
      base64Data,
      mimeType,
      timeoutMs,
      preferredCurrency,
      options.onStage
    );

    return {
      receipts: cloudReceipts,
      engineUsed: 'cloud_api',
      fallbackTriggered: false,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);

    if (mode === 'cloud_only') {
      await enqueueUnprocessedReceipt({
        fileName,
        fileSize,
        mimeType,
        base64Data,
        previewUrl,
        initialError: errMsg,
        engineUsed: 'cloud_api',
        status: 'pending',
      });
      throw new Error(
        'Connection was interrupted. Your receipt photo was saved to Pending Scans so you can retry shortly.'
      );
    }

    const switchMessage = 'Finishing scan directly on your phone...';
    if (options.onStage) {
      options.onStage(switchMessage);
    }

    const onDevice = await performBestOnDeviceOcr({
      base64Data,
      mimeType,
      fileName,
      preferredCurrency,
      onStage: options.onStage,
    });

    if (options.onEngineSwitched) {
      options.onEngineSwitched(onDevice.engineUsed, switchMessage);
    }

    let cachedJobId: string | undefined;
    if (!onDevice.hadText || onDevice.receipts.every((r) => (r.total_amount || 0) === 0)) {
      const cachedJob = await enqueueUnprocessedReceipt({
        fileName,
        fileSize,
        mimeType,
        base64Data,
        previewUrl,
        initialError: errMsg,
        engineUsed: onDevice.engineUsed,
        extractedReceipts: onDevice.receipts,
        status: 'fallback_extracted',
      });
      cachedJobId = cachedJob.id;
    }

    return {
      receipts: onDevice.receipts,
      engineUsed: onDevice.engineUsed,
      fallbackTriggered: true,
      warning: onDevice.hadText
        ? 'Scanned on your device while cloud service was busy — please check the total before saving.'
        : 'Receipt photo captured. Please confirm the store name and amount below.',
      cachedJobId,
    };
  }
}

let workerIntervalId: any = null;
let isWorkerRunning = false;

export function startBackgroundQueueWorker(
  onSyncEvent?: (job: CachedReceiptJob, success: boolean) => void
): () => void {
  if (!hasConfiguredCloudOcrEndpoint()) {
    return () => {};
  }

  if (workerIntervalId) {
    return () => stopBackgroundQueueWorker();
  }

  const runWorkerCycle = async () => {
    if (isWorkerRunning) return;
    if (!hasConfiguredCloudOcrEndpoint()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    isWorkerRunning = true;
    try {
      const eligibleJobs = await getPendingRetryJobs();
      if (eligibleJobs.length === 0) return;

      for (const job of eligibleJobs) {
        try {
          await updateQueueJob(job.id, { status: 'processing' });
          const receipts = await callSmartOcrWithTimeout(
            job.base64Data,
            job.mimeType,
            15000,
            getPreferredCurrency()
          );

          if (receipts && receipts.length > 0) {
            await updateQueueJob(job.id, {
              status: 'completed',
              engineUsed: 'cloud_api',
              extractedReceipts: receipts,
            });
            if (onSyncEvent) onSyncEvent(job, true);
          } else {
            throw new Error('No receipt items extracted');
          }
        } catch (retryErr: any) {
          await recordJobFailure(job.id, retryErr?.message || 'Retry attempt failed');
          if (onSyncEvent) onSyncEvent(job, false);
        }
      }
    } finally {
      isWorkerRunning = false;
    }
  };

  const initialTimer = setTimeout(runWorkerCycle, 3000);
  workerIntervalId = setInterval(runWorkerCycle, 20000);

  const handleOnline = () => {
    runWorkerCycle();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }

  return () => {
    clearTimeout(initialTimer);
    stopBackgroundQueueWorker();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
    }
  };
}

export function stopBackgroundQueueWorker(): void {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
  }
}
