import React, { useEffect, useState } from 'react';
import { X, Check, Trash2, Clock } from 'lucide-react';
import type { CachedReceiptJob, SavedReceipt } from '../types';
import {
  subscribeToQueue,
  removeQueueJob,
  clearCompletedQueueJobs,
} from '../utils/offlineOcrQueue';
import { formatMoney, formatShortDate } from '../utils/currencyFormat';

interface OfflineOcrQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencyCode: string;
  onSaveExtractedReceipts: (receipts: SavedReceipt[]) => void;
}

export const OfflineOcrQueueModal: React.FC<OfflineOcrQueueModalProps> = ({
  isOpen,
  onClose,
  currencyCode,
  onSaveExtractedReceipts,
}) => {
  const [jobs, setJobs] = useState<CachedReceiptJob[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToQueue((updatedJobs) => {
      setJobs(updatedJobs);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleSaveJobReceipts = async (job: CachedReceiptJob) => {
    if (!job.extractedReceipts || job.extractedReceipts.length === 0) return;

    const toSave: SavedReceipt[] = job.extractedReceipts.map((r, idx) => {
      const todayIso = new Date().toISOString().substring(0, 10);
      const safeDate =
        r.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(r.invoice_date)
          ? r.invoice_date
          : todayIso;
      return {
        ...r,
        id: `rcpt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        created_at: new Date().toISOString(),
        invoice_date: safeDate,
        month_year: safeDate.substring(0, 7),
        currency: r.currency || currencyCode,
        file_name: job.fileName,
        image_preview: job.previewUrl,
      };
    });

    onSaveExtractedReceipts(toSave);
    await removeQueueJob(job.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-queue-title"
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3" />

        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="offline-queue-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Pending Offline Scans
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Photos captured while offline are finished automatically when signal returns.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pending scans"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pb-safe-modal overflow-y-auto space-y-3 flex-1">
          {jobs.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No pending offline scans
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Any receipt photo taken without internet will wait safely here.
              </p>
            </div>
          ) : (
            jobs.map((job) => {
              const extractedCount = job.extractedReceipts?.length || 0;
              const extractedTotal = (job.extractedReceipts || []).reduce(
                (s, r) => s + (Number(r.total_amount) || 0),
                0
              );

              const statusText =
                job.status === 'completed'
                  ? 'Ready to save'
                  : job.status === 'fallback_extracted'
                  ? 'Read offline on phone'
                  : job.status === 'processing'
                  ? 'Reading now...'
                  : 'Waiting for internet';

              return (
                <div
                  key={job.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {job.extractedReceipts?.[0]?.vendor_name || job.fileName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>{statusText}</span>
                        <span aria-hidden="true" className="mx-1.5">
                          ·
                        </span>
                        <span>{formatShortDate(job.createdAt.substring(0, 10))}</span>
                        {extractedCount > 0 && (
                          <>
                            <span aria-hidden="true" className="mx-1.5">
                              ·
                            </span>
                            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                              {formatMoney(extractedTotal, currencyCode)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeQueueJob(job.id)}
                      aria-label="Remove pending scan"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {extractedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSaveJobReceipts(job)}
                      className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        Save {extractedCount === 1 ? 'Receipt' : `${extractedCount} Receipts`} to
                        Ledger
                      </span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {jobs.some((j) => j.status === 'completed') && (
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={() => clearCompletedQueueJobs()}
              className="min-h-[40px] px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              Clear completed
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
