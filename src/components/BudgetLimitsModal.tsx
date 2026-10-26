import React, { useState, useEffect, useRef } from 'react';
import { X, Check, RotateCcw, Sliders } from 'lucide-react';
import type { CategoryBudgets, ReceiptCategory } from '../types';
import {
  ALL_RECEIPT_CATEGORIES,
  DEFAULT_CATEGORY_BUDGETS,
} from '../utils/budgetStorage';

interface BudgetLimitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: CategoryBudgets;
  onSave: (updatedBudgets: CategoryBudgets) => void;
  selectedMonth?: string;
  monthCategoryTotals?: Partial<Record<ReceiptCategory, number>>;
  initialFocusCategory?: ReceiptCategory | null;
}

export const BudgetLimitsModal: React.FC<BudgetLimitsModalProps> = ({
  isOpen,
  onClose,
  budgets,
  onSave,
  selectedMonth,
  monthCategoryTotals,
  initialFocusCategory,
}) => {
  const [draftValues, setDraftValues] = useState<Record<ReceiptCategory, string>>(() => {
    const init = {} as Record<ReceiptCategory, string>;
    for (const cat of ALL_RECEIPT_CATEGORIES) {
      init[cat] = String(budgets[cat] ?? 0);
    }
    return init;
  });

  const inputRefs = useRef<Partial<Record<ReceiptCategory, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (isOpen) {
      const next = {} as Record<ReceiptCategory, string>;
      for (const cat of ALL_RECEIPT_CATEGORIES) {
        next[cat] = String(budgets[cat] ?? 0);
      }
      setDraftValues(next);

      if (initialFocusCategory) {
        setTimeout(() => {
          const el = inputRefs.current[initialFocusCategory];
          if (el) {
            el.focus();
            el.select();
          }
        }, 60);
      }
    }
  }, [isOpen, budgets, initialFocusCategory]);

  if (!isOpen) return null;

  const parseDraftNumber = (val: string): number => {
    const num = parseFloat(val);
    if (Number.isNaN(num) || num < 0) return 0;
    return Number(num.toFixed(2));
  };

  const adjustCategory = (cat: ReceiptCategory, delta: number) => {
    setDraftValues((prev) => {
      const current = parseDraftNumber(prev[cat] || '0');
      const updated = Math.max(0, Number((current + delta).toFixed(2)));
      return { ...prev, [cat]: String(updated) };
    });
  };

  const handleResetDefaults = () => {
    const reset = {} as Record<ReceiptCategory, string>;
    for (const cat of ALL_RECEIPT_CATEGORIES) {
      reset[cat] = String(DEFAULT_CATEGORY_BUDGETS[cat]);
    }
    setDraftValues(reset);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = {} as CategoryBudgets;
    for (const cat of ALL_RECEIPT_CATEGORIES) {
      cleaned[cat] = parseDraftNumber(draftValues[cat] || '0');
    }
    onSave(cleaned);
    onClose();
  };

  const totalDraftBudget = ALL_RECEIPT_CATEGORIES.reduce(
    (sum, cat) => sum + parseDraftNumber(draftValues[cat] || '0'),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Monthly Category Budget Limits
              </h2>
              <p className="text-xs text-slate-500">
                Set a monthly ZAR spending target per category (enter 0 to disable a limit)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close budget settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-2 overflow-y-auto divide-y divide-slate-100 flex-1">
            {ALL_RECEIPT_CATEGORIES.map((category) => {
              const limitNum = parseDraftNumber(draftValues[category] || '0');
              const spent = Number((monthCategoryTotals?.[category] || 0).toFixed(2));
              const rawPct = limitNum > 0 ? (spent / limitNum) * 100 : 0;
              const barPct = Math.min(100, Math.max(0, rawPct));
              const isOver = limitNum > 0 && rawPct >= 100;
              const isNear = limitNum > 0 && rawPct >= 80 && rawPct < 100;

              return (
                <div key={category} className="py-3.5 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label
                        htmlFor={`budget-input-${category}`}
                        className="text-sm font-semibold text-slate-900 block"
                      >
                        {category}
                      </label>
                      {selectedMonth && (
                        <div className="text-xs text-slate-500 tabular-nums mt-0.5 flex items-center gap-1.5">
                          <span>
                            {selectedMonth} spend: R {spent.toFixed(2)}
                          </span>
                          {limitNum > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  isOver
                                    ? 'text-rose-600 font-semibold'
                                    : isNear
                                    ? 'text-amber-600 font-semibold'
                                    : 'text-emerald-700 font-medium'
                                }
                              >
                                {rawPct.toFixed(0)}% of limit
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => adjustCategory(category, -100)}
                        className="h-9 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold tabular-nums transition-colors cursor-pointer"
                        title="Decrease limit by R 100"
                      >
                        -100
                      </button>

                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">
                          R
                        </span>
                        <input
                          ref={(el) => {
                            inputRefs.current[category] = el;
                          }}
                          id={`budget-input-${category}`}
                          type="number"
                          min="0"
                          step="10"
                          value={draftValues[category] ?? ''}
                          onChange={(e) =>
                            setDraftValues((prev) => ({
                              ...prev,
                              [category]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="w-full h-9 pl-7 pr-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 text-right tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => adjustCategory(category, 100)}
                        className="h-9 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold tabular-nums transition-colors cursor-pointer"
                        title="Increase limit by R 100"
                      >
                        +100
                      </button>
                    </div>
                  </div>

                  {/* Live Budget Preview Progress Bar */}
                  {selectedMonth && (
                    <div
                      className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.round(barPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${category} budget preview`}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          limitNum <= 0
                            ? 'bg-slate-300'
                            : isOver
                            ? 'bg-rose-600'
                            : isNear
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${limitNum > 0 ? barPct : 0}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Summary & Actions */}
          <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Combined Monthly Cap
                </div>
                <div className="text-base font-black text-slate-900 tabular-nums">
                  R {totalDraftBudget.toFixed(2)}
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Budgets</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
