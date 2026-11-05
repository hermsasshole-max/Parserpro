import React from 'react';
import {
  Camera,
  FileText,
  CreditCard,
  Receipt,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Users,
  Package,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { formatMoney } from '../utils/currencyFormat';
import type { NavTab } from './Navigation';

interface FieldDashboardProps {
  onNavigate: (tab: NavTab) => void;
  onOpenReceiptScanModal: () => void;
  onOpenVoiceQuoteModal: () => void;
  onOpenAddManual: () => void;
}

export const FieldDashboard: React.FC<FieldDashboardProps> = ({
  onNavigate,
  onOpenReceiptScanModal,
  onOpenVoiceQuoteModal,
  onOpenAddManual,
}) => {
  const { receipts, quotes, invoices, clients, inventory, currencyCode, tier } = useAppContext();

  const totalMonthlySpend = receipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const totalUnpaidInvoices = invoices
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + (inv.totalAmount - inv.amountPaid), 0);
  const lowStockCount = inventory.filter((i) => i.quantity <= i.minQuantity).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero Field Quick Action Strip */}
      <section className="p-5 sm:p-6 rounded-3xl bg-emerald-600 text-white shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-100">
              Contractor Field Command
            </span>
            <h1 className="text-2xl font-bold tracking-tight">On-Site Rapid Actions</h1>
          </div>
          <span className="text-xs font-mono bg-emerald-700/80 px-3 py-1.5 rounded-xl w-fit">
            Plan: {tier.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
          <button
            type="button"
            onClick={onOpenReceiptScanModal}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-1.5 border border-white/20 cursor-pointer"
          >
            <Camera className="w-6 h-6 text-emerald-200" />
            <span className="text-xs font-bold leading-tight">Snap Slip / OCR</span>
          </button>

          <button
            type="button"
            onClick={onOpenVoiceQuoteModal}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-1.5 border border-white/20 cursor-pointer"
          >
            <Sparkles className="w-6 h-6 text-amber-300" />
            <span className="text-xs font-bold leading-tight">Voice Quote</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('invoices')}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-1.5 border border-white/20 cursor-pointer"
          >
            <CreditCard className="w-6 h-6 text-emerald-200" />
            <span className="text-xs font-bold leading-tight">New Invoice</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddManual}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex flex-col items-center justify-center text-center gap-1.5 border border-white/20 cursor-pointer"
          >
            <Receipt className="w-6 h-6 text-emerald-200" />
            <span className="text-xs font-bold leading-tight">Manual Expense</span>
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
            <span className="text-xs font-medium text-slate-500">Expenses Logged</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {formatMoney(totalMonthlySpend, currencyCode)}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">{receipts.length} total slips</p>
        </div>

        <div
          onClick={() => onNavigate('invoices')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-1 cursor-pointer hover:border-emerald-500/50 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Unpaid Invoices</span>
            <CreditCard className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
            {formatMoney(totalUnpaidInvoices, currencyCode)}
          </p>
          <p className="text-xs text-slate-500">
            {invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').length} pending
          </p>
        </div>

        <div
          onClick={() => onNavigate('quotes')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-1 cursor-pointer hover:border-emerald-500/50 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Quotes</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {quotes.length} Quotes
          </p>
          <p className="text-xs text-slate-500">
            {quotes.filter((q) => q.status === 'accepted').length} accepted
          </p>
        </div>

        <div
          onClick={() => onNavigate('inventory')}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-1 cursor-pointer hover:border-emerald-500/50 transition-all shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Van &amp; Materials</span>
            <Package className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {inventory.length} SKUs
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {lowStockCount > 0 ? `${lowStockCount} low stock` : 'Stock normal'}
          </p>
        </div>
      </section>

      {/* Two Column Layout for Quick Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Receipts / Slips */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>Recent Scanned Receipts</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {receipts.slice(0, 4).map((rcpt) => (
              <div
                key={rcpt.id}
                onClick={() => onNavigate('expenses')}
                className="py-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{rcpt.vendor_name}</p>
                  <p className="text-slate-500 truncate mt-0.5">
                    {rcpt.invoice_date} · {rcpt.category} · {rcpt.line_items?.length || 0} items
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
                    className="min-h-[36px] px-2 py-1 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
            {receipts.length === 0 && (
              <p className="py-4 text-xs text-slate-500 text-center">No receipts scanned yet.</p>
            )}
          </div>
        </div>

        {/* Recent Quotes & Invoices */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Active Quotes &amp; Billings</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('quotes')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Manage Quotes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {quotes.slice(0, 4).map((q) => (
              <div key={q.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{q.projectTitle}</p>
                  <p className="text-slate-500">
                    {q.clientName} · {q.quoteNumber} · <span className="capitalize">{q.status}</span>
                  </p>
                </div>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatMoney(q.totalAmount, currencyCode)}
                </span>
              </div>
            ))}
            {quotes.length === 0 && (
              <p className="py-4 text-xs text-slate-500 text-center">No quotes created yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldDashboard;
