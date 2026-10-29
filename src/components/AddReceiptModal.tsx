import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, AlertTriangle } from 'lucide-react';
import type { LineItem, ReceiptCategory, SavedReceipt } from '../types';
import { findDuplicateForReceipt } from '../utils/duplicateDetection';
import { formatMoney, formatShortDate, getCurrencySymbol } from '../utils/currencyFormat';

interface AddReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingReceipts: SavedReceipt[];
  currencyCode: string;
  onSaveReceipt: (receipt: SavedReceipt) => void;
}

const CATEGORIES: ReceiptCategory[] = [
  'Food & Groceries',
  'Electricity & Utilities',
  'Home Maintenance',
  'Transport',
  'Other',
];

export const AddReceiptModal: React.FC<AddReceiptModalProps> = ({
  isOpen,
  onClose,
  existingReceipts,
  currencyCode,
  onSaveReceipt,
}) => {
  const todayIso = new Date().toISOString().substring(0, 10);

  const [vendorName, setVendorName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIso);
  const [category, setCategory] = useState<ReceiptCategory>('Food & Groceries');
  const [totalAmount, setTotalAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVendorName('');
      setInvoiceDate(new Date().toISOString().substring(0, 10));
      setCategory('Food & Groceries');
      setTotalAmount('');
      setTaxAmount('');
      setNotes('');
      setLineItems([]);
      setValidationError(null);
      setDuplicateConfirmed(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const symbol = getCurrencySymbol(currencyCode);

  const addEmptyItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unit_price: 0, total_price: 0 },
    ]);
  };

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setLineItems((prev) => {
      const updated = prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, ...patch };
        if ('quantity' in patch || 'unit_price' in patch) {
          next.total_price = Number(((next.quantity || 1) * (next.unit_price || 0)).toFixed(2));
        }
        return next;
      });

      const itemsSum = updated.reduce((s, li) => s + (Number(li.total_price) || 0), 0);
      if (itemsSum > 0) {
        setTotalAmount(itemsSum.toFixed(2));
      }
      return updated;
    });
  };

  const removeItem = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const numericTotal = parseFloat(totalAmount) || 0;
  const numericTax = parseFloat(taxAmount) || 0;

  const potentialDuplicate =
    vendorName.trim() && numericTotal > 0
      ? findDuplicateForReceipt(
          {
            id: 'manual_draft_check',
            created_at: todayIso,
            vendor_name: vendorName.trim(),
            invoice_date: invoiceDate,
            month_year: invoiceDate.substring(0, 7),
            category,
            currency: currencyCode,
            line_items: lineItems,
            subtotal: Math.max(0, numericTotal - numericTax),
            tax: numericTax,
            total_amount: numericTotal,
            notes,
          },
          existingReceipts
        )
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!vendorName.trim()) {
      setValidationError('Please enter a store or provider name.');
      return;
    }
    if (numericTotal <= 0) {
      setValidationError('Please enter a receipt total greater than zero.');
      return;
    }

    if (potentialDuplicate && !duplicateConfirmed) {
      setDuplicateConfirmed(true);
      return;
    }

    const cleanedItems = lineItems.filter((li) => li.description.trim().length > 0);
    const finalItems: LineItem[] =
      cleanedItems.length > 0
        ? cleanedItems
        : [
            {
              description: `${vendorName.trim()} purchase`,
              quantity: 1,
              unit_price: numericTotal,
              total_price: numericTotal,
            },
          ];

    const newReceipt: SavedReceipt = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      vendor_name: vendorName.trim(),
      invoice_date: invoiceDate,
      month_year: invoiceDate.substring(0, 7),
      category,
      currency: currencyCode,
      line_items: finalItems,
      subtotal: Number(Math.max(0, numericTotal - numericTax).toFixed(2)),
      tax: Number(numericTax.toFixed(2)),
      total_amount: Number(numericTotal.toFixed(2)),
      notes: notes.trim(),
      engine_used: 'manual',
    };

    onSaveReceipt(newReceipt);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-receipt-title"
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3" />

        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="add-receipt-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Add Receipt Manually
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Always free and unlimited — enter a quick total or individual items.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pb-safe-modal overflow-y-auto space-y-4 flex-1">
          {validationError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/70 px-4 py-3 text-xs sm:text-sm text-rose-900 dark:text-rose-200">
              {validationError}
            </div>
          )}

          {potentialDuplicate && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Similar receipt already saved ({potentialDuplicate.matchedReceipt.vendor_name} ·{' '}
                  {formatShortDate(potentialDuplicate.matchedReceipt.invoice_date)} ·{' '}
                  {formatMoney(potentialDuplicate.matchedReceipt.total_amount, currencyCode)})
                </p>
                <p className="mt-0.5">
                  {duplicateConfirmed
                    ? 'Tap Save Receipt again to confirm saving this as a separate purchase.'
                    : 'Check that this was not already recorded.'}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Store or Provider
            </label>
            <input
              type="text"
              placeholder="e.g. Checkers, Pick n Pay, Shell, City Power"
              value={vendorName}
              onChange={(e) => {
                setVendorName(e.target.value);
                setValidationError(null);
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-sm text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ReceiptCategory)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Total Amount ({symbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={totalAmount}
                onChange={(e) => {
                  setTotalAmount(e.target.value);
                  setValidationError(null);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tax / VAT ({symbol}, optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-sm font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Optional Itemized Lines */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Optional Line Items
              </span>
              <button
                type="button"
                onClick={addEmptyItem}
                className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {lineItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder="Item name"
                  value={item.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  className="col-span-6 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(idx, { quantity: Math.max(1, parseFloat(e.target.value) || 1) })
                  }
                  className="col-span-2 min-h-[40px] px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-center font-mono tabular-nums text-xs sm:text-sm text-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  value={item.unit_price || ''}
                  onChange={(e) =>
                    updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })
                  }
                  className="col-span-3 min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-right font-mono tabular-nums text-xs sm:text-sm text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  aria-label="Remove item"
                  className="col-span-1 min-h-[40px] flex items-center justify-center text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Monthly electricity token"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{duplicateConfirmed ? 'Confirm & Save' : 'Save Receipt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
