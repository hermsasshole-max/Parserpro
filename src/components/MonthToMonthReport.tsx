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
} from 'lucide-react';
import type { CategoryBudgets, SavedReceipt } from '../types';
import {
  compareMonths,
  generateMonthReport,
  exportComparisonToCSV,
  calculateSixMonthSpendingTrend,
} from '../utils/reportUtils';
import {
  downloadComparisonPDF,
  shareOrSavePDF,
  printReportSafely,
} from '../utils/pdfGenerator';
import { computeCategoryBudgetProgress } from '../utils/budgetStorage';
import {
  FREE_PRICE_COMPARISON_PREVIEW_LIMIT,
  type UpgradeTriggerReason,
} from '../utils/subscriptionManager';
import { formatMoney, formatMonthLabel } from '../utils/currencyFormat';
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
  const [itemSearch, setItemSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'spent_more' | 'saved_more'
  >('all');

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

  const filteredItems = useMemo(() => {
    return comparison.items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (itemSearch.trim()) {
        return item.name.toLowerCase().includes(itemSearch.toLowerCase());
      }
      return true;
    });
  }, [comparison.items, statusFilter, itemSearch]);

  const displayedItems = isPlus
    ? filteredItems
    : filteredItems.slice(0, FREE_PRICE_COMPARISON_PREVIEW_LIMIT);

  const hiddenItemCount = Math.max(0, filteredItems.length - displayedItems.length);

  const handleCsvExportClick = () => {
    if (!isPlus) {
      onOpenUpgrade('csv_export');
      return;
    }
    exportComparisonToCSV(selectedMonth, comparisonMonth, comparison.items);
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
            Track category budgets, spot price increases on everyday groceries, and compare months
            automatically.
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
      {/* Header & Month Comparison Picker */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mr-1">
            Insights
          </h1>
          <select
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
        </div>

        {/* Report Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadComparisonPDF(selectedMonth, comparisonMonth, receipts)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>PDF Report</span>
          </button>

          <button
            type="button"
            onClick={() => shareOrSavePDF(selectedMonth, comparisonMonth, receipts)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Share2 className="w-4 h-4 text-slate-500" />
            <span>Share</span>
          </button>

          <button
            type="button"
            onClick={() => printReportSafely(selectedMonth, comparisonMonth, receipts)}
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

      {/* Category Budgets Progress Card */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {formatMonthLabel(selectedMonth)} Category Budgets
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
                <span>Set monthly category targets to track household spending pace.</span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenBudgetModal}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Edit Budgets</span>
          </button>
        </div>

        <div className="space-y-3.5">
          {budgetProgress.categories.map((cat) => {
            if (cat.status === 'unset' && cat.spent === 0) return null;

            const statusLabel =
              cat.status === 'exceeded'
                ? `Over by ${formatMoney(cat.overAmount, currencyCode)}`
                : cat.status === 'near'
                ? `${formatMoney(cat.remaining, currencyCode)} left (near limit)`
                : cat.status === 'within'
                ? `${formatMoney(cat.remaining, currencyCode)} remaining`
                : 'No budget set';

            const barColor =
              cat.status === 'exceeded'
                ? 'bg-rose-600'
                : cat.status === 'near'
                ? 'bg-amber-500'
                : 'bg-emerald-600';

            return (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {cat.category}
                  </span>
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatMoney(cat.spent, currencyCode)}
                    {cat.limit > 0 ? ` / ${formatMoney(cat.limit, currencyCode)}` : ''}
                  </span>
                </div>

                {cat.limit > 0 && (
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-opacity ${barColor}`}
                      style={{ width: `${cat.barWidthPercent}%` }}
                    />
                  </div>
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {statusLabel}
                </p>
              </div>
            );
          })}
        </div>
      </section>

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
              . Unlock interactive 6-month category charts and full item price history with
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
              Item-by-Item Price Comparison
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              Comparing {filteredItems.length} matched items between{' '}
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

        {displayedItems.length === 0 ? (
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
                {displayedItems.map((item, idx) => (
                  <tr key={`${item.name}_${idx}`}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span>{item.category}</span>
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
        {!isPlus && hiddenItemCount > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Showing top {FREE_PRICE_COMPARISON_PREVIEW_LIMIT} items. Unlock{' '}
              <strong className="font-semibold text-slate-900 dark:text-white">
                {hiddenItemCount} more item comparisons
              </strong>{' '}
              and Excel exports with ParserPro Plus.
            </p>
            <button
              type="button"
              onClick={() => onOpenUpgrade('price_history')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold whitespace-nowrap self-start sm:self-auto"
            >
              See All {filteredItems.length} Items
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
