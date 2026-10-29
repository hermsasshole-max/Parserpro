import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Check,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Loader2,
  X,
  Sparkles,
  WifiOff,
  FilePlus2,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { LineItem, ReceiptCategory, ReceiptData, SavedReceipt } from '../types';
import { compressAndPrepareImage } from '../utils/imageUtils';
import {
  isCapacitorPlatform,
  captureReceiptWithNativeCamera,
  pickReceiptFromGallery,
} from '../utils/nativeCamera';
import { executeFailSafeOcr } from '../utils/failSafeOcrCoordinator';
import {
  computeImageFingerprint,
  getDisplayInvoiceNumber,
  identifyBatchDuplicates,
  isDuplicateQueuedFile,
  type DuplicateMatch,
} from '../utils/duplicateDetection';
import {
  recordSmartScanUsed,
  FREE_MONTHLY_SMART_SCANS,
  type SubscriptionState,
  type UpgradeTriggerReason,
} from '../utils/subscriptionManager';
import {
  formatCategoryLabel,
  formatMoney,
  formatShortDate,
  normalizeReceiptCategory,
} from '../utils/currencyFormat';

interface QueuedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
  fingerprint: string;
}

interface ExtractedDraft extends ReceiptData {
  draftId: string;
  sourceFileName: string;
  previewUrl?: string;
  selected: boolean;
}

interface ReceiptScannerProps {
  existingReceipts: SavedReceipt[];
  subscriptionState: SubscriptionState;
  currencyCode: string;
  pendingOfflineCount: number;
  cameraLaunchTrigger?: number;
  onSaveReceipts: (newReceipts: SavedReceipt[]) => void;
  onOpenUpgrade: (reason: UpgradeTriggerReason) => void;
  onOpenSearch: () => void;
  onOpenAddManual: () => void;
  onOpenOfflineQueue: () => void;
}

