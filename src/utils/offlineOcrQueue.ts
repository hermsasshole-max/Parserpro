import type { CachedReceiptJob, QueueStatusStats, ReceiptData, OcrEngineType } from '../types';

const DB_NAME = 'parserpro_ocr_queue_db';
const DB_VERSION = 1;
const STORE_NAME = 'unprocessed_receipts_queue';
const LOCAL_STORAGE_BACKUP_KEY = 'parserpro_ocr_queue_backup_v1';

type QueueListener = (jobs: CachedReceiptJob[]) => void;
const listeners: Set<QueueListener> = new Set();

/**
 * Calculates exponential backoff delay with jitter.
 * Attempt 0: ~2s
 * Attempt 1: ~4s
 * Attempt 2: ~8s
 * Attempt 3: ~16s
 * Attempt 4: ~32s
 * Attempt 5+: capped at 60s
 */
export function calculateBackoffDelay(attempts: number, baseDelayMs = 2000, maxDelayMs = 60000): number {
  const exponential = baseDelayMs * Math.pow(2, attempts);
  // Add random jitter of +/- 20% to prevent thundering herd
  const jitter = (Math.random() - 0.5) * 0.4 * exponential;
  const rawDelay = exponential + jitter;
  return Math.min(maxDelayMs, Math.max(baseDelayMs, Math.round(rawDelay)));
}

/**
 * Open or upgrade IndexedDB database for offline queue
 */
function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable on this platform'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function notifyListeners(jobs: CachedReceiptJob[]): void {
  listeners.forEach(fn => {
    try {
      fn(jobs);
    } catch (e) {
      console.error('[OfflineQueue] Listener callback error:', e);
    }
  });
}

/**
 * Synchronize current jobs to localStorage backup for maximum resilience on mobile WebView
 */
function syncToLocalStorageBackup(jobs: CachedReceiptJob[]): void {
  try {
    // Only store lightweight metadata or max 5 jobs with base64 to avoid quota limits
    const safeBackup = jobs.slice(0, 10).map(j => ({
      ...j,
      // If base64 is larger than 1MB, truncate preview for localStorage backup
      base64Data: j.base64Data.length > 500000 ? j.base64Data.slice(0, 100) : j.base64Data
    }));
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(safeBackup));
  } catch (e) {
    console.warn('[OfflineQueue] LocalStorage backup sync skipped due to quota:', e);
  }
}

/**
 * Adds an unprocessed receipt to the local offline cache.
 */
export async function enqueueUnprocessedReceipt(params: {
  fileName: string;
  fileSize: number;
  mimeType: string;
  base64Data: string;
  previewUrl?: string;
  initialError?: string;
  engineUsed?: OcrEngineType;
  extractedReceipts?: ReceiptData[];
  status?: 'pending' | 'processing' | 'fallback_extracted';
}): Promise<CachedReceiptJob> {
  const newJob: CachedReceiptJob = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    fileName: params.fileName,
    fileSize: params.fileSize,
    mimeType: params.mimeType,
    base64Data: params.base64Data,
    previewUrl: params.previewUrl,
    createdAt: new Date().toISOString(),
    status: params.status || 'pending',
    attempts: 0,
    maxAttempts: 5,
    nextRetryAt: Date.now() + calculateBackoffDelay(0),
    lastError: params.initialError,
    engineUsed: params.engineUsed || 'cloud_api',
    extractedReceipts: params.extractedReceipts
  };

  try {
    const db = await openQueueDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(newJob);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (idbErr) {
    console.warn('[OfflineQueue] IndexedDB enqueue failed, falling back to localStorage:', idbErr);
    const existing = getQueueFromLocalStorage();
    existing.unshift(newJob);
    saveQueueToLocalStorage(existing);
  }

  const allJobs = await getAllQueueJobs();
  syncToLocalStorageBackup(allJobs);
  notifyListeners(allJobs);

  return newJob;
}

/**
 * Retrieve all jobs currently in the local cache.
 */
