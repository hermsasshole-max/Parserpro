import type { ReceiptData, OcrEngineType, OcrEngineMode, CachedReceiptJob } from '../types';
import { performLocalTesseractStructuredScan } from './localTesseractOcr';
import { isNativeMlKitAvailable, performNativeMlKitStructuredOcr } from './nativeReceiptOcr';
import {
  parseReceiptFromSpatialOrText,
  reconcileAndCleanReceiptItems,
  scoreParsedReceiptCandidate,
  selectBestParsedReceipts,
  type ParsedReceiptCandidate,
} from './receiptLayoutParser';
import { createFoldFlattenedOcrImage } from './imageUtils';
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
    const fingerprint = computeImageFingerprint(base64Data);
    return receipts.map((r) => {
      const { receipt: cleaned } = reconcileAndCleanReceiptItems(r);
      return {
        ...cleaned,
        engine_used: 'cloud_api',
        image_fingerprint: cleaned.image_fingerprint || fingerprint || undefined,
      };
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Runs the fastest, highest-accuracy curvature-aware on-device OCR engine available:
 * 1. Bundled Android Google ML Kit Dual-Pass Spatial OCR (compares crisp original vs shadow-flattened fold pass,
 *    using 2D bounding boxes + corner baseline slopes + monotonic DP price-to-item locking)
 * 2. Bundled WebAssembly Tesseract.js Dual-Pass Spatial OCR (illumination-flattened + curvature-rectified rows)
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

  // Tier A: Native Android ML Kit with 2D Spatial Geometry + Native Shadow-Flattened Pass
  if (await isNativeMlKitAvailable()) {
    try {
      const mlRes = await performNativeMlKitStructuredOcr(base64Data, onStage);
      if (mlRes) {
        const candidates: ParsedReceiptCandidate[] = [];

        if (mlRes.primary) {
          candidates.push(
            parseReceiptFromSpatialOrText({
              rawText: mlRes.primary.text || mlRes.text || mlRes.rawText || '',
              spatialPage: mlRes.primary,
              originalFileName: fileName,
              preferredCurrency,
              engineLabel: 'native_mlkit',
            })
          );
        }

        if (mlRes.enhanced) {
          candidates.push(
            parseReceiptFromSpatialOrText({
              rawText: mlRes.enhanced.text || mlRes.enhanced.rawText || '',
              spatialPage: mlRes.enhanced,
              originalFileName: fileName,
              preferredCurrency,
              engineLabel: 'native_mlkit',
            })
          );
        }

        if (candidates.length === 0 && (mlRes.text || mlRes.rawText)) {
          candidates.push(
            parseReceiptFromSpatialOrText({
              rawText: mlRes.text || mlRes.rawText,
              spatialPage: null,
              originalFileName: fileName,
              preferredCurrency,
              engineLabel: 'native_mlkit',
            })
          );
        }

        // If native ML Kit didn't return an enhanced pass and primary wasn't reconciled, try JS fold-flattened image in ML Kit
        const bestSoFar = selectBestParsedReceipts(candidates);
        if (!bestSoFar.reconciled && !mlRes.enhanced) {
          const jsFlattened = await createFoldFlattenedOcrImage(base64Data, mimeType);
          const mlFlatRes = await performNativeMlKitStructuredOcr(jsFlattened, onStage);
          if (mlFlatRes?.primary || mlFlatRes?.text) {
            candidates.push(
              parseReceiptFromSpatialOrText({
                rawText: mlFlatRes.primary?.text || mlFlatRes.text || '',
                spatialPage: mlFlatRes.primary || null,
                originalFileName: fileName,
                preferredCurrency,
                engineLabel: 'native_mlkit',
              })
            );
          }
        }

        const bestNative = selectBestParsedReceipts(candidates);
        const hadAnyNativeText = Boolean(
          (mlRes.text && mlRes.text.trim()) ||
            (mlRes.rawText && mlRes.rawText.trim()) ||
            (mlRes.enhanced?.text && mlRes.enhanced.text.trim())
        );

        if (hadAnyNativeText && bestNative.qualityScore > 0) {
          return {
            receipts: bestNative.receipts.map((r) => ({
              ...r,
              image_fingerprint: r.image_fingerprint || fingerprint || undefined,
            })),
            engineUsed: 'native_mlkit',
            hadText: true,
          };
        }
      }
    } catch (mlErr) {
      console.warn('[FailSafeOCR] Native ML Kit encountered an issue, trying spatial Tesseract fallback:', mlErr);
    }
  }

  // Tier B: Bundled WebAssembly Tesseract.js Dual-Pass Spatial OCR
  const tessScan = await performLocalTesseractStructuredScan({
    base64Data,
    mimeType,
    fileName,
    preferredCurrency,
    onProgress: (stage) => {
      if (onStage) onStage(stage || 'Reading folded lines & item amounts...');
    },
  });

  return {
    receipts: tessScan.receipts.map((r) => ({
      ...r,
      image_fingerprint: r.image_fingerprint || fingerprint || undefined,
    })),
    engineUsed: 'local_tesseract',
    hadText: tessScan.hadText,
  };
}

/**
 * 3-Tier Fail-Safe Receipt Scanner with Automatic Fold-Shadow & Curl Recovery:
 * 1. Smart Cloud Scanner (with automatic fold-flattened re-verification if crease shadows obscure items)
 * 2. Bundled Android Google ML Kit Dual-Pass 2D Spatial OCR
 * 3. Bundled WebAssembly Tesseract.js Dual-Pass 2D Spatial OCR
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
      options.onStage('Flattening fold shadows & reading items...');
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
        ? 'Scanned on your device with fold & curve alignment — confirm items and total below before saving.'
        : 'Receipt photo captured. Please enter or confirm the store name and total below.',
      cachedJobId,
    };
  }

  // Online smart scan with automatic fold-shadow enhancement retry + on-device spatial failover
  try {
    if (options.onStage) {
      options.onStage('Reading store, date, descriptions & item amounts...');
    }

    let cloudReceipts = await callSmartOcrWithTimeout(
      base64Data,
      mimeType,
      timeoutMs,
      preferredCurrency,
      options.onStage
    );

    // Check if severe fold shadows or paper curl caused missing/unreconciled items on Pass 1
    const primaryEval = scoreParsedReceiptCandidate(cloudReceipts);
    const hasWeakSingleSlip =
      cloudReceipts.length === 1 &&
      !primaryEval.reconciled &&
      (cloudReceipts[0].total_amount <= 0 ||
        (cloudReceipts[0].line_items?.length || 0) <= 1 ||
        reconcileAndCleanReceiptItems(cloudReceipts[0]).diffRatio > 0.16);

    if (hasWeakSingleSlip) {
      try {
        if (options.onStage) {
          options.onStage('Enhancing folded & curved lines for exact item matching...');
        }
        const flattenedB64 = await createFoldFlattenedOcrImage(base64Data, mimeType);
        const enhancedCloudReceipts = await callSmartOcrWithTimeout(
          flattenedB64,
          'image/jpeg',
          timeoutMs,
          preferredCurrency,
          options.onStage
        );
        const enhancedEval = scoreParsedReceiptCandidate(enhancedCloudReceipts);
        const bestCloud = selectBestParsedReceipts([
          {
            receipts: cloudReceipts,
            qualityScore: primaryEval.score,
            reconciled: primaryEval.reconciled,
          },
          {
            receipts: enhancedCloudReceipts,
            qualityScore: enhancedEval.score,
            reconciled: enhancedEval.reconciled,
          },
        ]);
        const origFp = computeImageFingerprint(base64Data);
        cloudReceipts = bestCloud.receipts.map((r) => ({
          ...r,
          image_fingerprint: origFp || r.image_fingerprint,
        }));
      } catch {
        // Keep primary cloudReceipts if secondary enhancement pass times out
      }
    }

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

    const switchMessage = 'Finishing scan with on-device fold & curve alignment...';
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
        ? 'Scanned on your device with fold & curve alignment — please check the items and total before saving.'
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
            16000,
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
