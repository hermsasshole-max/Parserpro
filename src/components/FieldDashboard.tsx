import React from 'react';
import {
  Camera,
  Receipt,
  Plus,
  ArrowRight,
  TrendingUp,
  PieChart,
  ShieldCheck,
  Settings2,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { formatMoney, formatCategoryLabel } from '../utils/currencyFormat';
import type { NavTab } from './Navigation';

interface FieldDashboardProps {
  onNavigate: (tab: NavTab) => void;
  onOpenReceiptScanModal: () => void;
  onOpenAddManual: () => void;
  onOpenBudgetModal: () => void;
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({
  onNavigate,
  onOpenReceiptScanModal,
  onOpenAddManual,
  onOpenBudgetModal,
}) => {
  const { receipts, categoryBudgets, currencyCode, tier } = useAppContext();

  const currentMonth = new Date().toISOString().substring(0, 7);
  const monthReceipts = receipts.filter((r) => r.month_year === currentMonth);
  const totalMonthlySpend = monthReceipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const totalItemCount = monthReceipts.reduce((sum, r) => sum + (r.line_items?.length || 0), 0);

  const categoryTotals: Record<string, number> = {};
  monthReceipts.forEach((r) => {
    const cat = r.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(r.total_amount) || 0);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero Household Quick Action Strip */}
      <section className="p-6 sm:p-8 rounded-3xl bg-emerald-600 text-white shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-100">
              Household Expense &amp; Budget Command
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
              Smart Receipt OCR &amp; Family Ledger
            </h1>
          </div>
          <span className="text-xs font-mono bg-emerald-700/80 px-3 py-1.5 rounded-xl w-fit">
            Plan: {tier.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <button
            type="button"
            onClick={onOpenReceiptScanModal}
            className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-2 border border-white/20 cursor-pointer"
          >
            <Camera className="w-6 h-6 text-emerald-200" />
            <span className="text-xs font-bold leading-tight">Snap Slip / OCR</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddManual}
            className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-2 border border-white/20 cursor-pointer"
          >
            <Receipt className="w-6 h-6 text-emerald-200" />
            <span className="text-xs font-bold leading-tight">Manual Expense</span>
          </button>

          <button
            type="button"
            onClick={onOpenBudgetModal}
            className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-2 border border-white/20 cursor-pointer"
          >
            <Settings2 className="w-6 h-6 text-emerald-200" />
            <span className="text-xs font-bold leading-tight">Set Budgets</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="p-4 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-2 border border-white/20 cursor-pointer"
          >
            <PieChart className="w-6 h-6 text-emerald-200" />
            <span className="text-xs font-bold leading-tight">Analytics</span>
          </button>
        </div>
      </section>

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => onNavigate('expenses')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-1 cursor-pointer hover:border-emerald-500/50 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">This Month Spend</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatMoney(totalMonthlySpend, currencyCode)}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">{monthReceipts.length} slips this month</p>
        </div>

        <div
          onClick={onOpenBudgetModal}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-1 cursor-pointer hover:border-emerald-500/50 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Budget Limits</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatMoney(
              Object.values(categoryBudgets).reduce((a, b) => a + (Number(b) || 0), 0),
              currencyCode
            )}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Tap to edit budgets</p>
        </div>

        <div
          onClick={() => onNavigate('expenses')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-1 cursor-pointer hover:border-emerald-500/50 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">All Saved Slips</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {receipts.length} Receipts
          </p>
          <p className="text-xs text-slate-500">Duplicate blocker active</p>
        </div>

        <div
          onClick={() => onNavigate('reports')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-1 cursor-pointer hover:border-emerald-500/50 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Items Itemized</span>
            <PieChart className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {totalItemCount} Items
          </p>
          <p className="text-xs text-slate-500">Extracted by AI OCR</p>
        </div>
      </section>

      {/* Two Column Layout for Recent Receipts & Category Spending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Scanned Receipts */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Recent Scanned Receipts</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {receipts.slice(0, 5).map((rcpt) => (
              <div
                key={rcpt.id}
                onClick={() => onNavigate('expenses')}
                className="py-3 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{rcpt.vendor_name}</p>
                  <p className="text-slate-500 truncate mt-0.5">
                    {rcpt.invoice_date} · {formatCategoryLabel(rcpt.category)} · {rcpt.line_items?.length || 0} items
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(rcpt.total_amount, currencyCode)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate('expenses');
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
            {receipts.length === 0 && (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-slate-500">No household receipts scanned yet.</p>
                <button
                  type="button"
                  onClick={onOpenReceiptScanModal}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                >
                  Scan First Receipt
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Category Spending Breakdown */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>Monthly Category Spend</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Full Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {Object.keys(categoryTotals).length === 0 ? (
              <p className="py-8 text-xs text-slate-500 text-center">
                No category expenses logged for this month yet.
              </p>
            ) : (
              Object.entries(categoryTotals).map(([cat, amount]) => {
                const limit = categoryBudgets[cat as any] || 0;
                const pct = limit > 0 ? Math.min(100, Math.round((amount / limit) * 100)) : 0;
                return (
                  <div key={cat} className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatCategoryLabel(cat as any)}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                        {formatMoney(amount, currencyCode)}
                        {limit > 0 && (
                          <span className="text-slate-400 font-normal ml-1">
                            / {formatMoney(limit, currencyCode)}
                          </span>
                        )}
                      </span>
                    </div>
                    {limit > 0 && (
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldDashboard;
