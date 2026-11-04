import React, { useState } from 'react';
import { Camera, Receipt as ReceiptIcon, Plus, Search, Filter } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ReceiptScanner } from './ReceiptScanner';
import { MonthlyReceiptsList } from './MonthlyReceiptsList';
import type { SavedReceipt } from '../types';

interface ExpenseManagerProps {
  onOpenAddManual: () => void;
  onOpenSearch: () => void;
  onOpenUpgrade: (reason?: any) => void;
  onOpenPrintableReport: (month: string) => void;
  onEditReceipt: (receipt: SavedReceipt) => void;
  onOpenOfflineQueue: () => void;
  pendingOfflineCount: number;
  cameraLaunchTrigger?: number;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  onOpenAddManual,
  onOpenSearch,
  onOpenUpgrade,
  onOpenPrintableReport,
  onEditReceipt,
  onOpenOfflineQueue,
  pendingOfflineCount,
  cameraLaunchTrigger = 0,
}) => {
  const { receipts, persistReceipts, subscriptionState, currencyCode } = useAppContext();
  const [subTab, setSubTab] = useState<'scanner' | 'ledger'>('scanner');

  const currentMonth = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  const availableMonths = Array.from(
    new Set([currentMonth, ...receipts.map((r) => r.month_year).filter(Boolean)])
  ).sort((a, b) => b.localeCompare(a));

  const handleSaveBatchReceipts = (newReceipts: SavedReceipt[]) => {
    if (!newReceipts.length) return;
    const updated = [...newReceipts, ...receipts];
    persistReceipts(updated);
    if (newReceipts[0]?.month_year) {
      setSelectedMonth(newReceipts[0].month_year);
    }
  };

  const handleDeleteReceipt = (id: string) => {
    persistReceipts(receipts.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Sub-tab Switcher: Scan Receipt vs View Ledger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Expense Manager &amp; Parser
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            AI OCR slip extraction, failsafe duplicate blocker, and itemized purchase ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setSubTab('scanner')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                subTab === 'scanner'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Smart Scanner</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('ledger')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                subTab === 'ledger'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ReceiptIcon className="w-4 h-4" />
              <span>Ledger ({receipts.length})</span>
            </button>
          </div>
        </div>
      </div>

      {subTab === 'scanner' ? (
        <ReceiptScanner
          existingReceipts={receipts}
          subscriptionState={subscriptionState}
          currencyCode={currencyCode}
          pendingOfflineCount={pendingOfflineCount}
          cameraLaunchTrigger={cameraLaunchTrigger}
          onSaveReceipts={handleSaveBatchReceipts}
          onOpenUpgrade={onOpenUpgrade}
          onOpenSearch={onOpenSearch}
          onOpenAddManual={onOpenAddManual}
          onOpenOfflineQueue={onOpenOfflineQueue}
        />
      ) : (
        <MonthlyReceiptsList
          receipts={receipts}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          availableMonths={availableMonths}
          currencyCode={currencyCode}
          subscriptionState={subscriptionState}
          onOpenUpgrade={onOpenUpgrade}
          onDeleteReceipt={handleDeleteReceipt}
          onEditReceipt={onEditReceipt}
          onOpenAddManual={onOpenAddManual}
          onOpenSearch={onOpenSearch}
          onGoToScanner={() => setSubTab('scanner')}
          onOpenPrintableReport={onOpenPrintableReport}
        />
      )}
    </div>
  );
};

export default ExpenseManager;
