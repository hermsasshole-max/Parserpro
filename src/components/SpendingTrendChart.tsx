import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { SavedReceipt } from '../types';
import { calculateSixMonthSpendingTrend } from '../utils/reportUtils';
import { formatMoney, getCurrencySymbol } from '../utils/currencyFormat';

interface SpendingTrendChartProps {
  receipts: SavedReceipt[];
  selectedMonth: string;
  currencyCode: string;
  onSelectMonth?: (monthKey: string) => void;
}

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({
  receipts,
  selectedMonth,
  currencyCode,
  onSelectMonth,
}) => {
  const [viewMode, setViewMode] = useState<'total' | 'stacked'>('total');

  const trend = useMemo(
    () => calculateSixMonthSpendingTrend(receipts, selectedMonth),
    [receipts, selectedMonth]
  );

  const symbol = getCurrencySymbol(currencyCode);

  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            6-Month Spending Timeline
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            <span>6-month total: {formatMoney(trend.totalSixMonthSpend, currencyCode)}</span>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span>Monthly avg: {formatMoney(trend.averageMonthlySpend, currencyCode)}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('total')}
            className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              viewMode === 'total'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Total Spend
          </button>
          <button
            type="button"
            onClick={() => setViewMode('stacked')}
            className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              viewMode === 'stacked'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            By Category
          </button>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={trend.points}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            onClick={(state: any) => {
              const clickedKey = state?.activePayload?.[0]?.payload?.monthKey;
              if (clickedKey && onSelectMonth) {
                onSelectMonth(clickedKey);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
            <XAxis
              dataKey="shortLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={56}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(val) => `${symbol}${val}`}
            />
            <Tooltip
              formatter={(value: any, name: string) => [
                formatMoney(Number(value) || 0, currencyCode),
                name,
              ]}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            />
            {viewMode === 'total' ? (
              <Bar
                dataKey="totalSpend"
                name="Total Spend"
                fill="#059669"
                radius={[8, 8, 0, 0]}
                maxBarSize={48}
              />
            ) : (
              <>
                <Bar
                  dataKey="groceries"
                  name="Food & Groceries"
                  stackId="a"
                  fill="#059669"
                  maxBarSize={48}
                />
                <Bar
                  dataKey="utilities"
                  name="Electricity & Utilities"
                  stackId="a"
                  fill="#0284c7"
                  maxBarSize={48}
                />
                <Bar
                  dataKey="transport"
                  name="Transport"
                  stackId="a"
                  fill="#d97706"
                  maxBarSize={48}
                />
                <Bar
                  dataKey="home"
                  name="Home Maintenance"
                  stackId="a"
                  fill="#7c3aed"
                  maxBarSize={48}
                />
                <Bar
                  dataKey="other"
                  name="Other"
                  stackId="a"
                  fill="#64748b"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={48}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
