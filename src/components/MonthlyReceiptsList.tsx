import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Share2,
  Printer,
  Pencil,
  Trash2,
  Search,
  Plus,
  Camera,
  FileText,
} from 'lucide-react';
import type { ReceiptCategory, SavedReceipt } from '../types';
import {
  downloadSingleReceiptPDF,
  printSingleReceiptSafely,
  downloadSingleMonthPDF,
  shareOrSaveSingleMonthPDF,
} from '../utils/pdfGenerator';
import {
  formatCategoryLabel,
  formatMoney,
  formatMonthLabel,
  formatShortDate,
} from '../utils/currencyFormat';
import { getDisplayInvoiceNumber } from '../utils/duplicateDetection';

interface MonthlyReceiptsListProps {
  receipts: SavedReceipt[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  availableMonths: string[];
  currencyCode: string;
  onDeleteReceipt: (id: string) => void;
  onEditReceipt: (receipt: SavedReceipt) => void;
  onOpenAddManual: () => void;
  onOpenSearch: () => void;
  onGoToScanner: () => void;
  onOpenPrintableReport: (month: string) => void;
}

const FILTER_CATEGORIES: ('All' | ReceiptCategory)[] = [
  'All',
  'Food & Groceries',
  'Electricity & Utilities',
  'Home Maintenance',
  'Transport',
  'Other',
];

export const MonthlyReceiptsList: React.FC<MonthlyReceiptsListProps> = ({
  receipts,
  selectedMonth,
  onSelectMonth,
  availableMonths,
  currencyCode,
  onDeleteReceipt,
  onEditReceipt,
  onOpenAddManual,
  onOpenSearch,
  onGoToScanner,
  onOpenPrintableReport,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'All' | ReceiptCategory>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState('');

  const monthReceipts = useMemo(() => {
    return receipts
      .filter((r) => r.month_year === selectedMonth)
      .filter((r) => (categoryFilter === 'All' ? true : r.category === categoryFilter))
      .filter((r) => {
        if (!localQuery.trim()) return true;
        const q = localQuery.toLowerCase();
        const inVendor = r.vendor_name.toLowerCase().includes(q);
        const inInv = getDisplayInvoiceNumber(r).toLowerCase().includes(q);
        const inNotes = (r.notes || '').toLowerCase().includes(q);
        const inItems = (r.line_items || []).some((li) =>
          li.description.toLowerCase().includes(q)
        );
        return inVendor || inInv || inNotes || inItems;
      })
      .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
  }, [receipts, selectedMonth, categoryFilter, localQuery]);

  const monthTotalSpend = useMemo(
    () => monthReceipts.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0),
    [monthReceipts]
  );

  const monthItemCount = useMemo(
    () => monthReceipts.reduce((acc, r) => acc + (r.line_items?.length || 0), 0),
    [monthReceipts]
  );

  if (receipts.length === 0) {
    return (
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-8 sm:p-12 text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <FileText className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-balance">
            Your receipt ledger is clean and ready
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Every slip you scan or add is organized automatically by month, store, and category —
            ready for PDF statements anytime.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={onGoToScanner}
            className="min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center gap-2 whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            <span>Scan First Receipt</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddManual}
            className="min-h-[48px] px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-sm flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manually</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Month & Statement Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Receipts
          </h1>
          <select
            aria-label="Select month"
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>

        {/* Free Single-Month PDF & Entry Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenSearch}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span>Search All</span>
          </button>

          {monthReceipts.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => downloadSingleMonthPDF(selectedMonth, receipts)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Month PDF</span>
              </button>

              <button
                type="button"
                onClick={() => shareOrSaveSingleMonthPDF(selectedMonth, receipts)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Share2 className="w-4 h-4 text-slate-500" />
                <span>Share</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenPrintableReport(selectedMonth)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Statement</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onOpenAddManual}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Receipt</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {formatMonthLabel(selectedMonth)} Spend
          </p>
          <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1 truncate">
            {formatMoney(monthTotalSpend, currencyCode)}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Saved Slips</p>
          <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {monthReceipts.length}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Items Tracked</p>
          <p className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {monthItemCount}
          </p>
        </div>
      </div>

      {/* Filter & Quick Filter Input */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-xl overflow-x-auto">
          {FILTER_CATEGORIES.map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat === 'Electricity & Utilities'
                  ? 'Utilities'
                  : cat === 'Food & Groceries'
                  ? 'Groceries'
                  : cat === 'Home Maintenance'
                  ? 'Hardware & Home'
                  : cat}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Filter store, invoice #, item..."
            className="w-full min-h-[42px] pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Month Ledger List */}
      {monthReceipts.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-8 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No receipts found for {formatMonthLabel(selectedMonth)}
            {categoryFilter !== 'All' ? ` in ${categoryFilter}` : ''}.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onGoToScanner}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              Scan a Receipt
            </button>
            {categoryFilter !== 'All' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('All')}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
              >
                Show All Categories
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {monthReceipts.map((rcpt) => {
            const isExpanded = expandedId === rcpt.id;
            const isConfirmingDelete = confirmDeleteId === rcpt.id;
            const displayInv = getDisplayInvoiceNumber(rcpt);

            return (
              <div key={rcpt.id} className="transition-colors">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rcpt.id)}
                  className="w-full min-h-[64px] px-4 sm:px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white truncate">
                        {rcpt.vendor_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        <span>{formatShortDate(rcpt.invoice_date)}</span>
                        {displayInv && (
                          <>
                            <span aria-hidden="true" className="mx-1.5">
                              ·
                            </span>
                            <span className="font-mono tabular-nums">#{displayInv}</span>
                          </>
                        )}
                        <span aria-hidden="true" className="mx-1.5">
                          ·
                        </span>
                        <span>{formatCategoryLabel(rcpt.category)}</span>
                        <span aria-hidden="true" className="mx-1.5">
                          ·
                        </span>
                        <span className="tabular-nums">
                          {rcpt.line_items?.length || 0}{' '}
                          {(rcpt.line_items?.length || 0) === 1 ? 'item' : 'items'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span className="text-sm sm:text-base font-mono tabular-nums font-bold text-slate-900 dark:text-white shrink-0">
                    {formatMoney(rcpt.total_amount, currencyCode)}
                  </span>
                </button>

                {/* Expanded Line-Item Detail & Actions */}
                {isExpanded && (
                  <div className="px-4 sm:px-6 pb-5 pt-2 bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>Store: {rcpt.vendor_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>Purchase Date: {formatShortDate(rcpt.invoice_date)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Invoice #: {displayInv || 'Not printed'}
                      </span>
                      {rcpt.notes && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Note: {rcpt.notes}</span>
                        </>
                      )}
                    </div>

                    {/* Line Items Table */}
                    {rcpt.line_items && rcpt.line_items.length > 0 ? (
                      <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                        {rcpt.line_items.map((item, idx) => (
                          <div
                            key={idx}
                            className="py-2.5 flex items-center justify-between gap-4 text-xs sm:text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                {item.description}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                <span className="font-mono">
                                  Qty {item.quantity} × {formatMoney(item.unit_price, currencyCode)}
                                </span>
                                <span aria-hidden="true" className="mx-1.5">
                                  ·
                                </span>
                                <span>{formatCategoryLabel(item.category || rcpt.category)}</span>
                                <span aria-hidden="true" className="mx-1.5">
                                  ·
                                </span>
                                <span>{formatShortDate(rcpt.invoice_date)}</span>
                              </p>
                            </div>
                            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
                              {formatMoney(item.total_price, currencyCode)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No individual items listed on this receipt.
                      </p>
                    )}

                    {/* Subtotal / Tax / Total Breakdown */}
                    <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <div>
                        <span>Subtotal: {formatMoney(rcpt.subtotal, currencyCode)}</span>
                        <span aria-hidden="true" className="mx-2">
                          ·
                        </span>
                        <span>Tax: {formatMoney(rcpt.tax, currencyCode)}</span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        Total: {formatMoney(rcpt.total_amount, currencyCode)}
                      </div>
                    </div>

                    {/* Receipt Actions (100% Free Single-Receipt PDF, Print, Edit, Inline Delete) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEditReceipt(rcpt)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadSingleReceiptPDF(rcpt)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => printSingleReceiptSafely(rcpt)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </div>

                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                            Delete this receipt?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteReceipt(rcpt.id);
                              setConfirmDeleteId(null);
                              setExpandedId(null);
                            }}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold whitespace-nowrap"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(rcpt.id)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
