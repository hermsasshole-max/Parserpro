import type { SavedReceipt } from '../types';

const STORAGE_KEY = 'parserpro_saved_receipts_v1';
const SNAPSHOTS_KEY = 'parserpro_device_snapshots_v1';
const DB_NAME = 'parserpro_storage_db';
const DB_VERSION = 1;
const STORE_RECEIPTS = 'receipts_store';
const STORE_SNAPSHOTS = 'snapshots_store';

export interface DeviceSnapshot {
  id: string;
  timestamp: string;
  label: string;
  receiptCount: number;
  totalSpend: number;
  receipts: SavedReceipt[];
}

export interface DeviceStorageStats {
  receiptCount: number;
  lineItemCount: number;
  totalSpend: number;
  monthsCount: number;
  storageUsageBytes?: number;
  storageQuotaBytes?: number;
  isPersistent: boolean;
  lastBackupDate: string | null;
  snapshotsCount: number;
}

/**
 * Open or upgrade IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported on this platform'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_RECEIPTS)) {
        db.createObjectStore(STORE_RECEIPTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Requests Android OS and browser to guarantee persistent storage
 */
export async function requestPersistentDeviceStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log('Android Persistent Storage requested, status:', isPersisted);
      return isPersisted;
    }
  } catch (e) {
    console.warn('Could not request persistent storage:', e);
  }
  return false;
}

/**
 * Check if storage persistence is currently active
 */
export async function checkStoragePersistence(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      return await navigator.storage.persisted();
    }
  } catch (e) {
    console.warn('Could not query storage persistence:', e);
  }
  return false;
}

/**
 * Dual-save to both LocalStorage and IndexedDB on Android device
 */
export async function saveReceiptsToDevice(receipts: SavedReceipt[]): Promise<void> {
  // 1. Primary synchronous persistence to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
    localStorage.setItem('parserpro_last_save', new Date().toISOString());
  } catch (e) {
    console.error('LocalStorage save error:', e);
  }

  // 2. Secondary high-capacity persistence to IndexedDB (survives cache clear)
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RECEIPTS, 'readwrite');
    const store = tx.objectStore(STORE_RECEIPTS);

    // Clear and re-populate
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    for (const receipt of receipts) {
      store.put(receipt);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB secondary save notice:', e);
  }
}

/**
 * Loads receipts from device, trying IndexedDB first then falling back to localStorage
 */
export async function loadReceiptsFromDevice(): Promise<SavedReceipt[]> {
  // Try IndexedDB first
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RECEIPTS, 'readonly');
    const store = tx.objectStore(STORE_RECEIPTS);
    const getAllReq = store.getAll();

    const result = await new Promise<SavedReceipt[]>((resolve, reject) => {
      getAllReq.onsuccess = () => resolve(getAllReq.result || []);
      getAllReq.onerror = () => reject(getAllReq.error);
    });

    if (Array.isArray(result) && result.length > 0) {
      return result;
    }
  } catch (e) {
    console.warn('IndexedDB load notice, falling back to localStorage:', e);
  }

  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Backfill to IndexedDB asynchronously
        saveReceiptsToDevice(parsed).catch(err => console.warn('Backfill failed:', err));
        return parsed;
      }
    }
  } catch (e) {
    console.error('LocalStorage load error:', e);
  }

  return [];
}

/**
 * Creates an on-device snapshot (rollback point)
 */
export async function createDeviceSnapshot(receipts: SavedReceipt[], label: string): Promise<DeviceSnapshot> {
  const totalSpend = receipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const snapshot: DeviceSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    label,
    receiptCount: receipts.length,
    totalSpend: Number(totalSpend.toFixed(2)),
    receipts
  };

  try {
    // Save to localStorage list (last 6 snapshots)
    const existingRaw = localStorage.getItem(SNAPSHOTS_KEY);
    const existing: DeviceSnapshot[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = [snapshot, ...existing.filter(s => s.id !== snapshot.id)].slice(0, 6);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));

    // Also persist to IndexedDB
    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    tx.objectStore(STORE_SNAPSHOTS).put(snapshot);
  } catch (e) {
    console.error('Failed to create local snapshot:', e);
  }

  return snapshot;
}

/**
 * Gets all saved snapshots on the device
 */
