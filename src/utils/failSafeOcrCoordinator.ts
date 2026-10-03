import type { ReceiptData, OcrEngineType, OcrEngineMode, CachedReceiptJob } from '../types';
import { performLocalTesseractOcr, parseLocalOcrTextToReceipts } from './localTesseractOcr';
import { 
  enqueueUnprocessedReceipt, 
  updateQueueJob, 
  recordJobFailure, 
  getPendingRetryJobs 
} from './offlineOcrQueue';
import { parseMultipleReceiptsWithGemini, getActiveGeminiApiKey } from './geminiVision';

const OCR_MODE_STORAGE_KEY = 'parserpro_ocr_engine_mode_v1';
const OCR_TIMEOUT_STORAGE_KEY = 'parserpro_ocr_timeout_ms_v1';

export function getStoredOcrMode(): OcrEngineMode {
  try {
    const val = localStorage.getItem(OCR_MODE_STORAGE_KEY);
    if (val === 'cloud_only' || val === 'local_tesseract_only') {
      return val;
    }
  } catch (e) {}
  return 'auto_fallback';
}

export function setStoredOcrMode(mode: OcrEngineMode): void {
  try {
    localStorage.setItem(OCR_MODE_STORAGE_KEY, mode);
  } catch (e) {}
}

export function getStoredApiTimeoutMs(): number {
  try {
    const val = localStorage.getItem(OCR_TIMEOUT_STORAGE_KEY);
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 5000 && num <= 60000) return num;
    }
  } catch (e) {}
  return 12000; // 12 seconds default fail-safe timeout
}

export function setStoredApiTimeoutMs(timeoutMs: number): void {
  try {
    localStorage.setItem(OCR_TIMEOUT_STORAGE_KEY, String(timeoutMs));
  } catch (e) {}
}

