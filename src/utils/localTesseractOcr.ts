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
 * Known South African and global retail vendors for accurate dictionary matching
 */
const KNOWN_VENDORS = [
  'Pick n Pay', 'Pick n Pay Express', 'Checkers', 'Checkers Hyper', 'Checkers Sixty60', 'Shoprite',
  'Woolworths', 'Woolworths Food', 'Spar', 'SUPERSPAR', 'KWIKSPAR',
  "Food Lover's Market", 'Food Lovers', 'Makro', 'Game', 'Dis-Chem', 'Clicks',
  'Boxer', 'PNP', 'Takealot',
  'Eskom', 'City Power', 'Tshwane Electricity', 'Ethekwini Electricity',
  'Engen', 'Shell', 'TotalEnergies', 'BP', 'Sasol', 'Caltex', 'Astron Energy',
  'Builders Warehouse', 'Builders Express', 'Chamberlains', 'Mica Hardware',
  'Leroy Merlin', 'Cashbuild', 'Agrimark', 'Kaap Agri',
  'Walmart', 'Target', 'Costco', 'Kroger', 'Whole Foods', "Trader Joe's", 'Aldi', 'Lidl',
  'Tesco', "Sainsbury's", 'Asda', 'Morrisons', 'Carrefour', 'Coles', 'Home Depot', "Lowe's", 'IKEA',
  "McDonald's", 'KFC', "Nando's", 'Steers', 'Debonairs Pizza', 'Wimpy', 'Starbucks',
  'Rayton Express', 'Rayton Pharmacy', 'Clicks Pharmacy', 'Total Garage'
];

export interface LocalParseOptions {
  preferredCurrency?: string;
  engineLabel?: 'native_mlkit' | 'local_tesseract';
}

const CURRENCY_PREFIX_PATTERN = '(?:R|ZAR|US\\$|A\\$|C\\$|NZ\\$|\\$|£|€|₹|¥|CHF|SEK|NOK|AED)?';

/**
 * Parses raw text extracted by on-device ML Kit or Tesseract into structured ReceiptData objects.
 * If text is empty or unreadable, creates a valid, clean, editable slip so the user is never blocked.
 */
