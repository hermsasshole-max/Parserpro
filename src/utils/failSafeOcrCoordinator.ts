import type { ReceiptData, OcrEngineType, OcrEngineMode, CachedReceiptJob } from '../types';
import { performLocalTesseractOcr, parseLocalOcrTextToReceipts } from './localTesseractOcr';
import {
  enqueueUnprocessedReceipt,
  updateQueueJob,
  recordJobFailure,
  getPendingRetryJobs,
} from './offlineOcrQueue';
import { parseMultipleReceiptsViaServer } from './geminiVision';
import { getPreferredCurrency } from './currencyFormat';

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
  return 14000;
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
    return receipts.map((r) => ({ ...r, engine_used: 'cloud_api' }));
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Consumer-friendly smart receipt scanner with seamless offline fallback:
 * Automatically reads receipts via the smart cloud scanner when online, and seamlessly
 * falls back to on-device offline reading if there is no signal or a slow connection.
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

  // Offline or forced on-device mode
  if (mode === 'local_tesseract_only' || !isOnline) {
    const offlineReason = !isOnline
      ? 'No internet connection — reading receipt directly on your phone.'
      : 'Offline reading mode active.';

    if (options.onEngineSwitched) {
      options.onEngineSwitched('local_tesseract', offlineReason);
    }
    if (options.onStage) {
      options.onStage('Reading receipt offline on your phone...');
    }

    const rawText = await performLocalTesseractOcr(base64Data, mimeType, () => {
      if (options.onStage) options.onStage('Reading items offline...');
    });
    const parsedReceipts = parseLocalOcrTextToReceipts(rawText, fileName).map((r) => ({
      ...r,
      currency: r.currency || preferredCurrency,
    }));

    const cachedJob = await enqueueUnprocessedReceipt({
      fileName,
      fileSize,
      mimeType,
      base64Data,
      previewUrl,
      initialError: offlineReason,
      engineUsed: 'local_tesseract',
      extractedReceipts: parsedReceipts,
      status: 'fallback_extracted',
    });

    return {
      receipts: parsedReceipts,
      engineUsed: 'local_tesseract',
      fallbackTriggered: true,
      warning: 'Scanned offline on your device. Please review store name and total before saving.',
      cachedJobId: cachedJob.id,
    };
  }

  // Online smart scan with automatic offline fallback
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
      throw new Error('Connection was interrupted. Your receipt photo was saved to Pending Scans so you can retry shortly.');
    }

    const switchMessage = 'Slow connection detected — finishing scan directly on your phone...';
    if (options.onEngineSwitched) {
      options.onEngineSwitched('local_tesseract', switchMessage);
    }
    if (options.onStage) {
      options.onStage(switchMessage);
    }

    const cachedJob = await enqueueUnprocessedReceipt({
      fileName,
      fileSize,
      mimeType,
      base64Data,
      previewUrl,
      initialError: errMsg,
      engineUsed: 'local_tesseract',
      status: 'processing',
    });

    try {
      const rawText = await performLocalTesseractOcr(base64Data, mimeType, () => {
        if (options.onStage) options.onStage('Finishing scan on your phone...');
      });
      const parsedReceipts = parseLocalOcrTextToReceipts(rawText, fileName).map((r) => ({
        ...r,
        currency: r.currency || preferredCurrency,
      }));

      await updateQueueJob(cachedJob.id, {
        status: 'fallback_extracted',
        engineUsed: 'local_tesseract',
        extractedReceipts: parsedReceipts,
      });

      return {
        receipts: parsedReceipts,
        engineUsed: 'local_tesseract',
        fallbackTriggered: true,
        warning: 'Scanned offline due to weak signal. Quickly check the total before saving.',
        cachedJobId: cachedJob.id,
      };
    } catch {
      const safeFallback = parseLocalOcrTextToReceipts('', fileName).map((r) => ({
        ...r,
        currency: preferredCurrency,
      }));
      await updateQueueJob(cachedJob.id, {
        status: 'fallback_extracted',
        engineUsed: 'local_tesseract',
        extractedReceipts: safeFallback,
      });
      return {
        receipts: safeFallback,
        engineUsed: 'local_tesseract',
        fallbackTriggered: true,
        warning: 'Receipt photo captured offline. Please confirm store name and amount below.',
        cachedJobId: cachedJob.id,
      };
    }
  }
}

let workerIntervalId: any = null;
let isWorkerRunning = false;

export function startBackgroundQueueWorker(
  onSyncEvent?: (job: CachedReceiptJob, success: boolean) => void
): () => void {
  if (workerIntervalId) {
    return () => stopBackgroundQueueWorker();
  }

  const runWorkerCycle = async () => {
    if (isWorkerRunning) return;
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