export interface FailSafeOptions {
  timeoutMs?: number;
  mode?: OcrEngineMode;
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

/**
 * Attempts to parse an image using the Cloud API (server proxy or client Gemini).
 * Races against an AbortController with the specified timeout.
 */
async function callCloudOcrWithTimeout(
  base64Data: string,
  mimeType: string,
  timeoutMs: number,
  onStage?: (stage: string) => void
): Promise<ReceiptData[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`API_TIMEOUT: Cloud OCR timed out after ${(timeoutMs / 1000).toFixed(0)} seconds.`));
  }, timeoutMs);

  try {
    // 1. First attempt: Server-side proxy route (/api/parse-receipt)
    let fileExtracted: ReceiptData[] = [];
    let serverErr: any = null;
    let isStaticOrNoBackend = false;

    try {
      if (onStage) onStage('Calling Cloud OCR API...');
      const res = await fetch('/api/parse-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: mimeType || 'image/jpeg',
        }),
        signal: controller.signal
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
          } catch {}
        }
      }

      if (json && typeof json === 'object') {
        if (res.ok) {
          if (Array.isArray(json.receipts) && json.receipts.length > 0) {
            fileExtracted = json.receipts;
          } else if (json.vendor_name) {
            fileExtracted = [json];
          } else {
            serverErr = new Error('No receipt records returned from cloud response');
          }
        } else {
          serverErr = new Error(json.error || `Server returned error status ${res.status}`);
        }
      } else {
        const lower = rawText.toLowerCase();
        if (lower.includes('<!doctype') || lower.includes('<html')) {
          isStaticOrNoBackend = true;
          serverErr = new Error('STATIC_HOST_NO_BACKEND');
        } else {
          serverErr = new Error(`Server returned HTTP ${res.status}`);
        }
      }
    } catch (netErr: any) {
      if (netErr?.name === 'AbortError' || netErr?.message?.includes('API_TIMEOUT')) {
        throw netErr;
      }
      isStaticOrNoBackend = true;
      serverErr = netErr;
    }

    if (fileExtracted.length > 0) {
      clearTimeout(timeoutId);
      return fileExtracted.map(r => ({ ...r, engine_used: 'cloud_api' }));
    }

    // 2. Client Gemini Vision fallback if static host or client key configured
    const clientKey = getActiveGeminiApiKey();
    if (clientKey) {
      if (onStage) onStage('Calling client-side Gemini Vision...');
      const geminiResults = await parseMultipleReceiptsWithGemini(
        base64Data,
        mimeType,
        {
          apiKey: clientKey,
          onProgress: onStage
        }
      );
      clearTimeout(timeoutId);
      return geminiResults.map(r => ({ ...r, engine_used: 'cloud_api' }));
    }

    if (serverErr) {
      throw serverErr;
    }

    throw new Error('Cloud OCR service unavailable.');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Main Fail-Safe Orchestrator:
 * Executes Cloud OCR with timeout, automatically switches to local Tesseract on timeout/failure,
 * and maintains an offline retry queue with exponential backoff.
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
    options = {}
  } = params;

  const mode = options.mode || getStoredOcrMode();
  const timeoutMs = options.timeoutMs || getStoredApiTimeoutMs();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Case A: User explicitly forced Local Tesseract OR device is offline
  if (mode === 'local_tesseract_only' || !isOnline) {
    const offlineReason = !isOnline 
      ? 'Device is currently offline.' 
      : 'Local Tesseract mode is enabled.';
    
    if (options.onEngineSwitched) {
      options.onEngineSwitched('local_tesseract', offlineReason);
    }
    if (options.onStage) {
      options.onStage(
        !isOnline 
          ? 'Device is offline. Running local on-device Tesseract OCR...' 
          : 'Running on-device Tesseract OCR...'
      );
    }

    console.log(`[FailSafeOCR] ${offlineReason} Running local Tesseract engine...`);
    const rawText = await performLocalTesseractOcr(base64Data, mimeType, options.onStage);
    const parsedReceipts = parseLocalOcrTextToReceipts(rawText, fileName);

    // Save job into cache as fallback_extracted
    const cachedJob = await enqueueUnprocessedReceipt({
      fileName,
      fileSize,
      mimeType,
      base64Data,
      previewUrl,
      initialError: offlineReason,
      engineUsed: 'local_tesseract',
      extractedReceipts: parsedReceipts,
      status: 'fallback_extracted'
    });

    return {
      receipts: parsedReceipts,
      engineUsed: 'local_tesseract',
      fallbackTriggered: true,
      warning: !isOnline 
        ? 'Offline Mode: Slip extracted using local on-device Tesseract engine.' 
        : 'Slip extracted using local on-device Tesseract engine.',
      cachedJobId: cachedJob.id
    };
  }

  // Case B: Auto Fail-Safe Mode (Try Cloud API with aggressive timeout, fallback to Tesseract)
  let cloudError: any = null;

  try {
    if (options.onStage) {
      options.onStage(`Contacting AI Cloud OCR (timeout: ${(timeoutMs / 1000).toFixed(0)}s)...`);
    }

    const cloudReceipts = await callCloudOcrWithTimeout(
      base64Data, 
      mimeType, 
      timeoutMs, 
      options.onStage
    );

    console.log(`[FailSafeOCR] Cloud OCR succeeded (${cloudReceipts.length} receipt(s) detected).`);
    return {
      receipts: cloudReceipts,
      engineUsed: 'cloud_api',
      fallbackTriggered: false
    };
  } catch (err: any) {
    cloudError = err;
    const errMsg = err?.message || String(err);
    const isTimeout = 
      err?.name === 'AbortError' || 
      errMsg.includes('API_TIMEOUT') || 
      errMsg.includes('timeout') || 
      errMsg.includes('timed out');

    console.warn(`[FailSafeOCR] Cloud OCR attempt failed (isTimeout=${isTimeout}):`, errMsg);

    // If mode is strictly cloud_only, fail and queue for retry
    if (mode === 'cloud_only') {
      const cached = await enqueueUnprocessedReceipt({
        fileName,
        fileSize,
        mimeType,
        base64Data,
        previewUrl,
        initialError: errMsg,
        engineUsed: 'cloud_api',
        status: 'pending'
      });
      throw new Error(`Cloud OCR error: ${errMsg}. Receipt saved to offline queue (#${cached.id.slice(-5)}).`);
    }

    // AUTO-FAILOVER: Switch to Local Tesseract OCR
    const switchReason = isTimeout
      ? `Cloud API timed out after ${(timeoutMs / 1000).toFixed(0)}s. Switching to local Tesseract OCR...`
      : `Cloud API unreachable (${errMsg}). Switching to local Tesseract OCR...`;

    if (options.onEngineSwitched) {
      options.onEngineSwitched('local_tesseract', switchReason);
    }
    if (options.onStage) {
      options.onStage(switchReason);
    }

    console.log(`[FailSafeOCR] Fail-safe triggered: ${switchReason}`);

    // Queue in background cache first for tracking and retry capability
    const cachedJob = await enqueueUnprocessedReceipt({
      fileName,
      fileSize,
      mimeType,
      base64Data,
      previewUrl,
      initialError: errMsg,
      engineUsed: 'local_tesseract',
      status: 'processing'
    });

    try {
      const rawText = await performLocalTesseractOcr(base64Data, mimeType, options.onStage);
      const parsedReceipts = parseLocalOcrTextToReceipts(rawText, fileName);

      // Update cache item with fallback extracted results
      await updateQueueJob(cachedJob.id, {
        status: 'fallback_extracted',
        engineUsed: 'local_tesseract',
        extractedReceipts: parsedReceipts
      });

      return {
        receipts: parsedReceipts,
        engineUsed: 'local_tesseract',
        fallbackTriggered: true,
        warning: isTimeout
          ? `⚡ Cloud API timed out (${(timeoutMs / 1000).toFixed(0)}s). Switched to Local Tesseract OCR!`
          : `⚡ Cloud OCR unavailable. Extracted offline with Local Tesseract OCR!`,
        cachedJobId: cachedJob.id
      };
    } catch (tesseractErr: any) {
      console.error('[FailSafeOCR] Local Tesseract fallback also encountered an issue:', tesseractErr);
      await recordJobFailure(cachedJob.id, `Tesseract error: ${tesseractErr?.message || String(tesseractErr)}`);
      throw new Error(`Cloud API failed (${errMsg}) and local OCR could not parse image. Receipt cached for background retry.`);
    }
  }
}