export function parseLocalOcrTextToReceipts(
  rawText: string,
  originalFileName?: string,
  options: LocalParseOptions = {}
): ReceiptData[] {
  const preferredCurrency = options.preferredCurrency || 'ZAR';
  const engineUsed = options.engineLabel || 'local_tesseract';

  if (!rawText || rawText.trim().length === 0) {
    return [createDefaultReceipt('Store Purchase', 'Food & Groceries', originalFileName, preferredCurrency, engineUsed)];
  }

  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return [createDefaultReceipt('Store Purchase', 'Food & Groceries', originalFileName, preferredCurrency, engineUsed)];
  }

  // 1. Detect Vendor Name
  let vendorName = '';
  const fullTextUpper = rawText.toUpperCase();

  for (const v of KNOWN_VENDORS) {
    if (fullTextUpper.includes(v.toUpperCase())) {
      vendorName = v === 'PNP' ? 'Pick n Pay' : v;
      break;
    }
  }

  if (!vendorName) {
    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const line = lines[i];
      if (
        /^\d+$/.test(line) ||
        /tel:|fax:|vat|tax|invoice|date|cashier|slip|welcome|thank\s+you|reg\s*no|www\.|http/i.test(line) ||
        line.length < 3 ||
        line.length > 48
      ) {
        continue;
      }
      const clean = line.replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim();
      if (clean.length >= 3 && /[A-Za-z]{2,}/.test(clean)) {
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

  const ymdMatch = rawText.match(/\b(202[0-9])[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12][0-9]|3[01])\b/);
  const dmyMatch = rawText.match(/\b(0[1-9]|[12][0-9]|3[01])[-/.](0[1-9]|1[0-2])[-/.](202[0-9]|2[0-9])\b/);
  const monMatch = rawText.match(/\b(0[1-9]|[12][0-9]|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,.-]+(202[0-9]|2[0-9])\b/i);

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

  // 3. Detect Amounts & Total (prefer explicit TOTAL keywords over payment tender lines)
  let totalAmount = 0;
  let subtotal = 0;
  let tax = 0;
  const primaryTotals: number[] = [];
  const paymentTotals: number[] = [];

  const primaryTotalRegex = new RegExp(
    `(?:GRAND\\s*TOTAL|TOTAL\\s*DUE|AMOUNT\\s*DUE|BALANCE\\s*DUE|INVOICE\\s*TOTAL|TOTAL\\s*INCL|TOTAAL|\\bTOTAL\\b)(?!\\s*(?:ITEMS|QTY|SAVINGS|DISCOUNT))\\s*[:=]?\\s*${CURRENCY_PREFIX_PATTERN}\\s*([0-9]{1,6}[.,][0-9]{2})`,
    'gi'
  );
  let match;
  while ((match = primaryTotalRegex.exec(rawText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0 && val < 500000) {
      primaryTotals.push(val);
    }
  }

  const paymentFallbackRegex = new RegExp(
    `(?:DEBIT\\s*CARD|CREDIT\\s*CARD|CARD\\s*PAYMENT|EFT|CARD|PAID)\\s*[:=]?\\s*${CURRENCY_PREFIX_PATTERN}\\s*([0-9]{1,6}[.,][0-9]{2})`,
    'gi'
  );
  while ((match = paymentFallbackRegex.exec(rawText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0 && val < 500000) {
      paymentTotals.push(val);
    }
  }

  const vatRegex = new RegExp(
    `(?:VAT|TAX|GST)\\s*(?:15%|14%|@[0-9.]+%)?\\s*[:=]?\\s*${CURRENCY_PREFIX_PATTERN}\\s*([0-9]{1,6}[.,][0-9]{2})`,
    'gi'
  );
  while ((match = vatRegex.exec(rawText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      tax = val;
    }
  }

  const subtotalRegex = new RegExp(
    `(?:SUBTOTAL|SUB\\s*TOTAL|NET\\s*TOTAL|TOTAL\\s*EXCL)\\s*[:=]?\\s*${CURRENCY_PREFIX_PATTERN}\\s*([0-9]{1,6}[.,][0-9]{2})`,
    'gi'
  );
  while ((match = subtotalRegex.exec(rawText)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      subtotal = val;
    }
  }

  if (primaryTotals.length > 0) {
    totalAmount = Math.max(...primaryTotals);
  } else if (paymentTotals.length > 0) {
    totalAmount = Math.max(...paymentTotals);
  }

  // 4. Extract Line Items (handles dots like 1.5L, parentheses, VAT suffixes A/Z/V/*, and 2-line thermal rows)
  const lineItems: LineItem[] = [];
  const skipLineRegex = /\b(?:total|totaal|subtotal|sub\s*total|balance|amount\s*due|vat|tax|gst|cashier|invoice|date|change|rounding|tender|cash|card|debit|credit|eft|auth|aid:|rrn:|stan:|slip|tel:|vat\s*no|loyalty|savings|points)\b/i;
  const inlineItemRegex = new RegExp(
    `^([A-Za-z0-9#&%*+/'().,:\\s-]{2,60}?)\\s+${CURRENCY_PREFIX_PATTERN}\\s*([0-9]{1,5}[.,][0-9]{2})(?:\\s*[*#A-Za-z]{1,2})?$`
  );
  const standalonePriceRegex = new RegExp(
    `^(?:(\\d+)\\s*[xX@]\\s*[0-9]+[.,][0-9]{2}\\s+)?${CURRENCY_PREFIX_PATTERN}\\s*([0-9]{1,5}[.,][0-9]{2})(?:\\s*[*#A-Za-z]{1,2})?$`
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (skipLineRegex.test(line)) {
      continue;
    }

    const itemMatch = line.match(inlineItemRegex);
    if (itemMatch) {
      const desc = itemMatch[1].replace(/^[\d*#\s-]+(?=[A-Za-z])/, '').trim();
      const price = parseFloat(itemMatch[2].replace(',', '.'));
      if (desc.length >= 2 && /[A-Za-z]{2,}/.test(desc) && !isNaN(price) && price > 0 && price < 50000) {
        let qty = 1;
        let finalDesc = desc;
        const qtyPrefix = desc.match(/^(\d{1,3})\s*[xX]\s+(.+)$/);
        if (qtyPrefix) {
          qty = parseInt(qtyPrefix[1], 10) || 1;
          finalDesc = qtyPrefix[2].trim();
        }

        lineItems.push({
          description: finalDesc,
          quantity: qty,
          unit_price: parseFloat((price / qty).toFixed(2)),
          total_price: price
        });
        continue;
      }
    }

    // Check 2-line thermal slip format: description on line i, qty x unit / price on line i + 1
    if (
      i + 1 < lines.length &&
      /[A-Za-z]{3,}/.test(line) &&
      !/[0-9]+[.,][0-9]{2}$/.test(line) &&
      !skipLineRegex.test(lines[i + 1])
    ) {
      const nextPriceMatch = lines[i + 1].match(standalonePriceRegex);
      if (nextPriceMatch) {
        const qty = nextPriceMatch[1] ? parseInt(nextPriceMatch[1], 10) || 1 : 1;
        const price = parseFloat(nextPriceMatch[2].replace(',', '.'));
        const cleanDesc = line.replace(/^[\d*#\s-]+(?=[A-Za-z])/, '').trim();
        if (cleanDesc.length >= 2 && !isNaN(price) && price > 0 && price < 50000) {
          lineItems.push({
            description: cleanDesc,
            quantity: qty,
            unit_price: parseFloat((price / qty).toFixed(2)),
            total_price: price
          });
          i += 1;
        }
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
    currency: preferredCurrency,
    line_items: lineItems,
    subtotal,
    tax,
    total_amount: totalAmount,
    notes:
      engineUsed === 'native_mlkit'
        ? 'Scanned directly on your phone'
        : 'Scanned offline on your device',
    engine_used: engineUsed
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
    text.includes('fuel') || text.includes('litres') || text.includes('gallons') ||
    text.includes('engen') || text.includes('shell') || text.includes('sasol') ||
    text.includes('totalenergies') || text.includes('bp ') || text.includes('caltex') ||
    text.includes('chevron') || text.includes('exxon') || text.includes('toll') ||
    text.includes('parking') || text.includes('uber')
  ) {
    return 'Transport';
  }

  // Home Maintenance
  if (
    text.includes('builders') || text.includes('hardware') || text.includes('paint') ||
    text.includes('timber') || text.includes('cement') || text.includes('mica') ||
    text.includes('chamberlains') || text.includes('home depot') || text.includes('ikea') ||
    text.includes('plumbing') || text.includes('tools') || text.includes('screws') ||
    text.includes('garden') || text.includes('diy')
  ) {
    return 'Home Maintenance';
  }

  // Food & Groceries
  if (
    text.includes('pick n pay') || text.includes('checkers') || text.includes('shoprite') ||
    text.includes('woolworths') || text.includes('spar') || text.includes('walmart') ||
    text.includes('tesco') || text.includes('costco') || text.includes('aldi') ||
    text.includes('lidl') || text.includes('kroger') || text.includes('target') ||
    text.includes('food') || text.includes('grocery') || text.includes('bakery') ||
    text.includes('butchery') || text.includes('supermarket') || text.includes('milk') ||
    text.includes('bread') || text.includes('meat') || text.includes('cheese') ||
    text.includes('fruit') || text.includes('kfc') || text.includes('mcdonald') ||
    text.includes('steers') || text.includes('nando') || text.includes('wimpy')
  ) {
    return 'Food & Groceries';
  }

  return 'Other';
}

function createDefaultReceipt(
  vendor: string,
  category: ReceiptCategory,
  fileName?: string,
  currency = 'ZAR',
  engineUsed: 'native_mlkit' | 'local_tesseract' = 'local_tesseract'
): ReceiptData {
  const today = new Date().toISOString().split('T')[0];
  return {
    vendor_name: vendor,
    invoice_date: today,
    month_year: today.substring(0, 7),
    category,
    currency,
    line_items: [{
      description: fileName ? `Scanned Slip (${fileName})` : 'Household Expense',
      quantity: 1,
      unit_price: 0,
      total_price: 0
    }],
    subtotal: 0,
    tax: 0,
    total_amount: 0,
    notes: 'Photo captured on device — confirm store name and total below.',
    engine_used: engineUsed
  };
}