const CATEGORIES: ReceiptCategory[] = [
  'Food & Groceries',
  'Electricity & Utilities',
  'Home Maintenance',
  'Transport',
  'Other',
];

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  existingReceipts,
  subscriptionState,
  currencyCode,
  pendingOfflineCount,
  cameraLaunchTrigger = 0,
  onSaveReceipts,
  onOpenUpgrade,
  onOpenSearch,
  onOpenAddManual,
  onOpenOfflineQueue,
}) => {
  const [queuedPhotos, setQueuedPhotos] = useState<QueuedPhoto[]>([]);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState('');
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLimitFallbackPrompt, setShowLimitFallbackPrompt] = useState(false);

  const [drafts, setDrafts] = useState<ExtractedDraft[]>([]);
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Record<string, boolean>>({});
  const [savedBannerCount, setSavedBannerCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const lastHandledTriggerRef = useRef<number>(cameraLaunchTrigger);

  const isPlus = subscriptionState.tier === 'plus';

  // Live duplicate evaluation whenever Store, Date, Invoice #, Total, or saved receipts change
  const duplicateMap = useMemo<Map<string, DuplicateMatch>>(() => {
    if (drafts.length === 0) return new Map();
    const asSavedForCheck: SavedReceipt[] = drafts.map((d) => ({
      ...d,
      id: d.draftId,
      created_at: new Date().toISOString(),
    }));
    return identifyBatchDuplicates(asSavedForCheck, existingReceipts);
  }, [drafts, existingReceipts]);

  const processSelectedFiles = async (files: File[]) => {
    if (!files.length) return;
    setErrorMessage(null);
    setSavedBannerCount(null);

    let allowedFiles = files;

    // Gate multi-photo batch scanning on Free Starter while keeping the first photo queued
    if (!isPlus) {
      if (queuedPhotos.length >= 1) {
        onOpenUpgrade('batch_multi_photo');
        setScanNotice(
          'Free Starter scans one photo at a time. Upgrade to ParserPro Plus to queue multiple photos at once.'
        );
        return;
      }
      if (files.length > 1) {
        allowedFiles = [files[0]];
        onOpenUpgrade('batch_multi_photo');
        setScanNotice(
          'Your first photo is ready below. Upgrade to ParserPro Plus to scan multiple photos in one batch.'
        );
      }
    }

    setIsPreparingPhoto(true);
    try {
      const preparedItems: QueuedPhoto[] = [];
      let skippedSameTrayCount = 0;

      for (const file of allowedFiles) {
        const compressed = await compressAndPrepareImage(file, 2200, 0.86);
        const fingerprint = computeImageFingerprint(compressed.base64Data);

        if (
          isDuplicateQueuedFile(
            compressed.file,
            [...queuedPhotos, ...preparedItems],
            fingerprint
          )
        ) {
          skippedSameTrayCount += 1;
          continue;
        }

        const previewUrl = URL.createObjectURL(compressed.file);
        preparedItems.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file: compressed.file,
          previewUrl,
          base64Data: compressed.base64Data,
          mimeType: compressed.mimeType,
          fingerprint,
        });
      }

      if (skippedSameTrayCount > 0) {
        setScanNotice('Duplicate photo skipped — that receipt image is already in your scan tray.');
      }

      if (preparedItems.length > 0) {
        setQueuedPhotos((prev) => [...prev, ...preparedItems]);
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Could not load that image. Please try another photo.'
      );
    } finally {
      setIsPreparingPhoto(false);
    }
  };

  const handleTakePhotoClick = async () => {
    setErrorMessage(null);
    if (!isPlus && queuedPhotos.length >= 1) {
      onOpenUpgrade('batch_multi_photo');
      return;
    }

    if (isCapacitorPlatform()) {
      try {
        const captured = await captureReceiptWithNativeCamera();
        if (captured) {
          await processSelectedFiles([captured.file]);
        }
        return;
      } catch {
        // Fallback to standard file input if permission dialog was dismissed or webview fallback needed
      }
    }
    cameraInputRef.current?.click();
  };

  useEffect(() => {
    if (cameraLaunchTrigger > 0 && cameraLaunchTrigger !== lastHandledTriggerRef.current) {
      lastHandledTriggerRef.current = cameraLaunchTrigger;
      handleTakePhotoClick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraLaunchTrigger]);

  const handleChoosePhotoClick = async () => {
    setErrorMessage(null);
    if (!isPlus && queuedPhotos.length >= 1) {
      onOpenUpgrade('batch_multi_photo');
      return;
    }

    if (isCapacitorPlatform() && !isPlus) {
      try {
        const picked = await pickReceiptFromGallery();
        if (picked) {
          await processSelectedFiles([picked.file]);
        }
        return;
      } catch {
        // Fallback to standard file input
      }
    }
    galleryInputRef.current?.click();
  };

  const removeQueuedPhoto = (id: string) => {
    setQueuedPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
    setShowLimitFallbackPrompt(false);
  };

  const runScan = async (forceOffline = false) => {
    if (queuedPhotos.length === 0 || isScanning) return;

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Check monthly smart scan allowance on Free Starter (offline scans are always free!)
    if (!isPlus && !forceOffline && isOnline) {
      if (subscriptionState.smartScansRemaining <= 0) {
        setShowLimitFallbackPrompt(true);
        onOpenUpgrade('scan_limit_reached');
        return;
      }
    }

    setIsScanning(true);
    setShowLimitFallbackPrompt(false);
    setErrorMessage(null);
    setScanNotice(null);

    const extractedList: ExtractedDraft[] = [];
    const warnings: string[] = [];
    let cloudPhotosScanned = 0;

    try {
      for (let i = 0; i < queuedPhotos.length; i++) {
        const photo = queuedPhotos[i];
        const prefix =
          queuedPhotos.length > 1 ? `Photo ${i + 1} of ${queuedPhotos.length}: ` : '';

        setScanStage(`${prefix}Reading store, date, invoice # & items...`);

        const result = await executeFailSafeOcr({
          base64Data: photo.base64Data,
          mimeType: photo.mimeType,
          fileName: photo.file.name,
          fileSize: photo.file.size,
          previewUrl: `data:${photo.mimeType};base64,${photo.base64Data}`,
          options: {
            mode: forceOffline ? 'local_tesseract_only' : 'auto_fallback',
            preferredCurrency: currencyCode,
            onStage: (stage) => setScanStage(`${prefix}${stage}`),
          },
        });

        if (result.engineUsed === 'cloud_api') {
          cloudPhotosScanned += 1;
        }
        if (result.warning) {
          warnings.push(result.warning);
        }

        result.receipts.forEach((slip, idx) => {
          const todayIso = new Date().toISOString().substring(0, 10);
          const safeDate =
            slip.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(slip.invoice_date)
              ? slip.invoice_date
              : todayIso;
          const safeMonth = safeDate.substring(0, 7);
          const normalizedCat = normalizeReceiptCategory(slip.category, 'Food & Groceries');
          const normalizedItems: LineItem[] = (slip.line_items || []).map((li) => ({
            description: li.description || 'Receipt Item',
            quantity: Number(li.quantity) > 0 ? Number(li.quantity) : 1,
            unit_price: Number(li.unit_price) || 0,
            total_price:
              Number(li.total_price) > 0
                ? Number(li.total_price)
                : Number(((Number(li.quantity) || 1) * (Number(li.unit_price) || 0)).toFixed(2)),
            category: normalizeReceiptCategory(li.category, normalizedCat),
          }));

          extractedList.push({
            ...slip,
            invoice_number: (slip.invoice_number || getDisplayInvoiceNumber(slip) || '').trim(),
            invoice_date: safeDate,
            month_year: safeMonth,
            category: normalizedCat,
            line_items: normalizedItems,
            currency: slip.currency || currencyCode,
            image_fingerprint: slip.image_fingerprint || photo.fingerprint,
            draftId: `draft_${Date.now()}_${i}_${idx}_${Math.random()
              .toString(36)
              .substring(2, 6)}`,
            sourceFileName: photo.file.name,
            previewUrl: `data:${photo.mimeType};base64,${photo.base64Data}`,
            selected: true,
          });
        });
      }

      // Deduct smart scan credits ONLY when cloud smart scan succeeded (never for offline scans)
      if (!isPlus && cloudPhotosScanned > 0) {
        recordSmartScanUsed(cloudPhotosScanned);
      }

      // Evaluate duplicates immediately against historical ledger + current batch
      const asSavedForCheck: SavedReceipt[] = extractedList.map((d) => ({
        ...d,
        id: d.draftId,
        created_at: new Date().toISOString(),
      }));
      const initialDupes = identifyBatchDuplicates(asSavedForCheck, existingReceipts);

      const finalDrafts = extractedList.map((d) => ({
        ...d,
        selected: !initialDupes.get(d.draftId)?.isBlocked,
      }));

      setDrafts(finalDrafts);
      setQueuedPhotos([]);

      const blockedCount = Array.from(initialDupes.values()).filter((m) => m.isBlocked).length;
      if (blockedCount > 0) {
        setScanNotice(
          blockedCount === extractedList.length
            ? 'Duplicate receipt detected and blocked — verify Store, Date, and Invoice # below.'
            : `${blockedCount} duplicate ${blockedCount === 1 ? 'receipt was' : 'receipts were'} automatically blocked.`
        );
      } else if (warnings.length > 0) {
        setScanNotice(warnings[0]);
      } else if (extractedList.length > 1) {
        setScanNotice(
          `Found ${extractedList.length} separate receipts. Confirm Store, Date & Invoice # below before accepting.`
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          'Could not read this photo right now. You can try again or enter the total manually.'
      );
    } finally {
      setIsScanning(false);
      setScanStage('');
    }
  };

  const updateDraftField = <K extends keyof ExtractedDraft>(
    draftId: string,
    field: K,
    value: ExtractedDraft[K]
  ) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.draftId !== draftId) return d;
        const next = { ...d, [field]: value };
        if (field === 'invoice_date' && typeof value === 'string' && value.length >= 7) {
          next.month_year = value.substring(0, 7);
        }
        return next;
      })
    );
  };

  const updateDraftLineItem = (
    draftId: string,
    itemIndex: number,
    patch: Partial<LineItem>
  ) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.draftId !== draftId) return d;
        const updatedItems = (d.line_items || []).map((item, idx) => {
          if (idx !== itemIndex) return item;
          const merged = { ...item, ...patch };
          if ('quantity' in patch || 'unit_price' in patch) {
            const qty = Math.max(0.01, Number(merged.quantity) || 1);
            const unit = Math.max(0, Number(merged.unit_price) || 0);
            merged.total_price = Number((qty * unit).toFixed(2));
          }
          return merged;
        });

        const sumItems = updatedItems.reduce(
          (sum, li) => sum + (Number(li.total_price) || 0),
          0
        );
        return {
          ...d,
          line_items: updatedItems,
          total_amount: sumItems > 0 ? Number(sumItems.toFixed(2)) : d.total_amount,
          subtotal:
            sumItems > 0
              ? Number(Math.max(0, sumItems - (Number(d.tax) || 0)).toFixed(2))
              : d.subtotal,
        };
      })
    );
  };

  const addDraftLineItem = (draftId: string) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.draftId !== draftId) return d;
        const nextItems: LineItem[] = [
          ...(d.line_items || []),
          {
            description: '',
            quantity: 1,
            unit_price: 0,
            total_price: 0,
            category: d.category,
          },
        ];
        return { ...d, line_items: nextItems };
      })
    );
  };

  const removeDraftLineItem = (draftId: string, itemIndex: number) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.draftId !== draftId) return d;
        const nextItems = (d.line_items || []).filter((_, idx) => idx !== itemIndex);
        const sumItems = nextItems.reduce(
          (sum, li) => sum + (Number(li.total_price) || 0),
          0
        );
        return {
          ...d,
          line_items: nextItems,
          total_amount: sumItems > 0 ? Number(sumItems.toFixed(2)) : d.total_amount,
        };
      })
    );
  };

  const acceptedDrafts = drafts.filter(
    (d) => d.selected && !duplicateMap.get(d.draftId)?.isBlocked
  );
  const blockedDraftCount = drafts.filter(
    (d) => Boolean(duplicateMap.get(d.draftId)?.isBlocked)
  ).length;
  const selectedDraftCount = acceptedDrafts.length;
  const selectedTotalSpend = acceptedDrafts.reduce(
    (sum, d) => sum + (Number(d.total_amount) || 0),
    0
  );

  const handleSaveSelectedDrafts = () => {
    setErrorMessage(null);

    if (acceptedDrafts.length === 0) {
      setErrorMessage(
        blockedDraftCount > 0
          ? 'Duplicate receipt scans are blocked from saving to prevent double-counting.'
          : 'Select at least one verified receipt below to accept.'
      );
      return;
    }

    const toSave: SavedReceipt[] = acceptedDrafts.map((d) => {
      const cleanedItems = (d.line_items || [])
        .filter((li) => li.description.trim().length > 0)
        .map((li) => ({
          ...li,
          category: normalizeReceiptCategory(li.category, d.category),
        }));

      const numericTotal = Number(d.total_amount) || 0;
      const finalItems: LineItem[] =
        cleanedItems.length > 0
          ? cleanedItems
          : [
              {
                description: `${d.vendor_name.trim() || 'Store'} purchase`,
                quantity: 1,
                unit_price: numericTotal,
                total_price: numericTotal,
                category: d.category,
              },
            ];

      return {
        id: `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        created_at: new Date().toISOString(),
        vendor_name: d.vendor_name.trim() || 'Store Receipt',
        invoice_number: (d.invoice_number || '').trim() || undefined,
        invoice_date: d.invoice_date,
        month_year: d.invoice_date.substring(0, 7),
        category: d.category,
        currency: d.currency || currencyCode,
        line_items: finalItems,
        subtotal: Number(d.subtotal) || numericTotal,
        tax: Number(d.tax) || 0,
        total_amount: numericTotal,
        notes: d.notes || '',
        engine_used: d.engine_used,
        image_fingerprint: d.image_fingerprint,
        file_name: d.sourceFileName,
        image_preview: d.previewUrl,
      };
    });

    onSaveReceipts(toSave);
    setDrafts([]);
    setScanNotice(null);
    setSavedBannerCount(toSave.length);
  };

  return (
    <div className="space-y-6">
      {/* Workspace Utility Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {isPlus ? (
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              ParserPro Plus · Unlimited smart & batch scans
            </span>
          ) : (
            <span className="tabular-nums">
              <strong className="font-semibold text-slate-900 dark:text-white">
                {subscriptionState.smartScansRemaining} of {FREE_MONTHLY_SMART_SCANS}
              </strong>{' '}
              free smart scans left this month
            </span>
          )}
          {!isPlus && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onOpenUpgrade('general')}
                className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
              >
                Get unlimited
              </button>
            </>
          )}
          {pendingOfflineCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenOfflineQueue}
                className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400 hover:underline whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5" />
                {pendingOfflineCount} pending offline
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span>Search</span>
            <kbd className="hidden md:inline text-[11px] font-mono text-slate-400">⌘K</kbd>
          </button>

          <button
            type="button"
            onClick={onOpenAddManual}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="w-4 h-4 text-slate-500" />
            <span>Add Manually</span>
          </button>
        </div>
      </div>

      {/* Saved Confirmation Banner */}
      {savedBannerCount !== null && (
        <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm font-medium text-emerald-900 dark:text-emerald-200">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Accepted & saved {savedBannerCount}{' '}
              {savedBannerCount === 1 ? 'receipt' : 'receipts'} to your monthly ledger.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSavedBannerCount(null)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-emerald-700 dark:text-emerald-300 hover:opacity-80"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Primary Capture Card */}
      {drafts.length === 0 && (
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = Array.from(e.dataTransfer.files).filter((f) =>
              f.type.startsWith('image/')
            );
            if (dropped.length > 0) {
              processSelectedFiles(dropped);
            }
          }}
          className={`rounded-3xl bg-white dark:bg-slate-900 border transition-colors p-6 sm:p-10 ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
              : 'border-slate-200/90 dark:border-slate-800'
          }`}
        >
          <div className="max-w-xl mx-auto text-center space-y-5">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                Snap a receipt and let ParserPro extract every item
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Extracts store, purchase date, invoice number, unit prices, quantities, and
                categories — while automatically blocking duplicate receipt scans.
              </p>
            </div>

            {/* Hidden Native/Web File Inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                processSelectedFiles(files);
                e.target.value = '';
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple={isPlus}
              className="hidden"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                processSelectedFiles(files);
                e.target.value = '';
              }}
            />

            {/* Primary Capture Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isScanning || isPreparingPhoto}
                onClick={handleTakePhotoClick}
                className="min-h-[52px] px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99] transition-all whitespace-nowrap"
              >
                <Camera className="w-5 h-5 shrink-0" />
                <span>Take Photo</span>
              </button>

              <button
                type="button"
                disabled={isScanning || isPreparingPhoto}
                onClick={handleChoosePhotoClick}
                className="min-h-[52px] px-6 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 disabled:opacity-60 text-slate-900 dark:text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 active:scale-[0.99] transition-all whitespace-nowrap"
              >
                <ImageIcon className="w-5 h-5 shrink-0 text-slate-600 dark:text-slate-300" />
                <span>{isPlus ? 'Choose Photos' : 'Choose Photo'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automatic fold-shadow & paper-curl alignment keeps every item matched to its exact
              amount — online or offline.
            </p>
          </div>

          {/* Queued Photos Tray */}
          {(queuedPhotos.length > 0 || isPreparingPhoto) && (
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Ready to scan ({queuedPhotos.length}{' '}
                  {queuedPhotos.length === 1 ? 'photo' : 'photos'})
                </p>
                {isPlus && !isScanning && (
                  <button
                    type="button"
                    onClick={handleChoosePhotoClick}
                    className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add more photos
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {queuedPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 aspect-[4/3]"
                  >
                    <img
                      src={photo.previewUrl}
                      alt={photo.file.name || 'Receipt photo preview'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {!isScanning && (
                      <button
                        type="button"
                        onClick={() => removeQueuedPhoto(photo.id)}
                        aria-label="Remove photo"
                        className="absolute top-2 right-2 min-h-[36px] min-w-[36px] rounded-xl bg-black/70 text-white flex items-center justify-center hover:bg-black/85 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Free Limit Reached Friendly Alternatives */}
              {showLimitFallbackPrompt && !isPlus && (
                <div className="rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 p-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                      You have used all {FREE_MONTHLY_SMART_SCANS} free smart scans for this month
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-300/90">
                      Unlock unlimited smart scans with ParserPro Plus, or keep tracking right now
                      for free using on-device offline reading or manual entry:
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenUpgrade('scan_limit_reached')}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap"
                    >
                      <Sparkles className="w-4 h-4" />
                      Upgrade to Plus
                    </button>
                    <button
                      type="button"
                      onClick={() => runScan(true)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap"
                    >
                      <WifiOff className="w-4 h-4" />
                      Scan Offline on Phone (Free)
                    </button>
                    <button
                      type="button"
                      onClick={onOpenAddManual}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium whitespace-nowrap"
                    >
                      Enter Manually (Free)
                    </button>
                  </div>
                </div>
              )}

              {/* Scan Action Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
                {isScanning ? (
                  <div className="w-full py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                    <span>{scanStage || 'Reading receipt...'}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => runScan(false)}
                    className="min-h-[48px] px-6 py-3 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {queuedPhotos.length > 1
                        ? `Scan ${queuedPhotos.length} Photos Now`
                        : 'Read Receipt Now'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Helpful Notices & Error States */}
      {scanNotice && (
        <div className="rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between gap-3">
          <span>{scanNotice}</span>
          <button
            type="button"
            onClick={() => setScanNotice(null)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/70 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={onOpenAddManual}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-900 dark:text-rose-200 whitespace-nowrap self-start sm:self-auto"
          >
            Add Manually Instead
          </button>
        </div>
      )}

      {/* Pre-Acceptance Receipt Verification & Itemized Review */}
      {drafts.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Verify Store, Date & Invoice # Before Accepting
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Confirm the receipt details and itemized lines below. Duplicate receipts are
                automatically blocked.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDrafts([]);
                setErrorMessage(null);
                setScanNotice(null);
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap self-start sm:self-auto"
            >
              Discard & Scan Again
            </button>
          </div>

          <div className="space-y-4">
            {drafts.map((draft, index) => {
              const dupeMatch = duplicateMap.get(draft.draftId);
              const isBlocked = Boolean(dupeMatch?.isBlocked);
              const isIncluded = draft.selected && !isBlocked;
              const notedInvoiceNum =
                (draft.invoice_number || '').trim() || getDisplayInvoiceNumber(draft);
              const matchedSavedInvoiceNum = dupeMatch
                ? getDisplayInvoiceNumber(dupeMatch.matchedReceipt)
                : '';

              return (
                <div
                  key={draft.draftId}
                  className={`rounded-2xl bg-white dark:bg-slate-900 border p-5 sm:p-6 space-y-5 transition-opacity ${
                    isBlocked
                      ? 'border-rose-300 dark:border-rose-800/80'
                      : isIncluded
                      ? 'border-slate-200 dark:border-slate-800'
                      : 'border-slate-200/60 dark:border-slate-800/60 opacity-65'
                  }`}
                >
                  {/* Pre-Acceptance Store, Date & Invoice Number Verification Strip */}
                  <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Pre-Acceptance Receipt Verification
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                        <span>
                          <span className="text-slate-500 dark:text-slate-400">Store:</span>{' '}
                          <strong className="font-semibold text-slate-900 dark:text-white">
                            {draft.vendor_name.trim() || 'Unspecified Store'}
                          </strong>
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span>
                          <span className="text-slate-500 dark:text-slate-400">Date:</span>{' '}
                          <strong className="font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                            {formatShortDate(draft.invoice_date)}
                          </strong>
                        </span>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span>
                          <span className="text-slate-500 dark:text-slate-400">Invoice #:</span>{' '}
                          <strong className="font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                            {notedInvoiceNum || 'Not printed on slip'}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold shrink-0">
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>Duplicate Blocked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>Verified Unique</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hard-Blocked Duplicate Failsafe Callout */}
                  {dupeMatch && isBlocked && (
                    <div className="rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/80 px-4 py-3 flex items-start gap-3 text-xs sm:text-sm text-rose-950 dark:text-rose-200">
                      <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold">
                          Duplicate Receipt Scan Blocked — Cannot Be Accepted
                        </p>
                        <p className="text-rose-800 dark:text-rose-300 leading-relaxed">
                          Matches saved receipt:{' '}
                          <strong className="font-semibold">
                            {dupeMatch.matchedReceipt.vendor_name}
                          </strong>{' '}
                          ·{' '}
                          <span className="font-mono tabular-nums">
                            {formatShortDate(dupeMatch.matchedReceipt.invoice_date)}
                          </span>
                          {matchedSavedInvoiceNum ? (
                            <>
                              {' '}
                              · Invoice{' '}
                              <span className="font-mono tabular-nums font-semibold">
                                #{matchedSavedInvoiceNum}
                              </span>
                            </>
                          ) : null}{' '}
                          ·{' '}
                          <span className="font-mono tabular-nums font-semibold">
                            {formatMoney(dupeMatch.matchedReceipt.total_amount, currencyCode)}
                          </span>
                          .
                        </p>
                        <p className="text-xs text-rose-700 dark:text-rose-300/90">
                          {dupeMatch.matchReason}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Top Row: Accept Checkbox + Total Summary */}
                  <div className="flex items-center justify-between gap-3">
                    <label
                      className={`min-h-[44px] flex items-center gap-3 select-none ${
                        isBlocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        disabled={isBlocked}
                        onChange={(e) =>
                          updateDraftField(draft.draftId, 'selected', e.target.checked)
                        }
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 disabled:opacity-50"
                      />
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {isBlocked
                          ? 'Blocked duplicate receipt'
                          : drafts.length > 1
                          ? `Accept Receipt ${index + 1}`
                          : 'Accept this receipt'}
                      </span>
                    </label>

                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{draft.line_items?.length || 0} items</span>
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {formatMoney(draft.total_amount, currencyCode)}
                      </span>
                    </div>
                  </div>

                  {/* Editable Receipt Header Fields (Store, Date, Invoice #, Total) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Store or Provider
                      </label>
                      <input
                        type="text"
                        value={draft.vendor_name}
                        onChange={(e) =>
                          updateDraftField(draft.draftId, 'vendor_name', e.target.value)
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Purchase Date
                      </label>
                      <input
                        type="date"
                        value={draft.invoice_date}
                        onChange={(e) =>
                          updateDraftField(draft.draftId, 'invoice_date', e.target.value)
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Invoice / Slip #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. INV-4821"
                        value={draft.invoice_number || ''}
                        onChange={(e) =>
                          updateDraftField(draft.draftId, 'invoice_number', e.target.value)
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Total Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={draft.total_amount}
                        onChange={(e) =>
                          updateDraftField(
                            draft.draftId,
                            'total_amount',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Primary Receipt Category
                      </label>
                      <select
                        value={draft.category}
                        onChange={(e) =>
                          updateDraftField(
                            draft.draftId,
                            'category',
                            e.target.value as ReceiptCategory
                          )
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {formatCategoryLabel(cat)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Optional Note
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Weekly household groceries"
                        value={draft.notes || ''}
                        onChange={(e) =>
                          updateDraftField(draft.draftId, 'notes', e.target.value)
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Itemized Line-Item Extraction & Category Assignment */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    {(() => {
                      const itemsSum = Number(
                        (draft.line_items || [])
                          .reduce((acc, li) => acc + (Number(li.total_price) || 0), 0)
                          .toFixed(2)
                      );
                      const receiptTotal = Number(draft.total_amount) || 0;
                      const receiptTax = Number(draft.tax) || 0;
                      const matchesTotal =
                        receiptTotal > 0 &&
                        itemsSum > 0 &&
                        (Math.abs(itemsSum - receiptTotal) <= 0.15 ||
                          (receiptTax > 0 && Math.abs(itemsSum + receiptTax - receiptTotal) <= 0.15));
                      const hasMismatch =
                        receiptTotal > 0 && itemsSum > 0 && !matchesTotal;
                      const isPreviewOpen = Boolean(expandedPreviewIds[draft.draftId]);

                      return (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                  Extracted Line Items ({draft.line_items?.length || 0})
                                </p>
                                {matchesTotal && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                    <Check className="w-3 h-3" />
                                    <span>Items match total</span>
                                  </span>
                                )}
                                {hasMismatch && (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 tabular-nums">
                                    <span>
                                      Items sum: {formatMoney(itemsSum, currencyCode)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateDraftField(draft.draftId, 'total_amount', itemsSum)
                                      }
                                      className="underline font-semibold hover:opacity-80"
                                    >
                                      Use items sum
                                    </button>
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Purchase Date: {formatShortDate(draft.invoice_date)} · Item name,
                                qty, unit price & category
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {draft.previewUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedPreviewIds((prev) => ({
                                      ...prev,
                                      [draft.draftId]: !prev[draft.draftId],
                                    }))
                                  }
                                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  {isPreviewOpen ? (
                                    <>
                                      <EyeOff className="w-3.5 h-3.5" />
                                      <span>Hide Slip</span>
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Check Slip Photo</span>
                                    </>
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => addDraftLineItem(draft.draftId)}
                                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 whitespace-nowrap"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Item</span>
                              </button>
                            </div>
                          </div>

                          {isPreviewOpen && draft.previewUrl && (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-2 max-h-72 overflow-y-auto">
                              <img
                                src={draft.previewUrl}
                                alt="Scanned receipt slip reference"
                                referrerPolicy="no-referrer"
                                className="w-full h-auto rounded-lg object-contain"
                              />
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {draft.line_items && draft.line_items.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-72 overflow-y-auto pr-1 space-y-2">
                        {draft.line_items.map((item, idx) => (
                          <div
                            key={idx}
                            className="pt-2 first:pt-0 grid grid-cols-12 gap-2 items-center text-xs"
                          >
                            <input
                              type="text"
                              placeholder="Item name"
                              aria-label="Item name"
                              value={item.description}
                              onChange={(e) =>
                                updateDraftLineItem(draft.draftId, idx, {
                                  description: e.target.value,
                                })
                              }
                              className="col-span-12 sm:col-span-4 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-900 dark:text-white"
                            />
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              aria-label="Quantity"
                              title="Quantity"
                              value={item.quantity}
                              onChange={(e) =>
                                updateDraftLineItem(draft.draftId, idx, {
                                  quantity: Math.max(0.01, parseFloat(e.target.value) || 1),
                                })
                              }
                              className="col-span-3 sm:col-span-1 min-h-[40px] px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-center font-mono tabular-nums text-slate-900 dark:text-white"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              aria-label="Unit price"
                              title="Unit price"
                              placeholder="Unit price"
                              value={item.unit_price}
                              onChange={(e) =>
                                updateDraftLineItem(draft.draftId, idx, {
                                  unit_price: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="col-span-4 sm:col-span-2 min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-right font-mono tabular-nums text-slate-900 dark:text-white"
                            />
                            <select
                              aria-label="Assigned item category"
                              value={item.category || draft.category}
                              onChange={(e) =>
                                updateDraftLineItem(draft.draftId, idx, {
                                  category: e.target.value as ReceiptCategory,
                                })
                              }
                              className="col-span-5 sm:col-span-3 min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 truncate"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {formatCategoryLabel(cat)}
                                </option>
                              ))}
                            </select>
                            <div className="col-span-12 sm:col-span-2 flex items-center justify-end gap-1.5">
                              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                                {formatMoney(item.total_price, currencyCode)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeDraftLineItem(draft.draftId, idx)}
                                aria-label="Remove line item"
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No individual items detected yet — tap Add Item to itemize manually.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accept & Save Bar */}
          <div className="rounded-2xl bg-slate-900 dark:bg-slate-900 border border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">
                {selectedDraftCount} verified{' '}
                {selectedDraftCount === 1 ? 'receipt' : 'receipts'} ready to accept
                {blockedDraftCount > 0
                  ? ` · ${blockedDraftCount} duplicate ${
                      blockedDraftCount === 1 ? 'blocked' : 'blocked'
                    }`
                  : ''}
              </p>
              <p className="text-xs text-slate-300 tabular-nums">
                Accepted total: {formatMoney(selectedTotalSpend, currencyCode)}
              </p>
            </div>
            <button
              type="button"
              disabled={selectedDraftCount === 0}
              onClick={handleSaveSelectedDrafts}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
            >
              {selectedDraftCount === 0 && blockedDraftCount > 0 ? (
                <>
                  <ShieldAlert className="w-5 h-5" />
                  <span>Duplicate Receipt Blocked</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>
                    Accept & Save{' '}
                    {selectedDraftCount === 1 ? 'Receipt' : `${selectedDraftCount} Receipts`}
                  </span>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* Recent Activity Quick Peek when idle */}
      {drafts.length === 0 && queuedPhotos.length === 0 && existingReceipts.length > 0 && (
        <section className="pt-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Recently saved
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {existingReceipts.length} total{' '}
              {existingReceipts.length === 1 ? 'receipt' : 'receipts'}
            </span>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {existingReceipts.slice(0, 3).map((rcpt) => {
              const inv = getDisplayInvoiceNumber(rcpt);
              return (
                <div
                  key={rcpt.id}
                  className="px-4 py-3.5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {rcpt.vendor_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      <span>{formatShortDate(rcpt.invoice_date)}</span>
                      {inv && (
                        <>
                          <span aria-hidden="true" className="mx-1.5">
                            ·
                          </span>
                          <span className="font-mono tabular-nums">#{inv}</span>
                        </>
                      )}
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      <span>{formatCategoryLabel(rcpt.category)}</span>
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      <span className="tabular-nums">{rcpt.line_items?.length || 0} items</span>
                    </p>
                  </div>
                  <span className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
                    {formatMoney(rcpt.total_amount, currencyCode)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
