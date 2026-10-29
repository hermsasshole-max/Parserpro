import type { SavedReceipt } from '../types';

export interface DuplicateCandidateInput {
  id?: string;
  vendor_name: string;
  invoice_date: string;
  invoice_number?: string;
  total_amount: number | string;
  notes?: string;
  image_fingerprint?: string;
}

export interface DuplicateMatch {
  detectedReceiptId: string;
  matchedReceipt: SavedReceipt;
  confidence: 'exact' | 'high' | 'possible';
  matchReason: string;
  isBlocked: boolean;
  isBatchDuplicate: boolean;
  matchedFields: ('store' | 'date' | 'invoice_number' | 'amount' | 'image')[];
  matchedInvoiceNumber?: string;
}

/**
 * Computes a fast, deterministic fingerprint from a receipt image's base64 payload
 * so re-uploading or re-snapping the exact same image file is immediately caught.
 */
export function computeImageFingerprint(base64Data?: string): string {
  if (!base64Data) return '';
  const commaIdx = base64Data.indexOf(',');
  const raw = commaIdx !== -1 && base64Data.startsWith('data:')
    ? base64Data.slice(commaIdx + 1).trim()
    : base64Data.trim();

  if (raw.length < 64) return '';

  let hash1 = 0x811c9dc5;
  let hash2 = 0x01000193;
  const step = Math.max(1, Math.floor(raw.length / 512));

  for (let i = 0; i < raw.length; i += step) {
    const code = raw.charCodeAt(i);
    hash1 ^= code;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 ^= code + (i & 0xff);
    hash2 = Math.imul(hash2, 0x85ebca6b);
  }

  return `img_${raw.length.toString(36)}_${(hash1 >>> 0).toString(36)}_${(hash2 >>> 0).toString(36)}`;
}

/**
 * Normalizes vendor names for robust store matching
 * (e.g. "Pick 'n Pay", "Pick n Pay Supermarket", "PICK N PAY" -> "pick n pay")
 */