/**
 * Background Queue Worker:
 * Periodically processes pending cached receipts using exponential backoff retry.
 */
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
      return; // Skip cycle if offline
    }

    isWorkerRunning = true;
    try {
      const eligibleJobs = await getPendingRetryJobs();
      if (eligibleJobs.length === 0) return;

      console.log(`[QueueWorker] Found ${eligibleJobs.length} cached receipt(s) eligible for exponential backoff retry.`);

      for (const job of eligibleJobs) {
        try {
          await updateQueueJob(job.id, { status: 'processing' });
          console.log(`[QueueWorker] Retrying job ${job.id} (attempt ${job.attempts + 1}/${job.maxAttempts})...`);

          const receipts = await callCloudOcrWithTimeout(
            job.base64Data,
            job.mimeType,
            15000 // 15s timeout for background retries
          );

          if (receipts && receipts.length > 0) {
            await updateQueueJob(job.id, {
              status: 'completed',
              engineUsed: 'cloud_api',
              extractedReceipts: receipts
            });
            console.log(`[QueueWorker] Successfully processed job ${job.id} via Cloud API!`);
            if (onSyncEvent) onSyncEvent(job, true);
          } else {
            throw new Error('No receipt items extracted');
          }
        } catch (retryErr: any) {
          console.warn(`[QueueWorker] Retry for job ${job.id} failed:`, retryErr?.message);
          await recordJobFailure(job.id, retryErr?.message || 'Retry attempt failed');
          if (onSyncEvent) onSyncEvent(job, false);
        }
      }
    } catch (err) {
      console.error('[QueueWorker] Error during worker cycle:', err);
    } finally {
      isWorkerRunning = false;
    }
  };

  // Run initial cycle after 3 seconds
  const initialTimer = setTimeout(runWorkerCycle, 3000);

  // Periodic cycle every 20 seconds
  workerIntervalId = setInterval(runWorkerCycle, 20000);

  // Trigger cycle immediately when network reconnects
  const handleOnline = () => {
    console.log('[QueueWorker] Network connection restored. Triggering queue retry cycle...');
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
