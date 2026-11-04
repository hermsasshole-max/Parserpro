import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Send,
  Phone,
  Sparkles,
  Download,
  Share2,
} from 'lucide-react';
import { useAppContext, type QuoteRecord } from '../context/AppContext';
import { formatMoney } from '../utils/currencyFormat';

interface QuotationEngineProps {
  onOpenVoiceQuote?: () => void;
  onOpenPaywall?: () => void;
}

export const QuotationEngine: React.FC<QuotationEngineProps> = ({
  onOpenVoiceQuote,
  onOpenPaywall,
}) => {
  const { quotes, setQuotes, clients, currencyCode, tier } = useAppContext();
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRecord | null>(null);

  // New Quote Form State
  const [clientName, setClientName] = useState(clients[0]?.name || '');
  const [projectTitle, setProjectTitle] = useState('');
  const [notes, setNotes] = useState('Payment within 14 days of acceptance. Materials quoted at current supplier pricing.');
  const [items, setItems] = useState<
    { description: string; quantity: number; unitPrice: number; isLabour: boolean }[]
  >([
    { description: 'Labor & On-site Assessment (hrs)', quantity: 4, unitPrice: 450, isLabour: true },
    { description: 'Materials & Standard Consumables', quantity: 1, unitPrice: 650, isLabour: false },
  ]);

  const totalQuoteAmount = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { description: 'New Material or Labor', quantity: 1, unitPrice: 250, isLabour: false },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim()) return;

    const newQuote: QuoteRecord = {
      id: `quo-${Date.now()}`,
      quoteNumber: `Q-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(3, '0')}`,
      clientName: clientName.trim() || 'Direct Client',
      projectTitle: projectTitle.trim(),
      date: new Date().toISOString().substring(0, 10),
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
      status: 'draft',
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: Number((i.quantity * i.unitPrice).toFixed(2)),
        isLabour: i.isLabour,
      })),
      totalAmount: Number(totalQuoteAmount.toFixed(2)),
      notes,
    };

    setQuotes([newQuote, ...quotes]);
    setShowNewQuoteModal(false);
    setProjectTitle('');
    setSelectedQuote(newQuote);
  };

  const handleShareQuote = async (quote: QuoteRecord) => {
    const text = `Quotation ${quote.quoteNumber} from ParserPro Field Service\nProject: ${quote.projectTitle}\nClient: ${quote.clientName}\nTotal: ${formatMoney(quote.totalAmount, currencyCode)}\nValid until: ${quote.expiryDate}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Quote ${quote.quoteNumber}`,
          text,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(text);
      alert('Quote summary copied to clipboard!');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Quotation Engine
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Draft, price, and dispatch professional mobile quotes directly from the job site.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenVoiceQuote && (
            <button
              type="button"
              onClick={onOpenVoiceQuote}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-emerald-600/30 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Voice Quote</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowNewQuoteModal(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Quote</span>
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Quotes</p>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {quotes.length}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pipeline Value</p>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatMoney(
              quotes.reduce((s, q) => s + q.totalAmount, 0),
              currencyCode
            )}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Accepted</p>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {quotes.filter((q) => q.status === 'accepted').length}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Plan</p>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 capitalize">
            {tier} Tier
          </p>
        </div>
      </div>

      {/* Quotes List */}
      <div className="space-y-3">
        {quotes.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3">
            <FileText className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No field quotations created yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tap "New Quote" or "Voice Quote" above to price up a job on-site in under 60 seconds.
            </p>
          </div>
        ) : (
          quotes.map((quote) => (
            <div
              key={quote.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-emerald-500/50 transition-all shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {quote.quoteNumber}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs text-slate-500">{quote.date}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span
                    className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      quote.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : quote.status === 'sent'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {quote.status}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {quote.projectTitle}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Client: {quote.clientName} {quote.clientPhone && `(${quote.clientPhone})`} · {quote.items.length} items
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total Quote</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatMoney(quote.totalAmount, currencyCode)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleShareQuote(quote)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuote(quote)}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 text-xs font-semibold"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Quote Modal */}
      {showNewQuoteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Create On-Site Quotation
              </h2>
              <button
                type="button"
                onClick={() => setShowNewQuoteModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Pretoria East Residential"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Project / Job Title
                  </label>
                  <input
                    type="text"
                    required
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="e.g. Inverter Backup & Sub-DB Wiring"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Labor & Material Items
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-12 sm:col-span-6">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, description: val } : it))
                            );
                          }}
                          placeholder="Description"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0.1"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 1;
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                            );
                          }}
                          placeholder="Qty"
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white tabular-nums"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-3">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, unitPrice: val } : it))
                            );
                          }}
                          placeholder="Price"
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white tabular-nums"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Terms & Warranty Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Total Calculation</p>
                  <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatMoney(totalQuoteAmount, currencyCode)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewQuoteModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    Save &amp; Generate Quote
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Quote Detail Modal */}
      {selectedQuote && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-600">
                  {selectedQuote.quoteNumber}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedQuote.projectTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuote(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p>
                <strong>Client:</strong> {selectedQuote.clientName}
              </p>
              <p>
                <strong>Date:</strong> {selectedQuote.date} (Expires: {selectedQuote.expiryDate})
              </p>
              <p>
                <strong>Status:</strong>{' '}
                <span className="capitalize font-semibold">{selectedQuote.status}</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {selectedQuote.items.map((it, i) => (
                <div key={i} className="p-3 text-xs flex justify-between">
                  <span>
                    {it.description} <span className="text-slate-400">× {it.quantity}</span>
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatMoney(it.total, currencyCode)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs font-bold text-slate-500">Total Quote Amount</span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatMoney(selectedQuote.totalAmount, currencyCode)}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleShareQuote(selectedQuote)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold"
              >
                Share with Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationEngine;
