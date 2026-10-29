import React, { useMemo } from 'react';
import { X, Download, Share2, Printer } from 'lucide-react';
import type { SavedReceipt } from '../types';
import { generateMonthReport } from '../utils/reportUtils';
import {
  downloadSingleMonthPDF,
  shareOrSaveSingleMonthPDF,
  triggerSystemPrint,
} from '../utils/pdfGenerator';
import {
  formatCategoryLabel,
  formatMoney,
  formatMonthLabel,
  formatPriceVarianceSummary,
  formatShortDate,
} from '../utils/currencyFormat';
import { getDisplayInvoiceNumber } from '../utils/duplicateDetection';

interface PrintableReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthYear: string;
  receipts: SavedReceipt[];
  currencyCode: string;
}

export const PrintableReportModal: React.FC<PrintableReportModalProps> = ({
  isOpen,
  onClose,
  monthYear,
  receipts,
  currencyCode,
}) => {
  const report = useMemo(
    () => generateMonthReport(monthYear, receipts),
    [monthYear, receipts]
  );

  const monthReceipts = useMemo(
    () =>
      receipts
        .filter((r) => r.month_year === monthYear)
        .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date)),
    [receipts, monthYear]
  );

  if (!isOpen) return null;

  const handlePrint = () => {
    if (!triggerSystemPrint()) {
      shareOrSaveSingleMonthPDF(monthYear, receipts);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-modal-title"
    >
      <div className="w-full sm:max-w-3xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="statement-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              {formatMonthLabel(monthYear)} Statement
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              {report.receipt_count} receipts · {report.item_count} unique items ·{' '}
              {formatMoney(report.total_spend, currencyCode)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close statement"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Category Breakdown Subtotals */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Category Breakdown & Subtotals
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {report.category_breakdown.map((row) => {
                if (row.subtotal <= 0 && row.item_count === 0) return null;
                return (
                  <div
                    key={row.category}
                    className="py-2 flex items-center justify-between gap-4 text-xs sm:text-sm"
                  >
                    <div>
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {formatCategoryLabel(row.category)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2 tabular-nums">
                        {row.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatMoney(row.subtotal, currencyCode)}
                    </span>
                  </div>
                );
              })}
              <div className="pt-2.5 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                <span>Total Expenditure</span>
                <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatMoney(report.total_spend, currencyCode)}
                </span>
              </div>
            </div>
          </div>

          {/* Grouped Item Purchase Frequency & Price Variance */}
          {report.items_alphabetical.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Grouped Item Frequency & Price Variance
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.items_alphabetical.map((item) => (
                  <div
                    key={item.name}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs sm:text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {item.name}:{' '}
                        <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                          Purchased {item.occurrences} {item.occurrences === 1 ? 'time' : 'times'}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                        <span>
                          {formatPriceVarianceSummary(
                            item.lowest_unit_price,
                            item.highest_unit_price,
                            currencyCode
                          )}
                        </span>
                        <span aria-hidden="true" className="mx-1.5">
                          ·
                        </span>
                        <span>Latest: {formatMoney(item.latest_unit_price, currencyCode)}</span>
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
                      {formatMoney(item.total_amount, currencyCode)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipt Register */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Receipts Included
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {monthReceipts.map((r) => {
                const invNum = getDisplayInvoiceNumber(r);
                return (
                  <div
                    key={r.id}
                    className="py-2.5 flex items-center justify-between gap-4 text-xs sm:text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {r.vendor_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>{formatShortDate(r.invoice_date)}</span>
                        {invNum && (
                          <>
                            <span aria-hidden="true" className="mx-1.5">
                              ·
                            </span>
                            <span className="font-mono">#{invNum}</span>
                          </>
                        )}
                        <span aria-hidden="true" className="mx-1.5">
                          ·
                        </span>
                        <span>{formatCategoryLabel(r.category)}</span>
                      </p>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
                      {formatMoney(r.total_amount, currencyCode)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 pb-safe-modal border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => shareOrSaveSingleMonthPDF(monthYear, receipts)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            <span>Share PDF</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={() => downloadSingleMonthPDF(monthYear, receipts)}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
