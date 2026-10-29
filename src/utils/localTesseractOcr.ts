import { createWorker, type Worker } from 'tesseract.js';
import type { ReceiptData } from '../types';
import {
  extractInvoiceNumberFromText,
  parseReceiptFromSpatialOrText,
  selectBestParsedReceipts,
  type OcrSpatialBox,
  type OcrSpatialPage,
} from './receiptLayoutParser';
import { createFoldFlattenedOcrImage } from './imageUtils';

export { extractInvoiceNumberFromText };

let cachedWorker: Worker | null = null;
let isInitializingWorker = false;

export interface LocalOcrProgress {
  status: string;
  progress: number;
}

function getLocalTesseractAssets(): { workerPath: string; corePath: string; langPath: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/[^/]*$/, '/');
    const basePath = new URL(pathname, origin).href.replace(/\/$/, '');
    return {
      workerPath: `${basePath}/tesseract/worker.min.js`,
      corePath: `${basePath}/tesseract/tesseract-core.wasm.js`,
      langPath: `${basePath}/tesseract`,
    };
  } catch (e) {
    console.warn('[LocalTesseract] Failed to resolve local base URL:', e);
    return null;
  }
}

async function getTesseractWorker(onProgress?: (p: LocalOcrProgress) => void): Promise<Worker> {
  if (cachedWorker) {
    return cachedWorker;
  }

  if (isInitializingWorker) {
    while (isInitializingWorker) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (cachedWorker) return cachedWorker;
  }

  isInitializingWorker = true;
  const localAssets = getLocalTesseractAssets();

  if (localAssets) {
    try {
      if (onProgress) {
        onProgress({ status: 'Initializing on-device OCR engine...', progress: 0.1 });
      }
      const worker = await createWorker('eng', 1, {
        workerPath: localAssets.workerPath,
        corePath: localAssets.corePath,
        langPath: localAssets.langPath,
        gzip: true,
        logger: (m) => {
          if (onProgress && m.status) {
            const prog = typeof m.progress === 'number' ? m.progress : 0.5;
            onProgress({
              status:
                m.status === 'recognizing text'
                  ? `Reading receipt items (${Math.round(prog * 100)}%)...`
                  : m.status,
              progress: prog,
            });
          }
        },
      });
      cachedWorker = worker;
      return worker;
    } catch (localErr) {
      console.warn('[LocalTesseract] Local bundled asset loading failed, trying CDN fallback:', localErr);
    } finally {
      if (cachedWorker) {
        isInitializingWorker = false;
      }
    }
  }

  try {
    if (onProgress) {
      onProgress({ status: 'Connecting OCR engine via fallback...', progress: 0.2 });
    }
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (onProgress && m.status) {
          const prog = typeof m.progress === 'number' ? m.progress : 0.5;
          onProgress({
            status:
              m.status === 'recognizing text'
                ? `Reading receipt items (${Math.round(prog * 100)}%)...`
                : m.status,
            progress: prog,
          });
        }
      },
    });
    cachedWorker = worker;
    return worker;
  } finally {
    isInitializingWorker = false;
  }
}

function extractTesseractSpatialPage(data: any): OcrSpatialPage | null {
  if (!data) return null;

  const lines: OcrSpatialBox[] = [];
  const elements: OcrSpatialBox[] = [];
  let maxX = 0;
  let maxY = 0;

  if (Array.isArray(data.lines)) {
    for (const ln of data.lines) {
      const txt = String(ln?.text || '').trim();
      const bbox = ln?.bbox;
      if (txt && bbox && bbox.x1 > bbox.x0 && bbox.y1 > bbox.y0) {
        let slope = 0;
        const bl = ln?.baseline;
        if (bl && typeof bl.x1 === 'number' && typeof bl.x0 === 'number' && bl.x1 - bl.x0 > 12) {
          const s = (bl.y1 - bl.y0) / (bl.x1 - bl.x0);
          if (Math.abs(s) <= 0.36) slope = s;
        }
        lines.push({
          text: txt,
          left: bbox.x0,
          top: bbox.y0,
          right: bbox.x1,
          bottom: bbox.y1,
          slope,
        });
        if (bbox.x1 > maxX) maxX = bbox.x1;
        if (bbox.y1 > maxY) maxY = bbox.y1;
      }
    }
  }

  if (Array.isArray(data.words)) {
    for (const wd of data.words) {
      const txt = String(wd?.text || '').trim();
      const bbox = wd?.bbox;
      if (txt && bbox && bbox.x1 > bbox.x0 && bbox.y1 > bbox.y0) {
        let slope = 0;
        const bl = wd?.baseline;
        if (bl && typeof bl.x1 === 'number' && typeof bl.x0 === 'number' && bl.x1 - bl.x0 > 12) {
          const s = (bl.y1 - bl.y0) / (bl.x1 - bl.x0);
          if (Math.abs(s) <= 0.36) slope = s;
        }
        elements.push({
          text: txt,
          left: bbox.x0,
          top: bbox.y0,
          right: bbox.x1,
          bottom: bbox.y1,
          slope,
        });
        if (bbox.x1 > maxX) maxX = bbox.x1;
        if (bbox.y1 > maxY) maxY = bbox.y1;
      }
    }
  }

  if (lines.length === 0 && elements.length === 0) return null;

  return {
    width: Math.max(400, maxX + 20),
    height: Math.max(400, maxY + 20),
    text: String(data.text || ''),
    rawText: String(data.text || ''),
    lines,
    elements,
  };
}