export function normalizeVendorName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['"’]/g, '')
    .replace(/\b(pty|ltd|inc|cc|supermarket|hypermarket|store|branch)\b/g, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const INVALID_INVOICE_TOKENS = new Set([
  '',
  'none',
  'na',
  'n/a',
  'null',
  'undefined',
  'unknown',
  'copy',
  'taxinvoice',
  'invoice',
  'receipt',
  'slip',
  'cash',
  '0',
  '00',
  '000',
]);

/**
 * Extracts an invoice/slip number from legacy notes if `invoice_number` wasn't stored separately.
 */
export function extractInvoiceNumberFromNotes(notes?: string): string {
  if (!notes) return '';
  if (/vat\s*(?:no|reg)/i.test(notes)) return '';
  const match = notes.match(
    /\b(?:tax\s*invoice|invoice|inv|receipt|rcpt|slip|doc|trans|txn|ref)\s*(?:no\.?|nr\.?|number|#|:)?\s*([A-Z0-9][A-Z0-9/-]{2,24})\b/i
  );
  if (!match) return '';
  const candidate = match[1].trim();
  if (/^(?:of|copy)$/i.test(candidate)) return '';
  return candidate;
}

/**
 * Normalizes printed invoice / receipt / slip numbers for exact comparison.
 * Strips common labels ("INV-", "Receipt #", spaces, slashes, leading zeros on pure numbers).
 */
export function normalizeInvoiceNumber(rawInvoice?: string, fallbackNotes?: string): string {
  const source = (rawInvoice && rawInvoice.trim()) || extractInvoiceNumberFromNotes(fallbackNotes);
  if (!source) return '';

  const cleaned = source
    .toLowerCase()
    .replace(/^(?:tax\s*invoice|invoice|inv|receipt|rcpt|slip|doc|trans|txn|till|ref)\s*(?:no\.?|nr\.?|number|#|:)?\s*/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  if (cleaned.length < 2 || INVALID_INVOICE_TOKENS.has(cleaned)) {
    return '';
  }

  // Require at least one digit so plain words like "groceries" or "copy" are never treated as invoice numbers
  if (!/\d/.test(cleaned)) {
    return '';
  }

  // Canonicalize pure numeric invoice numbers by stripping leading zeros (e.g. "004821" === "4821")
  if (/^\d+$/.test(cleaned)) {
    const stripped = cleaned.replace(/^0+/, '');
    return stripped || '0';
  }

  return cleaned;
}

export function getDisplayInvoiceNumber(item: { invoice_number?: string; notes?: string }): string {
  const explicit = (item.invoice_number || '').trim();
  if (explicit && normalizeInvoiceNumber(explicit)) {
    return explicit;
  }
  const fromNotes = extractInvoiceNumberFromNotes(item.notes);
  if (fromNotes && normalizeInvoiceNumber(fromNotes)) {
    return fromNotes;
  }
  return '';
}

function storesMatch(normA: string, normB: string): boolean {
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.length >= 3 && normB.length >= 3 && (normA.includes(normB) || normB.includes(normA))) {
    return true;
  }
  const firstTokenA = normA.split(' ')[0];
  const firstTokenB = normB.split(' ')[0];
  return firstTokenA.length >= 4 && firstTokenA === firstTokenB;
}

/**
 * Evaluates whether two receipt entries represent the same transaction using
 * Store Name, Purchase Date, Invoice/Slip Number, Total Amount, and Image Fingerprint.
 */
export function areReceiptsDuplicate(
  a: DuplicateCandidateInput,
  b: DuplicateCandidateInput
): {
  isDuplicate: boolean;
  isBlocked: boolean;
  confidence: 'exact' | 'high' | 'possible';
  reason: string;
  matchedFields: ('store' | 'date' | 'invoice_number' | 'amount' | 'image')[];
  matchedInvoiceNumber?: string;
} {
  // 1. Exact Image Fingerprint Match (same receipt photo scanned again)
  if (
    a.image_fingerprint &&
    b.image_fingerprint &&
    a.image_fingerprint === b.image_fingerprint
  ) {
    return {
      isDuplicate: true,
      isBlocked: true,
      confidence: 'exact',
      reason: 'Exact same receipt photo has already been scanned.',
      matchedFields: ['image', 'store', 'date'],
      matchedInvoiceNumber: getDisplayInvoiceNumber(b) || getDisplayInvoiceNumber(a) || undefined,
    };
  }

  const normVendorA = normalizeVendorName(a.vendor_name);
  const normVendorB = normalizeVendorName(b.vendor_name);
  const vendorMatch = storesMatch(normVendorA, normVendorB);

  const dateA = (a.invoice_date || '').substring(0, 10);
  const dateB = (b.invoice_date || '').substring(0, 10);
  const dateMatch = dateA.length === 10 && dateA === dateB;

  const invA = normalizeInvoiceNumber(a.invoice_number, a.notes);
  const invB = normalizeInvoiceNumber(b.invoice_number, b.notes);
  const displayInv = getDisplayInvoiceNumber(b) || getDisplayInvoiceNumber(a);

  const amountA = Math.round((Number(a.total_amount) || 0) * 100) / 100;
  const amountB = Math.round((Number(b.total_amount) || 0) * 100) / 100;
  const amountMatch = amountA > 0 && Math.abs(amountA - amountB) < 0.05;

  // 2. Store + Date + Invoice Number Match (Gold-standard receipt identity match -> HARD BLOCK)
  if (invA && invB && invA === invB && vendorMatch && dateMatch) {
    return {
      isDuplicate: true,
      isBlocked: true,
      confidence: 'exact',
      reason: `Duplicate Store, Date & Invoice # (${b.vendor_name} · ${dateB} · #${displayInv})`,
      matchedFields: amountMatch
        ? ['store', 'date', 'invoice_number', 'amount']
        : ['store', 'date', 'invoice_number'],
      matchedInvoiceNumber: displayInv || invB,
    };
  }

  // 3. Store + Invoice Number Match (Same store & exact same printed invoice/slip #, even if OCR date differed -> HARD BLOCK)
  if (invA && invB && invA === invB && invA.length >= 3 && vendorMatch) {
    return {
      isDuplicate: true,
      isBlocked: true,
      confidence: 'exact',
      reason: `Invoice #${displayInv} from ${b.vendor_name} is already recorded (dated ${dateB}).`,
      matchedFields: ['store', 'invoice_number'],
      matchedInvoiceNumber: displayInv || invB,
    };
  }

  // 4. Date + Long Invoice Number Match (even if store name had OCR variation -> HARD BLOCK)
  if (invA && invB && invA === invB && invA.length >= 5 && dateMatch) {
    return {
      isDuplicate: true,
      isBlocked: true,
      confidence: 'exact',
      reason: `Invoice #${displayInv} on ${dateB} is already recorded under ${b.vendor_name}.`,
      matchedFields: ['date', 'invoice_number'],
      matchedInvoiceNumber: displayInv || invB,
    };
  }

  // 5. Distinct Invoice Numbers Guard:
  // If BOTH receipts have valid, DIFFERENT printed invoice numbers, they are genuinely separate slips!
  if (invA && invB && invA !== invB) {
    return {
      isDuplicate: false,
      isBlocked: false,
      confidence: 'possible',
      reason: '',
      matchedFields: [],
    };
  }

  // 6. Store + Date + Exact Total Match (when invoice number is missing on one or both slips -> HARD BLOCK)
  if (vendorMatch && dateMatch && amountMatch) {
    return {
      isDuplicate: true,
      isBlocked: true,
      confidence: 'exact',
      reason: displayInv
        ? `Duplicate Store, Date & Total (${b.vendor_name} · ${dateB} · #${displayInv}). Enter this slip's distinct Invoice # if it was a separate purchase.`
        : `Duplicate Store, Date & Total (${b.vendor_name} on ${dateB}). Distinct printed Invoice #s are required on both slips to record identical same-day totals.`,
      matchedFields: ['store', 'date', 'amount'],
      matchedInvoiceNumber: displayInv || undefined,
    };
  }

  // 7. Same Store & Exact Total within 24 hours with missing invoice number (e.g. midnight timezone slip -> HARD BLOCK)
  if (vendorMatch && amountMatch && dateA && dateB && (!invA || !invB)) {
    const timeA = new Date(dateA).getTime();
    const timeB = new Date(dateB).getTime();
    if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
      const diffDays = Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24);
      if (diffDays <= 1) {
        return {
          isDuplicate: true,
          isBlocked: true,
          confidence: 'high',
          reason: displayInv
            ? `Matching receipt from ${b.vendor_name} for the same amount (${dateB} · #${displayInv}). Enter a distinct Invoice # if this was a separate purchase.`
            : `Matching receipt from ${b.vendor_name} for the same amount (${dateB}).`,
          matchedFields: ['store', 'amount'],
          matchedInvoiceNumber: displayInv || undefined,
        };
      }
    }
  }

  return {
    isDuplicate: false,
    isBlocked: false,
    confidence: 'possible',
    reason: '',
    matchedFields: [],
  };
}

/**
 * Checks a newly scanned or manual receipt against historical saved receipts
 * and against other slips in the current batch.
 */
export function findDuplicateForReceipt(
  slip: DuplicateCandidateInput & { id: string },
  historicalReceipts: SavedReceipt[],
  currentBatch: SavedReceipt[] = []
): DuplicateMatch | null {
  for (const existing of historicalReceipts) {
    if (existing.id === slip.id) continue;
    const check = areReceiptsDuplicate(slip, existing);
    if (check.isDuplicate) {
      return {
        detectedReceiptId: slip.id,
        matchedReceipt: existing,
        confidence: check.confidence,
        matchReason: check.reason,
        isBlocked: check.isBlocked,
        isBatchDuplicate: false,
        matchedFields: check.matchedFields,
        matchedInvoiceNumber: check.matchedInvoiceNumber,
      };
    }
  }

  for (const sibling of currentBatch) {
    if (sibling.id === slip.id) continue;
    const check = areReceiptsDuplicate(slip, sibling);
    if (check.isDuplicate) {
      return {
        detectedReceiptId: slip.id,
        matchedReceipt: sibling,
        confidence: check.confidence,
        matchReason: `Duplicate in current scan batch: ${check.reason}`,
        isBlocked: check.isBlocked,
        isBatchDuplicate: true,
        matchedFields: check.matchedFields,
        matchedInvoiceNumber: check.matchedInvoiceNumber,
      };
    }
  }

  return null;
}

/**
 * Scans an entire batch of newly detected slips and returns a lookup Map of all duplicates found.
 */
export function identifyBatchDuplicates(
  detectedReceipts: SavedReceipt[],
  historicalReceipts: SavedReceipt[]
): Map<string, DuplicateMatch> {
  const duplicateMap = new Map<string, DuplicateMatch>();

  for (let i = 0; i < detectedReceipts.length; i++) {
    const slip = detectedReceipts[i];

    // 1. Check against already saved historical receipts
    let matchedHistorical: { receipt: SavedReceipt; check: ReturnType<typeof areReceiptsDuplicate> } | null = null;
    for (const h of historicalReceipts) {
      if (h.id === slip.id) continue;
      const check = areReceiptsDuplicate(slip, h);
      if (check.isDuplicate) {
        matchedHistorical = { receipt: h, check };
        break;
      }
    }

    if (matchedHistorical) {
      duplicateMap.set(slip.id, {
        detectedReceiptId: slip.id,
        matchedReceipt: matchedHistorical.receipt,
        confidence: matchedHistorical.check.confidence,
        matchReason: matchedHistorical.check.reason,
        isBlocked: matchedHistorical.check.isBlocked,
        isBatchDuplicate: false,
        matchedFields: matchedHistorical.check.matchedFields,
        matchedInvoiceNumber: matchedHistorical.check.matchedInvoiceNumber,
      });
      continue;
    }

    // 2. Check against earlier non-blocked slips in the same scan batch
    for (let j = 0; j < i; j++) {
      const previousSlip = detectedReceipts[j];
      const check = areReceiptsDuplicate(slip, previousSlip);
      if (check.isDuplicate) {
        duplicateMap.set(slip.id, {
          detectedReceiptId: slip.id,
          matchedReceipt: previousSlip,
          confidence: check.confidence,
          matchReason: `Duplicate within this scan batch: ${check.reason}`,
          isBlocked: check.isBlocked,
          isBatchDuplicate: true,
          matchedFields: check.matchedFields,
          matchedInvoiceNumber: check.matchedInvoiceNumber,
        });
        break;
      }
    }
  }

  return duplicateMap;
}

/**
 * Prevents queuing the exact same image file twice in the upload tray,
 * or queuing an image whose fingerprint already exists in saved receipts.
 */
export function isDuplicateQueuedFile(
  newFile: File,
  existingQueue: { file: File; fingerprint?: string }[],
  newFingerprint?: string
): boolean {
  return existingQueue.some(
    (q) =>
      (newFingerprint && q.fingerprint && newFingerprint === q.fingerprint) ||
      (q.file.name === newFile.name &&
        q.file.size === newFile.size &&
        q.file.lastModified === newFile.lastModified)
  );
}
