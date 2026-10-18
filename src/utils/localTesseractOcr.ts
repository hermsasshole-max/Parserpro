import { createWorker, type Worker } from 'tesseract.js';
import type { ReceiptData, LineItem, ReceiptCategory } from '../types';

let cachedWorker: Worker | null = null;
let isInitializingWorker = false;
let workerInitializationFailed = false;

export interface LocalOcrProgress {
  status: string;
  progress: number;
}

/**
 * Resolves local bundled Tesseract assets from public directory.
 * Ensures compatibility with root paths, GitHub Pages subpaths, and Android Capacitor WebView.
 */
function getLocalTesseractAssets(): { workerPath: string; corePath: string; langPath: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const origin = window.location.origin;
    const pathname = window.location.pathname.replace(/\/[^/]*$/, '/');
    const basePath = new URL(pathname, origin).href.replace(/\/$/, '');
    return {
      workerPath: `${basePath}/tesseract/worker.min.js`,
      corePath: `${basePath}/tesseract/tesseract-core.wasm.js`,
      langPath: `${basePath}/tesseract`
    };
  } catch (e) {
    console.warn('[LocalTesseract] Failed to resolve local base URL:', e);
    return null;
  }
}

/**
 * Gets or initializes a singleton Tesseract Web Worker with multi-tier failover:
 * Tier 1: Local bundled files in /public/tesseract/ (works 100% offline)
 * Tier 2: CDN fallback (if local path is blocked by unusual CSP)
 */
async function getTesseractWorker(onProgress?: (p: LocalOcrProgress) => void): Promise<Worker> {
  if (cachedWorker) {
    return cachedWorker;
  }

  if (isInitializingWorker) {
    while (isInitializingWorker) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (cachedWorker) return cachedWorker;
  }

  isInitializingWorker = true;
  workerInitializationFailed = false;

  const localAssets = getLocalTesseractAssets();

  // Tier 1: Attempt local bundled offline assets
  if (localAssets) {
    try {
      if (onProgress) {
        onProgress({ status: 'Initializing on-device OCR engine...', progress: 0.1 });
      }

      console.log('[LocalTesseract] Loading local offline assets from:', localAssets.langPath);
      const worker = await createWorker('eng', 1, {
        workerPath: localAssets.workerPath,
        corePath: localAssets.corePath,
        langPath: localAssets.langPath,
        gzip: true,
        logger: (m) => {
          if (onProgress && m.status) {
            const prog = typeof m.progress === 'number' ? m.progress : 0.5;
            onProgress({
              status: m.status === 'recognizing text' 
                ? `Reading receipt text (${Math.round(prog * 100)}%)...`
                : m.status,
              progress: prog
            });
          }
        }
      });

      cachedWorker = worker;
      return worker;
    } catch (localErr) {
      console.warn('[LocalTesseract] Local bundled asset loading failed, trying CDN fallback:', localErr);
    }
  }

  // Tier 2: CDN fallback
  try {
    if (onProgress) {
      onProgress({ status: 'Connecting OCR engine via fallback...', progress: 0.2 });
    }

    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (onProgress && m.status) {
          const prog = typeof m.progress === 'number' ? m.progress : 0.5;
          onProgress({
            status: m.status === 'recognizing text' 
              ? `Reading receipt text (${Math.round(prog * 100)}%)...`
              : m.status,
            progress: prog
          });
        }
      }
    });

    cachedWorker = worker;
    return worker;
  } catch (cdnErr) {
    console.error('[LocalTesseract] All Tesseract worker initializations failed:', cdnErr);
    workerInitializationFailed = true;
    throw cdnErr;
  } finally {
    isInitializingWorker = false;
  }
}

/**
 * Performs on-device local OCR using Tesseract WebAssembly.
 * Fully offline - does not send any data to external servers.
 * Includes timeout and safe fallback so scanning NEVER crashes.
 */
