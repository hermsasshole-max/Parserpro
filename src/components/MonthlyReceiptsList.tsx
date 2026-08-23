import React, { useState } from 'react';
import { Calendar, Store, Tag, Plus, Search, ChevronDown, ChevronUp, Trash2, TrendingUp, Receipt, ShoppingCart, RotateCcw, Edit3 } from 'lucide-react';
import type { SavedReceipt, ReceiptCategory } from '../types';

interface MonthlyReceiptsListProps {
  receipts: SavedReceipt[];
  onDeleteReceipt: (id: string) => void;
  onEditReceipt: (receipt: SavedReceipt) => void;
  onAddManualReceipt: () => void;
  onGoToReport: (month: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
}

export const MonthlyReceiptsList: React.FC<MonthlyReceiptsListProps> = ({
  receipts,
  onDeleteReceipt,
  onEditReceipt,
  onAddManualReceipt,
  onGoToReport,
  selectedMonth,
  setSelectedMonth
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);

  const currentMonthDefault = new Date().toISOString().substring(0, 7);

  // Extract all distinct months available in descending order
  const availableMonths = Array.from(new Set<string>(receipts.map(r => r.month_year)))
    .sort((a, b) => b.localeCompare(a));

  // If selectedMonth not in available, default to latest or current
  const activeMonth = availableMonths.includes(selectedMonth)
    ? selectedMonth
    : availableMonths[0] || currentMonthDefault;

  // Filter receipts by active month, search query, and category
  const monthReceipts = receipts.filter(r => r.month_year === activeMonth);

  // Sort strictly chronologically by invoice_date (descending)
  const sortedReceipts = [...monthReceipts].sort((a, b) => {
    return b.invoice_date.localeCompare(a.invoice_date);
  });

  const filteredReceipts = sortedReceipts.filter(r => {
    const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory;
    const matchesSearch =
      r.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.line_items.some(item => item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Calculate monthly stats
  const totalMonthlySpend = monthReceipts.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
  const totalMonthlyItems = monthReceipts.reduce((acc, r) => acc + r.line_items.length, 0);

  const getCategoryColor = (cat: ReceiptCategory) => {
    switch (cat) {
      case 'Food & Groceries':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Electricity & Utilities':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Home Maintenance':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Transport':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full gap-5 overflow-auto">
      {/* Month Tabs Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Months:
          </span>
          {availableMonths.length === 0 ? (
            <span className="text-xs text-slate-400">No months recorded</span>
          ) : (
            availableMonths.map((m) => {
              const count = receipts.filter(r => r.month_year === m).length;
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                    activeMonth === m
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{m}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeMonth === m ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => onGoToReport(activeMonth)}
            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Analyze {activeMonth} Report</span>
          </button>
          <button
            onClick={onAddManualReceipt}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Receipt</span>
          </button>
        </div>
      </div>

      {/* Monthly Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              {activeMonth} Total Spend
            </div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">
              R {totalMonthlySpend.toFixed(2)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Receipts in {activeMonth}
            </div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">
              {monthReceipts.length} <span className="text-xs font-normal text-slate-500">Invoices</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Unique Line Items
            </div>
            <div className="text-2xl font-black text-slate-800 mt-0.5">
              {totalMonthlyItems} <span className="text-xs font-normal text-slate-500">Items recorded</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search vendor, item name or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['all', 'Food & Groceries', 'Electricity & Utilities', 'Home Maintenance', 'Transport', 'Other'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Receipts Chronological List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
          <span>Receipts Ordered Chronologically by Date</span>
          <span>{filteredReceipts.length} Matching</span>
        </div>

        {filteredReceipts.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-slate-700 text-sm font-bold">No receipts found for {activeMonth}</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Scan a receipt photo or add an invoice manually to track itemized spend for this month.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={onAddManualReceipt}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Invoice Manually</span>
              </button>
            </div>
          </div>
        ) : (
          filteredReceipts.map((receipt) => {
            const isExpanded = expandedReceiptId === receipt.id;
            return (
              <div
                key={receipt.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedReceiptId(isExpanded ? null : receipt.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 font-black text-xs">
                      {receipt.invoice_date.split('-')[2] || '—'}
                      <span className="text-[9px] block text-slate-400 font-normal">
                        {new Date(receipt.invoice_date).toLocaleString('default', { month: 'short' })}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-sm">{receipt.vendor_name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryColor(receipt.category)}`}>
                          {receipt.category}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {receipt.invoice_date}
                        </span>
                        <span>•</span>
                        <span>{receipt.line_items.length} line items</span>
                        {receipt.notes && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px] italic">{receipt.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">
                        {receipt.currency} {Number(receipt.total_amount).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Tax: {receipt.currency} {Number(receipt.tax || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditReceipt(receipt);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                        title="Edit invoice details"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete receipt for ${receipt.vendor_name}?`)) {
                            onDeleteReceipt(receipt.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete receipt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Line Items Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Itemized Breakdown
                      </h4>
                      <span className="text-xs text-slate-400">
                        Filed Under: <strong className="text-slate-700">{receipt.month_year}</strong> ({receipt.invoice_date})
                      </span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-3 text-center">Qty</th>
                            <th className="py-2.5 px-3 text-right">Unit Price</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {receipt.line_items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                              <td className="py-2 px-3 font-medium text-slate-800">{item.description}</td>
                              <td className="py-2 px-3 text-center font-mono">{item.quantity}</td>
                              <td className="py-2 px-3 text-right text-slate-500">
                                {receipt.currency} {Number(item.unit_price).toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900">
                                {receipt.currency} {Number(item.total_price).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                          <tr>
                            <td colSpan={3} className="py-2 px-3 text-slate-500 font-normal">
                              Subtotal: {receipt.currency} {Number(receipt.subtotal).toFixed(2)} | Tax: {receipt.currency} {Number(receipt.tax).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right">Total Paid:</td>
                            <td className="py-2 px-3 text-right text-emerald-700">
                              {receipt.currency} {Number(receipt.total_amount).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {receipt.notes && (
                      <div className="mt-3 text-xs text-slate-600 bg-amber-50/70 border border-amber-100 p-2.5 rounded-lg">
                        <strong>Notes:</strong> {receipt.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
