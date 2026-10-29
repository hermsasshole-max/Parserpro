import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  Lock,
  Check,
  History,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import type { SavedReceipt } from '../types';
import {
  exportDeviceBackupJSON,
  parseBackupFile,
  exportAllInvoicesToCSV,
  createDeviceSnapshot,
  getDeviceSnapshots,
  deleteDeviceSnapshot,
  type DeviceSnapshot,
} from '../utils/deviceStorage';
import type { UpgradeTriggerReason } from '../utils/subscriptionManager';
import { formatMoney, formatShortDate } from '../utils/currencyFormat';

interface AndroidBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: SavedReceipt[];
  onRestoreReceipts: (restored: SavedReceipt[]) => void;
  isPlus: boolean;
  currencyCode: string;
  onOpenUpgrade: (reason: UpgradeTriggerReason) => void;
}

export const AndroidBackupModal: React.FC<AndroidBackupModalProps> = ({
  isOpen,
  onClose,
  receipts,
  onRestoreReceipts,
  isPlus,
  currencyCode,
  onOpenUpgrade,
}) => {
  const [snapshots, setSnapshots] = useState<DeviceSnapshot[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmRestoreSnapId, setConfirmRestoreSnapId] = useState<string | null>(null);
  const [confirmDeleteSnapId, setConfirmDeleteSnapId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSnapshots = async () => {
    const list = await getDeviceSnapshots();
    setSnapshots(list);
  };

  useEffect(() => {
    if (isOpen) {
      setStatusMessage(null);
      setErrorMessage(null);
      refreshSnapshots();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFullBackupClick = async () => {
    if (!isPlus) {
      onOpenUpgrade('full_backup');
      return;
    }
    setErrorMessage(null);
    const res = await exportDeviceBackupJSON(receipts);
    if (res.success) {
      setStatusMessage(`Backup saved (${res.filename}).`);
    } else {
      setErrorMessage('Could not save backup file. Please try again.');
    }
  };

  const handleCsvExportAllClick = () => {
    if (!isPlus) {
      onOpenUpgrade('csv_export');
      return;
    }
    exportAllInvoicesToCSV(receipts);
    setStatusMessage('Spreadsheet exported with all saved receipts and items.');
  };

  const handleCreateSnapshot = async () => {
    if (!isPlus) {
      onOpenUpgrade('full_backup');
      return;
    }
    const label = `Snapshot · ${new Date().toLocaleDateString()}`;
    await createDeviceSnapshot(receipts, label);
    await refreshSnapshots();
    setStatusMessage('Recovery point saved on this device.');
  };

  const handleImportFile = async (file: File) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const result = await parseBackupFile(file);
    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }
    onRestoreReceipts(result.receipts);
    setStatusMessage(`Restored ${result.receipts.length} receipts from backup.`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3" />

        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="backup-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Backups & Spreadsheets
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Keep your receipts safe when switching phones or exporting to Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close backups"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pb-safe-modal overflow-y-auto space-y-5 flex-1">
          {statusMessage && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 px-4 py-3 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/70 px-4 py-3 text-xs sm:text-sm text-rose-900 dark:text-rose-200">
              {errorMessage}
            </div>
          )}

          {/* Always-Free Restore from File */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Restore from Backup File (Always Free)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Moving to a new phone? Import any ParserPro <code>.json</code> backup file for free.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[48px] px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>Import Backup File (.json)</span>
            </button>
          </div>

          {/* Plus Exports */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Full Backups & Excel Spreadsheets
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={receipts.length === 0 && isPlus}
                onClick={handleFullBackupClick}
                className="min-h-[48px] px-4 py-3 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isPlus ? (
                  <Download className="w-4 h-4" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                <span>Save Full Backup</span>
              </button>

              <button
                type="button"
                disabled={receipts.length === 0 && isPlus}
                onClick={handleCsvExportAllClick}
                className="min-h-[48px] px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-900 dark:text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isPlus ? (
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Export All to Excel</span>
              </button>
            </div>
          </div>

          {/* On-Device Recovery Snapshots */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  On-Device Recovery Points
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Save instant restore points before making bulk edits.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateSnapshot}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {isPlus ? (
                  <History className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Save Point</span>
              </button>
            </div>

            {snapshots.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {snapshots.map((snap) => (
                  <div key={snap.id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {snap.label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span>{formatShortDate(snap.timestamp.substring(0, 10))}</span>
                          <span aria-hidden="true" className="mx-1.5">
                            ·
                          </span>
                          <span>{snap.receiptCount} receipts</span>
                          <span aria-hidden="true" className="mx-1.5">
                            ·
                          </span>
                          <span>{formatMoney(snap.totalSpend, currencyCode)}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {confirmRestoreSnapId === snap.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onRestoreReceipts(snap.receipts);
                                setConfirmRestoreSnapId(null);
                                setStatusMessage(`Restored "${snap.label}".`);
                              }}
                              className="min-h-[38px] px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreSnapId(null)}
                              className="min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                            >
                              Cancel
                            </button>
                          </>
                        ) : confirmDeleteSnapId === snap.id ? (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteDeviceSnapshot(snap.id);
                                setConfirmDeleteSnapId(null);
                                refreshSnapshots();
                              }}
                              className="min-h-[38px] px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSnapId(null)}
                              className="min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setConfirmRestoreSnapId(snap.id)}
                              className="min-h-[38px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSnapId(snap.id)}
                              aria-label="Delete snapshot"
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
