import React, { useState, useRef } from 'react';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, Calendar, Store, ArrowRight, RefreshCw, Camera, Edit3, X, Plus, Trash2 } from 'lucide-react';
import type { ReceiptData, SavedReceipt, LineItem } from '../types';
import { compressAndPrepareImage } from '../utils/imageUtils';

interface ReceiptScannerProps {
  onReceiptSaved: (receipt: SavedReceipt) => void;
  onViewMonth: (month: string) => void;
  recentReceipts: SavedReceipt[];
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({
  onReceiptSaved,
  onViewMonth,
  recentReceipts
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('Analyzing Receipt & Items...');
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ReceiptData | null>(null);
  const [savedReceipt, setSavedReceipt] = useState<SavedReceipt | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Manual Entry Form State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualVendor, setManualVendor] = useState('Pick n Pay');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualCategory, setManualCategory] = useState<'Food & Groceries' | 'Electricity & Utilities' | 'Home Maintenance' | 'Transport' | 'Other'>('Food & Groceries');
  const [manualCurrency, setManualCurrency] = useState('ZAR');
  const [manualTotal, setManualTotal] = useState('241.71');
  const [manualItems, setManualItems] = useState<LineItem[]>([
    { description: 'Carrier Bag 24L', quantity: 2, unit_price: 1.40, total_price: 2.80 },
    { description: 'Household & Grocery Items', quantity: 8, unit_price: 29.86, total_price: 238.91 }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      processSelectedFile(selectedFile);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setParsedData(null);
    setSavedReceipt(null);

    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const parseReceipt = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setParsedData(null);
    setSavedReceipt(null);

    try {
      setLoadingStage('Optimizing receipt image...');
      console.log('[ReceiptScanner] Starting receipt optimization for:', file.name, `(${Math.round(file.size / 1024)} KB)`);

      // Compress and prepare image to prevent payload overflow / network disconnects
      const prepared = await compressAndPrepareImage(file);
      console.log(`[ReceiptScanner] Optimization complete. Sending ${prepared.processedSizeKb} KB payload.`);

      setLoadingStage('Extracting items with AI OCR...');

      // Attempt multipart form upload with the optimized file, with auto-fallback to JSON base64
      let data: any = null;
      let lastErrorMessage = '';

      // Up to 2 attempts for server cold starts (common on free-tier hosting like Render)
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (attempt > 1) {
            setLoadingStage(`Waking server & retrying OCR (attempt ${attempt}/2)...`);
            await new Promise((r) => setTimeout(r, 1500));
          }

          let response: Response;
          const formData = new FormData();
          formData.append('receipt', prepared.file);

          try {
            response = await fetch('/api/parse-receipt', {
              method: 'POST',
              body: formData,
            });
          } catch (fetchErr) {
            // Direct JSON payload fallback if multipart network request fails
            response = await fetch('/api/parse-receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                imageBase64: prepared.base64Data,
                mimeType: prepared.mimeType,
              }),
            });
          }

          const contentType = response.headers.get('content-type') || '';
          const responseText = await response.text();

