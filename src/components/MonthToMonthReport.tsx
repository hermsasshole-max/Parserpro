import React, { useMemo, useState } from 'react';
import {
  Download,
  Share2,
  Printer,
  FileSpreadsheet,
  SlidersHorizontal,
  Lock,
  Search,
  BarChart3,
  Camera,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AggregatedItem, CategoryBudgets, SavedReceipt } from '../types';
import {
  compareMonths,
  generateMonthReport,
  exportComparisonToCSV,
  exportMonthlySummaryToCSV,
  calculateSixMonthSpendingTrend,
} from '../utils/reportUtils';
import {
  downloadComparisonPDF,
  downloadSingleMonthPDF,
  shareOrSavePDF,
  shareOrSaveSingleMonthPDF,
  printReportSafely,
  triggerSystemPrint,
} from '../utils/pdfGenerator';
import { computeCategoryBudgetProgress } from '../utils/budgetStorage';
import {
  FREE_PRICE_COMPARISON_PREVIEW_LIMIT,
  type UpgradeTriggerReason,
} from '../utils/subscriptionManager';
import {
  formatCategoryLabel,
  formatMoney,
  formatMonthLabel,
  formatPriceVarianceSummary,
  formatShortDate,
} from '../utils/currencyFormat';
import { SpendingTrendChart } from './SpendingTrendChart';

interface MonthToMonthReportProps {
  receipts: SavedReceipt[];
  selectedMonth: string;
  comparisonMonth: string;
  availableMonths: string[];
  onSelectMonth: (month: string) => void;
  onSelectComparisonMonth: (month: string) => void;
  categoryBudgets: CategoryBudgets;
  onOpenBudgetModal: () => void;
  isPlus: boolean;
  currencyCode: string;
  onOpenUpgrade: (reason: UpgradeTriggerReason) => void;
  onGoToScanner: () => void;
}

