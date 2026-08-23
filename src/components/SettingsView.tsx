import React, { useState } from 'react';
import { 
  Trash2, 
  Edit3, 
  RotateCcw, 
  Download, 
  Upload, 
  Check, 
  AlertTriangle, 
  Calendar, 
  Store, 
  Search, 
  Settings, 
  ShieldCheck, 
  HardDrive, 
  DollarSign, 
  FileText,
  Plus
} from 'lucide-react';
import type { SavedReceipt } from '../types';

interface SettingsViewProps {
  receipts: SavedReceipt[];
  onResetAllData: () => void;
  onResetMonthData: (monthYear: string) => void;
  onEditReceipt: (receipt: SavedReceipt) => void;
  onDeleteReceipt: (id: string) => void;
  onAddManualReceipt: () => void;
  onImportData: (importedReceipts: SavedReceipt[]) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  receipts,
  onResetAllData,
  onResetMonthData,
  onEditReceipt,
  onDeleteReceipt,
  onAddManualReceipt,
  onImportData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [showConfirmResetAll, setShowConfirmResetAll] = useState(false);
  const [monthToReset, setMonthToReset] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Available distinct months
  const availableMonths = Array.from(new Set<string>(receipts.map(r => r.month_year)))
    .sort((a, b) => b.localeCompare(a));

  // Filtered receipts
  const filteredReceipts = receipts.filter(r => {
    const matchesMonth = selectedMonthFilter === 'all' || r.month_year === selectedMonthFilter;
    const matchesSearch = 
      r.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.invoice_date.includes(searchQuery) ||
      (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.line_items.some(item => item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesMonth && matchesSearch;
  });

  const totalSpendAll = receipts.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
  const totalItemsAll = receipts.reduce((acc, r) => acc + r.line_items.length, 0);

  // Export JSON
  const handleExportData = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(receipts, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `parserpro-backup-${new Date().toISOString().substring(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setFeedbackToast('Export completed! JSON backup downloaded.');
      setTimeout(() => setFeedbackToast(null), 4000);
    } catch (e) {
      console.error('Export error:', e);
      alert('Failed to export data.');
    }
  };

  // Import JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          onImportData(parsed);
          setFeedbackToast(`Successfully imported ${parsed.length} invoices!`);
          setTimeout(() => setFeedbackToast(null), 4000);
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        console.error('Import parse error:', err);
        alert('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full gap-6 overflow-auto">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Application Settings & Data Control</h1>
            <p className="text-xs text-slate-400">
              Reset totals & invoices to 0, edit existing invoice details, and manage local storage backups
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportData}
            disabled={receipts.length === 0}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Download JSON Backup"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>

          <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Storage & Reset Totals Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Total Metrics Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" /> Current Ledger Status
            </span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
              Active State
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Spend</div>
              <div className="text-xl font-black text-slate-800 mt-1 font-mono">
                R {totalSpendAll.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Invoices</div>
              <div className="text-xl font-black text-slate-800 mt-1">
                {receipts.length}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-700">100% Client-Side Privacy:</strong> All receipt details, photos, and item breakdowns remain securely inside your local browser storage.
            </div>
          </div>
        </div>

        {/* Reset Totals to 0 (Clear All Invoices) */}
        <div className="bg-white p-5 rounded-2xl border border-rose-100 bg-linear-to-b from-white to-rose-50/20 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-rose-500" /> Reset Totals & Invoices to 0
            </span>
            <span className="text-xs text-slate-400">
              Permanent Clearing Action
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Need to start fresh for a new financial period or remove all test/uploaded records? You can clear all invoices and reset all monthly expenditure figures to <strong>R 0.00</strong> with a single click.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => setShowConfirmResetAll(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset All Totals & Invoices to 0</span>
            </button>

            {availableMonths.length > 0 && (
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Or reset specific month:</span>
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setMonthToReset(e.target.value);
                    }
                  }}
                  className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="">Select Month...</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {m} ({receipts.filter(r => r.month_year === m).length} invoices)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Management & Details Editor Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Edit Invoices & Change Details</h2>
            <p className="text-xs text-slate-400">
              Select any invoice below to edit store names, prices, item quantities, or dates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onAddManualReceipt}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Invoice</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vendor, item name, or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs font-bold text-slate-400 uppercase">Filter Month:</span>
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">All Months ({receipts.length})</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m} ({receipts.filter(r => r.month_year === m).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Vendor / Store</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-center">Items</th>
                <th className="py-3 px-3 text-right">Subtotal</th>
                <th className="py-3 px-3 text-right">Tax (VAT)</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 italic bg-white">
                    {receipts.length === 0 
                      ? 'No invoices saved yet. Add or scan your first invoice to manage details.'
                      : 'No invoices match your current search query.'}
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {receipt.invoice_date}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      <div>{receipt.vendor_name}</div>
                      {receipt.notes && (
                        <div className="text-[10px] text-slate-400 font-normal truncate max-w-xs">{receipt.notes}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {receipt.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {receipt.line_items.length}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {receipt.currency} {Number(receipt.subtotal).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                      {receipt.currency} {Number(receipt.tax).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                      {receipt.currency} {Number(receipt.total_amount).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onEditReceipt(receipt)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                          title="Edit Invoice Details"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete invoice from ${receipt.vendor_name} dated ${receipt.invoice_date}?`)) {
                              onDeleteReceipt(receipt.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete Invoice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Reset ALL Data Modal */}
      {showConfirmResetAll && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-800">Reset All Invoices & Totals to 0?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will delete all <strong>{receipts.length} saved invoices</strong> and reset all monthly summaries, line items, and reports to zero.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl">
              <strong>Tip:</strong> You can export a JSON backup first using the "Export Backup" button if you'd like to keep a copy of your records.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmResetAll(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetAllData();
                  setShowConfirmResetAll(false);
                  setFeedbackToast('All totals and invoices have been reset to 0.');
                  setTimeout(() => setFeedbackToast(null), 4000);
                }}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Yes, Reset to 0
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Single Month Modal */}
      {monthToReset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-800">Clear all invoices for {monthToReset}?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will delete all receipts recorded under <strong>{monthToReset}</strong> and reset that month's spending to zero.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMonthToReset(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetMonthData(monthToReset);
                  setMonthToReset(null);
                  setFeedbackToast(`Cleared invoices and reset total for ${monthToReset}.`);
                  setTimeout(() => setFeedbackToast(null), 4000);
                }}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Clear Month
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