          // Check if server returned HTML (e.g. SPA fallback, 502 Bad Gateway page, or Render spin-up)
          const trimmed = responseText.trim();
          if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || contentType.includes('text/html')) {
            console.warn('[ReceiptScanner] Server returned HTML instead of JSON. Server may be in cold start.', response.status);
            lastErrorMessage = 'Server is waking up or returned an HTML page. Please wait 10 seconds and tap Retry, or enter details manually.';
            if (attempt < 2) continue;
            throw new Error(lastErrorMessage);
          }

          try {
            data = JSON.parse(responseText);
          } catch (jsonErr) {
            console.error('[ReceiptScanner] JSON parse error on response:', response.status, responseText);
            lastErrorMessage = `Server returned an invalid response format (Status ${response.status}). Please retry or use manual entry.`;
            if (attempt < 2) continue;
            throw new Error(lastErrorMessage);
          }

          if (!response.ok) {
            console.error('[ReceiptScanner] Server error response:', response.status, data);
            throw new Error(data?.error || `Failed to extract receipt (Status ${response.status})`);
          }

          // Successfully received valid parsed JSON
          break;
        } catch (attemptErr: any) {
          lastErrorMessage = attemptErr.message || 'Failed to extract receipt';
          if (attempt === 2) throw attemptErr;
        }
      }

      if (!data) {
        throw new Error(lastErrorMessage || 'Failed to parse receipt after multiple attempts.');
      }

      setParsedData(data);

      // Ensure valid month_year and invoice_date
      let invoiceDate = data.invoice_date || new Date().toISOString().split('T')[0];
      let monthYear = data.month_year;
      if (!monthYear && invoiceDate) {
        monthYear = invoiceDate.substring(0, 7);
      }

      // Automatically place into the correct month and by date
      const newSaved: SavedReceipt = {
        ...data,
        id: `rec-${Date.now()}`,
        invoice_date: invoiceDate,
        month_year: monthYear || '2026-08',
        created_at: new Date().toISOString(),
        file_name: file.name,
        image_preview: preview || undefined
      };

      setSavedReceipt(newSaved);
      onReceiptSaved(newSaved);
      console.log('[ReceiptScanner] Receipt successfully processed and filed:', newSaved);
    } catch (err: any) {
      console.error('[ReceiptScanner] Error occurred during receipt parsing:', err);
      const isNetworkError =
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError') ||
        err?.name === 'TypeError';

      const userMsg = isNetworkError
        ? 'Connection error while uploading receipt. Please retry.'
        : (err.message || 'An error occurred during parsing');

      setError(userMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const triggerCameraInput = () => {
    cameraInputRef.current?.click();
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseFloat(manualTotal) || 0;
    const invDate = manualDate || new Date().toISOString().split('T')[0];
    const mYear = invDate.substring(0, 7);

    const manualData: ReceiptData = {
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
      notes: 'Manually logged / corrected receipt'
    };

    const newSaved: SavedReceipt = {
      ...manualData,
      id: `rec-${Date.now()}`,
      created_at: new Date().toISOString(),
      file_name: file?.name || 'manual-entry.jpg',
      image_preview: preview || undefined
    };

    setParsedData(manualData);
    setSavedReceipt(newSaved);
    onReceiptSaved(newSaved);
    setError(null);
    setShowManualModal(false);
    console.log('[ReceiptScanner] Manual receipt filed successfully:', newSaved);
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

  const copyJsonToClipboard = () => {
    if (parsedData) {
      navigator.clipboard.writeText(JSON.stringify(parsedData, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full overflow-auto">
      {/* Left Sidebar / Quick Recent */}
      <aside className="w-full lg:w-72 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4 shadow-sm shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Recent Scans
          </div>
          <span className="text-xs text-emerald-600 font-semibold">
            {recentReceipts.length} Total
          </span>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-[420px] pr-1">
          {recentReceipts.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No receipts scanned yet. Upload your first receipt!
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
                  <span className="font-bold text-slate-700">
                    R {Number(rec.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-auto p-4 bg-slate-900 rounded-2xl text-white shadow-sm">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
            Household Allocation
          </div>
          <div className="text-xs text-slate-300 leading-relaxed">
            Every scanned receipt is automatically parsed, filed into its correct month, and ordered chronologically by date.
          </div>
        </div>
      </aside>

      {/* Main Scanner Section */}
      <section className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Document Source */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>Document Source</span>
              {file && (
                <span className="text-xs font-normal text-slate-500">
                  ({file.name})
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowManualModal(true)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-slate-200"
                title="Enter details manually if receipt is blurred or server is offline"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Manual Entry</span>
              </button>
              <button
                onClick={triggerCameraInput}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-emerald-200"
                title="Take photo with phone camera"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Camera</span>
              </button>
              {file && (
                <button
                  onClick={triggerFileInput}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Replace</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4 relative overflow-hidden min-h-[380px]">
            <div
              className={`flex-1 border-2 border-dashed rounded-xl p-6 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[260px]
                ${file ? 'border-emerald-200 bg-slate-50/50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={!file ? triggerFileInput : undefined}
            >
              {/* Regular file input */}
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {/* Direct Camera capture input for Android */}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                capture="environment"
                ref={cameraInputRef}
                onChange={handleFileChange}
              />

              {preview ? (
                <div className="space-y-3 w-full h-full flex flex-col items-center justify-center relative">
                  <img
                    src={preview}
                    alt="Receipt Preview"
                    className="max-h-[280px] object-contain rounded-lg shadow-sm border border-slate-200 bg-white"
                  />
                  <p className="text-xs text-slate-500 font-medium bg-white/90 px-3 py-1 rounded-full shadow-sm border border-slate-200">
                    {file?.name}
                  </p>
                </div>
              ) : file ? (
                <div className="space-y-3 flex flex-col items-center justify-center text-slate-600">
                  <FileType className="w-12 h-12 text-emerald-600" />
                  <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                  <p className="text-xs text-slate-500">Document ready for processing</p>
                </div>
              ) : (
                <div className="space-y-3 flex flex-col items-center justify-center text-slate-500 py-6">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1 shadow-inner">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Click to upload receipt, take photo, or drag & drop
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports PNG, JPG, JPEG, PDF up to 10MB
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <span className="text-[10px] font-semibold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded">
                      Supermarket Invoices
                    </span>
                    <span className="text-[10px] font-semibold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded">
                      Utility Slips
                    </span>
                    <span className="text-[10px] font-semibold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded">
                      Fuel & Maintenance
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={parseReceipt}
              disabled={!file || isLoading}
              className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{loadingStage}</span>
                </>
              ) : (
                <span>Extract & File to Month</span>
              )}
            </button>

            {error && (
              <div className="p-3.5 bg-red-50 text-red-700 border border-red-200 rounded-xl flex flex-col sm:flex-row items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <p className="font-semibold">{error}</p>
                    <p className="text-[11px] text-red-500 mt-0.5">
                      You can retry the scan or enter receipt details directly.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => setShowManualModal(true)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3 text-emerald-600" />
                    <span>Enter Manually</span>
                  </button>
                  <button
                    onClick={parseReceipt}
                    disabled={isLoading}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Extracted Data & Placement */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">
              Extracted & Categorized Data
            </h2>
            <div className="flex gap-2">
              <button
                onClick={copyJsonToClipboard}
                disabled={!parsedData}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                {isCopied ? 'Copied!' : 'Copy JSON'}
              </button>
              {savedReceipt && (
                <button
                  onClick={() => onViewMonth(savedReceipt.month_year)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 transition-colors"
                >
                  <span>View in {savedReceipt.month_year}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Success Banner when saved */}
          {savedReceipt && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">Placed in Month: {savedReceipt.month_year}</span>
                  <span className="text-emerald-700 ml-2">(Date: {savedReceipt.invoice_date})</span>
                </div>
              </div>
              <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">
                {savedReceipt.line_items.length} Items Listed
              </span>
            </div>
          )}

          {/* JSON Terminal Area */}
          <div className="flex-1 bg-slate-900 rounded-2xl shadow-inner p-5 font-mono text-xs text-emerald-400 overflow-auto leading-relaxed min-h-[280px]">
            {parsedData ? (
              <pre
                className="whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify(parsedData, null, 2)
                    .replace(/("[^"]+":)/g, '<span class="text-slate-300">$1</span>')
                    .replace(/:\s*("[^"]*")/g, ': <span class="text-orange-300">$1</span>')
                    .replace(/:\s*([0-9.-]+)/g, ': <span class="text-blue-300">$1</span>')
                }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-8">
                <div className="font-mono text-xs opacity-60">
                  {`{\n  "vendor_name": "...",\n  "invoice_date": "YYYY-MM-DD",\n  "month_year": "YYYY-MM",\n  "category": "...",\n  "line_items": [...]\n}`}
                </div>
                <p className="text-[11px] text-slate-400">
                  Scan receipt to preview raw JSON and auto-allocate
                </p>
              </div>
            )}
          </div>

          {/* Summary metrics of the parsed receipt */}
          {parsedData && (
            <div className="grid grid-cols-3 gap-2.5 shrink-0">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Store className="w-3 h-3" /> Vendor
                </div>
                <div className="text-sm font-bold text-slate-800 truncate mt-0.5">
                  {parsedData.vendor_name}
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date & Month
                </div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">
                  {parsedData.invoice_date}
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Spend</div>
                <div className="text-sm font-bold text-emerald-600 mt-0.5">
                  {parsedData.currency} {Number(parsedData.total_amount).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Manual Entry & Correction Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vendor / Store Name</label>
                  <input
                    type="text"
                    required
                    value={manualVendor}
                    onChange={(e) => setManualVendor(e.target.value)}
                    placeholder="e.g. Pick n Pay, Checkers, Eskom"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                        className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700"
                      />
                      <button
                        type="button"
                        onClick={() => removeManualItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
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
    </div>
  );
};