export const MonthToMonthReport: React.FC<MonthToMonthReportProps> = ({
  receipts,
  selectedMonth,
  comparisonMonth,
  availableMonths,
  onSelectMonth,
  onSelectComparisonMonth,
  categoryBudgets,
  onOpenBudgetModal,
  isPlus,
  currencyCode,
  onOpenUpgrade,
  onGoToScanner,
}) => {
  const [reportMode, setReportMode] = useState<'monthly_summary' | 'month_compare'>(
    'monthly_summary'
  );
  const [summaryFilter, setSummaryFilter] = useState<'all' | 'repeat' | 'variance'>('all');
  const [summarySort, setSummarySort] = useState<'frequency' | 'alphabetical'>('frequency');
  const [summarySearch, setSummarySearch] = useState('');
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null);

  const [itemSearch, setItemSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'spent_more' | 'saved_more'>('all');

  const currentReport = useMemo(
    () => generateMonthReport(selectedMonth, receipts),
    [selectedMonth, receipts]
  );

  const comparison = useMemo(
    () => compareMonths(selectedMonth, comparisonMonth, receipts),
    [selectedMonth, comparisonMonth, receipts]
  );

  const budgetProgress = useMemo(
    () => computeCategoryBudgetProgress(currentReport.category_totals, categoryBudgets),
    [currentReport.category_totals, categoryBudgets]
  );

  const sixMonthPreview = useMemo(
    () => calculateSixMonthSpendingTrend(receipts, selectedMonth),
    [receipts, selectedMonth]
  );

  const varianceStats = useMemo(() => {
    const varied = currentReport.items_alphabetical.filter((it) => it.price_variance > 0.004);
    let topItem: AggregatedItem | null = null;
    varied.forEach((it) => {
      if (!topItem || it.price_variance > topItem.price_variance) {
        topItem = it;
      }
    });
    return {
      variedCount: varied.length,
      topVarianceItem: topItem as AggregatedItem | null,
    };
  }, [currentReport.items_alphabetical]);

  const filteredSummaryItems = useMemo(() => {
    const list = currentReport.items_alphabetical.filter((item) => {
      if (summaryFilter === 'repeat' && item.occurrences < 2) return false;
      if (summaryFilter === 'variance' && item.price_variance <= 0.004) return false;
      if (summarySearch.trim()) {
        const q = summarySearch.trim().toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          formatCategoryLabel(item.primary_category).toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (summarySort === 'frequency') {
      return [...list].sort((a, b) => {
        if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
        if (b.price_variance !== a.price_variance) return b.price_variance - a.price_variance;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }

    return list;
  }, [currentReport.items_alphabetical, summaryFilter, summarySearch, summarySort]);

  const filteredComparisonItems = useMemo(() => {
    return comparison.items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (itemSearch.trim()) {
        return item.name.toLowerCase().includes(itemSearch.toLowerCase());
      }
      return true;
    });
  }, [comparison.items, statusFilter, itemSearch]);

  const displayedComparisonItems = isPlus
    ? filteredComparisonItems
    : filteredComparisonItems.slice(0, FREE_PRICE_COMPARISON_PREVIEW_LIMIT);

  const hiddenComparisonCount = Math.max(
    0,
    filteredComparisonItems.length - displayedComparisonItems.length
  );

  const handlePdfExportClick = () => {
    if (reportMode === 'monthly_summary') {
      downloadSingleMonthPDF(selectedMonth, receipts);
    } else {
      downloadComparisonPDF(selectedMonth, comparisonMonth, receipts);
    }
  };

  const handleShareClick = () => {
    if (reportMode === 'monthly_summary') {
      shareOrSaveSingleMonthPDF(selectedMonth, receipts);
    } else {
      shareOrSavePDF(selectedMonth, comparisonMonth, receipts);
    }
  };

  const handlePrintClick = () => {
    if (reportMode === 'monthly_summary') {
      if (!triggerSystemPrint()) {
        shareOrSaveSingleMonthPDF(selectedMonth, receipts);
      }
    } else {
      printReportSafely(selectedMonth, comparisonMonth, receipts);
    }
  };

  const handleCsvExportClick = () => {
    if (!isPlus) {
      onOpenUpgrade('csv_export');
      return;
    }
    if (reportMode === 'monthly_summary') {
      exportMonthlySummaryToCSV(selectedMonth, receipts, currencyCode);
    } else {
      exportComparisonToCSV(selectedMonth, comparisonMonth, comparison.items, currencyCode);
    }
  };

  if (receipts.length === 0) {
    return (
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-8 sm:p-12 text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-balance">
            Spending insights appear as soon as you add a receipt
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Extract itemized receipts, track purchase frequency and unit price variances, and
            review category expenditure subtotals automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToScanner}
          className="min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm inline-flex items-center gap-2 whitespace-nowrap"
        >
          <Camera className="w-4 h-4" />
          <span>Scan First Receipt</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Header, Mode Switch & Export Actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mr-1">
              Reports
            </h1>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setReportMode('monthly_summary')}
                className={`min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  reportMode === 'monthly_summary'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Monthly Summary
              </button>
              <button
                type="button"
                onClick={() => setReportMode('month_compare')}
                className={`min-h-[40px] px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  reportMode === 'month_compare'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Month-to-Month Compare
              </button>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePdfExportClick}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>{reportMode === 'monthly_summary' ? 'PDF Statement' : 'PDF Report'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareClick}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Share2 className="w-4 h-4 text-slate-500" />
              <span>Share</span>
            </button>

            <button
              type="button"
              onClick={handlePrintClick}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleCsvExportClick}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              {isPlus ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Excel / CSV</span>
            </button>
          </div>
        </div>

        {/* Billing Period Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label
            htmlFor="report-target-month"
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            Billing Period
          </label>
          <select
            id="report-target-month"
            aria-label="Target month"
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

          {reportMode === 'month_compare' && (
            <>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">vs</span>
              <select
                aria-label="Comparison baseline month"
                value={comparisonMonth}
                onChange={(e) => onSelectComparisonMonth(e.target.value)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {reportMode === 'monthly_summary' ? (
        <>
          {/* Monthly Aggregation KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {formatMonthLabel(selectedMonth)} Expenditure
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {formatMoney(currentReport.total_spend, currencyCode)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                {currentReport.receipt_count}{' '}
                {currentReport.receipt_count === 1 ? 'receipt' : 'receipts'} filed
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Item Purchase Frequency
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {currentReport.item_count} {currentReport.item_count === 1 ? 'item' : 'items'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                Purchased {currentReport.total_item_purchases}{' '}
                {currentReport.total_item_purchases === 1 ? 'time' : 'times'} across receipts
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Unit Price Variances
              </p>
              <p
                className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                  varianceStats.variedCount > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {varianceStats.variedCount}{' '}
                {varianceStats.variedCount === 1 ? 'item varied' : 'items varied'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate tabular-nums">
                {varianceStats.topVarianceItem
                  ? `Highest spread: ${varianceStats.topVarianceItem.name} (+${formatMoney(
                      varianceStats.topVarianceItem.price_variance,
                      currencyCode
                    )})`
                  : 'Stable unit prices across scanned receipts'}
              </p>
            </div>
          </div>

          {/* Category Breakdown & Monthly Subtotals */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Category Breakdown & Subtotals
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  {budgetProgress.overall.activeCategoriesCount > 0 ? (
                    <>
                      <span>
                        {formatMoney(budgetProgress.overall.budgetedSpend, currencyCode)} of{' '}
                        {formatMoney(budgetProgress.overall.totalBudget, currencyCode)} budgeted
                      </span>
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      <span>{budgetProgress.overall.percentUsed}% used</span>
                    </>
                  ) : (
                    <span>
                      Subtotal expenditure per assigned category for{' '}
                      {formatMonthLabel(selectedMonth)}.
                    </span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenBudgetModal}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Edit Budgets</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-4">Category</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Activity</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Share</th>
                    <th className="py-2.5 pl-3 text-right whitespace-nowrap">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                  {currentReport.category_breakdown.map((row) => {
                    const budgetRow = budgetProgress.categories.find(
                      (b) => b.category === row.category
                    );
                    const hasBudget = budgetRow && budgetRow.limit > 0;
                    const barColor =
                      budgetRow?.status === 'exceeded'
                        ? 'bg-rose-600'
                        : budgetRow?.status === 'near'
                        ? 'bg-amber-500'
                        : 'bg-emerald-600';

                    return (
                      <tr key={row.category}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {formatCategoryLabel(row.category)}
                          </p>
                          {hasBudget && budgetRow && (
                            <div className="mt-1.5 max-w-xs space-y-1">
                              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${budgetRow.barWidthPercent}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                Budget {formatMoney(budgetRow.limit, currencyCode)} ·{' '}
                                {budgetRow.status === 'exceeded'
                                  ? `Over by ${formatMoney(budgetRow.overAmount, currencyCode)}`
                                  : `${formatMoney(budgetRow.remaining, currencyCode)} left`}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                          {row.receipt_count} {row.receipt_count === 1 ? 'slip' : 'slips'} ·{' '}
                          {row.item_count} {row.item_count === 1 ? 'item' : 'items'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {row.percentage.toFixed(1)}%
                        </td>
                        <td className="py-3 pl-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatMoney(row.subtotal, currencyCode)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    <td className="pt-3 pr-4">Total Monthly Expenditure</td>
                    <td className="pt-3 px-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 font-normal whitespace-nowrap">
                      {currentReport.receipt_count}{' '}
                      {currentReport.receipt_count === 1 ? 'receipt' : 'receipts'}
                    </td>
                    <td className="pt-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      100.0%
                    </td>
                    <td className="pt-3 pl-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatMoney(currentReport.total_spend, currencyCode)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Grouped Item Purchase Frequency & Price History / Variance */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Grouped Item Frequency & Price Variance
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  Identical items grouped across {formatMonthLabel(selectedMonth)} receipts showing
                  purchase counts, lowest to highest unit price spread, and most recent unit price.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {(
                    [
                      { id: 'all', label: 'All Items' },
                      { id: 'repeat', label: 'Purchased 2+ Times' },
                      { id: 'variance', label: 'Price Variance' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSummaryFilter(tab.id)}
                      className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        summaryFilter === tab.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSummarySort('frequency')}
                    className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      summarySort === 'frequency'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Most Purchased
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummarySort('alphabetical')}
                    className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      summarySort === 'alphabetical'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    A–Z
                  </button>
                </div>

                <div className="relative w-full sm:w-52">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={summarySearch}
                    onChange={(e) => setSummarySearch(e.target.value)}
                    placeholder="Search item or category..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {filteredSummaryItems.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                {currentReport.receipt_count === 0
                  ? `No receipts recorded for ${formatMonthLabel(selectedMonth)}.`
                  : 'No grouped items match this filter.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-4">Item & Purchase Frequency</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">
                        Price History & Variance (Low – High)
                      </th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">
                        Most Recent Unit Price
                      </th>
                      <th className="py-2.5 pl-3 text-right whitespace-nowrap">Item Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                    {filteredSummaryItems.map((item) => {
                      const rowKey = item.name.toLowerCase();
                      const isExpanded = expandedItemKey === rowKey;
                      const hasVariance = item.price_variance > 0.004;
                      const freqText = `Purchased ${item.occurrences} ${
                        item.occurrences === 1 ? 'time' : 'times'
                      }`;

                      return (
                        <React.Fragment key={rowKey}>
                          <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 pr-4">
                              <button
                                type="button"
                                onClick={() => setExpandedItemKey(isExpanded ? null : rowKey)}
                                className="text-left group inline-flex items-start gap-2 min-h-[44px] py-0.5 focus:outline-none"
                              >
                                <span className="mt-0.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0">
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </span>
                                <span>
                                  <span className="block font-semibold text-slate-900 dark:text-white">
                                    {item.name}:{' '}
                                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                                      {freqText}
                                    </span>
                                  </span>
                                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                    <span>{formatCategoryLabel(item.primary_category)}</span>
                                    <span aria-hidden="true" className="mx-1.5">
                                      ·
                                    </span>
                                    <span>Total Qty {item.total_quantity}</span>
                                  </span>
                                </span>
                              </button>
                            </td>

                            <td
                              className={`py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                                hasVariance
                                  ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {formatPriceVarianceSummary(
                                item.lowest_unit_price,
                                item.highest_unit_price,
                                currencyCode
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-right whitespace-nowrap">
                              <p className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                                {formatMoney(item.latest_unit_price, currencyCode)}
                              </p>
                              {item.latest_purchase_date && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  {formatShortDate(item.latest_purchase_date)}
                                  {item.latest_vendor ? ` · ${item.latest_vendor}` : ''}
                                </p>
                              )}
                            </td>

                            <td className="py-3.5 pl-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                              {formatMoney(item.total_amount, currencyCode)}
                            </td>
                          </tr>

                          {isExpanded && item.price_history.length > 0 && (
                            <tr className="bg-slate-50/60 dark:bg-slate-800/30">
                              <td colSpan={4} className="px-4 py-3">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                                  Chronological Unit Price History ({item.price_history.length}{' '}
                                  {item.price_history.length === 1 ? 'receipt' : 'receipts'})
                                </p>
                                <div className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
                                  {item.price_history.map((obs, obsIdx) => (
                                    <div
                                      key={`${obs.receipt_id}_${obsIdx}`}
                                      className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                                    >
                                      <div className="text-slate-600 dark:text-slate-300">
                                        <span className="font-medium text-slate-800 dark:text-slate-100">
                                          {formatShortDate(obs.invoice_date)}
                                        </span>
                                        <span aria-hidden="true" className="mx-1.5">
                                          ·
                                        </span>
                                        <span>{obs.vendor_name}</span>
                                        {obs.invoice_number && (
                                          <>
                                            <span aria-hidden="true" className="mx-1.5">
                                              ·
                                            </span>
                                            <span className="font-mono tabular-nums">
                                              #{obs.invoice_number}
                                            </span>
                                          </>
                                        )}
                                        <span aria-hidden="true" className="mx-1.5">
                                          ·
                                        </span>
                                        <span>{formatCategoryLabel(obs.category)}</span>
                                      </div>

                                      <div className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                                        <span>
                                          {obs.quantity} ×{' '}
                                          {formatMoney(obs.unit_price, currencyCode)}
                                        </span>
                                        <span className="text-slate-400 mx-1.5">=</span>
                                        <span className="font-semibold">
                                          {formatMoney(obs.total_price, currencyCode)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* Month Comparison KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {formatMonthLabel(selectedMonth)} Total
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {formatMoney(comparison.totalA, currencyCode)}
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {formatMonthLabel(comparisonMonth)} Baseline
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {formatMoney(comparison.totalB, currencyCode)}
              </p>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Month-to-Month Difference
              </p>
              <p
                className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                  comparison.totalDiff > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : comparison.totalDiff < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {comparison.totalDiff > 0 ? '+' : ''}
                {formatMoney(comparison.totalDiff, currencyCode)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                {comparison.totalDiff > 0
                  ? `Spent more (${comparison.totalPercentChange}%)`
                  : comparison.totalDiff < 0
                  ? `Saved (${Math.abs(comparison.totalPercentChange)}%)`
                  : 'No change between selected months'}
              </p>
            </div>
          </div>

          {/* 6-Month Timeline (Full Interactive Chart on Plus, Calm Unlock Preview on Free) */}
          {isPlus ? (
            <SpendingTrendChart
              receipts={receipts}
              selectedMonth={selectedMonth}
              currencyCode={currencyCode}
              onSelectMonth={onSelectMonth}
            />
          ) : (
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  6-Month Spending Timeline
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed tabular-nums">
                  Your 6-month household average is{' '}
                  <strong className="font-semibold text-slate-900 dark:text-white">
                    {formatMoney(sixMonthPreview.averageMonthlySpend, currencyCode)}/mo
                  </strong>
                  . Unlock interactive 6-month category charts and full item comparisons with
                  ParserPro Plus.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenUpgrade('price_history')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <Sparkles className="w-4 h-4" />
                <span>Unlock Timeline</span>
              </button>
            </section>
          )}

          {/* A-Z Item Price Comparison Table */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Item-by-Item Month Comparison
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  Comparing {filteredComparisonItems.length} matched items between{' '}
                  {formatMonthLabel(selectedMonth)} and {formatMonthLabel(comparisonMonth)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'spent_more', label: 'Spent More' },
                      { id: 'saved_more', label: 'Saved' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                        statusFilter === tab.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-52">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search item..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {displayedComparisonItems.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                No matching items found for this filter.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-4">Item</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">
                        {formatMonthLabel(comparisonMonth)}
                      </th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">
                        {formatMonthLabel(selectedMonth)}
                      </th>
                      <th className="py-2.5 pl-3 text-right whitespace-nowrap">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                    {displayedComparisonItems.map((item, idx) => (
                      <tr key={`${item.name}_${idx}`}>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            <span>{formatCategoryLabel(item.category)}</span>
                            <span aria-hidden="true" className="mx-1.5">
                              ·
                            </span>
                            <span className="tabular-nums">Qty {item.monthA_quantity}</span>
                          </p>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatMoney(item.monthB_total, currencyCode)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatMoney(item.monthA_total, currencyCode)}
                        </td>
                        <td
                          className={`py-3 pl-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            item.amount_diff > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : item.amount_diff < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.amount_diff > 0 ? '+' : ''}
                          {formatMoney(item.amount_diff, currencyCode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Free Starter Preview Unlock Card */}
            {!isPlus && hiddenComparisonCount > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Showing top {FREE_PRICE_COMPARISON_PREVIEW_LIMIT} items. Unlock{' '}
                  <strong className="font-semibold text-slate-900 dark:text-white">
                    {hiddenComparisonCount} more item comparisons
                  </strong>{' '}
                  and Excel exports with ParserPro Plus.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenUpgrade('price_history')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold whitespace-nowrap self-start sm:self-auto"
                >
                  See All {filteredComparisonItems.length} Items
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
