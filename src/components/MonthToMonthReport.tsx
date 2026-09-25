import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, ArrowUpDown, Search, Printer, 
  Download, Calendar, CheckCircle2, ArrowRight, ShieldCheck, Sparkles,
  FileDown, Loader2
} from 'lucide-react';
import type { SavedReceipt } from '../types';
import { compareMonths, exportComparisonToCSV } from '../utils/reportUtils';
import { downloadComparisonPDF } from '../utils/pdfGenerator';

interface MonthToMonthReportProps {
  receipts: SavedReceipt[];
  initialMonthA?: string;
  initialMonthB?: string;
  onOpenPrintReport: () => void;
}

export const MonthToMonthReport: React.FC<MonthToMonthReportProps> = ({
  receipts,
  initialMonthA,
  initialMonthB,
  onOpenPrintReport,
}) => {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  // Get all unique available months sorted descending
  const availableMonths = useMemo(() => {
    return Array.from(new Set<string>(receipts.map(r => r.month_year)))
      .sort((a, b) => b.localeCompare(a));
  }, [receipts]);

  const currentMonthDefault = new Date().toISOString().substring(0, 7);

  const [monthA, setMonthA] = useState<string>(
    initialMonthA || availableMonths[0] || currentMonthDefault
  );
  const [monthB, setMonthB] = useState<string>(
    initialMonthB || availableMonths[1] || availableMonths[0] || currentMonthDefault
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'saved_more' | 'spent_more' | 'new_item'>('all');
  const [sortBy, setSortBy] = useState<'alpha' | 'diff_high' | 'diff_low' | 'totalA'>('alpha');

  // Compute live comparison
  const comparison = useMemo(() => {
    return compareMonths(monthA, monthB, receipts);
  }, [monthA, monthB, receipts]);

  // Filter & sort items
  const displayedItems = useMemo(() => {
    let list = comparison.items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter === 'saved_more') {
        matchesStatus = item.status === 'saved_more' || item.status === 'not_purchased';
      } else if (statusFilter === 'spent_more') {
        matchesStatus = item.status === 'spent_more';
      } else if (statusFilter === 'new_item') {
        matchesStatus = item.status === 'new_item';
      }

      return matchesSearch && matchesStatus;
    });

    if (sortBy === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } else if (sortBy === 'diff_high') {
      // Highest spend increase first
      list.sort((a, b) => b.amount_diff - a.amount_diff);
    } else if (sortBy === 'diff_low') {
      // Biggest savings first (most negative diff)
      list.sort((a, b) => a.amount_diff - b.amount_diff);
    } else if (sortBy === 'totalA') {
      list.sort((a, b) => b.monthA_total - a.monthA_total);
    }

    return list;
  }, [comparison.items, searchQuery, statusFilter, sortBy]);

  const handleExportCSV = () => {
    exportComparisonToCSV(monthA, monthB, comparison.items);
  };

  const isNetSaving = comparison.totalDiff < 0;

  if (receipts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full text-center">
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-sm w-full space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800">No Invoices or Receipts Recorded</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Once you scan or add receipts, ParserPro will automatically extract line items, aggregate identical purchases A-Z, and generate side-by-side comparative monthly reports.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Auto-calculates itemized unit prices & quantities</span>
            </div>
            <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Tracks category variance & net savings</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full gap-5 overflow-auto">
      {/* Month Selector & Controls Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Primary Month:
            </span>
            <select
              value={monthA}
              onChange={(e) => setMonthA(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {availableMonths.map((m) => (
                <option key={`a-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 text-slate-400 font-bold text-xs">
            <span>vs</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Comparison Month:
            </span>
            <select
              value={monthB}
              onChange={(e) => setMonthB(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {availableMonths.map((m) => (
                <option key={`b-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              const temp = monthA;
              setMonthA(monthB);
              setMonthB(temp);
            }}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-xs font-bold flex items-center gap-1"
            title="Swap months"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Swap</span>
          </button>
        </div>

        {/* Action Buttons: Print & Export */}
        <div className="flex items-center gap-2 self-end lg:self-auto flex-wrap">
          <button
            onClick={async () => {
              setIsDownloadingPdf(true);
              await downloadComparisonPDF(monthA, monthB, receipts);
              setIsDownloadingPdf(false);
            }}
            disabled={isDownloadingPdf}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            title="Download vector PDF directly to your device"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{isDownloadingPdf ? 'Generating...' : 'Download PDF'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenPrintReport}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF Preview</span>
          </button>
        </div>
      </div>

      {/* Comparison Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Month A */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {monthA} Total Spend
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            R {comparison.totalA.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Primary Target Period</span>
          </div>
        </div>

        {/* Total Month B */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {monthB} Total Spend
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            R {comparison.totalB.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Baseline Comparison</span>
          </div>
        </div>

        {/* Net Difference */}
        <div className={`p-4 rounded-2xl border shadow-sm ${
          isNetSaving 
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
            : 'bg-rose-50/80 border-rose-200 text-rose-950'
        }`}>
          <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">
            Net Month-to-Month Variance
          </div>
          <div className="text-2xl font-black mt-1 flex items-center gap-1.5">
            {isNetSaving ? (
              <>
                <TrendingDown className="w-6 h-6 text-emerald-600 shrink-0" />
                <span>- R {Math.abs(comparison.totalDiff).toFixed(2)}</span>
              </>
            ) : (
              <>
                <TrendingUp className="w-6 h-6 text-rose-600 shrink-0" />
                <span>+ R {Math.abs(comparison.totalDiff).toFixed(2)}</span>
              </>
            )}
          </div>
          <div className="text-[11px] font-semibold mt-1">
            {isNetSaving ? (
              <span className="text-emerald-700">
                Saved {Math.abs(comparison.totalPercentChange)}% compared to {monthB}
              </span>
            ) : (
              <span className="text-rose-700">
                Spent {Math.abs(comparison.totalPercentChange)}% more than {monthB}
              </span>
            )}
          </div>
        </div>

        {/* Distinct Items Tracked */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Alphabetical Items Calculated
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {comparison.items.length} <span className="text-xs font-normal text-slate-500">Distinct Items</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Sorted A-Z & Aggregated</span>
          </div>
        </div>
      </div>

      {/* Highlights: Where we Spent More vs Where we Saved More */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Where We Saved More */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-emerald-600" />
              <span>Where We Saved More (Top Reductions)</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
              Cost Reductions
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {comparison.topSavings.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No item reductions found.</p>
            ) : (
              comparison.topSavings.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2 bg-emerald-50/50 rounded-xl">
                  <div className="font-semibold text-slate-800 truncate max-w-[220px]">
                    {item.name}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-700">
                      - R {Math.abs(item.amount_diff).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {monthA}: R{item.monthA_total.toFixed(0)} vs {monthB}: R{item.monthB_total.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Where We Spent More */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-rose-600" />
              <span>Where We Spent More (Top Increases)</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full">
              Cost Increases
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {comparison.topIncreases.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No item increases found.</p>
            ) : (
              comparison.topIncreases.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2 bg-rose-50/50 rounded-xl">
                  <div className="font-semibold text-slate-800 truncate max-w-[220px]">
                    {item.name}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-rose-700">
                      + R {item.amount_diff.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {monthA}: R{item.monthA_total.toFixed(0)} vs {monthB}: R{item.monthB_total.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Category Breakdown Comparison */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Category-by-Category Spend Comparison
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {comparison.categoryComparison.map((cat) => {
            const isCatSaving = cat.diff < 0;
            return (
              <div key={cat.category} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="text-[11px] font-bold text-slate-700 truncate">{cat.category}</div>
                <div className="text-xs font-extrabold text-slate-900 mt-1">
                  R {cat.monthA.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {monthB}: R {cat.monthB.toFixed(2)}
                </div>
                <div className="mt-1 text-[10px] font-bold">
                  {cat.monthA === 0 && cat.monthB === 0 ? (
                    <span className="text-slate-400">No Spend</span>
                  ) : isCatSaving ? (
                    <span className="text-emerald-600">Saved R {Math.abs(cat.diff).toFixed(2)}</span>
                  ) : (
                    <span className="text-rose-600">+ R {cat.diff.toFixed(2)} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alphabetical Item Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Item-by-Item Calculated Ledger</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                Alphabetical Order (A-Z)
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live totals calculated for every grocery, utility, and household item.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('saved_more')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  statusFilter === 'saved_more' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                Saved More
              </button>
              <button
                onClick={() => setStatusFilter('spent_more')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  statusFilter === 'spent_more' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                Spent More
              </button>
            </div>

            {/* Sort order */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
            >
              <option value="alpha">A-Z Alphabetical</option>
              <option value="diff_low">Biggest Savings First</option>
              <option value="diff_high">Biggest Increases First</option>
              <option value="totalA">Highest Total Spend ({monthA})</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Item Name (A to Z)</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-center">{monthA} Qty</th>
                <th className="py-3 px-4 text-right">{monthA} Total (ZAR)</th>
                <th className="py-3 px-3 text-center">{monthB} Qty</th>
                <th className="py-3 px-4 text-right">{monthB} Total (ZAR)</th>
                <th className="py-3 px-4 text-right">Variance (Diff)</th>
                <th className="py-3 px-4 text-center">Status / Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No items match the selected filter.
                  </td>
                </tr>
              ) : (
                displayedItems.map((item, idx) => {
                  const isSaving = item.status === 'saved_more' || item.status === 'not_purchased';
                  const isIncrease = item.status === 'spent_more';
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name */}
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <span>{item.name}</span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                          {item.category}
                        </span>
                      </td>

                      {/* Month A Qty */}
                      <td className="py-3 px-3 text-center font-mono font-semibold">
                        {item.monthA_quantity > 0 ? item.monthA_quantity : <span className="text-slate-300">0</span>}
                      </td>

                      {/* Month A Total */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                        {item.monthA_total > 0 ? (
                          `R ${item.monthA_total.toFixed(2)}`
                        ) : (
                          <span className="text-slate-300">R 0.00</span>
                        )}
                      </td>

                      {/* Month B Qty */}
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-500">
                        {item.monthB_quantity > 0 ? item.monthB_quantity : <span className="text-slate-300">0</span>}
                      </td>

                      {/* Month B Total */}
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {item.monthB_total > 0 ? (
                          `R ${item.monthB_total.toFixed(2)}`
                        ) : (
                          <span className="text-slate-300">R 0.00</span>
                        )}
                      </td>

                      {/* Diff */}
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {item.amount_diff === 0 ? (
                          <span className="text-slate-400">R 0.00</span>
                        ) : isSaving ? (
                          <span className="text-emerald-600">
                            - R {Math.abs(item.amount_diff).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-rose-600">
                            + R {Math.abs(item.amount_diff).toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {item.status === 'saved_more' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px]">
                            <TrendingDown className="w-3 h-3 text-emerald-600" />
                            Saved ({Math.abs(item.percent_change)}%)
                          </span>
                        )}

                        {item.status === 'not_purchased' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px]">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Not Bought (Saved 100%)
                          </span>
                        )}

                        {item.status === 'spent_more' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full font-bold text-[10px]">
                            <TrendingUp className="w-3 h-3 text-rose-600" />
                            Spent More (+{item.percent_change}%)
                          </span>
                        )}

                        {item.status === 'new_item' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-bold text-[10px]">
                            <Sparkles className="w-3 h-3 text-blue-600" />
                            New Item
                          </span>
                        )}

                        {item.status === 'unchanged' && (
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                            Equal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-800 border-t border-slate-300">
              <tr>
                <td colSpan={3} className="py-3 px-4 text-slate-600">
                  Total Month Spend & Variance:
                </td>
                <td className="py-3 px-4 text-right text-emerald-700 text-sm font-black">
                  R {comparison.totalA.toFixed(2)}
                </td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-4 text-right text-slate-600 text-sm">
                  R {comparison.totalB.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right text-sm font-black">
                  {isNetSaving ? (
                    <span className="text-emerald-700">- R {Math.abs(comparison.totalDiff).toFixed(2)}</span>
                  ) : (
                    <span className="text-rose-700">+ R {comparison.totalDiff.toFixed(2)}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center text-xs">
                  {isNetSaving ? (
                    <span className="text-emerald-700 font-bold">Net Savings</span>
                  ) : (
                    <span className="text-rose-700 font-bold">Net Increase</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
