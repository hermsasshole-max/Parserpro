import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Calendar, Tag, ArrowRight, Store, FileText, DollarSign, ChevronRight } from 'lucide-react';
import type { SavedReceipt } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipts: SavedReceipt[];
  onSelectReceipt: (receipt: SavedReceipt) => void;
  onGoToMonth: (month: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  receipts,
  onSelectReceipt,
  onGoToMonth
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmed = query.trim().toLowerCase();

  const results = receipts.filter(r => {
    if (!trimmed) return false;
    const matchVendor = r.vendor_name.toLowerCase().includes(trimmed);
    const matchCategory = r.category.toLowerCase().includes(trimmed);
    const matchDate = r.invoice_date.includes(trimmed);
    const matchTotal = r.total_amount.toString().includes(trimmed);
    const matchNotes = r.notes ? r.notes.toLowerCase().includes(trimmed) : false;
    const matchItems = r.line_items.some(item => item.description.toLowerCase().includes(trimmed));
    return matchVendor || matchCategory || matchDate || matchTotal || matchNotes || matchItems;
  });

  const quickFilterPills = ['Pick n Pay', 'Woolworths', 'Food & Groceries', 'Electricity', 'Transport'];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden mt-6 sm:mt-12 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Header */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/70">
          <Search className="w-5 h-5 text-emerald-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stores, items (milk, eggs), dates, or amounts..."
            className="flex-1 bg-transparent border-none outline-hidden text-sm sm:text-base text-slate-800 placeholder-slate-400 font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2 py-1 text-[11px] font-bold text-slate-500 bg-slate-200 hover:bg-slate-300 rounded-md transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Quick Suggestion Tags */}
        {!query && (
          <div className="p-4 bg-white border-b border-slate-100">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Quick Filter Suggestions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickFilterPills.map(tag => (
                <button
                  key={tag}
                  onClick={() => setQuery(tag)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors border border-slate-200 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {!query ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">Type anything to search across all receipts and items</p>
              <p className="text-xs text-slate-400 mt-1">Found across {receipts.length} total stored receipts</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No matching receipts found</p>
              <p className="text-xs text-slate-400 mt-1">Try searching for a store name, grocery item, or date</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
                <span>{results.length} receipt{results.length === 1 ? '' : 's'} matched</span>
                <span>Click to view or edit</span>
              </div>
              {results.map(r => (
                <div
                  key={r.id}
                  onClick={() => {
                    onSelectReceipt(r);
                    onClose();
                  }}
                  className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all cursor-pointer shadow-xs group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                          {r.vendor_name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{r.invoice_date}</span>
                          <span>·</span>
                          <span>{r.category}</span>
                          <span>·</span>
                          <span>{r.line_items.length} items</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">
                        {r.currency} {Number(r.total_amount).toFixed(2)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGoToMonth(r.month_year);
                          onClose();
                        }}
                        className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold inline-flex items-center gap-0.5 mt-0.5"
                      >
                        <span>{r.month_year}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Matching item preview if matched */}
                  {r.line_items.some(item => item.description.toLowerCase().includes(trimmed)) && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 text-[11px]">
                      {r.line_items
                        .filter(item => item.description.toLowerCase().includes(trimmed))
                        .slice(0, 3)
                        .map((item, idx) => (
                          <span key={idx} className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-medium border border-emerald-100">
                            {item.description} ({r.currency} {Number(item.total_price).toFixed(2)})
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Tip: Press <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">ESC</kbd> to exit search</span>
          <button
            onClick={onClose}
            className="font-bold text-slate-700 hover:text-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