async function runSingleTesseractPass(
  base64Data: string,
  mimeType: string,
  onProgress?: (stage: string) => void
): Promise<{ text: string; spatialPage: OcrSpatialPage | null }> {
  const fullDataUrl = base64Data.startsWith('data:')
    ? base64Data
    : `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

  try {
    const worker = await getTesseractWorker((p) => {
      if (onProgress) onProgress(p.status);
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Tesseract OCR timed out after 25s')), 25000);
    });

    const result: any = await Promise.race([
      worker.recognize(fullDataUrl, {}, { text: true, blocks: true }),
      timeoutPromise,
    ]);

    const rawText = String(result?.data?.text || '');
    const spatialPage = extractTesseractSpatialPage(result?.data);
    return { text: rawText, spatialPage };
  } catch (err) {
    console.warn('[LocalTesseract] OCR pass encountered an issue:', err);
    if (cachedWorker) {
      try {
        await cachedWorker.terminate();
      } catch {}
      cachedWorker = null;
    }
    return { text: '', spatialPage: null };
  }
}

/**
 * Performs dual-pass curvature-aware local Tesseract OCR:
 * Pass 1: Runs on illumination-flattened (fold-shadow removed) image for maximum thermal ink clarity
 * Pass 2: If Pass 1 does not cleanly reconcile item totals, runs a comparison pass on the natural image
 *         and selects whichever pass produced superior item-to-amount pairing.
 */
export async function performLocalTesseractStructuredScan(params: {
  base64Data: string;
  mimeType: string;
  fileName?: string;
  preferredCurrency?: string;
  onProgress?: (stage: string) => void;
}): Promise<{ receipts: ReceiptData[]; hadText: boolean }> {
  const {
    base64Data,
    mimeType,
    fileName,
    preferredCurrency = 'ZAR',
    onProgress,
  } = params;

  if (onProgress) {
    onProgress('Flattening fold shadows & enhancing ink...');
  }
  const flattenedB64 = await createFoldFlattenedOcrImage(base64Data, mimeType);

  if (onProgress) {
    onProgress('Reading item descriptions & amounts...');
  }
  const passFlattened = await runSingleTesseractPass(flattenedB64, 'image/jpeg', onProgress);
  const candFlattened = parseReceiptFromSpatialOrText({
    rawText: passFlattened.text,
    spatialPage: passFlattened.spatialPage,
    originalFileName: fileName,
    preferredCurrency,
    engineLabel: 'local_tesseract',
  });

  // If the flattened pass already reconciled cleanly with real line items, return immediately!
  if (candFlattened.reconciled && candFlattened.qualityScore >= 75) {
    return {
      receipts: candFlattened.receipts,
      hadText: Boolean(passFlattened.text.trim()),
    };
  }

  // Otherwise run Pass 2 on the natural image and pick whichever pass best separated items & amounts
  if (onProgress) {
    onProgress('Cross-checking curved lines & item amounts...');
  }
  const passRaw = await runSingleTesseractPass(base64Data, mimeType, onProgress);
  const candRaw = parseReceiptFromSpatialOrText({
    rawText: passRaw.text,
    spatialPage: passRaw.spatialPage,
    originalFileName: fileName,
    preferredCurrency,
    engineLabel: 'local_tesseract',
  });

  const best = selectBestParsedReceipts([candFlattened, candRaw]);
  return {
    receipts: best.receipts,
    hadText: Boolean(passFlattened.text.trim() || passRaw.text.trim()),
  };
}

export async function performLocalTesseractOcr(
  base64Data: string,
  mimeType: string,
  onProgress?: (stage: string) => void
): Promise<string> {
  const flattenedB64 = await createFoldFlattenedOcrImage(base64Data, mimeType);
  const res = await runSingleTesseractPass(flattenedB64, 'image/jpeg', onProgress);
  return res.text;
}

export interface LocalParseOptions {
  preferredCurrency?: string;
  engineLabel?: 'native_mlkit' | 'local_tesseract';
  spatialPage?: OcrSpatialPage | null;
}

export function parseLocalOcrTextToReceipts(
  rawText: string,
  originalFileName?: string,
  options: LocalParseOptions = {}
): ReceiptData[] {
  return parseReceiptFromSpatialOrText({
    rawText,
    spatialPage: options.spatialPage || null,
    originalFileName,
    preferredCurrency: options.preferredCurrency || 'ZAR',
    engineLabel: options.engineLabel || 'local_tesseract',
  }).receipts;
}
