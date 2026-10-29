import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Check,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  Clock,
  Loader2,
  X,
  Sparkles,
  WifiOff,
  FilePlus2,
} from 'lucide-react';
import type { ReceiptCategory, ReceiptData, SavedReceipt } from '../types';
import { compressAndPrepareImage } from '../utils/imageUtils';
import {
  isCapacitorPlatform,
  captureReceiptWithNativeCamera,
  pickReceiptFromGallery,
} from '../utils/nativeCamera';
import { executeFailSafeOcr } from '../utils/failSafeOcrCoordinator';
import {
  identifyBatchDuplicates,
  type DuplicateMatch,
} from '../utils/duplicateDetection';
import {
  recordSmartScanUsed,
  FREE_MONTHLY_SMART_SCANS,
  type SubscriptionState,
  type UpgradeTriggerReason,
} from '../utils/subscriptionManager';
import { formatMoney, formatShortDate } from '../utils/currencyFormat';

interface QueuedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
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
  const [duplicateMap, setDuplicateMap] = useState<Map<string, DuplicateMatch>>(new Map());
  const [savedBannerCount, setSavedBannerCount] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const lastHandledTriggerRef = useRef<number>(cameraLaunchTrigger);

  const isPlus = subscriptionState.tier === 'plus';

  const processSelectedFiles = async (files: File[]) => {
    if (!files.length) return;
    setErrorMessage(null);
    setSavedBannerCount(null);

    let allowedFiles = files;

    // Gate multi-photo batch scanning on Free Starter while keeping the first photo queued!
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
      for (const file of allowedFiles) {
        const compressed = await compressAndPrepareImage(file, 1800, 0.84);
        const previewUrl = URL.createObjectURL(compressed.file);
        preparedItems.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file: compressed.file,
          previewUrl,
          base64Data: compressed.base64Data,
          mimeType: compressed.mimeType,
        });
      }
      setQueuedPhotos((prev) => [...prev, ...preparedItems]);
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

        setScanStage(`${prefix}Reading store, date & items...`);

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

          extractedList.push({
            ...slip,
            invoice_date: safeDate,
            month_year: safeMonth,
            currency: slip.currency || currencyCode,
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

      // Run duplicate detection against existing saved receipts
      const asSavedForCheck: SavedReceipt[] = extractedList.map((d) => ({
        ...d,
        id: d.draftId,
        created_at: new Date().toISOString(),
      }));
      const dupes = identifyBatchDuplicates(asSavedForCheck, existingReceipts);

      // Automatically uncheck high-confidence duplicates so users don't double-count by accident,
      // while still letting them check the box if it really was a second purchase!
      const finalDrafts = extractedList.map((d) => ({
        ...d,
        selected: !dupes.has(d.draftId),
      }));

      setDuplicateMap(dupes);
      setDrafts(finalDrafts);
      setQueuedPhotos([]);

      if (warnings.length > 0) {
        setScanNotice(warnings[0]);
      } else if (extractedList.length > 1) {
        setScanNotice(
          `Found ${extractedList.length} separate receipts. Review below and tap Save.`
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

  const handleSaveSelectedDrafts = () => {
    const chosen = drafts.filter((d) => d.selected);
    if (chosen.length === 0) {
      setErrorMessage('Select at least one receipt below to save.');
      return;
    }

    const toSave: SavedReceipt[] = chosen.map((d) => ({
      id: `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      created_at: new Date().toISOString(),
      vendor_name: d.vendor_name.trim() || 'Store Receipt',
      invoice_date: d.invoice_date,
      month_year: d.invoice_date.substring(0, 7),
      category: d.category,
      currency: d.currency || currencyCode,
      line_items: d.line_items || [],
      subtotal: Number(d.subtotal) || Number(d.total_amount) || 0,
      tax: Number(d.tax) || 0,
      total_amount: Number(d.total_amount) || 0,
      notes: d.notes || '',
      engine_used: d.engine_used,
      file_name: d.sourceFileName,
      image_preview: d.previewUrl,
    }));

    onSaveReceipts(toSave);
    setDrafts([]);
    setDuplicateMap(new Map());
    setScanNotice(null);
    setSavedBannerCount(toSave.length);
  };

  const selectedDraftCount = drafts.filter((d) => d.selected).length;
  const selectedTotalSpend = drafts
    .filter((d) => d.selected)
    .reduce((sum, d) => sum + (Number(d.total_amount) || 0), 0);

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
              Saved {savedBannerCount} {savedBannerCount === 1 ? 'receipt' : 'receipts'} to your
              monthly ledger.
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
                Snap a receipt and let ParserPro do the typing
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Point your camera at a grocery slip, utility bill, or fuel receipt. Even multiple
                slips in a single photo are separated automatically.
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
              Works offline too — if you lose signal in a shop, your receipt is read right on your
              phone at no credit cost.
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

      {/* Extracted Receipt Review List */}
      {drafts.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Review extracted {drafts.length === 1 ? 'receipt' : `receipts (${drafts.length})`}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Check the store name, date, and total below before saving to your ledger.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDrafts([]);
                setDuplicateMap(new Map());
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap self-start sm:self-auto"
            >
              Discard & Scan Again
            </button>
          </div>

          <div className="space-y-4">
            {drafts.map((draft, index) => {
              const dupeMatch = duplicateMap.get(draft.draftId);
              return (
                <div
                  key={draft.draftId}
                  className={`rounded-2xl bg-white dark:bg-slate-900 border p-5 sm:p-6 space-y-4 transition-opacity ${
                    draft.selected
                      ? 'border-slate-200 dark:border-slate-800'
                      : 'border-slate-200/60 dark:border-slate-800/60 opacity-65'
                  }`}
                >
                  {/* Duplicate Warning Callout */}
                  {dupeMatch && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          Looks similar to an existing receipt ({dupeMatch.matchedReceipt.vendor_name} ·{' '}
                          {formatShortDate(dupeMatch.matchedReceipt.invoice_date)} ·{' '}
                          {formatMoney(dupeMatch.matchedReceipt.total_amount, currencyCode)})
                        </p>
                        <p className="text-amber-800 dark:text-amber-300/90 mt-0.5">
                          We unchecked this slip to prevent double-counting. Check the box below if
                          this was a separate purchase.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Top Row: Include Checkbox + Slip Metadata */}
                  <div className="flex items-center justify-between gap-3">
                    <label className="min-h-[44px] flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={draft.selected}
                        onChange={(e) =>
                          updateDraftField(draft.draftId, 'selected', e.target.checked)
                        }
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                      />
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {drafts.length > 1 ? `Receipt ${index + 1}` : 'Include this receipt'}
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

                  {/* Editable Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
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

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Date
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

                    <div>
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
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Category
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
                            {cat}
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
                        placeholder="e.g. Weekly groceries"
                        value={draft.notes || ''}
                        onChange={(e) =>
                          updateDraftField(draft.draftId, 'notes', e.target.value)
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Extracted Line Items Preview */}
                  {draft.line_items && draft.line_items.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                        Extracted items
                      </p>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-48 overflow-y-auto pr-1">
                        {draft.line_items.map((item, idx) => (
                          <div
                            key={idx}
                            className="py-1.5 flex items-center justify-between gap-3 text-xs sm:text-sm"
                          >
                            <span className="text-slate-700 dark:text-slate-300 truncate">
                              {item.quantity > 1 ? `${item.quantity} × ` : ''}
                              {item.description}
                            </span>
                            <span className="font-mono tabular-nums text-slate-900 dark:text-white shrink-0">
                              {formatMoney(item.total_price, currencyCode)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save Bar */}
          <div className="rounded-2xl bg-slate-900 dark:bg-slate-900 border border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">
                {selectedDraftCount} {selectedDraftCount === 1 ? 'receipt' : 'receipts'} selected
              </p>
              <p className="text-xs text-slate-300 tabular-nums">
                Combined total: {formatMoney(selectedTotalSpend, currencyCode)}
              </p>
            </div>
            <button
              type="button"
              disabled={selectedDraftCount === 0}
              onClick={handleSaveSelectedDrafts}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Check className="w-5 h-5" />
              <span>
                Save {selectedDraftCount === 1 ? 'Receipt' : `${selectedDraftCount} Receipts`}
              </span>
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
              {existingReceipts.length} total {existingReceipts.length === 1 ? 'receipt' : 'receipts'}
            </span>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {existingReceipts.slice(0, 3).map((rcpt) => (
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
                    <span aria-hidden="true" className="mx-1.5">
                      ·
                    </span>
                    <span>{rcpt.category}</span>
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
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
