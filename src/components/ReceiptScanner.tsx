import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileType, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Store, 
  ArrowRight, 
  RefreshCw, 
  Camera, 
  Edit3, 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  Layers, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  FileSpreadsheet,
  Coins,
  Key,
  FileDown,
  Printer,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Cpu,
  Cloud,
  Wifi,
  WifiOff,
  Sliders
} from 'lucide-react';
import type { ReceiptData, SavedReceipt, LineItem, ReceiptCategory } from '../types';
import { compressAndPrepareImage } from '../utils/imageUtils';
import { 
  parseMultipleReceiptsWithGemini, 
  getActiveGeminiApiKey, 
  setClientGeminiApiKey 
} from '../utils/geminiVision';
import { 
  executeFailSafeOcr, 
  getStoredOcrMode, 
  getStoredApiTimeoutMs, 
  startBackgroundQueueWorker 
} from '../utils/failSafeOcrCoordinator';
import { subscribeToQueue } from '../utils/offlineOcrQueue';
import { OfflineOcrQueueModal } from './OfflineOcrQueueModal';
import { captureReceiptWithNativeCamera, isCapacitorPlatform } from '../utils/nativeCamera';
import { downloadSingleReceiptPDF, printSingleReceiptSafely } from '../utils/pdfGenerator';
import { 
  identifyBatchDuplicates, 
  findDuplicateForReceipt, 
  isDuplicateQueuedFile, 
  type DuplicateMatch 
} from '../utils/duplicateDetection';

interface ReceiptScannerProps {
  onReceiptSaved: (receipt: SavedReceipt) => void;
  onMultipleReceiptsSaved?: (receipts: SavedReceipt[]) => void;
  onViewMonth: (month: string) => void;
  recentReceipts: SavedReceipt[];
}

interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string | null;
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  onReceiptSaved,
  onMultipleReceiptsSaved,
  onViewMonth,
  recentReceipts
}) => {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('Analyzing Receipts & Line Items...');
  const [error, setError] = useState<string | null>(null);
  
  // API Key management modal state for offline/APK/standalone environments
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getActiveGeminiApiKey());
  const [apiKeySavedSuccess, setApiKeySavedSuccess] = useState(false);

  // Multi-receipt review and filing state
  const [detectedReceipts, setDetectedReceipts] = useState<SavedReceipt[]>([]);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<Set<string>>(new Set());
  const [filedReceipts, setFiledReceipts] = useState<SavedReceipt[]>([]);
  const [isCopied, setIsCopied] = useState(false);

  // Duplicate Scan Safety Engine State
  const [duplicatesMap, setDuplicatesMap] = useState<Map<string, DuplicateMatch>>(new Map());
  const [dismissedDuplicateIds, setDismissedDuplicateIds] = useState<Set<string>>(new Set());
  const [showDuplicateSafetyModal, setShowDuplicateSafetyModal] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [manualDuplicateWarning, setManualDuplicateWarning] = useState<DuplicateMatch | null>(null);

  // Fail-Safe OCR & Offline Queue State
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [failSafeNotice, setFailSafeNotice] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // Listen to network status and background queue
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeQueue = subscribeToQueue((jobs) => {
      const activePending = jobs.filter(j => j.status === 'pending' || j.status === 'processing' || j.status === 'fallback_extracted').length;
      setPendingQueueCount(activePending);
    });

    const stopWorker = startBackgroundQueueWorker();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeQueue();
      stopWorker();
    };
  }, []);

  // Manual Entry Form State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualVendor, setManualVendor] = useState('Pick n Pay');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualCategory, setManualCategory] = useState<ReceiptCategory>('Food & Groceries');
  const [manualCurrency, setManualCurrency] = useState('ZAR');
  const [manualTotal, setManualTotal] = useState('241.71');
  const [manualItems, setManualItems] = useState<LineItem[]>([
    { description: 'Carrier Bag 24L', quantity: 2, unit_price: 1.40, total_price: 2.80 },
    { description: 'Household & Grocery Items', quantity: 8, unit_price: 29.86, total_price: 238.91 }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleSaveApiKey = () => {
    setClientGeminiApiKey(apiKeyInput.trim());
    setApiKeySavedSuccess(true);
    setTimeout(() => {
      setApiKeySavedSuccess(false);
      setShowApiKeyModal(false);
      if (queuedFiles.length > 0) {
        parseReceipts();
      }
    }, 900);
  };

  const handleFilesSelected = (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    // Safety feature: eliminate duplicate queued files
    const uniqueFiles: File[] = [];
    let duplicateCount = 0;
    filesArray.forEach((f) => {
      if (isDuplicateQueuedFile(f, queuedFiles)) {
        duplicateCount++;
      } else {
        uniqueFiles.push(f);
      }
    });

    if (duplicateCount > 0) {
      setDuplicateNotice(`Safety Feature: ${duplicateCount} duplicate photo(s) already in queue were skipped.`);
      setTimeout(() => setDuplicateNotice(null), 5000);
    }

    if (uniqueFiles.length === 0) return;

    const newQueued: QueuedFile[] = uniqueFiles.map((f) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null
    }));

    setQueuedFiles(prev => [...prev, ...newQueued]);
    setError(null);
    setDetectedReceipts([]);
    setFiledReceipts([]);
    setDuplicatesMap(new Map());
    setDismissedDuplicateIds(new Set());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesSelected(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const removeQueuedFile = (id: string) => {
    setQueuedFiles(prev => {
      const removed = prev.find(f => f.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      const updated = prev.filter(f => f.id !== id);
      if (activePreviewIndex >= updated.length) {
        setActivePreviewIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const clearAllQueued = () => {
    queuedFiles.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setQueuedFiles([]);
    setActivePreviewIndex(0);
    setDetectedReceipts([]);
    setFiledReceipts([]);
    setError(null);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerCameraInput = async () => {
    if (isCapacitorPlatform()) {
      try {
        const photo = await captureReceiptWithNativeCamera();
        if (photo) {
          handleFilesSelected([photo.file]);
          return;
        }
      } catch (err) {
        console.warn('[ReceiptScanner] Native camera notice:', err);
      }
    }
    cameraInputRef.current?.click();
  };

  /**
   * Main Batch & Multi-Slip Scanning Engine
   */
  const parseReceipts = async () => {
    if (queuedFiles.length === 0) return;

    setIsLoading(true);
    setError(null);
    setDetectedReceipts([]);
    setFiledReceipts([]);

    const allDiscoveredReceipts: SavedReceipt[] = [];
    const todayStr = new Date().toISOString().split('T')[0];
    const todayMonth = todayStr.substring(0, 7);

    try {
      for (let i = 0; i < queuedFiles.length; i++) {
        const qFile = queuedFiles[i];
        setLoadingStage(`Optimizing image ${i + 1} of ${queuedFiles.length}...`);
        
        // High quality 1800px compression for crisp reading and fast network transport
        const prepared = await compressAndPrepareImage(qFile.file, 1800, 0.80);
        console.log(`[ReceiptScanner] Image ${i + 1} optimized (${prepared.processedSizeKb} KB). Requesting AI OCR...`);

        setLoadingStage(
          queuedFiles.length > 1
            ? `Scanning photo ${i + 1} of ${queuedFiles.length} for multiple receipts...`
            : 'Scanning image for all receipts & slips...'
        );

        let fileExtracted: ReceiptData[] = [];

        // Fail-Safe OCR: Attempts Cloud API, automatically fails over to local Tesseract on timeout/network drops,
        // and persists to local cache with exponential backoff retry.
        const failSafeResult = await executeFailSafeOcr({
          base64Data: prepared.base64Data,
          mimeType: prepared.mimeType,
          fileName: qFile.file.name,
          fileSize: qFile.file.size,
          previewUrl: qFile.previewUrl || undefined,
          options: {
            timeoutMs: getStoredApiTimeoutMs(),
            mode: getStoredOcrMode(),
            onStage: (stage) => setLoadingStage(stage),
            onEngineSwitched: (engine, reason) => {
              setFailSafeNotice(`⚡ ${reason}`);
            }
          }
        });

        fileExtracted = failSafeResult.receipts;
        if (failSafeResult.fallbackTriggered) {
          setFailSafeNotice(failSafeResult.warning || 'Switched to on-device Tesseract OCR engine.');
        }

        // 3. Map into SavedReceipt objects
        fileExtracted.forEach((rec, slipIdx) => {
          let invDate = rec.invoice_date || todayStr;
          let mYear = rec.month_year || invDate.substring(0, 7) || todayMonth;
          const newId = `rec_${Date.now()}_${i}_${slipIdx}_${Math.random().toString(36).substring(2, 6)}`;

          allDiscoveredReceipts.push({
            ...rec,
            id: newId,
            vendor_name: rec.vendor_name || `Store Purchase ${allDiscoveredReceipts.length + 1}`,
            invoice_date: invDate,
            month_year: mYear,
            category: rec.category || 'Food & Groceries',
            currency: rec.currency || 'ZAR',
            line_items: Array.isArray(rec.line_items) ? rec.line_items : [],
            total_amount: typeof rec.total_amount === 'number' ? rec.total_amount : parseFloat(rec.total_amount as any) || 0,
            subtotal: typeof rec.subtotal === 'number' ? rec.subtotal : (rec.total_amount || 0),
            tax: typeof rec.tax === 'number' ? rec.tax : 0,
            notes: rec.notes || (fileExtracted.length > 1 ? `Slip ${slipIdx + 1} of ${fileExtracted.length} in photo` : ''),
            engine_used: rec.engine_used || failSafeResult.engineUsed,
            created_at: new Date().toISOString(),
            file_name: qFile.file.name,
            image_preview: qFile.previewUrl || undefined
          });
        });
      }

      if (allDiscoveredReceipts.length === 0) {
        throw new Error('No receipt records could be clearly detected. Please verify lighting and clarity.');
      }

      console.log(`[ReceiptScanner] Successfully extracted ${allDiscoveredReceipts.length} receipt(s) in batch!`, allDiscoveredReceipts);
      setDetectedReceipts(allDiscoveredReceipts);

      // Duplicate Scan Safety Analysis
      const dups = identifyBatchDuplicates(allDiscoveredReceipts, recentReceipts);
      setDuplicatesMap(dups);
      setDismissedDuplicateIds(new Set());
      if (dups.size > 0) {
        setDuplicateNotice(`Safety Feature: ${dups.size} potential duplicate scan(s) identified. You can review and skip duplicates before filing.`);
      }
    } catch (err: any) {
      console.error('[ReceiptScanner] Error during batch receipt scanning:', err);
      const rawMsg = err?.message || 'Failed to scan receipt';
      
      // Clean and sanitize any raw HTML / doctype / HTTP format messages
      let cleanMsg = rawMsg;
      if (
        rawMsg === 'STANDALONE_APK_NEEDS_KEY' || 
        rawMsg.includes('STATIC_HOST') || 
        rawMsg.includes('unexpected format') ||
        rawMsg.includes('unexpected response') ||
        rawMsg.includes('<!doctype') ||
        rawMsg.includes('HTTP 200') ||
        rawMsg.includes('status 200')
      ) {
        cleanMsg = 'No OCR backend server detected. If you are using ParserPro as a standalone mobile app or offline PWA, please connect your free Google Gemini API Key below to scan receipts directly on your device.';
      } else if (rawMsg.includes('Unexpected token') || rawMsg.includes('invalid JSON')) {
        cleanMsg = 'OCR response processing was interrupted. Please tap Retry or enter slip details manually.';
      } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
        cleanMsg = 'Network connection interrupted. Please check your internet connection and retry.';
      } else if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high traffic') || rawMsg.includes('high demand')) {
        cleanMsg = 'AI OCR service is temporarily experiencing high traffic. Please tap Retry in a moment.';
      }

      setError(cleanMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * File all detected receipts with Duplicate Safety Interception
   */
  const handleFileAllDetected = () => {
    if (detectedReceipts.length === 0) return;

    // Check if any receipts have an active duplicate flag that hasn't been explicitly dismissed
    const activeDuplicates = detectedReceipts.filter(
      r => duplicatesMap.has(r.id) && !dismissedDuplicateIds.has(r.id)
    );

    if (activeDuplicates.length > 0) {
      // Intercept with the Duplicate Safety Modal
      setShowDuplicateSafetyModal(true);
      return;
    }

    executeFileReceipts(detectedReceipts);
  };

  const executeFileReceipts = (receiptsToFile: SavedReceipt[]) => {
    if (receiptsToFile.length === 0) return;

    if (onMultipleReceiptsSaved) {
      onMultipleReceiptsSaved(receiptsToFile);
    } else {
      receiptsToFile.forEach(r => onReceiptSaved(r));
    }

    setFiledReceipts(receiptsToFile);
    setDetectedReceipts([]);
    setDuplicatesMap(new Map());
    setDismissedDuplicateIds(new Set());
    setShowDuplicateSafetyModal(false);
  };

  /**
   * Safely skip duplicate slips and file only unique/new slips
   */
  const handleSkipDuplicatesAndFileNew = () => {
    const nonDuplicates = detectedReceipts.filter(
      r => !duplicatesMap.has(r.id) || dismissedDuplicateIds.has(r.id)
    );

    if (nonDuplicates.length === 0) {
      setDuplicateNotice('All detected slips were duplicates and have been safely dismissed.');
      setDetectedReceipts([]);
      setShowDuplicateSafetyModal(false);
      return;
    }

    executeFileReceipts(nonDuplicates);
  };

  const handleDismissDuplicate = (id: string) => {
    setDismissedDuplicateIds(prev => new Set(prev).add(id));
  };

  const updateDetectedReceipt = (id: string, updates: Partial<SavedReceipt>) => {
    setDetectedReceipts(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, ...updates };
        if (updates.invoice_date && !updates.month_year) {
          updated.month_year = updates.invoice_date.substring(0, 7);
        }
        return updated;
      }
      return r;
    }));
  };

  const removeDetectedReceipt = (id: string) => {
    setDetectedReceipts(prev => prev.filter(r => r.id !== id));
  };

  const toggleExpand = (id: string) => {
    setExpandedReceiptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Manual Entry Submission with Duplicate Check
  const handleSaveManual = (e?: React.FormEvent, forceSave: boolean = false) => {
    if (e) e.preventDefault();
    const total = parseFloat(manualTotal) || 0;
    const invDate = manualDate || new Date().toISOString().split('T')[0];
    const mYear = invDate.substring(0, 7);

    const manualReceipt: SavedReceipt = {
      id: `rec_${Date.now()}`,
      vendor_name: manualVendor || 'Household Expense',
      invoice_date: invDate,
      month_year: mYear,
      category: manualCategory,
      currency: manualCurrency || 'ZAR',
      line_items: manualItems.length > 0 ? manualItems : [
        { description: 'General Store Purchase', quantity: 1, unit_price: total, total_price: total }
      ],
      total_amount: total,
      subtotal: total,
      tax: 0,
      notes: 'Manually logged receipt',
      created_at: new Date().toISOString(),
      file_name: 'manual-entry.jpg'
    };

    // Duplicate check for manual submission
    if (!forceSave && !manualDuplicateWarning) {
      const dup = findDuplicateForReceipt(manualReceipt, recentReceipts);
      if (dup) {
        setManualDuplicateWarning(dup);
        return;
      }
    }

    onReceiptSaved(manualReceipt);
    setFiledReceipts([manualReceipt]);
    setShowManualModal(false);
    setManualDuplicateWarning(null);
    setError(null);
  };

  const addManualItem = () => {
    setManualItems([...manualItems, { description: 'Item', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const updateManualItem = (index: number, field: keyof LineItem, val: any) => {
    const updated = [...manualItems];
    updated[index] = { ...updated[index], [field]: val };
    if (field === 'quantity' || field === 'unit_price') {
      const q = field === 'quantity' ? Number(val) : updated[index].quantity;
      const u = field === 'unit_price' ? Number(val) : updated[index].unit_price;
      updated[index].total_price = parseFloat((q * u).toFixed(2));
    }
    setManualItems(updated);
  };

  const removeManualItem = (index: number) => {
    setManualItems(manualItems.filter((_, i) => i !== index));
  };

  const totalDetectedAmount = detectedReceipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const activeQueued = queuedFiles[activePreviewIndex] || queuedFiles[0];

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full overflow-auto">
      {/* Left Sidebar / Recent Scans */}
      <aside className="w-full lg:w-72 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4 shadow-sm shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Recent Scans
          </div>
          <span className="text-xs text-emerald-600 font-semibold">
            {recentReceipts.length} Total
          </span>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-[380px] pr-1">
          {recentReceipts.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No receipts scanned yet. Upload single or multiple receipts!
            </div>
          ) : (
            recentReceipts.slice(0, 6).map((rec) => (
              <div
                key={rec.id}
                onClick={() => onViewMonth(rec.month_year)}
                className="p-3 bg-slate-50 hover:bg-emerald-50/60 border border-slate-100 hover:border-emerald-200 rounded-xl transition-all cursor-pointer group text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 truncate max-w-[140px]">
                    {rec.vendor_name}
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white rounded text-slate-600 border border-slate-200">
                    {rec.month_year}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{rec.invoice_date}</span>
                  <span className="font-bold text-slate-700 font-mono">
                    R {Number(rec.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-auto p-4 bg-slate-900 rounded-2xl text-white shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">
              Multi-Receipt Support
            </span>
            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold rounded">
              Batch OCR
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Photograph multiple slips side-by-side or select multiple files at once. Every receipt is automatically identified, separated, and filed.
          </p>
        </div>
      </aside>

      {/* Main Scanner Section */}
      <section className="flex-1 flex flex-col gap-6">
        {/* Upload & Document Queue Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span>Receipt Capture & Batch Queue</span>
                {queuedFiles.length > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                    {queuedFiles.length} photo{queuedFiles.length > 1 ? 's' : ''} queued
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload single or multiple receipt photos, or capture slips side-by-side
              </p>
            </div>

            {duplicateNotice && (
              <div className="w-full p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{duplicateNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDuplicateNotice(null)}
                  className="text-amber-700 hover:text-amber-900 text-xs font-bold cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {failSafeNotice && (
              <div className="w-full p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{failSafeNotice}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowQueueModal(true)}
                    className="text-emerald-800 underline text-xs font-bold cursor-pointer"
                  >
                    View Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => setFailSafeNotice(null)}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowQueueModal(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  pendingQueueCount > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
                title="Manage Fail-Safe OCR Engine & Offline Retry Queue"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fail-Safe OCR</span>
                {pendingQueueCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                    {pendingQueueCount}
                  </span>
                ) : (
                  <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800">
                    Tesseract Ready
                  </span>
                )}
              </button>

              <button
                onClick={triggerCameraInput}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Capture receipt with device camera"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>Camera</span>
              </button>

              <button
                onClick={triggerFileInput}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                title="Select multiple receipt images from device gallery"
              >
                <UploadCloud className="w-3.5 h-3.5 text-slate-600" />
                <span>Choose Files</span>
              </button>

              <button
                onClick={() => setShowManualModal(true)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Manually record a store purchase"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                <span>Manual</span>
              </button>

              {queuedFiles.length > 0 && (
                <button
                  onClick={clearAllQueued}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="Clear all selected photos"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Hidden inputs supporting multiple files and direct camera */}
          <input
            type="file"
            multiple
            className="hidden"
            accept="image/*,application/pdf"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <input
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            onChange={handleFileChange}
          />

          {/* Drop & Preview Area */}
          <div
            className={`border-2 border-dashed rounded-2xl p-5 transition-all flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[260px]
              ${queuedFiles.length > 0 ? 'border-emerald-200 bg-slate-50/40' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400 cursor-pointer'}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={queuedFiles.length === 0 ? triggerFileInput : undefined}
          >
            {queuedFiles.length > 0 ? (
              <div className="w-full space-y-4">
                {/* Active Photo Preview */}
                <div className="relative max-h-[300px] flex items-center justify-center rounded-xl overflow-hidden bg-white border border-slate-200 shadow-xs">
                  {activeQueued?.previewUrl ? (
                    <img
                      src={activeQueued.previewUrl}
                      alt="Receipt Preview"
                      className="max-h-[300px] object-contain rounded-xl"
                    />
                  ) : (
                    <div className="p-8 text-center text-slate-500">
                      <FileType className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                      <span className="font-bold text-xs">{activeQueued?.file.name}</span>
                    </div>
                  )}

                  {/* Scanning Laser Animation */}
                  {isLoading && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl bg-emerald-500/10 backdrop-contrast-125">
                      <div className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 shadow-[0_0_16px_3px_rgba(16,185,129,0.9)] animate-scan-laser" />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/15 to-transparent animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Queue Thumbnails Bar (When multiple files are selected) */}
                {queuedFiles.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 justify-center">
                    {queuedFiles.map((qf, idx) => (
                      <div
                        key={qf.id}
                        onClick={() => setActivePreviewIndex(idx)}
                        className={`relative w-14 h-14 rounded-xl border-2 overflow-hidden shrink-0 cursor-pointer transition-all ${
                          idx === activePreviewIndex
                            ? 'border-emerald-600 scale-105 shadow-sm'
                            : 'border-slate-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        {qf.previewUrl ? (
                          <img src={qf.previewUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] font-bold">
                            PDF
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeQueuedFile(qf.id);
                          }}
                          className="absolute -top-1 -right-1 bg-slate-900 text-white rounded-full p-0.5 hover:bg-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={triggerFileInput}
                      className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-white flex flex-col items-center justify-center text-slate-400 hover:text-emerald-600 shrink-0 transition-colors"
                      title="Add more receipts to batch"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[9px] font-bold mt-0.5">Add</span>
                    </button>
                  </div>
                )}

                {/* Status Indicator */}
                {isLoading && (
                  <div className="px-4 py-2 bg-slate-900 text-white rounded-full shadow-lg border border-slate-700 inline-flex items-center gap-2 text-xs font-semibold animate-pulse mx-auto">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                    <span className="text-emerald-300">{loadingStage}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 flex flex-col items-center justify-center text-slate-500 py-6">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1 shadow-inner">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    Tap to upload or take a photo of one or multiple receipts
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports multiple files or multiple slips laid side-by-side in a single photo
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <span className="text-[10px] font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg">
                    Multiple Slips in 1 Photo
                  </span>
                  <span className="text-[10px] font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg">
                    Batch File Upload
                  </span>
                  <span className="text-[10px] font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg">
                    PNG, JPG, PDF
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={parseReceipts}
            disabled={queuedFiles.length === 0 || isLoading}
            className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{loadingStage}</span>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>
                  {queuedFiles.length > 1
                    ? `Extract All Receipts from ${queuedFiles.length} Photos`
                    : 'Extract & File Receipts'}
                </span>
              </div>
            )}
          </button>

          {/* Sanitized Error Alert */}
          {error && (
            <div className="p-4 bg-rose-50 text-rose-900 border border-rose-200 rounded-xl flex flex-col sm:flex-row items-start justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div>
                  <p className="font-bold text-rose-900">{error}</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    You can retry scanning, adjust photo lighting, or log receipt details manually.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                {(error.includes('Gemini API Key') || error.includes('Standalone') || error.includes('server')) && (
                  <button
                    onClick={() => setShowApiKeyModal(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Connect Free Key</span>
                  </button>
                )}
                <button
                  onClick={() => setShowManualModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-600 inline mr-1" />
                  <span>Manual Entry</span>
                </button>
                <button
                  onClick={parseReceipts}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Successfully Filed Confirmation */}
        {filedReceipts.length > 0 && (
          <div className="p-5 bg-emerald-50 border-2 border-emerald-500 rounded-2xl shadow-sm space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">
                    🎉 Successfully Filed {filedReceipts.length} Receipt{filedReceipts.length > 1 ? 's' : ''}!
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium">
                    All slips, prices, and line items have been saved to your Android device storage.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onViewMonth(filedReceipts[0]?.month_year || '2026-09')}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <span>View in {filedReceipts[0]?.month_year}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={clearAllQueued}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Scan More
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {filedReceipts.map((r, i) => (
                <div key={r.id} className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 truncate">{r.vendor_name}</span>
                    <span className="font-mono font-bold text-emerald-700">R {Number(r.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{r.invoice_date}</span>
                    <span>{r.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detected Receipts Review List (Before Final Filing) */}
        {detectedReceipts.length > 0 && (() => {
          const totalDetectedAmount = detectedReceipts.reduce((acc, r) => acc + (r.total_amount || 0), 0);
          const activeDuplicateCount = detectedReceipts.filter(r => duplicatesMap.has(r.id) && !dismissedDuplicateIds.has(r.id)).length;

          return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-lg">
                      {detectedReceipts.length} Receipt{detectedReceipts.length > 1 ? 's' : ''} Detected
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      Combined Spend: <strong className="text-slate-800 font-mono">R {totalDetectedAmount.toFixed(2)}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Review and adjust stores, amounts, or categories before filing to your monthly ledger
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFileAllDetected}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>File All {detectedReceipts.length} Receipts to Ledger</span>
                  </button>
                </div>
              </div>

              {/* Duplicate Safety Alert Banner */}
              {activeDuplicateCount > 0 && (
                <div className="bg-amber-500/10 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <div className="font-bold text-amber-900 text-sm">
                        Duplicate Protection Active: {activeDuplicateCount} potential duplicate slip{activeDuplicateCount > 1 ? 's' : ''} detected
                      </div>
                      <div className="text-amber-800 text-xs">
                        We detected matching purchases in your ledger. You can skip duplicates or file only new receipts.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSkipDuplicatesAndFileNew}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer shadow-xs transition-colors self-end sm:self-auto flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Skip Duplicates & File New ({detectedReceipts.length - activeDuplicateCount})</span>
                  </button>
                </div>
              )}

              {/* List of Detected Slips */}
              <div className="space-y-3">
                {detectedReceipts.map((rec, idx) => {
                  const isExpanded = expandedReceiptIds.has(rec.id);
                  const dup = duplicatesMap.get(rec.id);
                  const isDuplicate = Boolean(dup && !dismissedDuplicateIds.has(rec.id));

                  return (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-xl border transition-all space-y-3 ${
                        isDuplicate
                          ? 'border-amber-300 bg-amber-50/40 shadow-xs ring-1 ring-amber-300/60'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                      }`}
                    >
                      {/* Per-Slip Duplicate Warning Banner */}
                      {isDuplicate && dup && (
                        <div className="bg-amber-100/90 border border-amber-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-950">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                            <div>
                              <span className="font-bold text-amber-900">Duplicate Scan Warning: </span>
                              <span className="text-amber-800">{dup.matchReason}</span>
                              {!dup.isBatchDuplicate && (
                                <div className="text-[11px] text-amber-700 mt-0.5">
                                  Matches existing ledger entry from <strong>{dup.matchedReceipt.month_year}</strong> ({dup.matchedReceipt.invoice_date})
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => removeDetectedReceipt(rec.id)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                              title="Discard this duplicate slip"
                            >
                              Skip Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismissDuplicate(rec.id)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                              title="Keep as legitimate separate purchase"
                            >
                              Keep Anyway
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-1">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={rec.vendor_name}
                              onChange={(e) => updateDetectedReceipt(rec.id, { vendor_name: e.target.value })}
                              className="font-bold text-slate-900 text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white px-1 py-0.5 rounded transition-all w-full max-w-xs focus:outline-none"
                              placeholder="Store Name"
                            />
                            {rec.engine_used === 'local_tesseract' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0" title="Extracted offline using on-device Tesseract OCR">
                                <Cpu className="w-3 h-3 text-emerald-600" />
                                <span>Tesseract</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0" title="Extracted using Cloud AI Vision">
                                <Cloud className="w-3 h-3 text-blue-600" />
                                <span>Cloud AI</span>
                              </span>
                            )}
                          </div>
                          {rec.notes && (
                            <div className="text-[10px] text-slate-400 px-1">{rec.notes}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                        <input
                          type="date"
                          value={rec.invoice_date}
                          onChange={(e) => updateDetectedReceipt(rec.id, { invoice_date: e.target.value })}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />

                        <select
                          value={rec.category}
                          onChange={(e) => updateDetectedReceipt(rec.id, { category: e.target.value as any })}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          <option value="Food & Groceries">Food & Groceries</option>
                          <option value="Electricity & Utilities">Electricity & Utilities</option>
                          <option value="Home Maintenance">Home Maintenance</option>
                          <option value="Transport">Transport</option>
                          <option value="Other">Other</option>
                        </select>

                        <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          <span className="text-xs font-bold text-slate-400">R</span>
                          <input
                            type="number"
                            step="0.01"
                            value={rec.total_amount}
                            onChange={(e) => updateDetectedReceipt(rec.id, { total_amount: parseFloat(e.target.value) || 0 })}
                            className="font-black text-slate-900 text-sm w-20 focus:outline-none font-mono"
                          />
                        </div>

                        <button
                          onClick={() => toggleExpand(rec.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="View line items"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => removeDetectedReceipt(rec.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete slip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Line Items */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-200/80 text-xs space-y-2">
                        <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                          <span>Extracted Line Items ({rec.line_items.length})</span>
                          <span>Unit & Total</span>
                        </div>
                        {rec.line_items.length === 0 ? (
                          <div className="text-slate-400 italic text-[11px]">No individual items itemized for this slip.</div>
                        ) : (
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {rec.line_items.map((item, itemIdx) => (
                              <div key={itemIdx} className="flex items-center justify-between py-1 px-2 bg-white rounded-lg border border-slate-100 text-slate-700">
                                <div>
                                  <span className="font-semibold">{item.description}</span>
                                  {item.quantity > 1 && (
                                    <span className="text-[10px] text-slate-400 ml-1.5">(x{item.quantity})</span>
                                  )}
                                </div>
                                <span className="font-mono font-bold text-slate-800">
                                  R {Number(item.total_price).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => downloadSingleReceiptPDF(rec)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                            title="Save slip as vector PDF"
                          >
                            <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Save PDF / Print to PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => printSingleReceiptSafely(rec)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                            title="Print slip"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            <span>Print</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Filing Bar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                All {detectedReceipts.length} slips will be filed chronologically into their respective months.
              </span>
              <button
                onClick={handleFileAllDetected}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <span>Confirm & File {detectedReceipts.length} Receipts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Duplicate Scan Safety Interceptor Modal */}
      {showDuplicateSafetyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-amber-200 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-950 text-base leading-tight">Duplicate Scan Protection</h3>
                  <p className="text-xs text-amber-800">Safety check before filing to monthly ledger</p>
                </div>
              </div>
              <button
                onClick={() => setShowDuplicateSafetyModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="text-xs text-slate-600 leading-relaxed">
                The scanner detected that <strong>{detectedReceipts.filter(r => duplicatesMap.has(r.id) && !dismissedDuplicateIds.has(r.id)).length}</strong> of your <strong>{detectedReceipts.length}</strong> receipts appear to already be recorded in your ledger. Filing duplicate scans can duplicate expenditure and skew totals.
              </div>

              {/* Duplicate summary list */}
              <div className="space-y-2">
                {detectedReceipts
                  .filter(r => duplicatesMap.has(r.id) && !dismissedDuplicateIds.has(r.id))
                  .map(dupSlip => {
                    const match = duplicatesMap.get(dupSlip.id);
                    return (
                      <div key={dupSlip.id} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{dupSlip.vendor_name}</span>
                          <span className="font-mono text-emerald-800">R {Number(dupSlip.total_amount).toFixed(2)}</span>
                        </div>
                        <div className="text-[11px] text-amber-900">
                          {match?.matchReason}
                        </div>
                        {match && !match.isBatchDuplicate && (
                          <div className="text-[10px] text-slate-500">
                            Recorded in ledger: {match.matchedReceipt.month_year} ({match.matchedReceipt.invoice_date})
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowDuplicateSafetyModal(false)}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 cursor-pointer"
              >
                Cancel & Review Slips
              </button>

              <button
                type="button"
                onClick={() => executeFileReceipts(detectedReceipts)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs cursor-pointer"
                title="Save all receipts anyway including duplicates"
              >
                File All Anyway ({detectedReceipts.length})
              </button>

              <button
                type="button"
                onClick={handleSkipDuplicatesAndFileNew}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Skip Duplicates & File New ({detectedReceipts.length - detectedReceipts.filter(r => duplicatesMap.has(r.id) && !dismissedDuplicateIds.has(r.id)).length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </section>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">Manual Receipt Entry</h3>
                  <p className="text-xs text-slate-500">File slip directly into month expenditure</p>
                </div>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Duplicate Safety Warning for Manual Entry */}
              {manualDuplicateWarning && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Duplicate Purchase Safety Warning</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    An existing receipt for <strong>{manualDuplicateWarning.matchedReceipt.vendor_name}</strong> on <strong>{manualDuplicateWarning.matchedReceipt.invoice_date}</strong> (R {Number(manualDuplicateWarning.matchedReceipt.total_amount).toFixed(2)}) is already in your ledger.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSaveManual(undefined, true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      Save Anyway
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualDuplicateWarning(null)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vendor / Store Name</label>
                  <input
                    type="text"
                    required
                    value={manualVendor}
                    onChange={(e) => setManualVendor(e.target.value)}
                    placeholder="e.g. Pick n Pay, Rayton Express, Eskom"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Date</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e: any) => setManualCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="Food & Groceries">Food & Groceries</option>
                    <option value="Electricity & Utilities">Electricity & Utilities</option>
                    <option value="Home Maintenance">Home Maintenance</option>
                    <option value="Transport">Transport</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={manualCurrency}
                    onChange={(e) => setManualCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Total Spend</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={manualTotal}
                    onChange={(e) => setManualTotal(e.target.value)}
                    placeholder="241.71"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Line items section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Line Items (Optional)</span>
                  <button
                    type="button"
                    onClick={addManualItem}
                    className="text-[11px] text-emerald-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {manualItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                      <input
                        type="text"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateManualItem(idx, 'description', e.target.value)}
                        className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateManualItem(idx, 'quantity', e.target.value)}
                        className="w-14 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Total"
                        value={item.total_price}
                        onChange={(e) => updateManualItem(idx, 'total_price', e.target.value)}
                        className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => removeManualItem(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-colors shadow-md cursor-pointer"
                >
                  Save & File to Month
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gemini API Key Configuration Modal for Standalone / APK Mode */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">Gemini Vision OCR Key</h3>
                  <p className="text-xs text-slate-500">Enable on-device receipt scanning</p>
                </div>
              </div>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              When using ParserPro as an Android APK or offline PWA without a dedicated backend server, receipts are scanned directly on your device using Google&apos;s free Gemini Vision OCR.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Google Gemini API Key</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <div className="flex justify-between items-center text-[11px] pt-1">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 font-bold hover:underline flex items-center gap-1"
                >
                  Get a free key from Google AI Studio &rarr;
                </a>
                {apiKeyInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiKeyInput('');
                      setClientGeminiApiKey('');
                    }}
                    className="text-rose-500 hover:underline text-[10px] cursor-pointer"
                  >
                    Clear Key
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                {apiKeySavedSuccess ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                <span>{apiKeySavedSuccess ? 'Saved & Scanning!' : 'Save & Continue'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline OCR Queue Modal */}
      <OfflineOcrQueueModal
        isOpen={showQueueModal}
        onClose={() => setShowQueueModal(false)}
        onImportExtractedReceipts={(receipts) => {
          setDetectedReceipts((prev) => [...prev, ...receipts]);
          setFailSafeNotice(`Imported ${receipts.length} receipt(s) from offline cache.`);
          setTimeout(() => setFailSafeNotice(null), 4000);
        }}
      />
    </div>
  );
};
