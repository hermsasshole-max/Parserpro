import React, { useState } from 'react';
import { MonthToMonthReport } from './MonthToMonthReport';
import { useAppContext } from '../context/AppContext';

interface FinancialAnalysisProps {
  onOpenBudgetModal: () => void;
  onOpenUpgrade: (reason?: any) => void;
  onGoToScanner: () => void;
}

export const FinancialAnalysis: React.FC<FinancialAnalysisProps> = ({
  onOpenBudgetModal,
  onOpenUpgrade,
  onGoToScanner,
}) => {
  const { receipts, categoryBudgets, subscriptionState, currencyCode } = useAppContext();

  const currentMonth = new Date().toISOString().substring(0, 7);
  const getPrevMonth = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(y, (mo || 1) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [comparisonMonth, setComparisonMonth] = useState<string>(() => getPrevMonth(currentMonth));

  const availableMonths = Array.from(
    new Set([
      currentMonth,
      getPrevMonth(currentMonth),
      ...receipts.map((r) => r.month_year).filter(Boolean),
    ])
  ).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Financial Analysis &amp; Expenditure Variance
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Month-to-month comparison, purchase frequency, price variance tracking, and category subtotal analysis.
        </p>
      </div>

      <MonthToMonthReport
        receipts={receipts}
        selectedMonth={selectedMonth}
        comparisonMonth={comparisonMonth}
        availableMonths={availableMonths}
        onSelectMonth={setSelectedMonth}
        onSelectComparisonMonth={setComparisonMonth}
        categoryBudgets={categoryBudgets}
        onOpenBudgetModal={onOpenBudgetModal}
        subscriptionState={subscriptionState}
        currencyCode={currencyCode}
        onOpenUpgrade={onOpenUpgrade}
        onGoToScanner={onGoToScanner}
      />
    </div>
  );
};

export default FinancialAnalysis;