export async function getAllQueueJobs(): Promise<CachedReceiptJob[]> {
  try {
    const db = await openQueueDB();
    return await new Promise<CachedReceiptJob[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const jobs = (req.result as CachedReceiptJob[]) || [];
        // Sort newest first
        jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(jobs);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineQueue] IndexedDB read failed, falling back to localStorage:', err);
    return getQueueFromLocalStorage();
  }
}

/**
 * Retrieves all pending jobs that are eligible for retry based on their nextRetryAt timestamp.
 */
export async function getPendingRetryJobs(): Promise<CachedReceiptJob[]> {
  const allJobs = await getAllQueueJobs();
  const now = Date.now();
  return allJobs.filter(j => 
    (j.status === 'pending' || j.status === 'fallback_extracted') && 
    j.attempts < j.maxAttempts && 
    now >= j.nextRetryAt
  );
}

/**
 * Updates a queue job's fields (e.g., status, attempts, error message, extracted results).
 */
export async function updateQueueJob(
  id: string, 
  updates: Partial<CachedReceiptJob>
): Promise<void> {
  try {
    const db = await openQueueDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const current = getReq.result as CachedReceiptJob | undefined;
        if (!current) {
          resolve();
          return;
        }
        const updated: CachedReceiptJob = {
          ...current,
          ...updates
        };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    const jobs = getQueueFromLocalStorage();
    const idx = jobs.findIndex(j => j.id === id);
    if (idx !== -1) {
      jobs[idx] = { ...jobs[idx], ...updates };
      saveQueueToLocalStorage(jobs);
    }
  }

  const allJobs = await getAllQueueJobs();
  syncToLocalStorageBackup(allJobs);
  notifyListeners(allJobs);
}

/**
 * Record a failed attempt on a queue job and schedule next exponential backoff retry.
 */
export async function recordJobFailure(
  id: string, 
  errorMessage: string
): Promise<void> {
  const jobs = await getAllQueueJobs();
  const job = jobs.find(j => j.id === id);
  if (!job) return;

  const nextAttempts = job.attempts + 1;
  const isFinalFailure = nextAttempts >= job.maxAttempts;
  const backoffDelay = calculateBackoffDelay(nextAttempts);

  await updateQueueJob(id, {
    attempts: nextAttempts,
    lastAttemptAt: new Date().toISOString(),
    lastError: errorMessage,
    status: isFinalFailure ? 'failed' : 'pending',
    nextRetryAt: isFinalFailure ? 0 : Date.now() + backoffDelay
  });
}

/**
 * Removes a job from the offline queue.
 */
export async function removeQueueJob(id: string): Promise<void> {
  try {
    const db = await openQueueDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const jobs = getQueueFromLocalStorage().filter(j => j.id !== id);
    saveQueueToLocalStorage(jobs);
  }

  const allJobs = await getAllQueueJobs();
  syncToLocalStorageBackup(allJobs);
  notifyListeners(allJobs);
}

/**
 * Clears all completed or dismissed jobs from the cache.
 */
export async function clearCompletedQueueJobs(): Promise<void> {
  const jobs = await getAllQueueJobs();
  for (const job of jobs) {
    if (job.status === 'completed') {
      await removeQueueJob(job.id);
    }
  }
}

/**
 * Obtains queue overview metrics for UI badges and status bars.
 */
export async function getQueueMetrics(): Promise<QueueStatusStats> {
  const jobs = await getAllQueueJobs();
  return {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    fallbackExtracted: jobs.filter(j => j.status === 'fallback_extracted').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length
  };
}

/**
 * Subscribes a React component to queue changes in real-time.
 */
export function subscribeToQueue(callback: QueueListener): () => void {
  listeners.add(callback);
  // Send initial data
  getAllQueueJobs().then(jobs => callback(jobs));
  return () => {
    listeners.delete(callback);
  };
}

// LocalStorage helpers
function getQueueFromLocalStorage(): CachedReceiptJob[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueueToLocalStorage(jobs: CachedReceiptJob[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(jobs));
  } catch (e) {
    console.warn('[OfflineQueue] LocalStorage save failed:', e);
  }
}
