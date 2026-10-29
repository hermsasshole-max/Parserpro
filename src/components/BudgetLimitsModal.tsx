import React, { useState, useEffect } from 'react';
import { X, Lock, Check } from 'lucide-react';
import type { CategoryBudgets, ReceiptCategory } from '../types';
import { ALL_RECEIPT_CATEGORIES } from '../utils/budgetStorage';
import {
  FREE_MAX_ACTIVE_BUDGETS,
  type UpgradeTriggerReason,
} from '../utils/subscriptionManager';
import { getCurrencySymbol, formatMoney } from '../utils/currencyFormat';

interface BudgetLimitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: CategoryBudgets;
  onSaveBudgets: (updated: CategoryBudgets) => void;
  isPlus: boolean;
  currencyCode: string;
  onOpenUpgrade: (reason: UpgradeTriggerReason) => void;
}

export const BudgetLimitsModal: React.FC<BudgetLimitsModalProps> = ({
  isOpen,
  onClose,
  budgets,
  onSaveBudgets,
  isPlus,
  currencyCode,
  onOpenUpgrade,
}) => {
  const [draft, setDraft] = useState<CategoryBudgets>(budgets);

  useEffect(() => {
    if (isOpen) {
      setDraft({ ...budgets });
    }
  }, [isOpen, budgets]);

  if (!isOpen) return null;

  const symbol = getCurrencySymbol(currencyCode);
  const activeCategories = ALL_RECEIPT_CATEGORIES.filter((cat) => (draft[cat] || 0) > 0);
  const activeCount = activeCategories.length;
  const totalMonthlyTarget = ALL_RECEIPT_CATEGORIES.reduce(
    (sum, cat) => sum + (Number(draft[cat]) || 0),
    0
  );

  const handleAmountChange = (category: ReceiptCategory, rawVal: string) => {
    const parsed = parseFloat(rawVal);
    const nextVal = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;

    // Enforce Free Starter 3-active-category limit when enabling a 4th category
    const wasActive = (draft[category] || 0) > 0;
    if (!isPlus && !wasActive && nextVal > 0 && activeCount >= FREE_MAX_ACTIVE_BUDGETS) {
      onOpenUpgrade('unlimited_budgets');
      return;
    }

    setDraft((prev) => ({
      ...prev,
      [category]: nextVal,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveBudgets(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3" />

        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="budget-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Monthly Category Budgets
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isPlus
                ? 'Set targets across all 5 household categories (0 = off).'
                : `Free Starter includes up to ${FREE_MAX_ACTIVE_BUDGETS} active budgets (${activeCount}/${FREE_MAX_ACTIVE_BUDGETS} used).`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close budget settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 pb-safe-modal space-y-4 overflow-y-auto">
          <div className="space-y-3">
            {ALL_RECEIPT_CATEGORIES.map((category) => {
              const currentVal = draft[category] || 0;
              const isLockedOnFree =
                !isPlus && currentVal <= 0 && activeCount >= FREE_MAX_ACTIVE_BUDGETS;

              return (
                <div
                  key={category}
                  className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800/80 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {category}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {currentVal > 0 ? 'Tracking monthly limit' : 'No limit set'}
                    </p>
                  </div>

                  {isLockedOnFree ? (
                    <button
                      type="button"
                      onClick={() => onOpenUpgrade('unlimited_budgets')}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Unlock with Plus</span>
                    </button>
                  ) : (
                    <div className="relative w-36 shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none">
                        {symbol}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={currentVal === 0 ? '' : currentVal}
                        placeholder="0"
                        onChange={(e) => handleAmountChange(category, e.target.value)}
                        className="w-full min-h-[44px] pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 text-right font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            <span>Combined monthly budget</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {formatMoney(totalMonthlyTarget, currencyCode)}
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>Save Budgets</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
