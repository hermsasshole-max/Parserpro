import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  HardDrive, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  Clock, 
  FileSpreadsheet, 
  RotateCcw, 
  Plus, 
  Trash2,
  Share2
} from 'lucide-react';
import type { SavedReceipt } from '../types';
import { 
  exportDeviceBackupJSON, 
  parseBackupFile, 
  exportAllInvoicesToCSV, 
  getDeviceStorageStats, 
  createDeviceSnapshot, 
  getDeviceSnapshots, 
  deleteDeviceSnapshot,
  requestPersistentDeviceStorage,
  type DeviceSnapshot, 
  type DeviceStorageStats 
} from '../utils/deviceStorage';

interface AndroidBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: SavedReceipt[];
  onRestoreData: (receipts: SavedReceipt[]) => void;
}

export const AndroidBackupModal: React.FC<AndroidBackupModalProps> = ({
  isOpen,
  onClose,
  receipts,
  onRestoreData
}) => {
  const [stats, setStats] = useState<DeviceStorageStats | null>(null);
  const [snapshots, setSnapshots] = useState<DeviceSnapshot[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    receipts: SavedReceipt[];
    count: number;
    filename: string;
  } | null>(null);
  const [isPersisting, setIsPersisting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen, receipts]);

  const loadStats = async () => {
    const s = await getDeviceStorageStats(receipts);
    setStats(s);
    const snaps = await getDeviceSnapshots();
    setSnapshots(snaps);
  };

  if (!isOpen) return null;

  const handleExportBackup = async () => {
    if (receipts.length === 0) {
      setStatusMessage({ type: 'info', text: 'No invoices currently in ledger to backup.' });
      return;
    }
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const res = await exportDeviceBackupJSON(receipts);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Backup successfully saved to your Android device (${res.filename}). Find it in your Downloads or Files app.`
        });
        await loadStats();
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Could not export backup. Please check your browser storage/download permissions.'
        });
      }
    } catch (e) {
      setStatusMessage({
        type: 'error',
        text: 'Backup export encountered an error.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (receipts.length === 0) {
      setStatusMessage({ type: 'info', text: 'No receipts to export.' });
      return;
    }
    try {
      exportAllInvoicesToCSV(receipts);
      setStatusMessage({
        type: 'success',
        text: 'All invoices & itemized records exported to CSV and saved to your device Downloads!'
      });
    } catch (e) {
      setStatusMessage({
        type: 'error',
        text: 'CSV export encountered an error.'
      });
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await parseBackupFile(file);
    if (!result.success) {
      setStatusMessage({
        type: 'error',
        text: result.message
      });
    } else {
      setPendingImport({
        receipts: result.receipts,
        count: result.receipts.length,
        filename: file.name
      });
    }
    e.target.value = '';
  };

  const confirmImportReplace = async () => {
    if (!pendingImport) return;
    // Auto-create snapshot of current state before replacing
    if (receipts.length > 0) {
      await createDeviceSnapshot(receipts, `Auto-backup before restoring ${pendingImport.filename}`);
    }
    onRestoreData(pendingImport.receipts);
    setStatusMessage({
      type: 'success',
      text: `Restored ${pendingImport.count} invoices from ${pendingImport.filename} to your Android device!`
    });
    setPendingImport(null);
    await loadStats();
  };

  const confirmImportMerge = async () => {
    if (!pendingImport) return;
    if (receipts.length > 0) {
      await createDeviceSnapshot(receipts, `Auto-backup before merging ${pendingImport.filename}`);
    }
    const existingIds = new Set(receipts.map(r => r.id));
    const newItems = pendingImport.receipts.filter(r => !existingIds.has(r.id));
    const merged = [...receipts, ...newItems];
    onRestoreData(merged);
    setStatusMessage({
      type: 'success',
      text: `Merged ${newItems.length} new invoices into your current ${receipts.length} records!`
    });
    setPendingImport(null);
    await loadStats();
  };

  const handleCreateSnapshot = async () => {
    if (receipts.length === 0) {
      setStatusMessage({ type: 'info', text: 'No data to snapshot.' });
      return;
    }
    const label = `Manual Snapshot (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    await createDeviceSnapshot(receipts, label);
    setStatusMessage({
      type: 'success',
      text: 'Created an instant on-device snapshot point.'
    });
    await loadStats();
  };

  const handleRestoreSnapshot = async (snap: DeviceSnapshot) => {
    if (confirm(`Restore snapshot "${snap.label}" containing ${snap.receiptCount} invoices?`)) {
      if (receipts.length > 0) {
        await createDeviceSnapshot(receipts, 'Auto-backup before snapshot rollback');
      }
      onRestoreData(snap.receipts);
      setStatusMessage({
        type: 'success',
        text: `Restored snapshot "${snap.label}"!`
      });
      await loadStats();
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    await deleteDeviceSnapshot(id);
    await loadStats();
  };

  const handleRequestPersistence = async () => {
    setIsPersisting(true);
    const granted = await requestPersistentDeviceStorage();
    setIsPersisting(false);
    if (granted) {
      setStatusMessage({
        type: 'success',
        text: 'Android OS has granted permanent storage persistence! Data will not be evicted during storage cleanups.'
      });
    } else {
      setStatusMessage({
        type: 'info',
        text: 'Persistence requested. Storage is safely retained in IndexedDB and LocalStorage.'
      });
    }
    await loadStats();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">Android Device Storage & Backup Hub</h2>
                <span className="px-1.5 py-0.5 bg-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded border border-emerald-400/40">
                  On-Device
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Save, backup, restore, and preserve all receipts and reports on your Android device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800 text-xs">
          {/* Status Toast Alert */}
          {statusMessage && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{statusMessage.text}</div>
              <button 
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-slate-700 ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Pending Import Confirmation Dialog */}
          {pendingImport && (
            <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Backup File Verified: {pendingImport.filename}</span>
              </div>
              <p className="text-slate-600">
                This backup contains <strong>{pendingImport.count} invoices</strong>. Choose how you would like to restore it to your device:
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={confirmImportReplace}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Replace All Existing ({pendingImport.count} Invoices)
                </button>
                <button
                  onClick={confirmImportMerge}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Merge with Current ({receipts.length} existing)
                </button>
                <button
                  onClick={() => setPendingImport(null)}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Device Storage Status Overview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Android Device Storage Status
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold text-[11px] text-emerald-800">
                  {stats?.isPersistent ? 'Permanent Persistence' : 'Local + IndexedDB Active'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Invoices Saved</span>
                <span className="text-base font-black text-slate-800">{receipts.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Unique Items</span>
                <span className="text-base font-black text-slate-800">{stats?.lineItemCount || 0}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Spend</span>
                <span className="text-base font-black text-slate-800 font-mono">
                  R {(stats?.totalSpend || 0).toFixed(2)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Months Filed</span>
                <span className="text-base font-black text-slate-800">{stats?.monthsCount || 0}</span>
              </div>
            </div>

            {!stats?.isPersistent && (
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200/80">
                <span className="text-[11px] text-slate-500">
                  Protect against Android automatic browser cache eviction during low device storage:
                </span>
                <button
                  onClick={handleRequestPersistence}
                  disabled={isPersisting}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
                >
                  {isPersisting ? 'Requesting...' : 'Guarantee Persistent Storage'}
                </button>
              </div>
            )}
          </div>

          {/* Primary Android Backup & Restore Buttons */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Device Backup & Restore Actions
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Backup Button */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Backup to Android Device</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Downloads an all-in-one JSON backup file directly into your Android device&apos;s Downloads folder or opens Android system share sheet.
                  </p>
                </div>
                <button
                  onClick={handleExportBackup}
                  disabled={isExporting || receipts.length === 0}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isExporting ? 'Preparing Backup...' : 'Save Backup to Device (.json)'}</span>
                </button>
              </div>

              {/* Restore Button */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <Upload className="w-4 h-4 text-slate-700" />
                    <span>Restore from Android Device</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Select a previously downloaded <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">.json</code> backup from your Android file manager to restore all invoices.
                  </p>
                </div>
                <label className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer text-center">
                  <Upload className="w-4 h-4" />
                  <span>Choose Backup File from Device</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Full CSV Ledger Export */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800">Export All Invoices & Line Items (CSV)</div>
                <div className="text-slate-500 text-[11px]">Save raw spreadsheet of all purchases to your Android device</div>
              </div>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={receipts.length === 0}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          </div>

          {/* On-Device Snapshots / Rollbacks */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>On-Device Rollback Snapshots ({snapshots.length}/6)</span>
              </div>
              <button
                onClick={handleCreateSnapshot}
                disabled={receipts.length === 0}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Create Snapshot</span>
              </button>
            </div>

            {snapshots.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                No local rollback points created yet. Automatic snapshots are saved whenever backups or restores occur.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-800 text-[11px]">{snap.label}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(snap.timestamp).toLocaleString()} • {snap.receiptCount} invoices (R {snap.totalSpend.toFixed(2)})
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRestoreSnapshot(snap)}
                        className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Restore this snapshot"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Android Storage Location Guide */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <div className="font-bold text-slate-700 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Where are my backups on Android?</span>
            </div>
            <p>
              When you tap <strong>Save Backup</strong> or <strong>Download CSV</strong>, your Android browser saves the files to your device&apos;s default <strong>Downloads</strong> folder. You can access them at any time via the <strong>Files</strong> or <strong>My Files</strong> app on your device, or share them to Google Drive.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>All data remains strictly on your device (100% Client-Side Privacy)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
