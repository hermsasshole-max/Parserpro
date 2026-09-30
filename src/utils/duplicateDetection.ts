import type { SavedReceipt } from '../types';

export interface DuplicateMatch {
  detectedReceiptId: string;
  matchedReceipt: SavedReceipt;
  confidence: 'exact' | 'high' | 'possible';
  matchReason: string;
  isBatchDuplicate: boolean;
}

/**
 * Normalizes vendor names for robust fuzzy matching (e.g. "Pick 'n Pay", "Pick n Pay Supermarket", "PICK N PAY")
 */
export function normalizeVendorName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['"’]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Evaluates whether two receipt entries represent the same purchase transaction.
 */
export function areReceiptsDuplicate(
  a: { vendor_name: string; invoice_date: string; total_amount: number | string },
  b: { vendor_name: string; invoice_date: string; total_amount: number | string }
): { isDuplicate: boolean; confidence: 'exact' | 'high' | 'possible'; reason: string } {
  const normA = normalizeVendorName(a.vendor_name);
  const normB = normalizeVendorName(b.vendor_name);
  const vendorMatch = normA === normB || (normA.length > 3 && normB.length > 3 && (normA.includes(normB) || normB.includes(normA)));

  const amountA = Math.round((Number(a.total_amount) || 0) * 100) / 100;
  const amountB = Math.round((Number(b.total_amount) || 0) * 100) / 100;
  const amountMatch = Math.abs(amountA - amountB) < 0.05 && amountA > 0;

  const dateA = (a.invoice_date || '').substring(0, 10);
  const dateB = (b.invoice_date || '').substring(0, 10);
  const dateMatch = dateA === dateB && dateA.length === 10;

  // 1. Exact Duplicate: Same vendor, exact same date, exact same total amount
  if (vendorMatch && dateMatch && amountMatch) {
    return {
      isDuplicate: true,
      confidence: 'exact',
      reason: `Exact match: ${a.vendor_name} on ${dateA} for ${amountA.toFixed(2)}`,
    };
  }

  // 2. High Confidence Duplicate: Same date & amount with related vendor
  if (dateMatch && amountMatch && (vendorMatch || normA.split(' ')[0] === normB.split(' ')[0])) {
    return {
      isDuplicate: true,
      confidence: 'high',
      reason: `Matching amount (${amountA.toFixed(2)}) on ${dateA} (${a.vendor_name} vs ${b.vendor_name})`,
    };
  }

  // 3. Possible Duplicate: Same vendor and amount within 24-48 hours (e.g. night scan or timezone offset)
  if (vendorMatch && amountMatch && dateA && dateB) {
    const timeA = new Date(dateA).getTime();
    const timeB = new Date(dateB).getTime();
    if (!isNaN(timeA) && !isNaN(timeB)) {
      const diffDays = Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24);
      if (diffDays <= 2) {
        return {
          isDuplicate: true,
          confidence: 'possible',
          reason: `Same vendor & amount within ${Math.ceil(diffDays)} day(s) (${dateA} vs ${dateB})`,
        };
      }
    }
  }

  return { isDuplicate: false, confidence: 'possible', reason: '' };
}

/**
 * Checks a newly scanned or detected slip against historical saved receipts
 * and against other slips in the current batch.
 */
export function findDuplicateForReceipt(
  slip: SavedReceipt,
  historicalReceipts: SavedReceipt[],
  currentBatch: SavedReceipt[] = []
): DuplicateMatch | null {
  // Check against historical receipts first (highest priority safety check)
  for (const existing of historicalReceipts) {
    if (existing.id === slip.id) continue;
    const check = areReceiptsDuplicate(slip, existing);
    if (check.isDuplicate) {
      return {
        detectedReceiptId: slip.id,
        matchedReceipt: existing,
        confidence: check.confidence,
        matchReason: check.reason,
        isBatchDuplicate: false,
      };
    }
  }

  // Check against other detected slips in the current scan queue
  for (const sibling of currentBatch) {
    if (sibling.id === slip.id) continue;
    const check = areReceiptsDuplicate(slip, sibling);
    if (check.isDuplicate) {
      return {
        detectedReceiptId: slip.id,
        matchedReceipt: sibling,
        confidence: check.confidence,
        matchReason: `Duplicate in current scan batch: ${check.reason}`,
        isBatchDuplicate: true,
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
    // Check against historical records
    const historicalMatch = historicalReceipts.find(h => {
      if (h.id === slip.id) return false;
      return areReceiptsDuplicate(slip, h).isDuplicate;
    });

    if (historicalMatch) {
      const match = areReceiptsDuplicate(slip, historicalMatch);
      duplicateMap.set(slip.id, {
        detectedReceiptId: slip.id,
        matchedReceipt: historicalMatch,
        confidence: match.confidence,
        matchReason: match.reason,
        isBatchDuplicate: false,
      });
      continue;
    }

    // Check against earlier items in the same batch
    for (let j = 0; j < i; j++) {
      const previousSlip = detectedReceipts[j];
      const match = areReceiptsDuplicate(slip, previousSlip);
      if (match.isDuplicate) {
        duplicateMap.set(slip.id, {
          detectedReceiptId: slip.id,
          matchedReceipt: previousSlip,
          confidence: match.confidence,
          matchReason: `Duplicate in current scan batch: ${match.reason}`,
          isBatchDuplicate: true,
        });
        break;
      }
    }
  }

  return duplicateMap;
}

/**
 * Prevents queuing identical image files by filename and size.
 */
export function isDuplicateQueuedFile(
  newFile: File,
  existingQueue: { file: File }[]
): boolean {
  return existingQueue.some(
    q => q.file.name === newFile.name && q.file.size === newFile.size && q.file.lastModified === newFile.lastModified
  );
}
