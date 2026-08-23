import React, { useState } from 'react';
import { Printer, Download, X, FileText, Check, TrendingDown, TrendingUp } from 'lucide-react';
import type { SavedReceipt } from '../types';
import { compareMonths, exportComparisonToCSV, generateMonthlyMarkdownReport, exportMarkdownReport } from '../utils/reportUtils';

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
  const [copiedMd, setCopiedMd] = useState(false);
  const comparison = compareMonths(monthA, monthB, receipts);
  const isNetSaving = comparison.totalDiff < 0;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    exportComparisonToCSV(monthA, monthB, comparison.items);
  };

  const handleExportMarkdown = () => {
    const mdA = generateMonthlyMarkdownReport(monthA, receipts);
    const mdB = generateMonthlyMarkdownReport(monthB, receipts);
    const combinedMd = `${mdA}\n\n${mdB}`;
    exportMarkdownReport(combinedMd, `Expenditure_Report_${monthA}_${monthB}.md`);
  };

  const handleCopyMarkdown = () => {
    const mdA = generateMonthlyMarkdownReport(monthA, receipts);
    const mdB = generateMonthlyMarkdownReport(monthB, receipts);
    const combinedMd = `${mdA}\n\n${mdB}`;
    navigator.clipboard.writeText(combinedMd).then(() => {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-6">
      {/* Top Action Bar (hidden on print) */}
      <div className="w-full max-w-4xl bg-slate-900 text-white p-3 sm:p-4 rounded-2xl mb-4 flex flex-wrap items-center justify-between gap-3 shadow-xl no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Printer className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Month-to-Month Report Preview</h3>
            <p className="text-[11px] text-slate-400">
              Print directly or choose &quot;Save as PDF&quot; in the browser print dialog
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Copy Markdown report to clipboard"
          >
            {copiedMd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
            <span>{copiedMd ? 'Copied MD!' : 'Copy MD'}</span>
          </button>
          <button
            onClick={handleExportMarkdown}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Download formatted Markdown (.md) file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.MD</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save to PDF</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Paper Document Container */}
      <div
        id="printable-report-area"
        className="w-full max-w-4xl bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0"
      >
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-6 mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-black tracking-tight text-slate-900">
                HOUSEHOLD EXPENDITURE & GROCERY REPORT
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
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
        <div className="grid grid-cols-3 gap-4 mb-6 print-page-break">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              {monthA} Total Spend
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              R {comparison.totalA.toFixed(2)}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-[10px] uppercase font-bold text-slate-400">
              {monthB} Total Spend
            </div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              R {comparison.totalB.toFixed(2)}
            </div>
          </div>

          <div className={`p-4 rounded-xl border ${
            isNetSaving ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}>
            <div className="text-[10px] uppercase font-bold opacity-70">
              Net Variance ({monthA} vs {monthB})
            </div>
            <div className="text-xl font-black mt-0.5 flex items-center gap-1">
              {isNetSaving ? (
                <>
                  <TrendingDown className="w-5 h-5 text-emerald-600" />
                  <span>- R {Math.abs(comparison.totalDiff).toFixed(2)}</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5 text-rose-600" />
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
        <div className="mb-8 print-page-break">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
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
          <div className="flex items-center justify-between mb-3">
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
                <th className="py-2.5 px-3">Item Description (A-Z)</th>
                <th className="py-2.5 px-2">Category</th>
                <th className="py-2.5 px-2 text-center">{monthA} Qty</th>
                <th className="py-2.5 px-3 text-right">{monthA} Total</th>
                <th className="py-2.5 px-2 text-center">{monthB} Qty</th>
                <th className="py-2.5 px-3 text-right">{monthB} Total</th>
                <th className="py-2.5 px-3 text-right">Variance</th>
                <th className="py-2.5 px-2 text-center">Status</th>
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
                      {item.status === 'saved_more' && <span className="text-emerald-700">Saved More</span>}
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
                <td colSpan={3} className="py-2.5 px-3">Totals:</td>
                <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-800">
                  R {comparison.totalA.toFixed(2)}
                </td>
                <td></td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                  R {comparison.totalB.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-black">
                  {isNetSaving ? (
                    <span className="text-emerald-800">- R {Math.abs(comparison.totalDiff).toFixed(2)}</span>
                  ) : (
                    <span className="text-rose-800">+ R {comparison.totalDiff.toFixed(2)}</span>
                  )}
                </td>
                <td className="py-2.5 px-2 text-center text-[10px]">
                  {isNetSaving ? 'Saved' : 'Increased'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <span>ParserPro Expenditure & Household Tracking</span>
          <span>Confidential Personal Finance Report</span>
        </div>
      </div>
    </div>
  );
};