export async function performLocalTesseractOcr(
  base64Data: string,
  mimeType: string,
  onProgress?: (stage: string) => void
): Promise<string> {
  const fullDataUrl = base64Data.startsWith('data:')
    ? base64Data
    : `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

  try {
    const worker = await getTesseractWorker((p) => {
      if (onProgress) onProgress(p.status);
    });

    if (onProgress) onProgress('Scanning receipt layout with Tesseract...');

    // 25-second timeout protection for low-end devices
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Tesseract OCR timed out after 25s')), 25000);
    });

    const recognizePromise = worker.recognize(fullDataUrl);
    const result = await Promise.race([recognizePromise, timeoutPromise]);

    return result?.data?.text || '';
  } catch (err: any) {
    console.warn('[LocalTesseract] OCR recognition encountered an issue:', err);
    // Reset worker in case it crashed
    if (cachedWorker) {
      try {
        await cachedWorker.terminate();
      } catch (e) {}
      cachedWorker = null;
    }
    // Return empty string to trigger graceful receipt synthesis
    return '';
  }
}

/**
 * Known South African and popular retail vendors for accurate dictionary matching
 */
const KNOWN_VENDORS = [
  'Pick n Pay', 'Pick n Pay Express', 'Checkers', 'Checkers Hyper', 'Shoprite',
  'Woolworths', 'Woolworths Food', 'Spar', 'SUPERSPAR', 'KWIKSPAR',
  'Food Lover\'s Market', 'Food Lovers', 'Makro', 'Game', 'Dis-Chem', 'Clicks',
  'Eskom', 'City Power', 'Tshwane Electricity', 'Ethekwini Electricity',
  'Engen', 'Shell', 'TotalEnergies', 'BP', 'Sasol', 'Caltex', 'Astron Energy',
  'Builders Warehouse', 'Builders Express', 'Chamberlains', 'Mica Hardware',
  'Leroy Merlin', 'Cashbuild', 'Agrimark', 'Kaap Agri',
  'McDonald\'s', 'KFC', 'Nando\'s', 'Steers', 'Debonairs Pizza', 'Wimpy',
  'Rayton Express', 'Rayton Pharmacy', 'Clicks Pharmacy', 'Total Garage'
];

/**
 * Parses raw text extracted by local Tesseract into structured ReceiptData objects.
 * If text is empty or unreadable, creates a valid, clean, editable slip so the user is never blocked.
 */
export function parseLocalOcrTextToReceipts(rawText: string, originalFileName?: string): ReceiptData[] {
  if (!rawText || rawText.trim().length === 0) {
    return [createDefaultReceipt('Household Store Purchase', 'Food & Groceries', originalFileName)];
  }

  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return [createDefaultReceipt('Household Store Purchase', 'Food & Groceries', originalFileName)];
  }

  // 1. Detect Vendor Name
  let vendorName = '';
  const fullTextUpper = rawText.toUpperCase();

  // Check known vendor dictionary first
  for (const v of KNOWN_VENDORS) {
    if (fullTextUpper.includes(v.toUpperCase())) {
      vendorName = v;
      break;
    }
  }

  // If not in dictionary, check first 6 lines for store header
  if (!vendorName) {
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const line = lines[i];
      if (
        /^\d+$/.test(line) ||
        /tel:|fax:|vat|tax|invoice|date|cashier|slip/i.test(line) ||
        line.length < 3 ||
        line.length > 45
      ) {
        continue;
      }
      const clean = line.replace(/[^a-zA-Z0-9\s&'-]/g, '').trim();
      if (clean.length >= 3) {
        vendorName = clean;
        break;
      }
    }
  }

  if (!vendorName) {
    vendorName = 'Local Store Purchase';
  }

  // 2. Detect Invoice Date
  let invoiceDate = new Date().toISOString().split('T')[0];
  let monthYear = invoiceDate.substring(0, 7);

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = rawText.match(/\b(202[0-9])[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12][0-9]|3[01])\b/);
  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = rawText.match(/\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[0-2])[-/.](202[0-9]|2[0-9])\b/);
  // Match DD Mon YYYY e.g. 24 Sep 2026
  const monMatch = rawText.match(/\b(0[1-9]|[12][0-9]|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(202[0-9]|2[0-9])\b/i);

  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2];
    const d = ymdMatch[3];
    invoiceDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    monthYear = `${y}-${m.padStart(2, '0')}`;
  } else if (dmyMatch) {
    let y = dmyMatch[3];
    if (y.length === 2) y = `20${y}`;
    const m = dmyMatch[2];
    const d = dmyMatch[1];
    invoiceDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    monthYear = `${y}-${m.padStart(2, '0')}`;
  } else if (monMatch) {
    const d = monMatch[1];
    const monStr = monMatch[2].toLowerCase();
    let y = monMatch[3];
    if (y.length === 2) y = `20${y}`;
    const monthsMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const m = monthsMap[monStr.substring(0, 3)] || '01';
    invoiceDate = `${y}-${m}-${d.padStart(2, '0')}`;
    monthYear = `${y}-${m}`;
  }

  // 3. Detect Amounts & Total
  let totalAmount = 0;
  let subtotal = 0;
  let tax = 0;
  const potentialTotals: number[] = [];

  const totalKeywordsRegex = /(?:GRAND\s*TOTAL|TOTAL\s*DUE|AMOUNT\s*DUE|BALANCE\s*DUE|TOTAL|AMOUNT|TOTAAL|CARD|CASH|PAID)\s*[:=]?\s*(?:R|ZAR|\$)?\s*([0-9]+[.,][0-9]{2})/gi;
  let match;
  while ((match = totalKeywordsRegex.exec(rawText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0 && val < 500000) {
      potentialTotals.push(val);
    }
  }

  const vatRegex = /(?:VAT|TAX)\s*(?:15%|14%)?\s*[:=]?\s*(?:R|ZAR|\$)?\s*([0-9]+[.,][0-9]{2})/gi;
  while ((match = vatRegex.exec(rawText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      tax = val;
    }
  }

  const subtotalRegex = /(?:SUBTOTAL|SUB\s*TOTAL|NET\s*TOTAL)\s*[:=]?\s*(?:R|ZAR|\$)?\s*([0-9]+[.,][0-9]{2})/gi;
  while ((match = subtotalRegex.exec(rawText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      subtotal = val;
    }
  }

  if (potentialTotals.length > 0) {
    totalAmount = Math.max(...potentialTotals);
  }

  // 4. Extract Line Items
  const lineItems: LineItem[] = [];
  const lineItemRegex = /^([A-Za-z0-9#&%*+/'\s-]{3,35})\s+(?:R|ZAR|\$)?\s*([0-9]+[.,][0-9]{2})$/;

  for (const line of lines) {
    if (/total|subtotal|balance|due|vat|tax|cashier|invoice|date|change|slip|tel:|card|auth/i.test(line)) {
      continue;
    }

    const itemMatch = line.match(lineItemRegex);
    if (itemMatch) {
      const desc = itemMatch[1].replace(/^[\d*#\s-]+/, '').trim();
      const price = parseFloat(itemMatch[2].replace(',', '.'));
      if (desc.length >= 2 && !isNaN(price) && price > 0 && price < 25000) {
        let qty = 1;
        const qtyMatch = desc.match(/^(\d+)\s*[xX]?\s+(.+)$/);
        let finalDesc = desc;
        if (qtyMatch) {
          qty = parseInt(qtyMatch[1], 10) || 1;
          finalDesc = qtyMatch[2];
        }

        lineItems.push({
          description: finalDesc,
          quantity: qty,
          unit_price: parseFloat((price / qty).toFixed(2)),
          total_price: price
        });
      }
    }
  }

  if (totalAmount === 0 && lineItems.length > 0) {
    totalAmount = lineItems.reduce((acc, item) => acc + item.total_price, 0);
    totalAmount = parseFloat(totalAmount.toFixed(2));
  }

  if (subtotal === 0) {
    subtotal = tax > 0 && totalAmount > tax ? parseFloat((totalAmount - tax).toFixed(2)) : totalAmount;
  }

  // 5. Automatic Categorization
  const category = classifyReceiptCategory(vendorName, rawText);

  if (lineItems.length === 0 && totalAmount > 0) {
    lineItems.push({
      description: `${vendorName} Purchase`,
      quantity: 1,
      unit_price: totalAmount,
      total_price: totalAmount
    });
  }

  const receipt: ReceiptData = {
    vendor_name: vendorName,
    invoice_date: invoiceDate,
    month_year: monthYear,
    category,
    currency: 'ZAR',
    line_items: lineItems,
    subtotal,
    tax,
    total_amount: totalAmount,
    notes: '⚡ Extracted locally via on-device Tesseract OCR engine (fail-safe fallback).',
    engine_used: 'local_tesseract'
  };

  return [receipt];
}

/**
 * Intelligent categorization based on vendor name and slip text
 */
function classifyReceiptCategory(vendor: string, fullText: string): ReceiptCategory {
  const text = `${vendor} ${fullText}`.toLowerCase();

  // Electricity & Utilities
  if (
    text.includes('eskom') || text.includes('city power') || text.includes('electricity') ||
    text.includes('prepaid') || text.includes('kwh') || text.includes('token') ||
    text.includes('meter') || text.includes('water') || text.includes('municipality') ||
    text.includes('sewerage') || text.includes('rates') || text.includes('gas')
  ) {
    return 'Electricity & Utilities';
  }

  // Transport
  if (
    text.includes('petrol') || text.includes('diesel') || text.includes('unleaded') ||
    text.includes('fuel') || text.includes('litres') || text.includes('engen') ||
    text.includes('shell') || text.includes('sasol') || text.includes('totalenergies') ||
    text.includes('bp ') || text.includes('caltex') || text.includes('toll') ||
    text.includes('parking')
  ) {
    return 'Transport';
  }

  // Home Maintenance
  if (
    text.includes('builders') || text.includes('hardware') || text.includes('paint') ||
    text.includes('timber') || text.includes('cement') || text.includes('mica') ||
    text.includes('chamberlains') || text.includes('plumbing') || text.includes('tools') ||
    text.includes('screws') || text.includes('garden') || text.includes('diy')
  ) {
    return 'Home Maintenance';
  }

  // Food & Groceries
  if (
    text.includes('pick n pay') || text.includes('checkers') || text.includes('shoprite') ||
    text.includes('woolworths') || text.includes('spar') || text.includes('food') ||
    text.includes('grocery') || text.includes('bakery') || text.includes('butchery') ||
    text.includes('supermarket') || text.includes('milk') || text.includes('bread') ||
    text.includes('meat') || text.includes('cheese') || text.includes('fruit') ||
    text.includes('kfc') || text.includes('mcdonald') || text.includes('steers') ||
    text.includes('nando') || text.includes('wimpy')
  ) {
    return 'Food & Groceries';
  }

  return 'Other';
}

function createDefaultReceipt(vendor: string, category: ReceiptCategory, fileName?: string): ReceiptData {
  const today = new Date().toISOString().split('T')[0];
  return {
    vendor_name: vendor,
    invoice_date: today,
    month_year: today.substring(0, 7),
    category,
    currency: 'ZAR',
    line_items: [{
      description: fileName ? `Scanned Slip (${fileName})` : 'Household Expense',
      quantity: 1,
      unit_price: 0,
      total_price: 0
    }],
    subtotal: 0,
    tax: 0,
    total_amount: 0,
    notes: '⚡ Offline scan: Saved on device. Ready for review or background sync.',
    engine_used: 'local_tesseract'
  };
}
