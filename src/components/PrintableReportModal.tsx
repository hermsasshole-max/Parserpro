import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  X, 
  FileText, 
  Check, 
  TrendingDown, 
  TrendingUp, 
  Share2, 
  FileDown, 
  Loader2,
  Calendar,
  AlertCircle
} from 'lucide-react';
import type { SavedReceipt } from '../types';
import { 
  compareMonths, 
  exportComparisonToCSV, 
  generateMonthlyMarkdownReport, 
  exportMarkdownReport,
  generateMonthReport 
} from '../utils/reportUtils';
import { 
  downloadComparisonPDF, 
  downloadSingleMonthPDF,
  shareOrSavePDF, 
  shareOrSaveSingleMonthPDF,
  printReportSafely,
  triggerSystemPrint
} from '../utils/pdfGenerator';

interface PrintableReportModalProps {
  receipts: SavedReceipt[];
  monthA: string;
  monthB: string;
  onClose: () => void;
}

export const PrintableReportModal: React.FC<PrintableReportModalProps> = ({
  receipts,
  monthA,
  monthB,
  onClose
}) => {
  const [reportMode, setReportMode] = useState<'comparison' | 'single'>('comparison');
  const [activeSingleMonth, setActiveSingleMonth] = useState<string>(monthA);
  const [copiedMd, setCopiedMd] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const comparison = compareMonths(monthA, monthB, receipts);
  const singleReport = generateMonthReport(activeSingleMonth, receipts);
  const singleReceipts = receipts.filter(r => r.month_year === activeSingleMonth);
  const isNetSaving = comparison.totalDiff < 0;

  const showFeedback = (type: 'success' | 'info' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      showFeedback('info', 'Print dialogue closed.');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    setFeedback(null);
    try {
      if (reportMode === 'comparison') {
        const res = await downloadComparisonPDF(monthA, monthB, receipts);
        if (res.success) {
          showFeedback('success', `PDF (${res.filename}) generated & downloaded to device!`);
        } else {
          showFeedback('error', 'Could not generate comparison PDF.');
        }
      } else {
        const res = await downloadSingleMonthPDF(activeSingleMonth, receipts);
        if (res.success) {
          showFeedback('success', `Monthly statement (${res.filename}) generated & downloaded to device!`);
        } else {
          showFeedback('error', 'Could not generate monthly statement PDF.');
        }
      }
    } catch (e) {
      console.error('PDF generation error:', e);
      showFeedback('error', 'Error generating PDF file.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShareOrSavePDF = async () => {
    setIsSharing(true);
    setFeedback(null);
    try {
      if (reportMode === 'comparison') {
        const res = await shareOrSavePDF(monthA, monthB, receipts);
        showFeedback(res.success ? 'success' : 'error', res.message);
      } else {
        const res = await shareOrSaveSingleMonthPDF(activeSingleMonth, receipts);
        showFeedback(res.success ? 'success' : 'error', res.message);
      }
    } catch (e) {
      console.error('PDF share error:', e);
      showFeedback('error', 'Failed to share or save PDF.');
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrint = async () => {
    setIsGeneratingPdf(true);
    setFeedback(null);
    try {
      const res = await printReportSafely(monthA, monthB, receipts);
      if (res.success) {
        showFeedback('success', res.message);
      } else {
        showFeedback('error', res.message || 'Could not initiate printing.');
      }
    } catch (e) {
      console.error('Print error:', e);
      showFeedback('error', 'Could not open print dialogue.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportCSV = () => {
    exportComparisonToCSV(monthA, monthB, comparison.items);
    showFeedback('success', 'CSV spreadsheet downloaded.');
  };

  const handleExportMarkdown = () => {
    const mdA = generateMonthlyMarkdownReport(monthA, receipts);
    const mdB = generateMonthlyMarkdownReport(monthB, receipts);
    const combinedMd = `${mdA}\n\n${mdB}`;
    exportMarkdownReport(combinedMd, `Expenditure_Report_${monthA}_${monthB}.md`);
    showFeedback('success', 'Markdown report downloaded.');
  };

  const handleCopyMarkdown = () => {
    const mdA = generateMonthlyMarkdownReport(monthA, receipts);
    const mdB = generateMonthlyMarkdownReport(monthB, receipts);
    const combinedMd = `${mdA}\n\n${mdB}`;
    navigator.clipboard.writeText(combinedMd).then(() => {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2500);
      showFeedback('success', 'Report text copied to clipboard!');
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-6 print:p-0 printable-modal-overlay">
      {/* Top Action & Toolbar (hidden on print) */}
      <div className="w-full max-w-4xl bg-slate-900 text-white p-3 sm:p-4 rounded-2xl mb-4 flex flex-col gap-3 shadow-xl no-print border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">Expenditure Document & PDF Export</h3>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded border border-emerald-400/30">
                  Vector PDF
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Generate high-resolution vector PDF, share via Android/WhatsApp, or print.
              </p>
            </div>
          </div>

          {/* Mode Switcher: Comparison vs Single Month */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setReportMode('comparison')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                reportMode === 'comparison'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              MoM Comparison
            </button>
            <button
              onClick={() => setReportMode('single')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                reportMode === 'single'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Single Month
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
            {/* Direct Print Button */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-600 cursor-pointer shadow-xs"
              title="Open system print dialogue"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Print</span>
            </button>

            {/* Save PDF / Print to PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Save document as PDF directly to your device storage"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingPdf ? 'Generating...' : 'Save PDF / Print to PDF'}</span>
            </button>

            {/* Share / Save to Drive / WhatsApp Button (VISIBLE ON ALL SCREENS) */}
            <button
              onClick={handleShareOrSavePDF}
              disabled={isSharing}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-emerald-500/30 cursor-pointer shadow-xs"
              title="Share via WhatsApp, Drive, Gmail or Android Files"
            >
              {isSharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Share</span>
            </button>

            {/* CSV */}
            <button
              onClick={handleExportCSV}
              className="hidden sm:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            {/* Copy Markdown */}
            <button
              onClick={handleCopyMarkdown}
              className="hidden md:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
              title="Copy markdown text summary"
            >
              {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
              <span>{copiedMd ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-1 cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div className={`px-3 py-2 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
            feedback.type === 'success' 
              ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
              : feedback.type === 'info'
              ? 'bg-blue-950/80 border border-blue-500/40 text-blue-200'
              : 'bg-rose-950/80 border border-rose-500/40 text-rose-200'
          }`}>
            {feedback.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
            {feedback.type === 'info' && <Printer className="w-4 h-4 text-blue-400 shrink-0" />}
            {feedback.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="font-medium">{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Printable Paper Document Container */}
      <div
        id="printable-report-area"
        className="w-full max-w-4xl bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0"
      >
        {reportMode === 'comparison' ? (
          /* COMPARISON REPORT VIEW */
          <>
            {/* Document Header */}
            <div className="border-b-2 border-slate-900 pb-5 mb-5 flex items-start justify-between">
              <div>
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 block">
                  HOUSEHOLD EXPENDITURE & GROCERY REPORT
                </span>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Comparative Analysis: <strong className="text-slate-800">{monthA}</strong> vs <strong className="text-slate-800">{monthB}</strong>
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-slate-800 uppercase">Generated On</div>
                <div className="text-xs text-slate-500">{new Date().toLocaleDateString('en-ZA')}</div>
                <div className="text-[10px] text-emerald-700 font-bold mt-1">Currency: ZAR (R)</div>
              </div>
            </div>

            {/* Executive Summary Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 print-page-break">
              <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {monthA} Total Spend
                </div>
                <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                  R {comparison.totalA.toFixed(2)}
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {monthB} Total Spend
                </div>
                <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                  R {comparison.totalB.toFixed(2)}
                </div>
              </div>

              <div className={`p-3 sm:p-4 rounded-xl border ${
                isNetSaving ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}>
                <div className="text-[10px] uppercase font-bold opacity-70">
                  Net Variance ({monthA} vs {monthB})
                </div>
                <div className="text-lg sm:text-xl font-black mt-0.5 flex items-center gap-1">
                  {isNetSaving ? (
                    <>
                      <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>- R {Math.abs(comparison.totalDiff).toFixed(2)}</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>+ R {comparison.totalDiff.toFixed(2)}</span>
                    </>
                  )}
                </div>
                <div className="text-[10px] font-bold mt-0.5">
                  {isNetSaving ? `Net Savings: ${Math.abs(comparison.totalPercentChange)}%` : `Net Increase: +${comparison.totalPercentChange}%`}
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="mb-6 print-page-break">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Category Breakdown
              </h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right">{monthA} Spend (R)</th>
                    <th className="py-2 px-3 text-right">{monthB} Spend (R)</th>
                    <th className="py-2 px-3 text-right">Variance (R)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparison.categoryComparison.map((cat, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-semibold text-slate-800">{cat.category}</td>
                      <td className="py-2 px-3 text-right font-mono">R {cat.monthA.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">R {cat.monthB.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        {cat.diff < 0 ? (
                          <span className="text-emerald-700">- R {Math.abs(cat.diff).toFixed(2)} (Saved)</span>
                        ) : cat.diff > 0 ? (
                          <span className="text-rose-700">+ R {cat.diff.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400">R 0.00</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Alphabetical Item Table */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Item-by-Item Calculated Ledger (Alphabetical Order A-Z)
                </h4>
                <span className="text-[11px] text-slate-500">
                  Total {comparison.items.length} unique items
                </span>
              </div>

              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-3">Item Description (A-Z)</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2 text-center">{monthA} Qty</th>
                    <th className="py-2 px-3 text-right">{monthA} Total</th>
                    <th className="py-2 px-2 text-center">{monthB} Qty</th>
                    <th className="py-2 px-3 text-right">{monthB} Total</th>
                    <th className="py-2 px-3 text-right">Variance</th>
                    <th className="py-2 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {comparison.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                        No itemized records found for {monthA} or {monthB}.
                      </td>
                    </tr>
                  ) : (
                    comparison.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2 px-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-2 px-2 text-[10px] text-slate-500">{item.category}</td>
                        <td className="py-2 px-2 text-center font-mono">{item.monthA_quantity}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">R {item.monthA_total.toFixed(2)}</td>
                        <td className="py-2 px-2 text-center font-mono text-slate-500">{item.monthB_quantity}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">R {item.monthB_total.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {item.amount_diff < 0 ? (
                            <span className="text-emerald-700">- R {Math.abs(item.amount_diff).toFixed(2)}</span>
                          ) : item.amount_diff > 0 ? (
                            <span className="text-rose-700">+ R {item.amount_diff.toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-400">R 0.00</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center text-[10px] font-bold">
                          {item.status === 'saved_more' && <span className="text-emerald-700">Saved</span>}
                          {item.status === 'not_purchased' && <span className="text-emerald-700">Not Bought</span>}
                          {item.status === 'spent_more' && <span className="text-rose-700">Spent More</span>}
                          {item.status === 'new_item' && <span className="text-blue-700">New Item</span>}
                          {item.status === 'unchanged' && <span className="text-slate-500">Equal</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="py-2 px-3">Totals:</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-emerald-800">
                      R {comparison.totalA.toFixed(2)}
                    </td>
                    <td></td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      R {comparison.totalB.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black">
                      {isNetSaving ? (
                        <span className="text-emerald-800">- R {Math.abs(comparison.totalDiff).toFixed(2)}</span>
                      ) : (
                        <span className="text-rose-800">+ R {comparison.totalDiff.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center text-[10px]">
                      {isNetSaving ? 'Saved' : 'Increased'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          /* SINGLE MONTH STATEMENT VIEW */
          <>
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-5 mb-5 flex items-start justify-between">
              <div>
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 block">
                  MONTHLY EXPENDITURE STATEMENT: {activeSingleMonth}
                </span>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Personal Accounting & Grocery Ledger  •  Currency: ZAR (R)
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-slate-800 uppercase">Generated On</div>
                <div className="text-xs text-slate-500">{new Date().toLocaleDateString('en-ZA')}</div>
                <div className="text-[10px] text-emerald-700 font-bold mt-1">Confidential Ledger</div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 print-page-break">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-emerald-800">Total Expenditure</div>
                <div className="text-lg font-black text-emerald-900 mt-0.5">
                  R {singleReport.total_spend.toFixed(2)}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400">Invoices Filed</div>
                <div className="text-lg font-black text-slate-800 mt-0.5">
                  {singleReport.receipt_count}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400">Line Items (A-Z)</div>
                <div className="text-lg font-black text-slate-800 mt-0.5">
                  {singleReport.items_alphabetical.length}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400">Average Per Invoice</div>
                <div className="text-lg font-black text-slate-800 mt-0.5">
                  R {singleReport.receipt_count > 0 ? (singleReport.total_spend / singleReport.receipt_count).toFixed(2) : '0.00'}
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="mb-6 print-page-break">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Category Spend Breakdown
              </h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right">Total Spend (ZAR)</th>
                    <th className="py-2 px-3 text-right">% of Month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(singleReport.category_totals).map(([cat, amt], idx) => {
                    const pct = singleReport.total_spend > 0 ? ((amt / singleReport.total_spend) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-semibold text-slate-800">{cat}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">R {amt.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">{pct} %</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Merged Items Table */}
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Merged Item-by-Item Summary (A-Z)
              </h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-200 text-slate-800 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Item Description (A-Z)</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Avg Unit Price</th>
                    <th className="py-2 px-3 text-right">Total Cost (ZAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {singleReport.items_alphabetical.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-semibold text-slate-900">{item.name}</td>
                      <td className="py-2 px-2 text-[10px] text-slate-500">{item.categories.join(', ')}</td>
                      <td className="py-2 px-2 text-center font-mono">{item.total_quantity}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">R {item.average_unit_price.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">R {item.total_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={4} className="py-2 px-3">Total Month Spend:</td>
                    <td className="py-2 px-3 text-right font-mono font-black text-emerald-800">
                      R {singleReport.total_spend.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Invoices Register */}
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Invoice & Receipt Register
              </h4>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Vendor / Store</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-center">Items</th>
                    <th className="py-2 px-3 text-right">Total (ZAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {singleReceipts.map((r, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-mono text-slate-600">{r.invoice_date}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{r.vendor_name}</td>
                      <td className="py-2 px-3 text-slate-600">{r.category}</td>
                      <td className="py-2 px-3 text-center font-mono">{r.line_items.length}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">R {Number(r.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="pt-5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <span>ParserPro Expenditure & Household Tracking</span>
          <span>Confidential Personal Finance Ledger</span>
        </div>
      </div>
    </div>
  );
};