export async function getDeviceSnapshots(): Promise<DeviceSnapshot[]> {
  try {
    const existingRaw = localStorage.getItem(SNAPSHOTS_KEY);
    if (existingRaw) {
      const parsed = JSON.parse(existingRaw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading snapshots from localStorage:', e);
  }

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
    const store = tx.objectStore(STORE_SNAPSHOTS);
    const getAllReq = store.getAll();

    return await new Promise<DeviceSnapshot[]>((resolve) => {
      getAllReq.onsuccess = () => resolve(getAllReq.result || []);
      getAllReq.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

/**
 * Deletes a snapshot
 */
export async function deleteDeviceSnapshot(id: string): Promise<void> {
  try {
    const existingRaw = localStorage.getItem(SNAPSHOTS_KEY);
    if (existingRaw) {
      const existing: DeviceSnapshot[] = JSON.parse(existingRaw);
      const filtered = existing.filter(s => s.id !== id);
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(filtered));
    }

    const db = await openDB();
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    tx.objectStore(STORE_SNAPSHOTS).delete(id);
  } catch (e) {
    console.error('Failed to delete snapshot:', e);
  }
}

/**
 * Computes storage metrics and health diagnostics for Android device
 */
export async function getDeviceStorageStats(receipts: SavedReceipt[]): Promise<DeviceStorageStats> {
  const isPersistent = await checkStoragePersistence();
  let storageUsageBytes: number | undefined;
  let storageQuotaBytes: number | undefined;

  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      storageUsageBytes = estimate.usage;
      storageQuotaBytes = estimate.quota;
    }
  } catch (e) {
    console.warn('Storage estimate failed:', e);
  }

  const lineItemCount = receipts.reduce((acc, r) => acc + r.line_items.length, 0);
  const totalSpend = receipts.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
  const months = new Set(receipts.map(r => r.month_year));
  const snapshots = await getDeviceSnapshots();
  const lastBackupDate = localStorage.getItem('parserpro_last_backup_export');

  return {
    receiptCount: receipts.length,
    lineItemCount,
    totalSpend: Number(totalSpend.toFixed(2)),
    monthsCount: months.size,
    storageUsageBytes,
    storageQuotaBytes,
    isPersistent,
    lastBackupDate,
    snapshotsCount: snapshots.length
  };
}

/**
 * Exports full backup JSON file to Android Device Storage
 * Uses native Android Web Share API if available or initiates direct file download
 */
export async function exportDeviceBackupJSON(receipts: SavedReceipt[]): Promise<{ success: boolean; filename: string }> {
  const now = new Date();
  const dateStr = now.toISOString().substring(0, 10);
  const timeStr = now.toTimeString().substring(0, 8).replace(/:/g, '-');
  const filename = `parserpro_android_backup_${dateStr}_${timeStr}.json`;

  const backupPayload = {
    app: 'ParserPro Expenditure & Household Accounting',
    version: '1.2.0',
    platform: 'Android / PWA',
    exported_at: now.toISOString(),
    receipt_count: receipts.length,
    total_spend: receipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0),
    data: receipts
  };

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Update last backup date
  try {
    localStorage.setItem('parserpro_last_backup_export', now.toISOString());
  } catch (e) {}

  // Try Android Native Share (allows user to select "Save to Files", "Google Drive", or file manager)
  try {
    const file = new File([blob], filename, { type: 'application/json' });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `ParserPro Android Backup (${dateStr})`,
        text: `ParserPro complete backup file containing ${receipts.length} invoices.`,
        files: [file]
      });
      return { success: true, filename };
    }
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      return { success: true, filename };
    }
    console.warn('Share backup failed, falling back to direct download:', error);
  }

  // Direct download fallback (supported across all Android browsers and desktop)
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, filename };
  } catch (err) {
    console.error('Direct download error:', err);
    return { success: false, filename };
  }
}

/**
 * Imports and validates backup JSON file
 */
export async function parseBackupFile(file: File): Promise<{
  success: boolean;
  receipts: SavedReceipt[];
  message: string;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        let extracted: SavedReceipt[] = [];

        // Format 1: Wrapped with metadata { app, data: [...] }
        if (parsed && Array.isArray(parsed.data)) {
          extracted = parsed.data;
        } 
        // Format 2: Direct array [ { id, vendor_name, ... } ]
        else if (Array.isArray(parsed)) {
          extracted = parsed;
        } else {
          resolve({
            success: false,
            receipts: [],
            message: 'Invalid file format: Backup file must contain a valid array of invoices.'
          });
          return;
        }

        // Validate basic invoice fields
        const validReceipts = extracted.filter(r => 
          r && 
          typeof r.vendor_name === 'string' && 
          typeof r.invoice_date === 'string' &&
          Array.isArray(r.line_items)
        );

        if (validReceipts.length === 0) {
          resolve({
            success: false,
            receipts: [],
            message: 'No valid invoice records found in this backup file.'
          });
          return;
        }

        resolve({
          success: true,
          receipts: validReceipts,
          message: `Successfully validated ${validReceipts.length} invoices from backup.`
        });
      } catch (err) {
        resolve({
          success: false,
          receipts: [],
          message: 'Failed to parse JSON file. The file may be corrupted.'
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        receipts: [],
        message: 'Could not read the selected file.'
      });
    };

    reader.readAsText(file);
  });
}

/**
 * Exports all invoices and every individual line item across all months into an all-in-one CSV for Android
 */
export function exportAllInvoicesToCSV(receipts: SavedReceipt[]): void {
  const headers = [
    'Invoice ID',
    'Invoice Date',
    'Month-Year',
    'Vendor / Store',
    'Store Category',
    'Line Item Description',
    'Quantity',
    'Unit Price (ZAR)',
    'Line Item Total (ZAR)',
    'Invoice Subtotal (ZAR)',
    'Invoice Tax (ZAR)',
    'Invoice Total (ZAR)',
    'Notes'
  ];

  const rows: string[][] = [];

  receipts.forEach(r => {
    if (r.line_items.length === 0) {
      rows.push([
        `"${r.id}"`,
        `"${r.invoice_date}"`,
        `"${r.month_year}"`,
        `"${r.vendor_name.replace(/"/g, '""')}"`,
        `"${r.category}"`,
        `"No items itemized"`,
        '1',
        r.total_amount.toFixed(2),
        r.total_amount.toFixed(2),
        r.subtotal.toFixed(2),
        r.tax.toFixed(2),
        r.total_amount.toFixed(2),
        `"${(r.notes || '').replace(/"/g, '""')}"`
      ]);
    } else {
      r.line_items.forEach(item => {
        rows.push([
          `"${r.id}"`,
          `"${r.invoice_date}"`,
          `"${r.month_year}"`,
          `"${r.vendor_name.replace(/"/g, '""')}"`,
          `"${r.category}"`,
          `"${item.description.replace(/"/g, '""')}"`,
          `${item.quantity}`,
          item.unit_price.toFixed(2),
          item.total_price.toFixed(2),
          r.subtotal.toFixed(2),
          r.tax.toFixed(2),
          r.total_amount.toFixed(2),
          `"${(r.notes || '').replace(/"/g, '""')}"`
        ]);
      });
    }
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `parserpro_all_invoices_${new Date().toISOString().substring(0, 10)}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
