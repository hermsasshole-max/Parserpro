import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import type { SavedReceipt, ReceiptCategory, LineItem } from '../types';

interface EditReceiptModalProps {
  receipt: SavedReceipt;
  onClose: () => void;
  onSave: (updatedReceipt: SavedReceipt) => void;
}

export const EditReceiptModal: React.FC<EditReceiptModalProps> = ({
  receipt,
  onClose,
  onSave,
}) => {
  const [vendorName, setVendorName] = useState(receipt.vendor_name || '');
  const [invoiceDate, setInvoiceDate] = useState(receipt.invoice_date || '');
  const [category, setCategory] = useState<ReceiptCategory>(receipt.category || 'Food & Groceries');
  const [currency, setCurrency] = useState(receipt.currency || 'ZAR');
  const [notes, setNotes] = useState(receipt.notes || '');
  const [items, setItems] = useState<LineItem[]>(
    receipt.line_items && receipt.line_items.length > 0
      ? receipt.line_items.map(item => ({ ...item }))
      : [{ description: '', quantity: 1, unit_price: 0, total_price: 0 }]
  );
  const [taxRate, setTaxRate] = useState<number>(() => {
    if (receipt.subtotal && receipt.tax) {
      const calcRate = Math.round((receipt.tax / receipt.subtotal) * 100);
      return calcRate > 0 && calcRate <= 30 ? calcRate : 15;
    }
    return 15;
  });

  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    // Auto calculate total_price when quantity or unit_price changes
    if (field === 'quantity' || field === 'unit_price') {
      const q = field === 'quantity' ? Number(value) : Number(updated[index].quantity);
      const u = field === 'unit_price' ? Number(value) : Number(updated[index].unit_price);
      updated[index].total_price = Number((q * u).toFixed(2));
    }

    setItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const subtotal = Number(items.reduce((acc, i) => acc + (Number(i.total_price) || 0), 0).toFixed(2));
  const tax = Number((subtotal * (taxRate / 100)).toFixed(2));
  const totalAmount = Number((subtotal + tax).toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      alert('Please enter a vendor / store name.');
      return;
    }

    const monthYear = invoiceDate.substring(0, 7) || receipt.month_year;
    const validItems = items.filter(i => i.description.trim() !== '');

    if (validItems.length === 0) {
      alert('Please have at least one valid line item with a description.');
      return;
    }

    const updatedReceipt: SavedReceipt = {
      ...receipt,
      vendor_name: vendorName.trim(),
      invoice_date: invoiceDate,
      month_year: monthYear,
      category,
      currency,
      line_items: validItems,
      subtotal,
      tax,
      total_amount: totalAmount,
      notes: notes.trim(),
    };

    onSave(updatedReceipt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">Edit Invoice & Details</h3>
            <p className="text-xs text-slate-400">Modify vendor, line items, pricing, or change filing month</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                Vendor / Store Name
              </label>
              <input
                type="text"
                required
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Checkers, Shell, Woolworths"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                Invoice Date
              </label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ReceiptCategory)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="Food & Groceries">Food & Groceries</option>
                <option value="Electricity & Utilities">Electricity & Utilities</option>
                <option value="Home Maintenance">Home Maintenance</option>
                <option value="Transport">Transport</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase text-slate-500">
                Itemized Line Items ({items.length})
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Description (e.g. Milk 2L, Bread)"
                    required
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 1)}
                    className="w-16 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-center focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-right focus:outline-none font-mono"
                  />
                  <span className="text-xs font-bold text-slate-700 w-24 text-right font-mono">
                    {currency} {Number(item.total_price).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    disabled={items.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    title="Remove Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes & Extra settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                Notes / Reference / Account / Meter #
              </label>
              <input
                type="text"
                placeholder="Optional invoice notes or account reference"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                Tax / VAT Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-center"
              />
            </div>
          </div>

          {/* Total calculation banner */}
          <div className="bg-slate-50 p-3.5 rounded-xl flex items-center justify-between text-xs font-bold text-slate-800 border border-slate-200">
            <div>
              <span className="text-slate-500 font-normal">Subtotal:</span>{' '}
              <span className="font-mono">{currency} {subtotal.toFixed(2)}</span>
              <span className="mx-2 text-slate-300">|</span>
              <span className="text-slate-500 font-normal">Tax ({taxRate}%):</span>{' '}
              <span className="font-mono">{currency} {tax.toFixed(2)}</span>
            </div>
            <div className="text-emerald-700 text-sm font-black font-mono">
              Total: {currency} {totalAmount.toFixed(2)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
