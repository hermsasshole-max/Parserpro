import React from 'react';
import { X } from 'lucide-react';
import { ReceiptScanner } from './ReceiptScanner';
import { useAppContext } from '../context/AppContext';
import type { SavedReceipt } from '../types';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpgrade: (reason?: any) => void;
  onOpenSearch: () => void;
  onOpenAddManual: () => void;
  onOpenOfflineQueue: () => void;
  pendingOfflineCount: number;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onOpenUpgrade,
  onOpenSearch,
  onOpenAddManual,
  onOpenOfflineQueue,
  pendingOfflineCount,
}) => {
  const { receipts, persistReceipts, subscriptionState, currencyCode } = useAppContext();

  if (!isOpen) return null;

  const handleSaveReceipts = (newReceipts: SavedReceipt[]) => {
    if (newReceipts.length > 0) {
      persistReceipts([...newReceipts, ...receipts]);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-scanner-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden touch-manipulation"
    >
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] max-h-[92dvh] overflow-hidden">
        {/* Mobile drag affordance */}
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <h2
            id="receipt-scanner-modal-title"
            className="text-lg font-bold text-slate-900 dark:text-white"
          >
            Field Receipt &amp; Slip Scanner
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl cursor-pointer"
            aria-label="Close scanner modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 pb-safe-modal overflow-y-auto flex-1 space-y-4">
          <ReceiptScanner
            existingReceipts={receipts}
            subscriptionState={subscriptionState}
            currencyCode={currencyCode}
            pendingOfflineCount={pendingOfflineCount}
            onSaveReceipts={handleSaveReceipts}
            onOpenUpgrade={onOpenUpgrade}
            onOpenSearch={onOpenSearch}
            onOpenAddManual={onOpenAddManual}
            onOpenOfflineQueue={onOpenOfflineQueue}
          />
        </div>
      </div>
    </div>
  );
};

export default ReceiptScannerModal;
