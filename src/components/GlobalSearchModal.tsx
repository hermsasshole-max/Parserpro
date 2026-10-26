import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import type { SavedReceipt } from '../types';
import { formatMoney, formatShortDate } from '../utils/currencyFormat';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: SavedReceipt[];
  currencyCode: string;
  onSelectReceipt: (receipt: SavedReceipt) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  receipts,
  currencyCode,
  onSelectReceipt,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts.slice(0, 12);

    return receipts
      .filter((r) => {
        if (r.vendor_name.toLowerCase().includes(q)) return true;
        if (r.category.toLowerCase().includes(q)) return true;
        if (r.invoice_date.includes(q)) return true;
        if ((r.notes || '').toLowerCase().includes(q)) return true;
        return (r.line_items || []).some((li) => li.description.toLowerCase().includes(q));
      })
      .slice(0, 30);
  }, [receipts, query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-12 sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Search receipts and items"
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any store, grocery item, date, or note..."
            className="w-full min-h-[44px] bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {matches.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {receipts.length === 0
                ? 'No saved receipts yet.'
                : `No receipts or items matching "${query}".`}
            </div>
          ) : (
            matches.map((rcpt) => {
              const matchedItem =
                query.trim().length > 1
                  ? (rcpt.line_items || []).find((li) =>
                      li.description.toLowerCase().includes(query.trim().toLowerCase())
                    )
                  : undefined;

              return (
                <button
                  key={rcpt.id}
                  type="button"
                  onClick={() => {
                    onSelectReceipt(rcpt);
                    onClose();
                  }}
                  className="w-full min-h-[60px] px-5 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {rcpt.vendor_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      <span>{formatShortDate(rcpt.invoice_date)}</span>
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      <span>{rcpt.category}</span>
                      {matchedItem && (
                        <>
                          <span aria-hidden="true" className="mx-1.5">
                            ·
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            Matched: {matchedItem.description}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {formatMoney(rcpt.total_amount, currencyCode)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
