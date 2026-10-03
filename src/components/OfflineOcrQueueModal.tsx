import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  Cloud, 
  Wifi, 
  WifiOff, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  FileText,
  Sliders
} from 'lucide-react';
import type { CachedReceiptJob, OcrEngineMode, SavedReceipt } from '../types';
import { 
  getAllQueueJobs, 
  removeQueueJob, 
  updateQueueJob, 
  clearCompletedQueueJobs,
  subscribeToQueue,
  recordJobFailure
} from '../utils/offlineOcrQueue';
import { 
  getStoredOcrMode, 
  setStoredOcrMode, 
  getStoredApiTimeoutMs, 
  setStoredApiTimeoutMs,
  executeFailSafeOcr
} from '../utils/failSafeOcrCoordinator';
import { performLocalTesseractOcr, parseLocalOcrTextToReceipts } from '../utils/localTesseractOcr';

interface OfflineOcrQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportExtractedReceipts?: (receipts: SavedReceipt[]) => void;
}

export const OfflineOcrQueueModal: React.FC<OfflineOcrQueueModalProps> = ({
  isOpen,
  onClose,
  onImportExtractedReceipts
}) => {
  const [jobs, setJobs] = useState<CachedReceiptJob[]>([]);
  const [engineMode, setEngineMode] = useState<OcrEngineMode>(() => getStoredOcrMode());
  const [timeoutSec, setTimeoutSec] = useState<number>(() => Math.round(getStoredApiTimeoutMs() / 1000));
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Listen to network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to queue changes
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeToQueue((updatedJobs) => {
      setJobs(updatedJobs);
    });
    return () => unsubscribe();
  }, [isOpen]);

  // Update countdown timer every second
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEngineModeChange = (mode: OcrEngineMode) => {
    setEngineMode(mode);
    setStoredOcrMode(mode);
    setActionNotice(`OCR Engine set to: ${
      mode === 'auto_fallback' 
        ? 'Auto Fail-Safe (Cloud API with Tesseract Fallback)' 
        : mode === 'local_tesseract_only' 
        ? '100% Offline (Local Tesseract Only)' 
        : 'Cloud API Only'
    }`);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleTimeoutChange = (sec: number) => {
    setTimeoutSec(sec);
    setStoredApiTimeoutMs(sec * 1000);
    setActionNotice(`Fail-safe timeout updated to ${sec} seconds.`);
    setTimeout(() => setActionNotice(null), 2500);
  };

  const handleRunTesseractNow = async (job: CachedReceiptJob) => {
    setProcessingJobId(job.id);
    setActionNotice(`Running on-device Tesseract OCR on "${job.fileName}"...`);

    try {
      await updateQueueJob(job.id, { status: 'processing', engineUsed: 'local_tesseract' });
      const rawText = await performLocalTesseractOcr(job.base64Data, job.mimeType);
      const parsed = parseLocalOcrTextToReceipts(rawText, job.fileName);

      await updateQueueJob(job.id, {
        status: 'fallback_extracted',
        engineUsed: 'local_tesseract',
        extractedReceipts: parsed
      });

      setActionNotice(`Successfully extracted "${job.fileName}" with Local Tesseract!`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      console.error('Manual Tesseract run failed:', err);
      await recordJobFailure(job.id, `Tesseract error: ${err?.message || String(err)}`);
      setActionNotice(`Tesseract extraction error: ${err?.message || 'Failed'}`);
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleRetryCloudNow = async (job: CachedReceiptJob) => {
    setProcessingJobId(job.id);
    setActionNotice(`Retrying Cloud API for "${job.fileName}"...`);

    try {
      await updateQueueJob(job.id, { status: 'processing' });
      const result = await executeFailSafeOcr({
        base64Data: job.base64Data,
        mimeType: job.mimeType,
        fileName: job.fileName,
        fileSize: job.fileSize,
        previewUrl: job.previewUrl,
        options: {
          mode: 'cloud_only',
          timeoutMs: timeoutSec * 1000
        }
      });

      await updateQueueJob(job.id, {
        status: 'completed',
        engineUsed: 'cloud_api',
        extractedReceipts: result.receipts
      });

      setActionNotice(`Cloud OCR succeeded for "${job.fileName}"!`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      console.warn('Manual cloud retry failed:', err);
      await recordJobFailure(job.id, err?.message || 'Manual retry failed');
      setActionNotice(`Cloud retry failed: ${err?.message || 'Error'}`);
    } finally {
      setProcessingJobId(null);
    }
  };

  const handleImportReceipt = (job: CachedReceiptJob) => {
    if (!job.extractedReceipts || job.extractedReceipts.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    const converted: SavedReceipt[] = job.extractedReceipts.map((r, idx) => ({
      ...r,
      id: `rec_queue_${Date.now()}_${idx}`,
      created_at: new Date().toISOString(),
      file_name: job.fileName,
      image_preview: job.previewUrl
    }));

    if (onImportExtractedReceipts) {
      onImportExtractedReceipts(converted);
    }
    
    // Mark completed
    updateQueueJob(job.id, { status: 'completed' });
    setActionNotice(`Imported ${converted.length} receipt(s) from "${job.fileName}" into scanner!`);
    setTimeout(() => {
      setActionNotice(null);
      onClose();
    }, 1200);
  };

  const pendingCount = jobs.filter(j => j.status === 'pending' || j.status === 'processing').length;
  const fallbackCount = jobs.filter(j => j.status === 'fallback_extracted').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold">Offline OCR Cache & Engine</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                  isOnline 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Local cache with exponential backoff & Tesseract WebAssembly fallback
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Engine Configuration Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center">
              <Sliders className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              OCR Execution Strategy:
            </span>
            <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => handleEngineModeChange('auto_fallback')}
                className={`px-2 py-1 rounded transition-all text-center ${
                  engineMode === 'auto_fallback'
                    ? 'bg-white text-emerald-700 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Auto Fail-Safe
              </button>
              <button
                onClick={() => handleEngineModeChange('local_tesseract_only')}
                className={`px-2 py-1 rounded transition-all text-center ${
                  engineMode === 'local_tesseract_only'
                    ? 'bg-white text-emerald-700 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Force Tesseract
              </button>
              <button
                onClick={() => handleEngineModeChange('cloud_only')}
                className={`px-2 py-1 rounded transition-all text-center ${
                  engineMode === 'cloud_only'
                    ? 'bg-white text-emerald-700 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cloud API Only
              </button>
            </div>
          </div>

          {/* Timeout Controller */}
          <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>API Timeout Threshold:</span>
            </div>
            <div className="flex items-center space-x-1">
              {[8, 12, 15, 20].map((s) => (
                <button
                  key={s}
                  onClick={() => handleTimeoutChange(s)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    timeoutSec === s
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Notice Banner */}
        {actionNotice && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Queue Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>
              Cached Receipts ({jobs.length}) • {pendingCount} Pending • {fallbackCount} Extracted Offline
            </span>
            {jobs.some(j => j.status === 'completed') && (
              <button
                onClick={() => clearCompletedQueueJobs()}
                className="text-slate-500 hover:text-slate-800 underline"
              >
                Clear Completed
              </button>
            )}
          </div>

          {jobs.length === 0 ? (
            <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-800">Queue is Clear</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Any receipts that fail or encounter API timeouts are automatically cached here with exponential backoff retry and local Tesseract extraction.
              </p>
            </div>
          ) : (
            jobs.map((job) => {
              const msRemaining = Math.max(0, job.nextRetryAt - currentTime);
              const secRemaining = Math.ceil(msRemaining / 1000);
              const isProcessing = processingJobId === job.id || job.status === 'processing';

              return (
                <div 
                  key={job.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    job.status === 'fallback_extracted'
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : job.status === 'completed'
                      ? 'bg-slate-50 border-slate-200 opacity-75'
                      : job.status === 'failed'
                      ? 'bg-rose-50/60 border-rose-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3 min-w-0">
                      {job.previewUrl ? (
                        <img 
                          src={job.previewUrl} 
                          alt="preview" 
                          className="w-12 h-14 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-14 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-400">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-semibold text-slate-900 truncate">
                            {job.fileName}
                          </h4>
                          {job.engineUsed === 'local_tesseract' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Tesseract
                            </span>
                          )}
                          {job.engineUsed === 'cloud_api' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                              Cloud API
                            </span>
                          )}
                        </div>

                        {/* Status Label */}
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                            job.status === 'fallback_extracted'
                              ? 'bg-emerald-600 text-white'
                              : job.status === 'completed'
                              ? 'bg-slate-200 text-slate-700'
                              : job.status === 'failed'
                              ? 'bg-rose-600 text-white'
                              : isProcessing
                              ? 'bg-blue-600 text-white animate-pulse'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {job.status === 'fallback_extracted' && 'Extracted with Tesseract'}
                            {job.status === 'completed' && 'Completed'}
                            {job.status === 'failed' && 'Max Retries Exceeded'}
                            {isProcessing && 'Processing...'}
                            {job.status === 'pending' && !isProcessing && (
                              secRemaining > 0 
                                ? `Retry in ${secRemaining}s (attempt ${job.attempts + 1}/${job.maxAttempts})` 
                                : `Ready to retry (attempt ${job.attempts + 1}/${job.maxAttempts})`
                            )}
                          </span>

                          <span className="text-[11px] text-slate-500">
                            {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Last error explanation if present */}
                        {job.lastError && (
                          <p className="text-xs text-rose-700 mt-1 line-clamp-1 flex items-center">
                            <AlertTriangle className="w-3 h-3 mr-1 flex-shrink-0" />
                            {job.lastError}
                          </p>
                        )}

                        {/* Extracted preview badge */}
                        {job.extractedReceipts && job.extractedReceipts.length > 0 && (
                          <div className="mt-1.5 text-xs text-emerald-800 font-medium">
                            Detected: {job.extractedReceipts[0].vendor_name} • R{job.extractedReceipts[0].total_amount.toFixed(2)} ({job.extractedReceipts[0].category})
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => removeQueueJob(job.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    {/* If extracted, allow importing directly into the main scanner */}
                    {job.extractedReceipts && job.extractedReceipts.length > 0 && (
                      <button
                        onClick={() => handleImportReceipt(job)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
                      >
                        <span>Review & File Slip</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Extract with local Tesseract */}
                    <button
                      disabled={isProcessing}
                      onClick={() => handleRunTesseractNow(job)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium flex items-center space-x-1 transition-all disabled:opacity-50"
                    >
                      <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Extract with Tesseract</span>
                    </button>

                    {/* Retry Cloud API */}
                    <button
                      disabled={isProcessing || !isOnline}
                      onClick={() => handleRetryCloudNow(job)}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium flex items-center space-x-1 transition-all disabled:opacity-50"
                    >
                      <Cloud className="w-3.5 h-3.5 text-blue-600" />
                      <span>Retry Cloud API</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Background exponential backoff active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
